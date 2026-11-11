/**
 * Baixa automática de previstos: quando chega um lançamento parecido com uma
 * conta prevista (condomínio ≈ R$ 1.200 e aparece R$ 1.191,72 na mesma
 * categoria, no mesmo mês), a conta é dada como paga por aquele lançamento.
 */
import { monthOf } from "./dates";
import { normalizeDescription } from "./dedup";
import type { Planned, Transaction } from "./types";

export interface Match {
  plannedId: string;
  transactionId: string;
}

const STOPWORDS = new Set(["pix", "ted", "doc", "pag", "pagamento", "boleto", "deb", "debito", "da", "de", "do", "e", "sa", "ltda", "me", "conta", "mensalidade", "fatura"]);

function tokens(text: string): Set<string> {
  return new Set(
    normalizeDescription(text)
      .split(" ")
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
  );
}

function similarDescription(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  for (const w of ta) if (tb.has(w)) return true;
  return false;
}

/** Tolerância de valor: contas "aproximadas" variam mais (energia, condomínio). */
function amountMatches(planned: Planned, tx: Transaction): boolean {
  const tol = planned.estimated ? 0.25 : 0.15;
  const p = Math.abs(planned.amount);
  const t = Math.abs(tx.amount);
  return Math.abs(p - t) <= Math.max(p, t) * tol;
}

export function matchPlannedToTransactions(planned: Planned[], transactions: Transaction[]): Match[] {
  const used = new Set<string>();
  const out: Match[] = [];
  const candidates = transactions.filter((t) => !t.isCardPayment && !t.plannedId);

  for (const p of planned) {
    if (p.status === "paid" || p.creditCardStatement) continue;
    const month = monthOf(p.dueDate);
    const best = candidates
      .filter(
        (t) =>
          !used.has(t.id) &&
          Math.sign(t.amount) === Math.sign(p.amount) &&
          monthOf(t.date) === month &&
          amountMatches(p, t) &&
          // mesma categoria, ou descrição parecida quando uma das duas não tem categoria
          ((p.categoryId && t.categoryId && p.categoryId === t.categoryId) || similarDescription(p.description, t.description)),
      )
      // o mais próximo em valor vence
      .sort((a, b) => Math.abs(Math.abs(a.amount) - Math.abs(p.amount)) - Math.abs(Math.abs(b.amount) - Math.abs(p.amount)))[0];
    if (best) {
      used.add(best.id);
      out.push({ plannedId: p.id, transactionId: best.id });
    }
  }
  return out;
}

/**
 * Conta fixa com valor previsto é dada como quitada quando o pago no mês chega perto
 * do previsto (±10%): condomínio de R$ 1.191,72 contra R$ 1.200 previstos não deixa
 * "R$ 8,28 a pagar". Abaixo disso, falta a diferença (ex.: 1 de 3 mensalidades).
 */
export const SETTLE_TOLERANCE = 0.1;
export function fixedRemaining(expected: number, spent: number, alreadyPlanned: number): number {
  if (expected <= 0) return 0;
  if (spent >= expected * (1 - SETTLE_TOLERANCE)) return 0;
  return Math.max(expected - spent - alreadyPlanned, 0);
}
