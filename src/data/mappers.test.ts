import { describe, expect, it } from "vitest";
import { budgetFromRow, budgetToRow, cents, plannedFromRow, transactionFromRow, transactionPatchToRow, transactionToRow } from "./mappers";
import { buildHistory } from "@/domain/history";
import type { Transaction } from "@/domain/types";

describe("conversão banco ↔ app", () => {
  it("bigint que chega como texto vira inteiro", () => {
    expect(cents("123456")).toBe(123456);
    expect(() => cents("12.5")).toThrow();
  });
  it("limite mensal usa o primeiro dia do mês no banco", () => {
    expect(budgetToRow({ categoryId: "c", month: "2026-11", limit: 100_000 }, "u")).toEqual({
      user_id: "u",
      category_id: "c",
      month: "2026-11-01",
      limit_cents: 100_000,
    });
    expect(budgetFromRow({ category_id: "c", month: "2026-11-01", limit_cents: "100000" })).toEqual({
      categoryId: "c",
      month: "2026-11",
      limit: 100_000,
    });
  });
  it("transação vai e volta sem perder informação", () => {
    const t: Omit<Transaction, "id"> = {
      accountId: "a",
      date: "2026-11-09",
      description: "Posto Petrobrás",
      amount: -8_610,
      categoryId: "transporte",
      source: "apple_pay",
      statementMonth: "2026-12",
    };
    const row = transactionToRow(t, "u");
    expect(row.statement_month).toBe("2026-12-01");
    const back = transactionFromRow({ ...row, id: "x", planned_id: null } as never);
    expect(back).toEqual({ ...t, id: "x", plannedId: undefined, isCardPayment: undefined });
  });
  it("previsto cancelado some; fatura vira composição de cartão", () => {
    const base = {
      id: "p",
      account_id: "itau",
      category_id: null,
      due_date: "2026-11-12",
      description: "Fatura",
      amount_cents: -231_044,
      amount_is_estimate: false,
      statement_account_id: "visa",
      statement_month: "2026-11-01",
    };
    expect(plannedFromRow({ ...base, status: "cancelled" })).toBeNull();
    expect(plannedFromRow({ ...base, status: "pending" })?.creditCardStatement).toEqual({ accountId: "visa", month: "2026-11" });
  });
});

describe("histórico das categorias", () => {
  const tx = (date: string, amount: number, categoryId = "mercado"): Transaction => ({
    id: date + amount,
    accountId: "a",
    date,
    description: "x",
    amount,
    categoryId,
    source: "import",
  });

  it("média mensal e curva acumulada dos meses anteriores", () => {
    const h = buildHistory(
      [
        tx("2026-10-01", -10_000),
        tx("2026-10-20", -30_000),
        tx("2026-09-15", -20_000),
        tx("2026-11-02", -99_000), // mês atual: não entra
        tx("2026-10-05", 5_000), // estorno: não entra
        tx("2026-09-01", -1_000, "outra"), // dados importados desde o início de setembro
      ],
      "2026-11-09",
    );
    const m = h.find((x) => x.categoryId === "mercado")!;
    expect(m.monthlyAverage).toBe(30_000); // (40.000 + 20.000) / 2 meses
    // dia 1: outubro tinha 25%, setembro 0% -> média 12,5%
    expect(m.cumulativeShare[0]).toBeCloseTo(0.125);
    // dia 31: 100% nos dois meses
    expect(m.cumulativeShare[30]).toBeCloseTo(1);
  });
  it("ignora o mês coberto pela metade (só os últimos dias vieram numa fatura)", () => {
    // Dados começam em 28/set: setembro está incompleto; só outubro e agosto não existem.
    const h = buildHistory(
      [tx("2026-09-28", -50_000), tx("2026-10-05", -20_000), tx("2026-10-25", -20_000)],
      "2026-11-17",
    );
    // Só um mês completo (outubro): ainda não há histórico; o app usa o calendário.
    expect(h.find((x) => x.categoryId === "mercado")).toBeUndefined();
  });

  it("com dois meses completos, a curva volta a valer", () => {
    const h = buildHistory(
      [tx("2026-09-02", -20_000), tx("2026-09-25", -20_000), tx("2026-10-05", -20_000), tx("2026-10-25", -20_000)],
      "2026-11-17",
    );
    const m = h.find((x) => x.categoryId === "mercado")!;
    expect(m.monthlyAverage).toBe(40_000);
    expect(m.cumulativeShare[14]).toBeCloseTo(0.5); // dia 15: metade, nos dois meses
  });

  it("assinatura cobrada no dia 1 tem curva cheia desde o início", () => {
    const h = buildHistory([tx("2026-10-01", -5_000, "assin"), tx("2026-09-01", -5_000, "assin")], "2026-11-09");
    expect(h[0]!.cumulativeShare[0]).toBe(1);
  });
});

describe("campos de edição de um lançamento", () => {
  it("traduz para os nomes das colunas e ignora o que não mudou", () => {
    expect(transactionPatchToRow({ description: "Salário", amount: -1234, date: "2026-11-15" })).toEqual({
      description: "Salário",
      amount_cents: -1234,
      date: "2026-11-15",
    });
    expect(transactionPatchToRow({ categoryId: null })).toEqual({ category_id: null });
    expect(transactionPatchToRow({})).toEqual({});
  });
});
