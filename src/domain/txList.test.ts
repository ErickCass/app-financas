import { describe, expect, it } from "vitest";
import { buildTxRows, totals } from "./txList";
import type { Category, Planned, Transaction } from "./types";

const categories: Category[] = [
  { id: "merc", name: "Mercado", kind: "variable", color: "#000" },
  { id: "cond", name: "Condomínio", kind: "fixed", color: "#000" },
];
const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  accountId: "cc",
  date: "2026-11-05",
  description: "x",
  amount: -1000,
  categoryId: null,
  source: "import",
  ...p,
});
const transactions = [
  tx({ id: "a", accountId: "visa", date: "2026-10-20", amount: -6000, categoryId: "merc", statementMonth: "2026-11", description: "Pão de Açúcar" }),
  tx({ id: "b", accountId: "visa", date: "2026-11-14", amount: -4000, categoryId: "merc", statementMonth: "2026-12" }),
  tx({ id: "c", accountId: "cc", date: "2026-11-03", amount: -1500, categoryId: null }),
  tx({ id: "d", accountId: "cc", date: "2026-11-05", amount: 500000, categoryId: null, description: "Salário" }),
  tx({ id: "e", accountId: "cc", date: "2026-11-06", amount: -6000, isCardPayment: true }),
];
const planned: Planned[] = [
  { id: "fat", accountId: "cc", dueDate: "2026-11-10", description: "Fatura Visa", amount: -6000, categoryId: null, status: "pending", creditCardStatement: { accountId: "visa", month: "2026-11" } },
  { id: "p", accountId: "cc", dueDate: "2026-11-20", description: "Condomínio", amount: -120000, categoryId: "cond", status: "pending" },
];
const data = { transactions, planned, categories };
const keys = (r: { key: string }[]) => r.map((x) => x.key).sort();

describe("lista única de lançamentos", () => {
  it("mês: realizados e previstos juntos, sem pagamento de fatura", () => {
    expect(keys(buildTxRows(data, { month: "2026-11" }))).toEqual(["b", "c", "d", "fat", "p"]);
  });

  it("por cartão: compras dele e a fatura dele", () => {
    expect(keys(buildTxRows(data, { month: "2026-11", accountId: "visa" }))).toEqual(["b", "fat"]);
  });

  it("por categoria: lançamentos e previstos dela, sem faturas", () => {
    expect(keys(buildTxRows(data, { month: "2026-11", categoryId: "cond" }))).toEqual(["p"]);
    expect(keys(buildTxRows(data, { month: "2026-11", categoryId: null }))).toEqual(["c", "d"]);
  });

  it("fatura: as compras dela, de qualquer data, sem previstos", () => {
    expect(keys(buildTxRows(data, { month: "2026-11", statement: { accountId: "visa", month: "2026-11" } }))).toEqual(["a"]);
  });

  it("status e busca sem acento", () => {
    expect(keys(buildTxRows(data, { month: "2026-11", status: "previstos" }))).toEqual(["fat", "p"]);
    expect(keys(buildTxRows(data, { statement: { accountId: "visa", month: "2026-11" }, query: "acucar" }))).toEqual(["a"]);
  });

  it("ordena por valor, do maior para o menor", () => {
    expect(buildTxRows(data, { month: "2026-11", sort: "valor" })[0]?.key).toBe("d");
  });

  it("soma saídas e entradas do que está na lista", () => {
    expect(totals(buildTxRows(data, { month: "2026-11", accountId: "cc" }))).toEqual({ out: 1500 + 120000, in: 500000 });
  });
});
