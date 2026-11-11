/**
 * Leitura e gravação no Supabase. Toda consulta é protegida por RLS:
 * o banco só devolve linhas do usuário logado.
 */
import { addMonths, monthOf } from "@/domain/dates";
import type { Account, Budget, Category, Transaction } from "@/domain/types";
import { rulePattern, type LearnedRule } from "@/import/categorize";
import type { ImportPlan } from "@/import/plan";
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

// ---------------------------------------------------------------- importação

export async function fetchClassificationRules(): Promise<LearnedRule[]> {
  const rows = check(
    await supabase.from("classification_rules").select("pattern, category_id"),
    "ler regras de categoria",
  ) as { pattern: string; category_id: string }[];
  return rows.map((r) => ({ pattern: r.pattern, categoryId: r.category_id }));
}

/** Quais dessas chaves já foram importadas antes (para não duplicar). */
export async function fetchImportedKeys(keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  // Lotes pequenos: as chaves vão na URL da consulta.
  for (let i = 0; i < keys.length; i += 80) {
    const chunk = keys.slice(i, i + 80);
    const rows = check(
      await supabase.from("transactions").select("external_id").eq("source", "import").in("external_id", chunk),
      "verificar lançamentos já importados",
    ) as { external_id: string }[];
    for (const r of rows) found.add(r.external_id);
  }
  return found;
}

export async function createAccount(
  a: { name: string; kind: Account["kind"]; closingDay?: number; dueDay?: number; last4?: string },
  userId: string,
): Promise<Account> {
  const row = check(
    await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        name: a.name,
        kind: a.kind,
        balance_cents: 0,
        closing_day: a.closingDay ?? null,
        due_day: a.dueDay ?? null,
        last4: a.last4 ?? null,
      })
      .select("*")
      .single(),
    "criar a conta",
  ) as AccountRow;
  return accountFromRow(row);
}

/**
 * Grava a importação: lote, lançamentos novos (sem duplicar), saldo da conta
 * (extrato) e a fatura prevista (cartão com vencimento futuro).
 */
export async function saveImport(args: {
  userId: string;
  account: Account;
  payFromAccountId: string | null;
  fileName: string;
  plan: ImportPlan;
  today: string;
}): Promise<{ inserted: number; plannedId: string | null }> {
  const { userId, account, payFromAccountId, fileName, plan, today } = args;
  const st = plan.statement;

  const batch = check(
    await supabase.from("import_batches").insert({ user_id: userId, source: "file", file_name: fileName }).select("id").single(),
    "registrar a importação",
  ) as { id: string };

  const rows = plan.newRows.map((r) => ({
    ...transactionToRow(
      {
        accountId: account.id,
        date: r.item.date,
        description: r.item.description,
        amount: r.item.amount,
        categoryId: r.categoryId,
        source: "import",
        statementMonth: st.kind === "credit_card" ? st.statementMonth : undefined,
        isCardPayment: r.item.internal,
        installment: r.item.installment,
      },
      userId,
    ),
    import_batch_id: batch.id,
    external_id: r.key,
    category_source: r.categoryId ? (r.categorySource === "rule" ? "rule" : "ai") : null,
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = check(
      await supabase
        .from("transactions")
        .upsert(chunk, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
        .select("id"),
      "gravar os lançamentos",
    ) as { id: string }[];
    inserted += res.length;
  }

  // Extrato da conta: o saldo final passa a ser o saldo da conta, se for mais recente.
  if (st.kind === "checking" && st.closingBalance && Date.parse(st.closingBalance.asOf) > Date.parse(account.balanceUpdatedAt)) {
    check(
      await supabase
        .from("accounts")
        .update({ balance_cents: st.closingBalance.amount, balance_updated_at: st.closingBalance.asOf })
        .eq("id", account.id),
      "atualizar o saldo",
    );
  }

  // Fatura que ainda vai vencer: vira (ou atualiza) um previsto para o saldo projetado.
  let plannedId: string | null = null;
  if (st.kind === "credit_card" && st.dueDate && st.statementMonth && st.dueDate >= today) {
    const amount = -(st.declaredTotal ?? plan.spending);
    const existing = check(
      await supabase
        .from("planned")
        .select("id")
        .eq("statement_account_id", account.id)
        .eq("statement_month", `${st.statementMonth}-01`)
        .neq("status", "cancelled")
        .limit(1),
      "procurar a fatura prevista",
    ) as { id: string }[];
    if (existing[0]) {
      plannedId = existing[0].id;
      check(
        await supabase
          .from("planned")
          .update({ amount_cents: amount, amount_is_estimate: st.declaredTotal === undefined, due_date: st.dueDate })
          .eq("id", plannedId),
        "atualizar a fatura prevista",
      );
    } else {
      const created = check(
        await supabase
          .from("planned")
          .insert({
            user_id: userId,
            account_id: payFromAccountId ?? account.id,
            due_date: st.dueDate,
            description: `Fatura ${account.name}`,
            amount_cents: amount,
            amount_is_estimate: st.declaredTotal === undefined,
            statement_account_id: account.id,
            statement_month: `${st.statementMonth}-01`,
          })
          .select("id")
          .single(),
        "criar a fatura prevista",
      ) as { id: string };
      plannedId = created.id;
    }
  }

  return { inserted, plannedId };
}

/** Guarda "esta loja é desta categoria" para as próximas importações. */
export async function learnRule(description: string, categoryId: string, userId: string) {
  const pattern = rulePattern(description);
  if (pattern.length < 3) return;
  check(
    await supabase
      .from("classification_rules")
      .upsert({ user_id: userId, pattern, category_id: categoryId }, { onConflict: "user_id,pattern" }),
    "salvar a regra de categoria",
  );
}

export async function setCategoryForMany(ids: string[], categoryId: string) {
  if (ids.length === 0) return;
  check(
    await supabase.from("transactions").update({ category_id: categoryId, category_source: "rule" }).in("id", ids),
    "aplicar a categoria às compras parecidas",
  );
}

// ---------------------------------------------------------------- categorias

function categoryError(e: { message: string; code?: string } | null, what: string) {
  if (!e) return;
  if (e.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
  throw new Error(`Falha ao ${what}: ${e.message}`);
}

export async function createCategory(c: { name: string; kind: Category["kind"]; color: string }, userId: string): Promise<Category> {
  const res = await supabase.from("categories").insert({ user_id: userId, ...c }).select("*").single();
  categoryError(res.error, "criar a categoria");
  return categoryFromRow(res.data as CategoryRow);
}

export async function updateCategory(id: string, patch: { name?: string; kind?: Category["kind"] }) {
  const res = await supabase.from("categories").update(patch).eq("id", id);
  categoryError(res.error, "salvar a categoria");
}

/** Arquivar: some das telas e das sugestões; os lançamentos continuam, sem categoria. */
export async function archiveCategory(id: string) {
  check(await supabase.from("transactions").update({ category_id: null }).eq("category_id", id), "liberar os lançamentos");
  check(await supabase.from("categories").update({ archived: true }).eq("id", id), "arquivar a categoria");
}

/** Marca como transferência interna (não conta como despesa nem renda). */
export async function markInternal(ids: string[]) {
  if (ids.length === 0) return;
  check(await supabase.from("transactions").update({ is_card_payment: true, category_id: null }).in("id", ids), "marcar como transferência");
}
