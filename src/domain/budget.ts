import type { Cents } from "./money";
import type { Budget, Category, CategoryHistory, ISODate, Transaction } from "./types";
import { daysInMonth, dayOfMonth, monthOf } from "./dates";

/**
 * As quatro cores do orçamento:
 * - sobra:    deve fechar abaixo de 85% do limite (verde)
 * - ritmo:    deve fechar entre 85% e 100% (azul)
 * - vai:      ainda não passou, mas a previsão passa (amarelo)
 * - estourou: já passou do limite (vermelho)
 * E "semlimite" (cinza): categoria sem limite no mês; mostra o gasto, sem alerta.
 */
export type PaceStatus = "sobra" | "ritmo" | "vai" | "estourou" | "semlimite";

export const RITMO_THRESHOLD = 0.85;

export function paceStatus(spent: Cents, limit: Cents, projected: Cents): PaceStatus {
  if (limit <= 0) return "semlimite";
  if (spent > limit) return "estourou";
  if (projected > limit) return "vai";
  if (projected >= limit * RITMO_THRESHOLD) return "ritmo";
  return "sobra";
}

/**
 * Fração do mês que você "costuma" ter gasto até o dia informado.
 * Com histórico: a curva da própria categoria (assinaturas cobradas no dia 1
 * chegam a ~100% logo cedo; mercado cresce aos poucos).
 * Sem histórico: o ritmo linear do calendário.
 */
export function expectedShare(day: number, totalDays: number, history?: CategoryHistory): number {
  const share = history?.cumulativeShare[day - 1];
  if (share !== undefined && Number.isFinite(share)) return clamp01(share);
  return clamp01(day / totalDays);
}

/**
 * Previsão de fechamento do mês para a categoria.
 * Com histórico: o que já foi gasto + o que você costuma gastar no resto do mês.
 * Sem histórico: extrapolação linear do gasto até hoje.
 */
export function projectMonthEnd(
  spent: Cents,
  day: number,
  totalDays: number,
  history?: CategoryHistory,
): Cents {
  if (history && history.monthlyAverage > 0) {
    const share = expectedShare(day, totalDays, history);
    return Math.round(spent + history.monthlyAverage * (1 - share));
  }
  if (day <= 0) return spent;
  return Math.round((spent / day) * totalDays);
}

/** Quanto ainda dá para gastar por dia para fechar no limite. */
export function dailyAllowance(spent: Cents, limit: Cents, day: number, totalDays: number): Cents {
  const remainingDays = Math.max(totalDays - day, 1);
  return Math.max(Math.floor((limit - spent) / remainingDays), 0);
}

/**
 * Gasto de uma categoria no mês: compras por data da compra, menos estornos e reembolsos
 * da mesma categoria; transferências internas (pagamento de fatura) não entram.
 */
export function categorySpent(transactions: Transaction[], categoryId: string, month: string): Cents {
  const net = transactions
    .filter((t) => t.categoryId === categoryId && monthOf(t.date) === month && !t.isCardPayment)
    .reduce((acc, t) => acc - t.amount, 0);
  return Math.max(net, 0);
}

export interface CategoryBudgetView {
  category: Category;
  limit: Cents;
  spent: Cents;
  projected: Cents;
  expectedShareToday: number;
  status: PaceStatus;
  dailyAllowance: Cents;
  transactions: Transaction[];
}

const statusOrder: Record<PaceStatus, number> = { estourou: 0, vai: 1, ritmo: 2, sobra: 3, semlimite: 4 };

/** Monta a tela de Orçamento: uma linha por categoria variável, ordenada por risco. */
export function buildBudgetView(params: {
  today: ISODate;
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  history: CategoryHistory[];
}): CategoryBudgetView[] {
  const month = monthOf(params.today);
  const day = dayOfMonth(params.today);
  const total = daysInMonth(month);

  return params.categories
    .filter((c) => c.kind === "variable")
    .map((category) => {
      const limit = params.budgets.find((b) => b.categoryId === category.id && b.month === month)?.limit ?? 0;
      const hist = params.history.find((h) => h.categoryId === category.id);
      const spent = categorySpent(params.transactions, category.id, month);
      const projected = projectMonthEnd(spent, day, total, hist);
      const transactions = params.transactions
        .filter((t) => t.categoryId === category.id && monthOf(t.date) === month && !t.isCardPayment)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      return {
        category,
        limit,
        spent,
        projected,
        expectedShareToday: expectedShare(day, total, hist),
        status: paceStatus(spent, limit, projected),
        dailyAllowance: dailyAllowance(spent, limit, day, total),
        transactions,
      };
    })
    .sort((a, b) => {
      const byStatus = statusOrder[a.status] - statusOrder[b.status];
      if (byStatus !== 0) return byStatus;
      if (a.status === "semlimite") return b.spent - a.spent;
      const ratioA = a.limit ? a.spent / a.limit : 0;
      const ratioB = b.limit ? b.spent / b.limit : 0;
      return ratioB - ratioA;
    });
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
