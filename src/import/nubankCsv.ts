/**
 * Fatura do cartão Nubank exportada em CSV (app › Cartão › Fatura › Exportar).
 * Formato: date,title,amount — compras positivas, estornos e pagamentos negativos.
 * O nome do arquivo traz o vencimento: Nubank_2026-12-01.csv.
 */
import { addMonthsToDate, parseBRL, tidy } from "./text";
import type { ParsedItem, ParsedStatement } from "./types";

/** Divide uma linha CSV respeitando aspas ("30,10" tem vírgula dentro). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function looksLikeNubankCsv(text: string): boolean {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0]?.trim().toLowerCase();
  return header === "date,title,amount";
}

/** Valor do Nubank: "30,10", "- 58,16", "1.661,92" ou, em exportações antigas, "30.10". */
function nubankAmount(raw: string): number {
  const v = raw.trim();
  if (/^-?\s?\d+\.\d{2}$/.test(v)) return Math.round(Number(v.replace(/\s/g, "")) * 100);
  return parseBRL(v);
}

const PAYMENT = /^pagamento recebido|^pagamento em /i;

export function parseNubankCsv(text: string, fileName = ""): ParsedStatement {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!looksLikeNubankCsv(lines[0] ?? "")) throw new Error("Este CSV não parece uma fatura do Nubank.");

  const items: ParsedItem[] = [];
  for (const line of lines.slice(1)) {
    const [date, title, amount] = splitCsvLine(line);
    if (!date || !title || amount === undefined) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Data inesperada no CSV: "${date}"`);
    const value = nubankAmount(amount);
    const description = tidy(title);
    const installment = description.match(/Parcela (\d+)\/(\d+)/i);
    items.push({
      date,
      description,
      amount: -value, // no CSV, compra é positiva; no app, saída é negativa
      internal: PAYMENT.test(description) || undefined,
      installment: installment ? { n: Number(installment[1]), total: Number(installment[2]) } : undefined,
    });
  }

  const due = fileName.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  // Sem a data no nome, supõe vencimento no mês seguinte à última compra.
  const lastDate = items.map((i) => i.date).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  const dueDate = due ?? `${addMonthsToDate(lastDate, 1).slice(0, 7)}-01`;
  const dueDay = Number(dueDate.slice(8, 10));

  return {
    institution: "nubank",
    kind: "credit_card",
    suggestedAccountName: "Cartão Nubank",
    dueDate,
    statementMonth: dueDate.slice(0, 7),
    dueDay,
    // O Nubank fecha a fatura 7 dias antes do vencimento (aproximação de 30 dias no mês).
    closingDay: dueDay > 7 ? dueDay - 7 : dueDay + 23,
    items,
    upcoming: [],
    checks: [],
  };
}
