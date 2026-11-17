/**
 * A lista única de lançamentos: realizados e previstos juntos, com os mesmos
 * filtros em todas as telas (aba Lançamentos, detalhe da categoria, da fatura).
 */
import type { Category, Planned, Transaction } from "./types";
import { monthOf } from "./dates";
import { normalizeDescription } from "./dedup";

export type TxStatus = "a_pagar" | "a_receber" | "pago" | "recebido";

export interface TxRow {
  key: string;
  accountId: string;
  categoryId: string | null;
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  status: TxStatus;
  href?: string;
}

export interface TxFilters {
  /** Mês mostrado (AAAA-MM). Ignorado quando `statement` está definido. */
  month?: string;
  /** Conta ou cartão. */
  accountId?: string;
  /** Categoria; `null` = só os sem categoria. */
  categoryId?: string | null;
  /** Compras de uma fatura: cartão + mês da fatura, em qualquer data de compra. */
  statement?: { accountId: string; month: string };
  status?: "todos" | "previstos" | "realizados";
  query?: string;
  sort?: "data" | "valor";
}

export function buildTxRows(
  data: { transactions: Transaction[]; planned: Planned[]; categories: Category[] },
  filters: TxFilters,
): TxRow[] {
  const { month, accountId, categoryId, statement, status = "todos", query, sort = "data" } = filters;
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const byCategory = (id: string | null) => categoryId === undefined || id === categoryId;

  const real: TxRow[] = data.transactions
    .filter((tx) => !tx.isCardPayment)
    .filter((tx) =>
      statement
        ? tx.accountId === statement.accountId && tx.statementMonth === statement.month
        : (!month || monthOf(tx.date) === month) && (!accountId || tx.accountId === accountId),
    )
    .filter((tx) => byCategory(tx.categoryId))
    .map((tx) => ({
      key: tx.id,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      date: tx.date,
      title: tx.description,
      subtitle: `${catName(tx.categoryId)}${tx.source === "apple_pay" ? " · Apple Pay" : ""}`,
      amount: tx.amount,
      status: tx.amount > 0 ? "recebido" : "pago",
      href: `/lancamento?id=${tx.id}`,
    }));

  // Previstos não fazem parte das compras de uma fatura.
  const planned: TxRow[] = statement
    ? []
    : data.planned
        .filter((p) => p.status !== "paid" && (!month || monthOf(p.dueDate) === month))
        .filter((p) => !accountId || (p.creditCardStatement?.accountId ?? p.accountId) === accountId)
        // Fatura não tem categoria: some quando o filtro é por categoria.
        .filter((p) => (p.creditCardStatement ? categoryId === undefined : byCategory(p.categoryId)))
        .map((p) => ({
          key: p.id,
          accountId: p.creditCardStatement?.accountId ?? p.accountId,
          categoryId: p.categoryId,
          date: p.dueDate,
          title: p.description,
          subtitle: p.creditCardStatement ? "Ver as compras desta fatura ›" : catName(p.categoryId),
          amount: p.amount,
          status: p.amount > 0 ? "a_receber" : "a_pagar",
          href: p.creditCardStatement ? `/fatura/${p.id}` : `/previsto?id=${p.id}`,
        }));

  let rows = status === "previstos" ? planned : status === "realizados" ? real : [...planned, ...real];
  const q = normalizeDescription(query ?? "");
  if (q) rows = rows.filter((r) => normalizeDescription(`${r.title} ${r.subtitle}`).includes(q));
  return rows.sort((a, b) =>
    sort === "valor" ? Math.abs(b.amount) - Math.abs(a.amount) || b.date.localeCompare(a.date) : b.date.localeCompare(a.date),
  );
}

/** Soma do que a lista mostra: saídas e entradas separadas. */
export function totals(rows: TxRow[]): { out: number; in: number } {
  return rows.reduce((a, r) => (r.amount < 0 ? { ...a, out: a.out - r.amount } : { ...a, in: a.in + r.amount }), { out: 0, in: 0 });
}
