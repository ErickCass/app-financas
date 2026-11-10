/**
 * Leitura e gravação no Supabase. Toda consulta é protegida por RLS:
 * o banco só devolve linhas do usuário logado.
 */
import { addMonths, monthOf } from "@/domain/dates";
import type { Budget, Transaction } from "@/domain/types";
import { buildHistory } from "@/domain/history";
import {
  DEFAULT_CATEGORIES,
  accountFromRow,
  budgetFromRow,
  budgetToRow,
  categoryFromRow,
  plannedFromRow,
  transactionFromRow,
  transactionToRow,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type PlannedRow,
  type TransactionRow,
} from "./mappers";
import type { FinanceData } from "./store";
import { supabase } from "./supabase";

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Falha ao ${what}: ${res.error.message}`);
  return res.data as T;
}

export async function loadFinanceData(today: string): Promise<Omit<FinanceData, "today">> {
  const month = monthOf(today);
  const since = `${addMonths(month, -3)}-01`;

  const [accounts, categories, budgets, transactions, planned, rules] = await Promise.all([
    supabase.from("accounts").select("*").eq("archived", false).order("created_at"),
    supabase.from("categories").select("*").eq("archived", false).order("created_at"),
    supabase.from("budgets").select("category_id, month, limit_cents").gte("month", `${month}-01`).lte("month", `${month}-01`),
    supabase.from("transactions").select("*").gte("date", since).order("date", { ascending: false }),
    supabase.from("planned").select("*").gte("due_date", `${month}-01`).order("due_date"),
    supabase.from("recurring_rules").select("amount_cents, ends_on"),
  ]);

  const tx = check(transactions, "ler transações") as TransactionRow[];
  const allTx = tx.map(transactionFromRow);
  const accountsData = (check(accounts, "ler contas") as AccountRow[]).map(accountFromRow);
  const latestUpdate = accountsData.map((a) => a.balanceUpdatedAt).sort().at(-1) ?? new Date().toISOString();

  return {
    balanceUpdatedAt: latestUpdate,
    accounts: accountsData,
    categories: (check(categories, "ler categorias") as CategoryRow[]).map(categoryFromRow),
    budgets: (check(budgets, "ler limites") as BudgetRow[]).map(budgetFromRow),
    transactions: allTx,
    planned: (check(planned, "ler previstos") as PlannedRow[]).map(plannedFromRow).filter((p) => p !== null),
    history: buildHistory(allTx, today),
    recurringMonthly: (check(rules, "ler recorrências") as { amount_cents: number; ends_on: string | null }[])
      .filter((r) => !r.ends_on || r.ends_on >= today)
      .map((r) => ({ amount: Number(r.amount_cents) })),
  };
}

/** Primeiro acesso: cria as categorias sugeridas e uma conta corrente. */
export async function seedIfEmpty(userId: string): Promise<boolean> {
  const { count, error } = await supabase.from("categories").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Falha ao verificar categorias: ${error.message}`);
  if ((count ?? 0) > 0) return false;
  check(
    await supabase.from("categories").insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }))),
    "criar categorias",
  );
  check(
    await supabase.from("accounts").insert({ user_id: userId, name: "Conta corrente", kind: "checking", balance_cents: 0 }),
    "criar conta",
  );
  check(await supabase.from("alert_settings").insert({ user_id: userId }), "criar alertas");
  return true;
}

export async function updateTransactionCategory(transactionId: string, categoryId: string) {
  check(
    await supabase.from("transactions").update({ category_id: categoryId, category_source: "user" }).eq("id", transactionId),
    "mudar a categoria",
  );
}

export async function upsertBudget(b: Budget, userId: string) {
  check(
    await supabase.from("budgets").upsert(budgetToRow(b, userId), { onConflict: "user_id,category_id,month" }),
    "salvar o limite",
  );
}

export async function insertTransaction(t: Omit<Transaction, "id">, userId: string): Promise<Transaction> {
  const row = check(
    await supabase.from("transactions").insert(transactionToRow(t, userId)).select("*").single(),
    "salvar o lançamento",
  ) as TransactionRow;
  return transactionFromRow(row);
}

export async function updateAccountBalance(accountId: string, balance: number) {
  check(
    await supabase
      .from("accounts")
      .update({ balance_cents: balance, balance_updated_at: new Date().toISOString() })
      .eq("id", accountId),
    "atualizar o saldo",
  );
}
