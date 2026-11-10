/**
 * Remoção de lançamentos duplicados.
 * Portado do app antigo (shared/transactionDedup.ts), agora em centavos.
 * Uso principal: a mesma compra chega pelo Apple Pay, pelo extrato importado
 * e pelo Open Finance; deve virar uma só.
 */
import type { Cents } from "./money";

export interface DedupCandidate {
  id?: string;
  date: string; // AAAA-MM-DD
  description: string;
  amount: Cents;
  categoryId?: string | null;
  source?: string | null;
  importBatchId?: string | null;
}

export function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\d{1,2}\s*\/\s*[a-z]+\s+/i, "") // "05/nov UBER" -> "uber"
    .replace(/\s*\(\d+\/\d+\)\s*$/, "") // "(3/10)"
    .replace(/\s+\d{1,2}\/\d{1,2}\s*$/, "") // " 3/10"
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function areLikelyDuplicates(a: DedupCandidate, b: DedupCandidate): boolean {
  if (a.date.slice(0, 10) !== b.date.slice(0, 10)) return false;
  if (a.amount !== b.amount) return false;
  if (a.categoryId != null && b.categoryId != null && a.categoryId !== b.categoryId) return false;

  const da = normalizeDescription(a.description);
  const db = normalizeDescription(b.description);
  if (da === db) return true;

  // Bancos cortam descrições longas: "SUPERMERCADO PAO DE ACU" vs "...ACUCAR".
  const sameSource = Boolean(a.source && b.source && a.source === b.source);
  const differentBatches = a.importBatchId != null && b.importBatchId != null && a.importBatchId !== b.importBatchId;
  const [shorter, longer] = da.length <= db.length ? [da, db] : [db, da];
  const truncated = shorter.length >= 12 && longer.startsWith(shorter);
  return sameSource && differentBatches && truncated;
}

/** Mantém uma ocorrência de cada; entre duplicadas, fica a de descrição mais completa. */
export function deduplicate<T extends DedupCandidate>(rows: T[]): T[] {
  const result: T[] = [];
  for (const row of rows) {
    const i = result.findIndex((c) => areLikelyDuplicates(c, row));
    if (i === -1) {
      result.push(row);
    } else if (normalizeDescription(row.description).length > normalizeDescription(result[i]!.description).length) {
      result[i] = row;
    }
  }
  return result;
}
