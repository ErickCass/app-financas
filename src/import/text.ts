import type { Cents } from "@/domain/money";

/** "1.661,92" → 166192; "- 58,16" → -5816; "R$ -10.549,17" → -1054917. */
export function parseBRL(text: string): Cents {
  const m = text.replace(/R\$\s*/g, "").trim().match(/^(-)?\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/);
  if (!m) throw new Error(`Valor inválido: "${text}"`);
  const [, minus, int, dec] = m;
  const cents = Number(int!.replace(/\./g, "")) * 100 + Number(dec);
  return minus ? -cents : cents;
}

/** Regex de valor em reais, com sinal opcional separado por espaço. */
export const BRL = String.raw`-?\s?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}`;

/** "dd/mm/aaaa" → "aaaa-mm-dd". */
export function brDate(text: string): string {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`Data inválida: "${text}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Soma de datas em meses, mantendo o dia dentro do mês ("2026-01-31" + 1 → "2026-02-28"). */
export function addMonthsToDate(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Remove espaços repetidos e nas pontas. */
export function tidy(description: string): string {
  return description.replace(/\s+/g, " ").trim();
}
