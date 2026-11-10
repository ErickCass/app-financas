/**
 * Escolher o arquivo e transformá-lo em um extrato lido.
 * O arquivo é lido no próprio aparelho: o PDF não é enviado a servidor nenhum.
 */
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { looksLikeItauAccount, looksLikeItauCard, parseItauAccount, parseItauCard } from "./itau";
import { looksLikeNubankCsv, parseNubankCsv } from "./nubankCsv";
import type { PdfPage } from "./pdfText";
import { layoutPdfText } from "./pdfText";
import type { ParsedStatement } from "./types";

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

export async function pickStatementFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "text/csv", "text/comma-separated-values", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return { name: asset.name, bytes: new Uint8Array(buffer) };
}

const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // "%PDF"

interface PdfJs {
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDoc> };
  GlobalWorkerOptions: { workerSrc: string };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(o: { scale: number }): { width: number };
    getTextContent(): Promise<{ items: { str?: string; transform?: number[]; width?: number }[] }>;
  }>;
}

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js é servido pelo próprio site (pasta public/pdfjs) e só carrega quando alguém importa um PDF. */
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    const origin = window.location.origin;
    // import() dinâmico fora do alcance do bundler: o arquivo não faz parte do pacote do app.
    const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<PdfJs>;
    pdfjsPromise = dynamicImport(`${origin}/pdfjs/pdf.min.mjs`).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `${origin}/pdfjs/pdf.worker.min.mjs`;
      return mod;
    });
    pdfjsPromise.catch(() => (pdfjsPromise = null));
  }
  return pdfjsPromise;
}

async function readPdfPages(bytes: Uint8Array): Promise<PdfPage[]> {
  const pdfjs = await loadPdfJs();
  let doc: PdfDoc;
  try {
    doc = await pdfjs.getDocument({ data: bytes }).promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "PasswordException") throw new Error("Este PDF está protegido por senha. Baixe a versão sem senha no app do banco.");
    throw new Error("Não consegui abrir este PDF.");
  }
  const pages: PdfPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push({
      width: page.getViewport({ scale: 1 }).width,
      items: content.items
        .filter((i) => typeof i.str === "string" && i.transform)
        .map((i) => ({ x: i.transform![4]!, y: i.transform![5]!, w: i.width ?? 0, str: i.str! })),
    });
  }
  return pages;
}

export const SUPPORTED_HINT = "Fatura do cartão Itaú (PDF), extrato da conta Itaú (PDF) e fatura do Nubank (CSV).";

export async function parseStatementFile(file: PickedFile): Promise<ParsedStatement> {
  if (isPdf(file.bytes)) {
    if (Platform.OS !== "web") {
      throw new Error("Por enquanto, PDFs são importados pelo site. No iPhone, importe o CSV ou use o navegador.");
    }
    const text = layoutPdfText(await readPdfPages(file.bytes));
    if (looksLikeItauCard(text)) return parseItauCard(text);
    if (looksLikeItauAccount(text)) return parseItauAccount(text);
    if (text.lines.length === 0) throw new Error("Este PDF parece ser uma imagem escaneada; ainda não lemos esse tipo.");
    throw new Error(`Não reconheci este PDF. Por enquanto lemos: ${SUPPORTED_HINT}`);
  }
  const text = new TextDecoder("utf-8").decode(file.bytes);
  if (looksLikeNubankCsv(text)) return parseNubankCsv(text, file.name);
  throw new Error(`Não reconheci este arquivo. Por enquanto lemos: ${SUPPORTED_HINT}`);
}
