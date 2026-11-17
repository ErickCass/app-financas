import type { Cents } from "./money";
import type { CategoryHistory, ISODate, Transaction } from "./types";
import { addMonths, dayOfMonth, daysInMonth, monthOf } from "./dates";

/**
 * Constrói o histórico de cada categoria a partir dos meses anteriores ao atual:
 * a média mensal e a curva média de "quanto do mês já tinha sido gasto até o dia d".
 * Só considera meses em que a categoria teve gasto, para uma categoria nova
 * não puxar a média para zero.
 *
 * Só entram meses COMPLETOS: os que começam depois do primeiro lançamento importado.
 * Um mês coberto pela metade (ex.: só os últimos dias de setembro, que vieram numa
 * fatura) parece "gastei tudo no fim do mês" e entorta a curva. E é preciso ter pelo
 * menos MIN_MONTHS meses completos; antes disso a categoria fica sem histórico e o
 * app usa o ritmo do calendário.
 */
export const MIN_MONTHS = 2;
/** Primeiro lançamento até este dia do mês: o mês conta como completo. */
const FULL_FROM_DAY = 3;
export function buildHistory(transactions: Transaction[], today: ISODate, months = 3): CategoryHistory[] {
  const current = monthOf(today);
  const dates = transactions.filter((t) => !t.isCardPayment).map((t) => t.date);
  const first = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  // Mês completo: o primeiro lançamento é anterior a ele, ou cai nos primeiros dias dele.
  const complete = (m: string) =>
    !!first && (monthOf(first) < m || (monthOf(first) === m && dayOfMonth(first) <= FULL_FROM_DAY));
  const window = Array.from({ length: months }, (_, i) => addMonths(current, -(i + 1))).filter(complete);

  // gasto[categoria][mês][dia] em centavos
  const spend = new Map<string, Map<string, Cents[]>>();
  for (const t of transactions) {
    if (t.amount >= 0 || t.isCardPayment || !t.categoryId) continue;
    const m = monthOf(t.date);
    if (!window.includes(m)) continue;
    const byMonth = spend.get(t.categoryId) ?? new Map<string, Cents[]>();
    const days = byMonth.get(m) ?? Array(daysInMonth(m)).fill(0);
    days[dayOfMonth(t.date) - 1] += -t.amount;
    byMonth.set(m, days);
    spend.set(t.categoryId, byMonth);
  }

  const result: CategoryHistory[] = [];
  for (const [categoryId, byMonth] of spend) {
    const curves: number[][] = [];
    let total = 0;
    for (const days of byMonth.values()) {
      const monthTotal = days.reduce((a, b) => a + b, 0);
      if (monthTotal <= 0) continue;
      total += monthTotal;
      let acc = 0;
      // Normaliza para 31 posições: dia d de qualquer mês -> fração acumulada
      const curve = Array.from({ length: 31 }, (_, i) => {
        if (i < days.length) acc += days[i]!;
        return acc / monthTotal;
      });
      curves.push(curve);
    }
    if (curves.length < MIN_MONTHS) continue;
    result.push({
      categoryId,
      monthlyAverage: Math.round(total / curves.length),
      cumulativeShare: Array.from({ length: 31 }, (_, i) => curves.reduce((a, c) => a + c[i]!, 0) / curves.length),
    });
  }
  return result;
}
