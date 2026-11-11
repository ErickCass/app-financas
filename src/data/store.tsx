/**
 * Camada de dados do app.
 * - Logado: lê e grava no Supabase (com atualização otimista na tela).
 * - Demonstração: dados fictícios em memória, nada é gravado.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Account, Budget, Category, CategoryHistory, Planned, Transaction } from "@/domain/types";
import { todayISO } from "@/domain/dates";
import { rulePattern } from "@/import/categorize";
import type { ImportPlan } from "@/import/plan";
import { useAuth } from "./auth";
import * as demo from "./demo";
import * as remote from "./remote";

export interface FinanceData {
  today: string;
  balanceUpdatedAt: string;
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  planned: Planned[];
  history: CategoryHistory[];
  recurringMonthly: { amount: number }[];
}

interface FinanceActions {
  status: "loading" | "ready" | "error";
  error: string | null;
  isDemo: boolean;
  reload(): Promise<void>;
  setTransactionCategory(transactionId: string, categoryId: string): Promise<void>;
  setBudgetLimit(categoryId: string, month: string, limit: number): Promise<void>;
  addTransaction(t: Omit<Transaction, "id">): Promise<void>;
  setAccountBalance(accountId: string, balance: number): Promise<void>;
  setAccountColor(accountId: string, color: string): Promise<void>;
  /** Classifica um grupo de lançamentos de uma vez (e ensina a regra pela descrição). */
  categorizeMany(ids: string[], categoryId: string, learn?: boolean): Promise<void>;
  /** Marca lançamentos como transferência entre contas próprias (não contam no orçamento). */
  markInternal(ids: string[]): Promise<void>;
  /** Desfaz: os lançamentos voltam a ficar sem categoria; `forgetRule` apaga a regra aprendida. */
  clearClassification(ids: string[], forgetRule?: boolean): Promise<void>;
  /** Renda a receber ou conta a pagar (avulsa ou mensal). */
  addPlanned(p: remote.PlannedInput): Promise<void>;
  setPlannedStatus(id: string, status: "pending" | "paid"): Promise<void>;
  removePlanned(id: string, alsoRecurrence?: boolean): Promise<void>;
  createCategory(name: string, kind: Category["kind"]): Promise<void>;
  updateCategory(id: string, patch: { name?: string; kind?: Category["kind"] }): Promise<void>;
  archiveCategory(id: string): Promise<void>;
  /** Grava uma importação já revisada; cria a conta se `account` for "nova". */
  importStatement(args: {
    plan: ImportPlan;
    fileName: string;
    account: Account | { create: { name: string; kind: Account["kind"]; closingDay?: number; dueDay?: number; last4?: string } };
  }): Promise<{ inserted: number; plannedId: string | null; accountId: string }>;
}

const DEMO_DATA: FinanceData = {
  today: demo.DEMO_TODAY,
  balanceUpdatedAt: demo.DEMO_UPDATED_AT,
  accounts: demo.accounts,
  categories: demo.categories,
  budgets: demo.budgets,
  transactions: demo.transactions,
  planned: demo.planned,
  history: demo.history,
  recurringMonthly: demo.recurringMonthly,
};

const EMPTY: FinanceData = {
  today: todayISO(),
  balanceUpdatedAt: new Date().toISOString(),
  accounts: [],
  categories: [],
  budgets: [],
  transactions: [],
  planned: [],
  history: [],
  recurringMonthly: [],
};

/** Cores para categorias novas (as padrão já usam algumas). */
const CATEGORY_COLORS = ["#0E4A5C", "#C2410C", "#E7A36B", "#4D8A9A", "#C98BB9", "#8C8C94", "#7C6FB0", "#2E9E5B", "#2F6FD6", "#B45309", "#0F766E", "#9D174D", "#4338CA", "#65A30D"];

const Ctx = createContext<(FinanceData & FinanceActions) | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isDemo = auth.mode === "demo";
  const userId = auth.session?.user.id ?? null;
  const [data, setData] = useState<FinanceData>(isDemo ? DEMO_DATA : EMPTY);
  const [status, setStatus] = useState<FinanceActions["status"]>(isDemo ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo) {
      setData(DEMO_DATA);
      setStatus("ready");
      return;
    }
    if (!userId) return;
    setStatus("loading");
    setError(null);
    try {
      await remote.seedIfEmpty(userId);
      const today = todayISO();
      await remote.materializeRecurring(userId, today);
      const loaded = await remote.loadFinanceData(today);
      setData({ today, ...loaded });
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [isDemo, userId]);

  useEffect(() => {
    // Carregamento inicial dos dados (busca assíncrona); o setState síncrono é só o "carregando".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  /** Aplica a mudança na tela na hora; se o banco recusar, recarrega e mostra o erro. */
  const optimistic = useCallback(
    async (apply: (d: FinanceData) => FinanceData, persist: () => Promise<unknown>) => {
      setData(apply);
      if (isDemo) return;
      try {
        await persist();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await reload();
      }
    },
    [isDemo, reload],
  );

  const value = useMemo(
    () => ({
      ...data,
      status,
      error,
      isDemo,
      reload,
      setTransactionCategory: (transactionId: string, categoryId: string) => {
        // Aprende: compras da mesma loja ainda sem categoria recebem a mesma, e as próximas importações também.
        const tx = data.transactions.find((t) => t.id === transactionId);
        const pattern = tx ? rulePattern(tx.description) : "";
        const siblings =
          tx && pattern.length >= 3
            ? data.transactions.filter((t) => t.id !== tx.id && !t.categoryId && !t.isCardPayment && rulePattern(t.description) === pattern).map((t) => t.id)
            : [];
        const changed = new Set([transactionId, ...siblings]);
        return optimistic(
          (d) => ({ ...d, transactions: d.transactions.map((t) => (changed.has(t.id) ? { ...t, categoryId } : t)) }),
          async () => {
            await remote.updateTransactionCategory(transactionId, categoryId);
            await remote.setCategoryForMany(siblings, categoryId);
            if (tx) await remote.learnRule(tx.description, categoryId, userId!);
          },
        );
      },
      setAccountColor: async (accountId: string, color: string) => {
        if (!isDemo) await remote.updateAccount(accountId, { color });
        setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, color } : a)) }));
      },
      categorizeMany: (ids: string[], categoryId: string, learn = true) => {
        const set = new Set(ids);
        const first = data.transactions.find((t) => set.has(t.id));
        return optimistic(
          (d) => ({ ...d, transactions: d.transactions.map((t) => (set.has(t.id) ? { ...t, categoryId } : t)) }),
          async () => {
            await remote.setCategoryForMany(ids, categoryId);
            if (first && learn) await remote.learnRule(first.description, categoryId, userId!);
          },
        );
      },
      markInternal: (ids: string[]) => {
        const set = new Set(ids);
        return optimistic(
          (d) => ({ ...d, transactions: d.transactions.map((t) => (set.has(t.id) ? { ...t, isCardPayment: true, categoryId: null } : t)) }),
          () => remote.markInternal(ids),
        );
      },
      clearClassification: (ids: string[], forgetRule = false) => {
        const set = new Set(ids);
        const first = data.transactions.find((t) => set.has(t.id));
        return optimistic(
          (d) => ({ ...d, transactions: d.transactions.map((t) => (set.has(t.id) ? { ...t, categoryId: null, isCardPayment: undefined } : t)) }),
          async () => {
            await remote.clearClassification(ids);
            if (first && forgetRule) await remote.forgetRule(first.description);
          },
        );
      },
      addPlanned: async (p: remote.PlannedInput) => {
        if (isDemo) {
          setData((d) => ({
            ...d,
            planned: [...d.planned, { id: `demo-p-${Date.now()}`, accountId: p.accountId, dueDate: p.dueDate, description: p.description, amount: p.amount, categoryId: p.categoryId, status: "pending" as const, estimated: p.estimated || undefined }],
            recurringMonthly: p.monthly ? [...d.recurringMonthly, { amount: p.amount }] : d.recurringMonthly,
          }));
          return;
        }
        await remote.createPlanned(p, userId!);
        await reload();
      },
      setPlannedStatus: (id: string, status: "pending" | "paid") =>
        optimistic(
          (d) => ({ ...d, planned: d.planned.map((p) => (p.id === id ? { ...p, status } : p)) }),
          () => remote.setPlannedStatus(id, status),
        ),
      removePlanned: async (id: string, alsoRecurrence = false) => {
        const item = data.planned.find((p) => p.id === id);
        if (isDemo) {
          setData((d) => ({ ...d, planned: d.planned.filter((p) => p.id !== id) }));
          return;
        }
        await remote.deletePlanned(id, alsoRecurrence ? item?.recurringRuleId : undefined);
        await reload();
      },
      createCategory: async (name: string, kind: Category["kind"]) => {
        const used = new Set(data.categories.map((c) => c.color));
        const color = CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[data.categories.length % CATEGORY_COLORS.length]!;
        const clean = name.trim();
        if (!clean) throw new Error("Dê um nome para a categoria.");
        if (data.categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) throw new Error("Já existe uma categoria com esse nome.");
        if (isDemo) {
          setData((d) => ({ ...d, categories: [...d.categories, { id: `demo-cat-${Date.now()}`, name: clean, kind, color }] }));
          return;
        }
        const created = await remote.createCategory({ name: clean, kind, color }, userId!);
        setData((d) => ({ ...d, categories: [...d.categories, created] }));
      },
      updateCategory: async (id: string, patch: { name?: string; kind?: Category["kind"] }) => {
        const name = patch.name?.trim();
        if (patch.name !== undefined && !name) throw new Error("Dê um nome para a categoria.");
        if (name && data.categories.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
          throw new Error("Já existe uma categoria com esse nome.");
        const clean = { ...patch, ...(name ? { name } : {}) };
        if (!isDemo) await remote.updateCategory(id, clean);
        setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...clean } : c)) }));
      },
      archiveCategory: async (id: string) => {
        if (!isDemo) await remote.archiveCategory(id);
        setData((d) => ({
          ...d,
          categories: d.categories.filter((c) => c.id !== id),
          transactions: d.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
        }));
      },
      importStatement: async ({ plan, fileName, account }: Parameters<FinanceActions["importStatement"]>[0]) => {
        if (isDemo || !userId) throw new Error("Entre com sua conta para importar arquivos.");
        const target = "create" in account ? await remote.createAccount(account.create, userId) : account;
        const payFrom = data.accounts.find((a) => a.kind === "checking")?.id ?? null;
        const res = await remote.saveImport({ userId, account: target, payFromAccountId: payFrom, fileName, plan, today: data.today });
        await reload();
        return { ...res, accountId: target.id };
      },
      setBudgetLimit: (categoryId: string, month: string, limit: number) =>
        optimistic(
          (d) => {
            const exists = d.budgets.some((b) => b.categoryId === categoryId && b.month === month);
            return {
              ...d,
              budgets: exists
                ? d.budgets.map((b) => (b.categoryId === categoryId && b.month === month ? { ...b, limit } : b))
                : [...d.budgets, { categoryId, month, limit }],
            };
          },
          () => remote.upsertBudget({ categoryId, month, limit }, userId!),
        ),
      addTransaction: async (t: Omit<Transaction, "id">) => {
        if (isDemo) {
          setData((d) => ({ ...d, transactions: [{ ...t, id: `demo-${Date.now()}` }, ...d.transactions] }));
          return;
        }
        const saved = await remote.insertTransaction(t, userId!);
        setData((d) => ({ ...d, transactions: [saved, ...d.transactions] }));
      },
      setAccountBalance: (accountId: string, balance: number) =>
        optimistic(
          (d) => ({
            ...d,
            balanceUpdatedAt: new Date().toISOString(),
            accounts: d.accounts.map((a) =>
              a.id === accountId ? { ...a, balance, balanceUpdatedAt: new Date().toISOString() } : a,
            ),
          }),
          () => remote.updateAccountBalance(accountId, balance),
        ),
    }),
    [data, status, error, isDemo, reload, optimistic, userId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFinance precisa estar dentro de <FinanceProvider>");
  return ctx;
}
