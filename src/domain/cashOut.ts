/**
 * "Quanto ainda sai da conta até o fim do mês", aberto por categoria.
 *
 * É a visão de caixa, diferente da visão de competência usada no resto do app:
 * - a fatura que vence neste mês sai da conta agora, mesmo sendo de compras do
 *   mês passado — e ela é distribuída pelas categorias dessas compras;
 * - as compras deste mês no cartão NÃO saem agora (vão na fatura do mês que vem).
 *
 * Por categoria mostramos três números: o orçamento do mês, o utilizado no mês
 * (competência, igual à tela de Orçamento) e o que ainda sai da conta até o fim.
 */
import type { Cents } from "./money";
import type { Account, Budget, Category, ISODate, Planned, Transaction } from "./types";
import { monthOf } from "./dates";
import { categorySpent } from "./budget";
import { fixedRemaining as fixedLeft } from "./reconcile";
import { liquidBalance } from "./projection";

export type CashOutItemKind = "fatura" | "fixa" | "prevista";

export interface CashOutItem {
  kind: CashOutItemKind;
  /** "Fatura Itaú", "Condomínio", descrição do previsto. */
  label: string;
  /** Vencimento, quando se sabe (contas fixas sem previsto não têm data). */
  dueDate?: ISODate;
  amount: Cents; // positivo = sai da conta
}

export interface CashOutRow {
  /** null = compras sem categoria dentro de faturas. */
  categoryId: string | null;
  budget: Cents;
  used: Cents;
  toLeave: Cents;
  items: CashOutItem[];
}

export interface CashOut {
  month: string;
  balanceToday: Cents;
  incomePending: Cents;
  toLeave: Cents;
  /** Saldo hoje + a receber − a sair. Não inclui gasto variável que ainda vai acontecer. */
  projectedBalance: Cents;
  rows: CashOutRow[];
  /** Parte das faturas que não vem de compras (saldo anterior, juros, encargos). */
  billsOther: Cents;
}

export function buildCashOut(params: {
  today: ISODate;
  accounts: Account[];
  transactions: Transaction[];
  planned: Planned[];
  budgets: Budget[];
  categories: Category[];
}): CashOut {
  const { today, accounts, transactions, planned, budgets, categories } = params;
  const month = monthOf(today);
  const inMonth = (d: ISODate) => monthOf(d) === month;
  const pending = planned.filter((p) => p.status !== "paid" && inMonth(p.dueDate));

  const rows = new Map<string | null, CashOutRow>();
  const row = (categoryId: string | null): CashOutRow => {
    let r = rows.get(categoryId);
    if (!r) {
      r = { categoryId, budget: 0, used: 0, toLeave: 0, items: [] };
      rows.set(categoryId, r);
    }
    return r;
  };
  const add = (categoryId: string | null, item: CashOutItem) => {
    if (item.amount <= 0) return;
    const r = row(categoryId);
    r.items.push(item);
    r.toLeave += item.amount;
  };

  // 1. Faturas que vencem neste mês e ainda não foram pagas, distribuídas pelas
  //    categorias das compras que as compõem.
  let billsOther = 0;
  const cardName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "cartão";
  for (const bill of pending.filter((p) => p.creditCardStatement && p.amount < 0)) {
    const { accountId, month: billMonth } = bill.creditCardStatement!;
    const purchases = transactions.filter(
      (t) => t.accountId === accountId && t.statementMonth === billMonth && !t.isCardPayment,
    );
    const byCategory = new Map<string | null, Cents>();
    for (const t of purchases) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) - t.amount);
    const label = `Fatura ${cardName(accountId)}`;
    let composed = 0;
    for (const [categoryId, amount] of byCategory) {
      if (amount <= 0) continue; // categoria só com estornos: não vira saída
      add(categoryId, { kind: "fatura", label, dueDate: bill.dueDate, amount });
      composed += amount;
    }
    // O que a fatura cobra além das compras (saldo anterior, juros) também sai.
    billsOther += Math.max(-bill.amount - composed, 0);
  }

  // 2. Contas a pagar previstas (avulsas ou mensais) do mês.
  for (const p of pending.filter((p) => !p.creditCardStatement && p.amount < 0)) {
    add(p.categoryId, { kind: "prevista", label: p.description, dueDate: p.dueDate, amount: -p.amount });
  }

  // 3. Contas fixas com valor previsto que ainda não foram pagas nem estão previstas.
  for (const c of categories.filter((c) => c.kind === "fixed")) {
    const expected = budgets.find((b) => b.categoryId === c.id && b.month === month)?.limit ?? 0;
    const spent = categorySpent(transactions, c.id, month);
    const alreadyPlanned = pending
      .filter((p) => p.categoryId === c.id && p.amount < 0 && !p.creditCardStatement)
      .reduce((a, p) => a - p.amount, 0);
    add(c.id, { kind: "fixa", label: c.name, amount: fixedLeft(expected, spent, alreadyPlanned) });
  }

  // Orçamento e utilizado: toda categoria de gasto com limite ou com gasto no mês aparece.
  for (const c of categories.filter((c) => c.kind !== "income")) {
    const budget = budgets.find((b) => b.categoryId === c.id && b.month === month)?.limit ?? 0;
    const used = categorySpent(transactions, c.id, month);
    if (budget === 0 && used === 0 && !rows.has(c.id)) continue;
    const r = row(c.id);
    r.budget = budget;
    r.used = used;
  }

  for (const r of rows.values()) r.items.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  const list = [...rows.values()];
  const toLeave = list.reduce((a, r) => a + r.toLeave, 0) + billsOther;
  const incomePending = pending.filter((p) => p.amount > 0).reduce((a, p) => a + p.amount, 0);
  const balanceToday = liquidBalance(accounts);

  return {
    month,
    balanceToday,
    incomePending,
    toLeave,
    projectedBalance: balanceToday + incomePending - toLeave,
    rows: list,
    billsOther,
  };
}
