/**
 * Camada de dados do app. Hoje lê os dados de demonstração em memória;
 * na fase 1 ganha uma implementação que lê e grava no Supabase com a mesma interface.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Account, Budget, Category, CategoryHistory, Planned, Transaction } from "@/domain/types";
import * as demo from "./demo";

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
  setTransactionCategory(transactionId: string, categoryId: string): void;
  setBudgetLimit(categoryId: string, month: string, limit: number): void;
}

const Ctx = createContext<(FinanceData & FinanceActions) | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState(demo.transactions);
  const [budgets, setBudgets] = useState(demo.budgets);

  const value = useMemo(
    () => ({
      today: demo.DEMO_TODAY,
      balanceUpdatedAt: demo.DEMO_UPDATED_AT,
      accounts: demo.accounts,
      categories: demo.categories,
      budgets,
      transactions,
      planned: demo.planned,
      history: demo.history,
      recurringMonthly: demo.recurringMonthly,
      setTransactionCategory(transactionId: string, categoryId: string) {
        setTransactions((rows) => rows.map((r) => (r.id === transactionId ? { ...r, categoryId } : r)));
      },
      setBudgetLimit(categoryId: string, month: string, limit: number) {
        setBudgets((rows) => {
          const exists = rows.some((b) => b.categoryId === categoryId && b.month === month);
          return exists
            ? rows.map((b) => (b.categoryId === categoryId && b.month === month ? { ...b, limit } : b))
            : [...rows, { categoryId, month, limit }];
        });
      },
    }),
    [transactions, budgets],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFinance precisa estar dentro de <FinanceProvider>");
  return ctx;
}
