import type { ISODate } from "./types";

/** "2026-11-09" -> "2026-11" */
export function monthOf(date: ISODate): string {
  return date.slice(0, 7);
}

export function dayOfMonth(date: ISODate): number {
  return Number(date.slice(8, 10));
}

/** Número de dias de um mês "AAAA-MM". */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

export function lastDayOfMonth(month: string): ISODate {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-09" -> "9 nov" */
export function shortDate(date: ISODate): string {
  return `${dayOfMonth(date)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

export function monthLabel(month: string): string {
  const full = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${full[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Data de hoje no fuso do aparelho, como ISODate. */
export function todayISO(now = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
