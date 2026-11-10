/**
 * Valores monetários são sempre centavos inteiros (number inteiro).
 * Nunca use float para dinheiro: R$ 0,10 + R$ 0,20 precisa dar R$ 0,30.
 */
export type Cents = number;

export function toCents(value: number | string): Cents {
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = value.trim().replace(/[R$\s]/g, "");
  // Aceita "1.234,56" (pt-BR) e "1234.56"
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Valor inválido: "${value}"`);
  return Math.round(parsed * 100);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlNoCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** "R$ 1.234,56". Usa espaço normal no lugar do espaço não separável do Intl. */
export function formatBRL(cents: Cents, opts: { noCents?: boolean; signed?: boolean } = {}): string {
  const fmt = opts.noCents ? brlNoCents : brl;
  const text = fmt.format(Math.abs(cents) / 100).replace(/ /g, " ");
  if (cents < 0) return `−${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

export function sum(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}
