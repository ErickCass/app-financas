/**
 * Fatura do cartão Itaú exportada em planilha (app/site › Cartões › Fatura › Exportar).
 * É o único jeito de trazer a fatura ainda aberta, antes de fechar.
 */
import { normalizeDescription } from "@/domain/dedup";
import type { Cents } from "@/domain/money";
import { cellDate, cellText, type Sheet } from "./xlsx";
import { addMonthsToDate, tidy } from "./text";
import type { ParsedItem, ParsedStatement } from "./types";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Pagamento da própria fatura: transferência interna, não é compra. */
const PAYMENT = /^pagamento\b/i;

export function looksLikeItauCardXlsx(sheet: Sheet): boolean {
  const head = sheet.slice(0, 20).flat().map(cellText).join(" | ").toLowerCase();
  return /fatura (aberta|fechada)/.test(head) && /lan[çc]amento/.test(head);
}

/** Linha de cabeçalho dos lançamentos e a posição de cada coluna. */
function findColumns(sheet: Sheet) {
  for (let r = 0; r < sheet.length; r++) {
    const cells = sheet[r]!.map((c) => normalizeDescription(cellText(c)));
    const col = (name: string) => cells.findIndex((c) => c === name);
    const date = col("data");
    const description = col("lancamento");
    const amount = col("valor");
    if (date >= 0 && description >= 0 && amount >= 0) {
      return { row: r, date, description, amount, installment: col("parcelamento"), card: col("numero do cartao") };
    }
  }
  return null;
}

export function parseItauCardXlsx(sheet: Sheet): ParsedStatement {
  const header = findColumns(sheet);
  if (!header) throw new Error("Não encontrei a tabela de lançamentos nesta planilha.");

  const flat = sheet.slice(0, header.row).map((r) => r.map(cellText).filter(Boolean).join(" | "));
  const title = flat.find((l) => /fatura (aberta|fechada)/i.test(l)) ?? "";
  const monthName = title.match(/(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/\s*(\d{4})/i);

  // Linha do resumo: nome do cartão, valor parcial e vencimento.
  let dueDate: string | null = null;
  let declaredTotal: Cents | undefined;
  let cardName = "";
  for (const row of sheet.slice(0, header.row)) {
    for (const cell of row) {
      const d = cellDate(cell);
      if (d && !dueDate) dueDate = d;
    }
    const label = cellText(row[1]);
    if (/final \d{4}|visa|mastercard|elo/i.test(label) && !cardName) cardName = label;
    const value = row.find((c) => typeof c === "number" && Math.abs(c) > 0);
    if (typeof value === "number" && declaredTotal === undefined && dueDate) declaredTotal = Math.round(value * 100);
  }

  const statementMonth =
    monthName ? `${monthName[2]}-${String(MONTHS.findIndex((m) => normalizeDescription(m) === normalizeDescription(monthName[1]!)) + 1).padStart(2, "0")}` : dueDate?.slice(0, 7);
  if (!statementMonth) throw new Error("Não encontrei o mês desta fatura na planilha.");

  const items: ParsedItem[] = [];
  for (const row of sheet.slice(header.row + 1)) {
    const date = cellDate(row[header.date] ?? null);
    const description = tidy(cellText(row[header.description] ?? null));
    const raw = row[header.amount];
    if (!date || !description || typeof raw !== "number") continue;

    const parcela = header.installment >= 0 ? cellText(row[header.installment] ?? null).match(/(\d+)\s*de\s*(\d+)/i) : null;
    const installment = parcela ? { n: Number(parcela[1]), total: Number(parcela[2]) } : undefined;
    const last4 = header.card >= 0 ? cellText(row[header.card] ?? null).match(/(\d{4})\s*$/)?.[1] : undefined;

    items.push({
      // Na planilha, compra é positiva; no app, saída é negativa.
      amount: -Math.round(raw * 100),
      // Parcela n entra no orçamento n−1 meses depois da compra.
      date: installment ? addMonthsToDate(date, installment.n - 1) : date,
      description,
      cardLast4: last4,
      installment,
      internal: PAYMENT.test(description) || undefined,
    });
  }
  if (items.length === 0) throw new Error("Não encontrei lançamentos nesta planilha.");

  const computed = -items.filter((i) => !i.internal).reduce((s, i) => s + i.amount, 0);
  const notes: string[] = [];
  if (declaredTotal !== undefined && declaredTotal !== computed) {
    const diff = declaredTotal - computed;
    notes.push(
      diff > 0
        ? `O Itaú informa um parcial de ${brl(declaredTotal)}, que inclui ${brl(diff)} de faturas anteriores ou lançamentos não detalhados na planilha. Importamos os ${items.length} lançamentos listados (${brl(computed)}).`
        : `O Itaú informa um parcial de ${brl(declaredTotal)}; os lançamentos listados somam ${brl(computed)}.`,
    );
  }

  const last4 = cardName.match(/final (\d{4})/i)?.[1] ?? items.find((i) => i.cardLast4)?.cardLast4;
  return {
    institution: "itau",
    kind: "credit_card",
    suggestedAccountName: last4 ? `Cartão Itaú •••• ${last4}` : "Cartão Itaú",
    last4,
    dueDate: dueDate ?? undefined,
    statementMonth,
    dueDay: dueDate ? Number(dueDate.slice(8, 10)) : undefined,
    // Fatura ainda aberta: o valor final só é conhecido no fechamento.
    declaredTotal: undefined,
    items,
    upcoming: [],
    checks: [],
    notes,
  };
}

const brl = (c: Cents) =>
  `R$ ${(Math.abs(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
