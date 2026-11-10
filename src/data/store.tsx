/**
 * Camada de dados do app.
 * - Logado: lê e grava no Supabase (com atualização otimista na tela).
 * - Demonstração: dados fictícios em memória, nada é gravado.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Account, Budget, Category, CategoryHistory, Planned, Transaction } from "@/domain/types";
import { todayISO } from "@/domain/dates";
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
      const loaded = await remote.loadFinanceData(today);
      setData({ today, ...loaded });
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [isDemo, userId]);

  useEffect(() => {
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
      setTransactionCategory: (transactionId: string, categoryId: string) =>
        optimistic(
          (d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === transactionId ? { ...t, categoryId } : t)) }),
          () => remote.updateTransactionCategory(transactionId, categoryId),
        ),
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
