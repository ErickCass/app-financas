/**
 * Extrato do cartão de benefícios Flash (CSV exportado no app).
 * Formato: Data,Hora,Movimentação,Valor,Meio de Pagamento,Saldo — mais recente primeiro.
 * Depósito da empresa é carga do benefício (não é renda); compras saem do saldo do cartão.
 */
import { brDate, parseBRL, tidy } from "./text";
import { splitCsvLine } from "./nubankCsv";
import type { ParsedItem, ParsedStatement } from "./types";

export function looksLikeFlashCsv(text: string): boolean {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0]?.trim().toLowerCase() ?? "";
  return header.startsWith("data,hora,movimenta") && header.includes("saldo");
}

const DEPOSIT = /dep[oó]sito|cr[eé]dito|carga|recarga/i;

export function parseFlashCsv(text: string, fileName = ""): ParsedStatement {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!looksLikeFlashCsv(lines[0] ?? "")) throw new Error("Este CSV não parece um extrato da Flash.");

  const items: ParsedItem[] = [];
  let closing: { amount: number; asOf: string } | null = null;
  for (const line of lines.slice(1)) {
    const [date, time, title, amount, , balance] = splitCsvLine(line);
    if (!date || !title || !amount) continue;
    const value = parseBRL(amount);
    if (value === 0) continue; // "R$ 0,00": pré-autorização sem efeito
    const iso = brDate(date);
    if (!closing && balance) closing = { amount: parseBRL(balance), asOf: `${iso}T${(time ?? "00:00").slice(0, 5)}:00-03:00` };
    const description = tidy(title);
    items.push({ date: iso, description, amount: value, internal: DEPOSIT.test(description) || undefined });
  }
  if (!closing) throw new Error("Não encontrei o saldo no extrato da Flash.");

  const period = fileName.match(/(\d{2})-(\d{4})/);
  return {
    institution: "flash",
    kind: "benefit",
    suggestedAccountName: "Flash (benefício)",
    closingBalance: closing,
    items,
    upcoming: [],
    checks: [],
    notes: period ? [`Extrato de ${period[1]}/${period[2]}. As cargas da empresa não contam como renda; as compras entram no orçamento das categorias.`] : undefined,
  };
}
