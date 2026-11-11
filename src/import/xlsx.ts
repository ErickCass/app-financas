/**
 * Leitor mínimo de planilhas .xlsx (o que os bancos exportam): abre o zip e lê
 * as células da primeira aba como texto, número ou data. Não interpreta fórmulas
 * (usa o último valor calculado) nem formatação.
 */
import { unzipSync } from "fflate";

export type Cell = string | number | Date | null;
export type Sheet = Cell[][];

export const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; // "PK\x03\x04"

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(xml: string): string {
  return xml.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code] ?? whole;
  });
}

/** Texto de todos os <t> dentro de um trecho (strings ricas vêm em vários pedaços). */
function textOf(fragment: string): string {
  let out = "";
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?\/>|<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decode(m[1] ?? "");
  return out;
}

/** "B14" → 1 (índice da coluna, base zero). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/** Serial do Excel → Date (epoch 1899-12-30, já com o bug do ano 1900). */
function fromSerial(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400000));
}

const BUILTIN_DATE = (id: number) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58);

/** Estilos cujo formato é data, para converter o serial em Date. */
function dateStyles(styles: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!styles) return out;
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    custom.set(Number(m[1]), decode(m[2]!));
  }
  const cellXfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  let i = 0;
  for (const m of cellXfs.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(m[0].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    const code = custom.get(id);
    // Formato de data: tem d/m/y/h fora de texto literal entre aspas ou colchetes.
    const looksLikeDate = code ? /[dmyh]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, "")) : BUILTIN_DATE(id);
    if (looksLikeDate) out.add(i);
    i++;
  }
  return out;
}

/** Lê a primeira aba da planilha. Lança se o arquivo não for um .xlsx válido. */
export function readXlsx(bytes: Uint8Array): Sheet {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => /^xl\/(worksheets\/sheet1\.xml|sharedStrings\.xml|styles\.xml)$/.test(f.name),
    });
  } catch {
    throw new Error("Não consegui abrir esta planilha.");
  }
  const text = (name: string) => {
    const file = files[name];
    return file ? new TextDecoder("utf-8").decode(file) : undefined;
  };
  const sheetXml = text("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("Esta planilha está vazia ou em um formato que não reconheço.");

  const shared = [...(text("xl/sharedStrings.xml") ?? "").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));
  const dates = dateStyles(text("xl/styles.xml"));

  const rows: Sheet = [];
  // Quantificador preguiçoso nos atributos: célula vazia vem como <c .../> e,
  // sendo ganancioso, a barra seria engolida e a célula seguinte entraria no lugar errado.
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: Cell[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1]!;
      const body = cellMatch[2] ?? "";
      const col = columnIndex(attrs.match(/r="([A-Z]+)/)?.[1] ?? "");
      if (col < 0) continue;
      const type = attrs.match(/t="([^"]+)"/)?.[1] ?? "n";
      const style = Number(attrs.match(/s="(\d+)"/)?.[1] ?? -1);
      const raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];

      let value: Cell = null;
      if (type === "s") value = shared[Number(raw)] ?? null;
      else if (type === "inlineStr") value = textOf(body);
      else if (type === "str" || type === "e") value = raw ? decode(raw) : null;
      else if (type === "b") value = raw === "1" ? "VERDADEIRO" : "FALSO";
      else if (raw !== undefined && raw !== "") {
        const n = Number(raw);
        value = Number.isNaN(n) ? decode(raw) : dates.has(style) ? fromSerial(n) : n;
      }
      while (row.length < col) row.push(null);
      row[col] = value;
    }
    rows.push(row);
  }
  return rows;
}

/** Texto de uma célula, já sem espaços duplicados. */
export const cellText = (c: Cell): string => (c === null ? "" : c instanceof Date ? "" : String(c)).replace(/\s+/g, " ").trim();

/** Data de uma célula: aceita Date ou "dd/mm/aaaa". */
export function cellDate(c: Cell): string | null {
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  const m = cellText(c).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
