/**
 * Prévia da importação: categoriza, marca o que já existe e confere os totais.
 * Função pura; a tela mostra o resultado e só então grava.
 */
import { areLikelyDuplicates, normalizeDescription } from "@/domain/dedup";
import type { Cents } from "@/domain/money";
import type { Category, Planned, Transaction } from "@/domain/types";
import { suggestCategory, type CategorySource, type LearnedRule } from "./categorize";
import type { ParsedItem, ParsedStatement, TotalCheck } from "./types";

export interface ImportRow {
  /** Identificador estável do lançamento (external_id): reimportar não duplica. */
  key: string;
  item: ParsedItem;
  categoryId: string | null;
  categorySource: CategorySource | null;
  /** "imported": já veio num arquivo anterior; "manual": parece já ter sido lançado à mão. */
  duplicate: "imported" | "manual" | null;
}

export interface ImportPlan {
  statement: ParsedStatement;
  rows: ImportRow[];
  newRows: ImportRow[];
  /** Agendados do extrato que ainda não existem como previsto. */
  newUpcoming: ImportRow[];
  /** Conferências que não bateram (vazio = tudo confere). */
  mismatches: TotalCheck[];
  /** Gasto do arquivo inteiro (sem transferências internas), em centavos positivos. */
  spending: Cents;
  period: { from: string; to: string } | null;
  byCategory: { categoryId: string | null; total: Cents; count: number }[];
  uncategorized: number;
}

/** Chave estável: banco, cartão, data, descrição, valor e a ordem entre lançamentos idênticos. */
export function importKeys(statement: ParsedStatement): string[] {
  const seen = new Map<string, number>();
  return statement.items.map((i) => {
    const base = [statement.institution, statement.kind, i.cardLast4 ?? "", i.date, normalizeDescription(i.description), i.amount].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  });
}

const REFUND_PREFIX = /^(estorno( de)?( compra)?|iof de volta de|credito( de)?|devolucao( de)?)\s*/;

export function buildImportPlan(args: {
  statement: ParsedStatement;
  accountId: string | null;
  categories: Category[];
  rules: LearnedRule[];
  importedKeys: Set<string>;
  existing: Transaction[];
  existingPlanned?: Planned[];
}): ImportPlan {
  const { statement, accountId, categories, rules, importedKeys, existing, existingPlanned = [] } = args;
  const keys = importKeys(statement);
  const manual = existing.filter((t) => t.accountId === accountId && t.source !== "import");

  const rows: ImportRow[] = statement.items.map((item, idx) => {
    const key = keys[idx]!;
    const suggestion = item.internal ? null : suggestCategory(item, categories, rules);
    const isManualDup = manual.some((t) =>
      areLikelyDuplicates({ date: t.date, description: t.description, amount: t.amount }, { date: item.date, description: item.description, amount: item.amount }) ||
      (t.date === item.date && t.amount === item.amount),
    );
    return {
      key,
      item,
      categoryId: suggestion?.categoryId ?? null,
      categorySource: suggestion?.source ?? null,
      duplicate: importedKeys.has(key) ? "imported" : isManualDup ? "manual" : null,
    };
  });

  // Estornos e créditos herdam a categoria da compra correspondente.
  for (const row of rows) {
    if (row.categoryId || row.item.amount <= 0 || row.item.internal) continue;
    const name = normalizeDescription(row.item.description).replace(REFUND_PREFIX, "");
    const match =
      rows.find((r) => r.categoryId && r.item.amount === -row.item.amount && r.item.cardLast4 === row.item.cardLast4) ??
      rows.find((r) => r.categoryId && r.item.amount < 0 && name.length > 3 && normalizeDescription(r.item.description).startsWith(name));
    if (match) {
      row.categoryId = match.categoryId;
      row.categorySource = match.categorySource;
    }
  }

  // Agendados ("saídas futuras"): viram previstos, sem repetir o que já existe.
  const newUpcoming: ImportRow[] = statement.upcoming
    .map((item, idx) => {
      const suggestion = item.internal ? null : suggestCategory(item, categories, rules);
      const already = existingPlanned.some(
        (p) =>
          p.status !== "paid" &&
          p.dueDate === item.date &&
          (p.amount === item.amount || normalizeDescription(p.description) === normalizeDescription(item.description)),
      );
      return {
        key: `upcoming|${statement.institution}|${item.date}|${normalizeDescription(item.description)}|${item.amount}|${idx}`,
        item,
        categoryId: suggestion?.categoryId ?? null,
        categorySource: suggestion?.source ?? null,
        duplicate: already ? ("imported" as const) : null,
      };
    })
    .filter((r) => r.duplicate === null);

  const newRows = rows.filter((r) => r.duplicate === null);
  // Cartão: compras menos estornos. Conta: só as saídas (entradas são renda, não abatem gasto).
  const counted = rows.filter((r) => !r.item.internal && (statement.kind === "credit_card" || r.item.amount < 0));
  const spending = -counted.reduce((s, r) => s + r.item.amount, 0);

  const groups = new Map<string | null, { total: Cents; count: number }>();
  for (const r of newRows) {
    if (r.item.internal || (r.item.amount > 0 && statement.kind !== "credit_card")) continue;
    const g = groups.get(r.categoryId) ?? { total: 0, count: 0 };
    groups.set(r.categoryId, { total: g.total - r.item.amount, count: g.count + 1 });
  }

  const dates = statement.items.map((i) => i.date).sort();
  return {
    statement,
    rows,
    newRows,
    newUpcoming,
    mismatches: statement.checks.filter((c) => c.declared !== c.computed),
    spending,
    period: dates.length ? { from: dates[0]!, to: dates.at(-1)! } : null,
    byCategory: [...groups.entries()]
      .map(([categoryId, v]) => ({ categoryId, ...v }))
      .sort((a, b) => b.total - a.total),
    uncategorized: groups.get(null)?.count ?? 0,
  };
}
