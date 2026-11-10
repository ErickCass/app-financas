/**
 * Itaú: fatura do cartão (PDF) e extrato da conta corrente (PDF).
 * Recebe o texto já organizado em linhas por `layoutPdfText`.
 */
import { isCardPayment } from "@/domain/cardPayment";
import type { Cents } from "@/domain/money";
import { addMonthsToDate, brDate, parseBRL, tidy } from "./text";
import type { ParsedItem, ParsedStatement, TotalCheck } from "./types";
import type { PdfText } from "./pdfText";

const VALUE = String.raw`(-)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})`;
const money = (minus: string | undefined, v: string): Cents => (minus ? -1 : 1) * parseBRL(v);

export function looksLikeItauCard(text: PdfText): boolean {
  const all = text.lines.join("\n");
  return /Total desta fatura/i.test(all) && /Lançamentos: compras e saques|Lançamentos internacionais/i.test(all);
}

export function looksLikeItauAccount(text: PdfText): boolean {
  const all = text.lines.join("\n");
  return /extrato conta/i.test(all) && /SALDO DO DIA/.test(all);
}

function find(lines: string[], re: RegExp): RegExpMatchArray | null {
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m;
  }
  return null;
}

// ---------------------------------------------------------------- fatura do cartão

type Section = "none" | "purchases" | "international" | "services" | "future";

export function parseItauCard(text: PdfText): ParsedStatement {
  const due = find(text.lines, /Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/);
  const issued = find(text.lines, /Emiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4})/);
  const total = find(text.lines, new RegExp(String.raw`Total desta fatura\s+${VALUE}`));
  const card = find(text.lines, /Cart[aã]o\s+\d{4}\.X{4}\.X{4}\.(\d{4})/);
  const nextClosing = find(text.lines, /Previs[aã]o pr[oó]x\.? Fechamento:\s*(\d{2})\/\d{2}\/\d{4}/i);
  if (!due || !issued) throw new Error("Não encontrei o vencimento e a emissão na fatura do Itaú.");

  const dueDate = brDate(due[1]!);
  const closing = brDate(issued[1]!);

  /** "28/09" → data completa: o ano da emissão, ou o anterior se cair depois do fechamento. */
  const fullDate = (dd: string, mm: string): string => {
    const year = Number(closing.slice(0, 4));
    const candidate = `${year}-${mm}-${dd}`;
    // Folga de 10 dias: lançamentos podem ter data um pouco depois da emissão.
    const limit = new Date(Date.parse(closing) + 10 * 86400000).toISOString().slice(0, 10);
    return candidate > limit ? `${year - 1}-${mm}-${dd}` : candidate;
  };

  const items: ParsedItem[] = [];
  const checks: TotalCheck[] = [];
  let section: Section = "none";
  let cardLast4: string | undefined;
  let last: ParsedItem | null = null;

  const sumWhere = (pred: (i: ParsedItem) => boolean) => -items.filter(pred).reduce((s, i) => s + i.amount, 0);

  for (const raw of text.columns) {
    const line = raw.trim();

    // Subtotais e totais (conferências)
    let m = line.match(new RegExp(String.raw`^Lançamentos no cartão \(final (\d{4})\)\s+${VALUE}$`));
    if (m) {
      const last4 = m[1]!;
      checks.push({
        label: `Compras nacionais, cartão final ${last4}`,
        declared: money(m[2], m[3]!),
        computed: sumWhere((i) => i.cardLast4 === last4 && !i.international && i.bankCategory !== "__service"),
      });
      continue;
    }
    m = line.match(new RegExp(String.raw`^Total lançamentos inter\. em R\$\s+${VALUE}$`));
    if (m) {
      const last4 = cardLast4;
      checks.push({
        label: `Internacionais com IOF, cartão final ${last4}`,
        declared: money(m[1], m[2]!),
        computed: sumWhere((i) => i.cardLast4 === last4 && Boolean(i.international)),
      });
      continue;
    }
    m = line.match(new RegExp(String.raw`^Repasse de IOF em R\$\s+${VALUE}$`));
    if (m) {
      items.push({
        date: closing,
        description: "IOF de compras internacionais",
        amount: -money(m[1], m[2]!),
        cardLast4,
        international: true,
      });
      last = null;
      continue;
    }
    m = line.match(new RegExp(String.raw`^Lançamentos produtos e serviços\s+${VALUE}$`));
    if (m) {
      checks.push({
        label: "Produtos e serviços",
        declared: money(m[1], m[2]!),
        computed: sumWhere((i) => i.bankCategory === "__service"),
      });
      continue;
    }
    m = line.match(new RegExp(String.raw`Total dos lançamentos atuais\s+${VALUE}$`));
    if (m) {
      checks.push({ label: "Total da fatura", declared: money(m[1], m[2]!), computed: sumWhere(() => true) });
      continue;
    }
    if (/^Total transações inter\./.test(line)) continue;

    // Seções
    if (/^Compras parceladas - próximas faturas/.test(line)) {
      section = "future";
      continue;
    }
    if (/^Lançamentos: compras e saques/.test(line)) {
      if (section !== "future") section = "purchases";
      continue;
    }
    if (/^Lançamentos internacionais/.test(line)) {
      if (section !== "future") section = "international";
      continue;
    }
    if (/^Lançamentos: produtos e serviços/.test(line)) {
      if (section !== "future") section = "services";
      continue;
    }
    m = line.match(/\(final (\d{4})\)$/);
    if (m) {
      cardLast4 = m[1];
      continue;
    }
    if (section === "none" || section === "future") continue;

    // Lançamento: "28/09   UBER *TRIP HELP.UBER.CO   30,78"
    m = line.match(new RegExp(String.raw`^(\d{2})\/(\d{2})\s+(.+?)\s{3,}${VALUE}$`));
    if (m) {
      const [, dd, mm, desc, minus, value] = m;
      const description = tidy(desc!);
      const purchaseDate = fullDate(dd!, mm!);
      // Parcelado: "PET LOVE*Clube 0A 05/12" = parcela 5 de 12.
      const inst = description.match(/\s(\d{2})\/(\d{2})$/);
      const n = Number(inst?.[1]);
      const totalInst = Number(inst?.[2]);
      const installment = inst && n >= 1 && n <= totalInst && totalInst > 1 ? { n, total: totalInst } : undefined;
      const item: ParsedItem = {
        // Parcela n entra no orçamento n−1 meses depois da compra.
        date: installment ? addMonthsToDate(purchaseDate, installment.n - 1) : purchaseDate,
        description,
        amount: -money(minus, value!),
        cardLast4,
        installment,
        international: section === "international" || undefined,
        bankCategory: section === "services" ? "__service" : undefined,
      };
      items.push(item);
      last = item;
      continue;
    }

    // Linha de detalhe da compra nacional: "VEÍCULOS .SAO PAULO", "TURISMO E ENTRETENIM.SAO PAULO"
    if (last && section === "purchases" && !last.bankCategory) {
      const cat = line.match(/^([A-ZÀ-Ü][A-ZÀ-Ü ]{2,}?)\s?\.\S/);
      if (cat) last.bankCategory = cat[1]!.trim();
      last = null;
    }
  }

  for (const i of items) if (i.bankCategory === "__service") i.bankCategory = "SERVIÇOS";

  return {
    institution: "itau",
    kind: "credit_card",
    suggestedAccountName: card ? `Cartão Itaú •••• ${card[1]}` : "Cartão Itaú",
    last4: card?.[1],
    dueDate,
    statementMonth: dueDate.slice(0, 7),
    dueDay: Number(dueDate.slice(8, 10)),
    closingDay: nextClosing ? Number(nextClosing[1]) : Number(closing.slice(8, 10)),
    declaredTotal: total ? money(total[1], total[2]!) : undefined,
    items,
    checks,
  };
}

// ---------------------------------------------------------------- extrato da conta corrente

export function parseItauAccount(text: PdfText): ParsedStatement {
  const holder = find(text.lines, /^\s*(.+?)\s+\d{3}\.\d{3}\.\d{3}-\d{2}/);
  const account = find(text.lines, /conta:\s*(\d+)-(\d)/);
  const issued = find(text.lines, /emitido em:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);

  // "PIX TRANSF FULANO 15/09": o Itaú mostra os 7 primeiros caracteres do nome de quem recebe.
  // Se for o próprio titular, é transferência entre contas dele, não despesa.
  const short = (holder?.[1] ?? "").trim().slice(0, 7).trim().toUpperCase();
  const ownName = short.length >= 5 ? short : null;

  const items: ParsedItem[] = [];
  const balances: { date: string; amount: Cents }[] = [];

  for (const raw of text.lines) {
    const m = raw.trim().match(new RegExp(String.raw`^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{3,}${VALUE}(?:\s{3,}${VALUE})?$`));
    if (!m) continue;
    const [, d, desc, minus, value, minus2, value2] = m;
    const date = brDate(d!);
    const description = tidy(desc!);
    if (/^SALDO (DO DIA|ANTERIOR)/i.test(description)) {
      balances.push({ date, amount: money(value2 ? minus2 : minus, value2 ?? value!) });
      continue;
    }
    // O Itaú cola a data do PIX no fim do nome: "PIX WHATS MARIA24/09".
    const clean = description.replace(/(\D)\d{2}\/\d{2}$/, "$1").trim();
    const internal =
      isCardPayment(clean) || (ownName !== null && /^(PIX|TED|DOC)\b.*\bTRANSF\b/i.test(clean) && clean.toUpperCase().endsWith(` ${ownName}`));
    items.push({ date, description: clean, amount: money(minus, value!), internal: internal || undefined });
  }

  if (balances.length === 0) throw new Error("Não encontrei os saldos diários no extrato do Itaú.");
  const sortedBalances = [...balances].sort((a, b) => a.date.localeCompare(b.date));
  const opening = sortedBalances[0]!;
  const closing = sortedBalances.at(-1)!;

  const asOf = issued
    ? `${brDate(issued[1]!)}T${issued[2]!.length === 5 ? `${issued[2]}:00` : issued[2]}-03:00`
    : `${closing.date}T23:59:00-03:00`;

  return {
    institution: "itau",
    kind: "checking",
    suggestedAccountName: account ? `Conta Itaú •••• ${account[1]!.slice(-4)}` : "Conta Itaú",
    closingBalance: { amount: closing.amount, asOf },
    items,
    checks: [
      {
        label: "Saldo final do extrato",
        declared: closing.amount - opening.amount,
        computed: items.filter((i) => i.date > opening.date).reduce((s, i) => s + i.amount, 0),
      },
    ],
  };
}
