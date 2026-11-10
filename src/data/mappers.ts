/**
 * Conversão entre as linhas do banco (snake_case, datas do Postgres)
 * e os tipos do domínio. Funções puras, cobertas por testes.
 */
import type { Account, AccountKind, Budget, Category, Planned, Transaction, TransactionSource } from "@/domain/types";

export interface AccountRow {
  id: string;
  name: string;
  kind: AccountKind;
  balance_cents: number | string;
  balance_updated_at: string;
  closing_day: number | null;
  due_day: number | null;
  archived?: boolean;
}
export interface CategoryRow {
  id: string;
  name: string;
  kind: Category["kind"];
  color: string;
  archived?: boolean;
}
export interface BudgetRow {
  category_id: string;
  month: string; // AAAA-MM-01
  limit_cents: number | string;
}
export interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  planned_id: string | null;
  date: string;
  description: string;
  amount_cents: number | string;
  source: TransactionSource;
  is_card_payment: boolean;
  statement_month: string | null;
}
export interface PlannedRow {
  id: string;
  account_id: string;
  category_id: string | null;
  due_date: string;
  description: string;
  amount_cents: number | string;
  amount_is_estimate: boolean;
  status: "pending" | "paid" | "cancelled";
  statement_account_id: string | null;
  statement_month: string | null;
}

/** bigint do Postgres pode chegar como string; dinheiro precisa ser inteiro. */
export function cents(v: number | string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isSafeInteger(n)) throw new Error(`Valor monetário inválido vindo do banco: ${v}`);
  return n;
}

export const accountFromRow = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  balance: cents(r.balance_cents),
  balanceUpdatedAt: r.balance_updated_at,
  closingDay: r.closing_day ?? undefined,
  dueDay: r.due_day ?? undefined,
});

export const categoryFromRow = (r: CategoryRow): Category => ({ id: r.id, name: r.name, kind: r.kind, color: r.color });

export const budgetFromRow = (r: BudgetRow): Budget => ({
  categoryId: r.category_id,
  month: r.month.slice(0, 7),
  limit: cents(r.limit_cents),
});

export const budgetToRow = (b: Budget, userId: string) => ({
  user_id: userId,
  category_id: b.categoryId,
  month: `${b.month}-01`,
  limit_cents: b.limit,
});

export const transactionFromRow = (r: TransactionRow): Transaction => ({
  id: r.id,
  accountId: r.account_id,
  date: r.date,
  description: r.description,
  amount: cents(r.amount_cents),
  categoryId: r.category_id,
  source: r.source,
  statementMonth: r.statement_month ? r.statement_month.slice(0, 7) : undefined,
  plannedId: r.planned_id ?? undefined,
  isCardPayment: r.is_card_payment || undefined,
});

export const transactionToRow = (t: Omit<Transaction, "id">, userId: string) => ({
  user_id: userId,
  account_id: t.accountId,
  category_id: t.categoryId,
  planned_id: t.plannedId ?? null,
  date: t.date,
  description: t.description,
  amount_cents: t.amount,
  source: t.source,
  is_card_payment: Boolean(t.isCardPayment),
  statement_month: t.statementMonth ? `${t.statementMonth}-01` : null,
});

export const plannedFromRow = (r: PlannedRow): Planned | null => {
  if (r.status === "cancelled") return null;
  return {
    id: r.id,
    accountId: r.account_id,
    dueDate: r.due_date,
    description: r.description,
    amount: cents(r.amount_cents),
    categoryId: r.category_id,
    status: r.status,
    estimated: r.amount_is_estimate || undefined,
    creditCardStatement:
      r.statement_account_id && r.statement_month
        ? { accountId: r.statement_account_id, month: r.statement_month.slice(0, 7) }
        : undefined,
  };
};

/** Categorias criadas no primeiro acesso. O usuário renomeia, apaga ou cria outras depois. */
export const DEFAULT_CATEGORIES: { name: string; kind: Category["kind"]; color: string }[] = [
  { name: "Mercado", kind: "variable", color: "#0E4A5C" },
  { name: "Restaurantes", kind: "variable", color: "#C2410C" },
  { name: "Transporte", kind: "variable", color: "#E7A36B" },
  { name: "Compras", kind: "variable", color: "#4D8A9A" },
  { name: "Lazer", kind: "variable", color: "#C98BB9" },
  { name: "Assinaturas", kind: "variable", color: "#8C8C94" },
  { name: "Casa e serviços", kind: "variable", color: "#7C6FB0" },
  { name: "Saúde", kind: "variable", color: "#2E9E5B" },
  { name: "Moradia", kind: "fixed", color: "#0E4A5C" },
  { name: "Educação", kind: "fixed", color: "#2F6FD6" },
  { name: "Renda", kind: "income", color: "#1E7A46" },
];
