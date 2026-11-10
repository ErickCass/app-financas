/**
 * Transforma os pedaços de texto posicionados de um PDF (pdf.js) em linhas.
 * Faturas do Itaú são diagramadas em duas colunas, como jornal: `columns`
 * devolve a coluna da esquerda e depois a da direita de cada página, na ordem de leitura.
 * `lines` devolve a página inteira, útil para o cabeçalho.
 */
export interface PdfTextItem {
  x: number;
  y: number;
  w: number;
  str: string;
}
export interface PdfPage {
  width: number;
  items: PdfTextItem[];
}
export interface PdfText {
  lines: string[];
  columns: string[];
}

/** Distância (pt) a partir da qual dois pedaços são campos diferentes, não palavras. */
const FIELD_GAP = 6;

function joinRow(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = "";
  let end: number | null = null;
  for (const it of sorted) {
    if (end !== null) {
      const gap = it.x - end;
      out += gap > FIELD_GAP ? "   " : gap > 1 ? " " : "";
    }
    out += it.str;
    end = it.x + it.w;
  }
  return out.replace(/\s+$/, "");
}

function toRows(items: PdfTextItem[]): string[] {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 2);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  // PDF: y cresce para cima, então ordem de leitura é y decrescente.
  return rows.sort((a, b) => b.y - a.y).map((r) => joinRow(r.items)).filter((l) => l.trim() !== "");
}

/** Onde começa a coluna da direita, ou null se a página tem uma coluna só. */
export function columnSplit(page: PdfPage): number | null {
  const anchors = page.items.filter((it) => /^\d{2}\/\d{2}$/.test(it.str.trim()) || /^Lan$|^Lançamentos/.test(it.str.trim()));
  const mid = page.width * 0.45;
  const right = anchors.filter((a) => a.x > mid).map((a) => a.x);
  const left = anchors.filter((a) => a.x <= mid);
  if (right.length < 2 || left.length < 2) return null;
  return Math.min(...right) - 4;
}

export function layoutPdfText(pages: PdfPage[]): PdfText {
  const lines: string[] = [];
  const columns: string[] = [];
  for (const page of pages) {
    lines.push(...toRows(page.items));
    const split = columnSplit(page);
    if (split === null) {
      columns.push(...toRows(page.items));
    } else {
      columns.push(...toRows(page.items.filter((i) => i.x < split)));
      columns.push(...toRows(page.items.filter((i) => i.x >= split)));
    }
  }
  return { lines, columns };
}
