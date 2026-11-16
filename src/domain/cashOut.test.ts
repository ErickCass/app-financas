import { describe, expect, it } from "vitest";
import { buildCashOut } from "./cashOut";
import type { Account, Budget, Category, Planned, Transaction } from "./types";

const accounts: Account[] = [
  { id: "cc", name: "Conta", kind: "checking", balance: 1_000_000, balanceUpdatedAt: "2026-11-16T00:00:00Z" },
  { id: "visa", name: "Visa", kind: "credit_card", balance: 0, balanceUpdatedAt: "2026-11-16T00:00:00Z" },
];
const categories: Category[] = [
  { id: "merc", name: "Mercado", kind: "variable", color: "#000" },
  { id: "rest", name: "Restaurantes", kind: "variable", color: "#000" },
  { id: "cond", name: "Condomínio", kind: "fixed", color: "#000" },
  { id: "esc", name: "Escola", kind: "fixed", color: "#000" },
  { id: "renda", name: "Renda", kind: "income", color: "#000" },
];
const budgets: Budget[] = [
  { categoryId: "merc", month: "2026-11", limit: 150_000 },
  { categoryId: "cond", month: "2026-11", limit: 120_000 },
  { categoryId: "esc", month: "2026-11", limit: 192_000 },
];
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  accountId: "cc",
  date: "2026-11-05",
  description: "x",
  amount: -1000,
  categoryId: null,
  source: "import",
  ...p,
});

// Fatura do Visa que vence em 10/nov, com as compras de outubro.
const bill: Planned = {
  id: "fat",
  accountId: "cc",
  dueDate: "2026-11-10",
  description: "Fatura Visa",
  amount: -95_000,
  categoryId: null,
  status: "pending",
  creditCardStatement: { accountId: "visa", month: "2026-11" },
};

const base = {
  today: "2026-11-16",
  accounts,
  budgets,
  categories,
};

describe("o que ainda sai da conta até o fim do mês", () => {
  const transactions = [
    // Compras de outubro, na fatura de novembro
    tx({ accountId: "visa", date: "2026-10-12", amount: -60_000, categoryId: "merc", statementMonth: "2026-11" }),
    tx({ accountId: "visa", date: "2026-10-20", amount: -30_000, categoryId: "rest", statementMonth: "2026-11" }),
    // Compra de novembro no cartão: vai na fatura de dezembro, não sai agora
    tx({ accountId: "visa", date: "2026-11-14", amount: -40_000, categoryId: "merc", statementMonth: "2026-12" }),
    // Escola já paga na conta
    tx({ date: "2026-11-05", amount: -192_000, categoryId: "esc" }),
  ];
  const out = buildCashOut({ ...base, transactions, planned: [bill] });
  const row = (id: string | null) => out.rows.find((r) => r.categoryId === id);

  it("distribui a fatura que vence no mês pelas categorias das compras", () => {
    expect(row("merc")?.items).toEqual([{ kind: "fatura", label: "Fatura Visa", dueDate: "2026-11-10", amount: 60_000 }]);
    expect(row("rest")?.toLeave).toBe(30_000);
  });

  it("não tira da conta agora as compras deste mês no cartão", () => {
    expect(row("merc")?.toLeave).toBe(60_000);
  });

  it("mostra o utilizado no mês, incluindo o cartão (competência)", () => {
    expect(row("merc")?.used).toBe(40_000);
    expect(row("merc")?.budget).toBe(150_000);
  });

  it("o que a fatura cobra além das compras também sai", () => {
    expect(out.billsOther).toBe(5_000);
  });

  it("conta fixa ainda não paga sai pelo valor previsto; a paga não sai", () => {
    expect(row("cond")?.items).toEqual([{ kind: "fixa", label: "Condomínio", amount: 120_000 }]);
    expect(row("esc")?.toLeave).toBe(0);
  });

  it("fecha a conta: saldo hoje + a receber − a sair", () => {
    expect(out.toLeave).toBe(60_000 + 30_000 + 5_000 + 120_000);
    expect(out.projectedBalance).toBe(1_000_000 - out.toLeave);
  });

  it("renda não aparece como categoria de gasto", () => {
    expect(row("renda")).toBeUndefined();
  });
});

describe("previstos e faturas pagas", () => {
  it("conta a pagar prevista sai na data, e não duplica a conta fixa", () => {
    const planned: Planned[] = [
      { id: "p", accountId: "cc", dueDate: "2026-11-20", description: "Condomínio nov", amount: -118_000, categoryId: "cond", status: "pending" },
      { id: "r", accountId: "cc", dueDate: "2026-11-25", description: "Salário", amount: 500_000, categoryId: "renda", status: "pending" },
    ];
    const out = buildCashOut({ ...base, transactions: [], planned });
    const cond = out.rows.find((r) => r.categoryId === "cond");
    // Previsto R$ 1.180 de R$ 1.200 esperados: a diferença está dentro da tolerância de conta aproximada.
    expect(cond?.items.map((i) => i.kind)).toEqual(["prevista"]);
    expect(cond?.toLeave).toBe(118_000);
    expect(out.incomePending).toBe(500_000);
  });

  it("fatura já paga não sai de novo", () => {
    const out = buildCashOut({ ...base, transactions: [], planned: [{ ...bill, status: "paid" }] });
    expect(out.rows.every((r) => r.items.every((i) => i.kind !== "fatura"))).toBe(true);
    expect(out.billsOther).toBe(0);
  });

  it("compras sem categoria na fatura aparecem num grupo próprio", () => {
    const transactions = [tx({ accountId: "visa", date: "2026-10-12", amount: -95_000, categoryId: null, statementMonth: "2026-11" })];
    const out = buildCashOut({ ...base, transactions, planned: [bill] });
    expect(out.rows.find((r) => r.categoryId === null)?.toLeave).toBe(95_000);
  });
});
