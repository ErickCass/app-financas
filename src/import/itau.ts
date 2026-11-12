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

const SALDO_LINE = /^SALDO (DO DIA|TOTAL DISPON\S* DIA|ANTERIOR)/i;

/** Cabeçalho de 5 colunas do PDF gerado pelo app do Itaú. */
const APP_HEADER = /^Data\s{2,}Lan[çc]amentos\s{2,}Descri[çc][ãa]o\s{2,}Valor/i;

export function looksLikeItauAccount(text: PdfText): boolean {
  const all = text.lines.join("\n");
  if (!/extrato conta/i.test(all)) return false;
  return (
    text.lines.some((l) => SALDO_LINE.test(l.replace(/^\d{2}\/\d{2}\/\d{4}\s+/, "").trim())) ||
    text.lines.some((l) => APP_HEADER.test(l.trim()))
  );
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
    upcoming: [],
    checks,
  };
}

// ---------------------------------------------------------------- extrato da conta corrente

export function parseItauAccount(text: PdfText): ParsedStatement {
  if (text.lines.some((l) => APP_HEADER.test(l.trim()))) return parseItauAccountApp(text);
  return parseItauAccountWeb(text);
}

/** Linhas que nunca são continuação da descrição anterior. */
const NOT_CONTINUATION =
  /^(Data\b|Lan[çc]amentos\b|Sa[íi]das futuras|Entradas futuras|Posi[çc][ãa]o consolidada|Per[íi]odo de|Emitido em|Extrato conta|Saldo em conta|R\$|Limite da Conta|\* ?Total|Pr[óo]ximos|P[áa]gina)/i;

/**
 * Extrato em PDF gerado pelo app do Itaú ("compartilhar"): colunas
 * Data | Lançamentos (tipo) | Descrição | Valor | Saldo, com textos que quebram
 * em mais de uma linha e a coluna Saldo sem o sinal de negativo.
 */
function parseItauAccountApp(text: PdfText): ParsedStatement {
  const holder = find(text.lines, /^\s*(.+?)\s+CPF:/i) ?? find(text.lines, /^\s*(.+?)\s+\d{3}\.\d{3}\.\d{3}-\d{2}/);
  const account = find(text.lines, /conta:\s*(\d+)-(\d)/i);
  const issued = find(text.lines, /Emitido em:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/i);
  const headerBalance = (() => {
    const i = text.lines.findIndex((l) => /^saldo em conta\b/i.test(l.trim()));
    const m = i >= 0 ? text.lines[i + 1]?.match(new RegExp(String.raw`^\s*R\$\s*${VALUE}`)) : null;
    return m ? money(m[1], m[2]!) : null;
  })();
  if (headerBalance === null) throw new Error("Não encontrei o saldo da conta neste extrato do Itaú.");

  const short = (holder?.[1] ?? "").trim().slice(0, 7).trim().toUpperCase();
  const ownName = short.length >= 5 ? short : null;

  const items: ParsedItem[] = [];
  const upcoming: ParsedItem[] = [];
  // A coluna Saldo vem sem sinal; o sinal é deduzido depois pela aritmética.
  const balances: { date: string; amount: Cents }[] = [];
  let future = false;
  let last: { list: ParsedItem[]; item: ParsedItem } | null = null;

  const isValue = (s: string) => new RegExp(String.raw`^${VALUE}$`).test(s.trim());

  for (const raw of text.lines) {
    const line = raw.trim();
    if (/^(sa[íi]das|entradas) futuras/i.test(line)) {
      future = true;
      last = null;
      continue;
    }
    if (/^lan[çc]amentos$/i.test(line)) {
      future = false;
      last = null;
      continue;
    }
    if (/^posi[çc][ãa]o consolidada/i.test(line)) break;

    const fields = line.split(/\s{3,}/).map((f) => f.trim()).filter((f) => f !== "");
    const first = fields[0] ?? "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(first)) {
      const date = brDate(first);
      // "12/11/2026   9.481,99": saldo do dia, sozinho na linha.
      if (fields.length === 2 && isValue(fields[1]!)) {
        const m = fields[1]!.match(new RegExp(String.raw`^${VALUE}$`))!;
        balances.push({ date, amount: money(m[1], m[2]!) });
        last = null;
        continue;
      }
      // "data | tipo | descrição | valor [| saldo]"
      const valueIndex = fields.findIndex((f, i) => i > 0 && isValue(f));
      if (valueIndex < 1) {
        last = null;
        continue;
      }
      const m = fields[valueIndex]!.match(new RegExp(String.raw`^${VALUE}$`))!;
      const description = tidy(fields.slice(1, valueIndex).join(" "));
      if (!description) {
        last = null;
        continue;
      }
      const internal =
        isCardPayment(description) ||
        (ownName !== null && /\b(PIX|TED|DOC|TRANSF)\b/i.test(description) && description.toUpperCase().includes(ownName));
      const item: ParsedItem = { date, description, amount: money(m[1], m[2]!), internal: internal || undefined };
      const list = future ? upcoming : items;
      list.push(item);
      last = { list, item };
      continue;
    }
    // Continuação da descrição anterior ("SCHOOL", "CODE   SHARSHARA").
    if (last && !NOT_CONTINUATION.test(line) && fields.length <= 2 && line.length <= 60) {
      last.item.description = tidy(`${last.item.description} ${fields.join(" ")}`);
      continue;
    }
    last = null;
  }

  if (items.length === 0) throw new Error("Não encontrei lançamentos neste extrato do Itaú.");

  const asOf = issued
    ? `${brDate(issued[1]!)}T${issued[2]!.length === 5 ? `${issued[2]}:00` : issued[2]}-03:00`
    : `${items[0]!.date}T23:59:00-03:00`;

  // Saldo inicial: a coluna Saldo não traz o sinal, então vale o sinal que fecha a conta.
  const checks: TotalCheck[] = [];
  const opening = [...balances].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (opening) {
    const movement = items.filter((i) => i.date > opening.date).reduce((s, i) => s + i.amount, 0);
    const candidates = [Math.abs(opening.amount), -Math.abs(opening.amount)];
    const chosen = candidates.find((c) => c + movement === headerBalance) ?? candidates[1]!;
    checks.push({ label: "Saldo final do extrato", declared: headerBalance - chosen, computed: movement });
  }

  return {
    institution: "itau",
    kind: "checking",
    suggestedAccountName: account ? `Conta Itaú •••• ${account[1]!.slice(-4)}` : "Conta Itaú",
    closingBalance: { amount: headerBalance, asOf },
    items,
    upcoming,
    checks,
  };
}

function parseItauAccountWeb(text: PdfText): ParsedStatement {
  const holder = find(text.lines, /^\s*(.+?)\s+\d{3}\.\d{3}\.\d{3}-\d{2}/);
  const account = find(text.lines, /conta:\s*(\d+)-(\d)/);
  const issued = find(text.lines, /emitido em:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);

  // "PIX TRANSF FULANO 15/09": o Itaú mostra os 7 primeiros caracteres do nome de quem recebe.
  // Se for o próprio titular, é transferência entre contas dele, não despesa.
  const short = (holder?.[1] ?? "").trim().slice(0, 7).trim().toUpperCase();
  const ownName = short.length >= 5 ? short : null;

  // Cabeçalho "saldo em conta": vale mais que o último saldo diário, porque
  // os lançamentos de hoje ainda não têm linha de saldo.
  const headerBalance = (() => {
    const i = text.lines.findIndex((l) => /^saldo em conta\b/i.test(l.trim()));
    const m = i >= 0 ? text.lines[i + 1]?.match(new RegExp(String.raw`^\s*R\$\s*${VALUE}`)) : null;
    return m ? money(m[1], m[2]!) : null;
  })();

  const items: ParsedItem[] = [];
  const upcoming: ParsedItem[] = [];
  const balances: { date: string; amount: Cents }[] = [];
  let future = false;

  for (const raw of text.lines) {
    const line = raw.trim();
    // "saídas/entradas futuras": agendados que ainda não saíram da conta.
    if (/^(sa[ií]das|entradas) futuras/i.test(line)) {
      future = true;
      continue;
    }
    if (/^lan[çc]amentos$/i.test(line) || /^data\s+lan[çc]amentos\s+valor/i.test(line)) {
      future = false;
      continue;
    }
    const m = line.match(new RegExp(String.raw`^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{3,}${VALUE}(?:\s{3,}${VALUE})?$`));
    if (!m) continue;
    const [, d, desc, minus, value, minus2, value2] = m;
    const date = brDate(d!);
    const description = tidy(desc!);
    if (SALDO_LINE.test(description)) {
      balances.push({ date, amount: money(value2 ? minus2 : minus, value2 ?? value!) });
      continue;
    }
    // O Itaú cola a data do PIX no fim do nome: "PIX WHATS MARIA24/09".
    const clean = description.replace(/(\D)\d{2}\/\d{2}$/, "$1").trim();
    const internal =
      isCardPayment(clean) || (ownName !== null && /^(PIX|TED|DOC)\b.*\bTRANSF\b/i.test(clean) && clean.toUpperCase().endsWith(` ${ownName}`));
    const item: ParsedItem = { date, description: clean, amount: money(minus, value!), internal: internal || undefined };
    (future ? upcoming : items).push(item);
  }

  if (balances.length === 0) throw new Error("Não encontrei os saldos diários no extrato do Itaú.");
  const sortedBalances = [...balances].sort((a, b) => a.date.localeCompare(b.date));
  const opening = sortedBalances[0]!;
  const lastDaily = sortedBalances.at(-1)!;
  const closingAmount = headerBalance ?? lastDaily.amount;

  const asOf = issued
    ? `${brDate(issued[1]!)}T${issued[2]!.length === 5 ? `${issued[2]}:00` : issued[2]}-03:00`
    : `${lastDaily.date}T23:59:00-03:00`;

  return {
    institution: "itau",
    kind: "checking",
    suggestedAccountName: account ? `Conta Itaú •••• ${account[1]!.slice(-4)}` : "Conta Itaú",
    closingBalance: { amount: closingAmount, asOf },
    items,
    upcoming,
    checks: [
      {
        label: "Saldo final do extrato",
        declared: closingAmount - opening.amount,
        computed: items.filter((i) => i.date > opening.date).reduce((s, i) => s + i.amount, 0),
      },
    ],
  };
}
