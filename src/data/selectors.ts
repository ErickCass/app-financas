import { useMemo } from "react";
import { buildBudgetView } from "@/domain/budget";
import { balanceTrajectory, buildMonthSummary, projectYearEnd } from "@/domain/projection";
import { monthOf } from "@/domain/dates";
import { useFinance } from "./store";

export function useBudgetView() {
  const f = useFinance();
  return useMemo(
    () =>
      buildBudgetView({
        today: f.today,
        categories: f.categories,
        budgets: f.budgets,
        transactions: f.transactions,
        history: f.history,
      }),
    [f.today, f.categories, f.budgets, f.transactions, f.history],
  );
}

export function useMonthSummary() {
  const f = useFinance();
  const view = useBudgetView();
  return useMemo(() => {
    const month = monthOf(f.today);
    // Compras no cartão já estão na fatura prevista; só o gasto em conta
    // (débito, PIX) ainda precisa ser estimado no saldo do fim do mês.
    const summary = buildMonthSummary({
      today: f.today,
      accounts: f.accounts,
      transactions: f.transactions,
      planned: f.planned,
      budgets: f.budgets,
    });
    const limitsTotal = f.budgets.filter((b) => b.month === month).reduce((a, b) => a + b.limit, 0);
    const yearEnd = projectYearEnd({
      today: f.today,
      monthEnd: summary.projectedMonthEnd,
      recurringPlanned: f.recurringMonthly,
      monthlyVariableLimits: limitsTotal,
    });
    const trajectory = balanceTrajectory({
      today: f.today,
      balanceToday: summary.balanceToday,
      transactions: f.transactions,
      planned: f.planned,
    });
    const spentTotal = view.reduce((a, v) => a + v.spent, 0);
    const projectedTotal = view.reduce((a, v) => a + v.projected, 0);
    return { ...summary, yearEnd, trajectory, limitsTotal, spentTotal, projectedTotal };
  }, [f, view]);
}
