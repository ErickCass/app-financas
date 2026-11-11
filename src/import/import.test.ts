import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "@/domain/types";
import { rulePattern, suggestCategory } from "./categorize";
import { parseItauAccount, parseItauCard, looksLikeItauAccount, looksLikeItauCard } from "./itau";
import { parseNubankCsv, splitCsvLine } from "./nubankCsv";
import { columnSplit, layoutPdfText, type PdfPage } from "./pdfText";
import { buildImportPlan, importKeys } from "./plan";
import { addMonthsToDate, parseBRL } from "./text";

// Dados fictícios, no mesmo formato dos arquivos reais dos bancos.

const CATEGORIES: Category[] = [
  { id: "mer", name: "Mercado", kind: "variable", color: "#000" },
  { id: "res", name: "Restaurantes", kind: "variable", color: "#000" },
  { id: "tra", name: "Transporte", kind: "variable", color: "#000" },
  { id: "com", name: "Compras", kind: "variable", color: "#000" },
  { id: "laz", name: "Lazer", kind: "variable", color: "#000" },
  { id: "ass", name: "Assinaturas", kind: "variable", color: "#000" },
  { id: "sau", name: "Saúde", kind: "variable", color: "#000" },
  { id: "ren", name: "Renda", kind: "income", color: "#000" },
];

describe("valores e datas", () => {
  it("lê reais com milhar, sinal e espaço", () => {
    expect(parseBRL("1.661,92")).toBe(166192);
    expect(parseBRL("- 58,16")).toBe(-5816);
    expect(parseBRL("R$ -10.549,17")).toBe(-1054917);
    expect(parseBRL("0,28")).toBe(28);
    expect(() => parseBRL("12.5")).toThrow();
  });
  it("soma meses mantendo o dia válido", () => {
    expect(addMonthsToDate("2026-06-28", 4)).toBe("2026-10-28");
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("Nubank CSV", () => {
  const csv = [
    "date,title,amount",
    '2026-11-10,Mp *Zionburguer,"47,80"',
    '2026-11-08,Hotel At Booking.Com,"1.661,92"',
    '2026-11-07,Ri Happy - NuPay,"399,91"',
    '2026-11-07,Ri Happy - NuPay,"399,91"',
    '2026-11-07,Ri Happy - NuPay,"- 399,91"',
    '2026-11-03,IOF de compra internacional,"18,25"',
    '2026-11-01,Pagamento recebido,"- 3.000,00"',
  ].join("\n");

  it("divide CSV com vírgula dentro das aspas", () => {
    expect(splitCsvLine('2026-11-10,Loja, Centro,"1,00"')).toEqual(["2026-11-10", "Loja", " Centro", "1,00"]);
  });

  it("inverte o sinal, marca o pagamento e tira o vencimento do nome do arquivo", () => {
    const st = parseNubankCsv(csv, "Nubank_2026-12-01.csv");
    expect(st.statementMonth).toBe("2026-12");
    expect(st.dueDay).toBe(1);
    expect(st.closingDay).toBe(24);
    expect(st.items).toHaveLength(7);
    expect(st.items[1]!.amount).toBe(-166192);
    expect(st.items[4]!.amount).toBe(39991); // estorno vira entrada
    expect(st.items[6]!.internal).toBe(true);
  });

  it("recusa CSV de outro formato", () => {
    expect(() => parseNubankCsv("data,valor\n1,2")).toThrow(/Nubank/);
  });
});

/** Página com itens posicionados como o pdf.js entrega (y cresce para cima). */
function page(rows: [number, number, string, number?][]): PdfPage {
  return { width: 595, items: rows.map(([x, y, str, w]) => ({ x, y, str, w: w ?? str.length * 4 })) };
}

describe("texto do PDF", () => {
  it("junta pedaços da mesma palavra e separa campos distantes", () => {
    const text = layoutPdfText([
      page([
        [151, 700, "28/09", 18],
        [178, 700, "UBER *TRIP", 40],
        [323, 700, "30,78", 17],
        [178, 691, "VE", 7],
        [185, 691, "Í", 2],
        [187, 691, "CULOS .SAO PAULO", 58],
        [151, 600, "29/09", 18],
        [367, 700, "02/10", 18],
        [394, 700, "CARREFOUR", 40],
        [539, 700, "694,52", 21],
        [367, 600, "03/10", 18],
      ]),
    ]);
    expect(text.columns.slice(0, 3)).toEqual(["28/09   UBER *TRIP   30,78", "VEÍCULOS .SAO PAULO", "29/09"]);
    expect(text.columns[3]).toBe("02/10   CARREFOUR   694,52");
  });

  it("página de uma coluna não é dividida", () => {
    expect(columnSplit(page([[40, 700, "10/11/2026"], [40, 690, "09/11/2026"]]))).toBeNull();
  });
});

const ITAU_CARD = {
  lines: [
    "Total desta fatura   1.500,20",
    "Vencimento: 06/02/2027",
    "Emissão: 30/01/2027",
    "Previsão prox. Fechamento: 28/02/2027",
    "Cartão   4191.XXXX.XXXX.1234",
    "Lançamentos: compras e saques",
    "Lançamentos internacionais",
  ],
  columns: [
    "Lançamentos: compras e saques",
    "FULANO DE TAL (final 1111)",
    "DATA   ESTABELECIMENTO   VALOR EM R$",
    "28/12   UBER *TRIP HELP.UBER.CO   30,00",
    "VEÍCULOS .SAO PAULO",
    "05/01   PADOCA DO BAIRRO   20,00",
    "ALIMENTAÇÃO .SAO BERNARDO",
    "Continua...",
    "Lançamentos: compras e saques",
    "10/01   LOJA QUALQUER   100,00",
    "VESTUÁRIO .SANTO ANDRE",
    "Lançamentos no cartão (final 1111)   150,00",
    "FULANO DE TAL (final 2222)",
    "28/10   PET LOVE*Clube 0A 04/12   10,00",
    "HOBBY .SAO PAULO",
    "15/01   APPLE.COM/BILL   40,00",
    "TURISMO E ENTRETENIM.SAO PAULO",
    "Lançamentos no cartão (final 2222)   50,00",
    "Lançamentos internacionais",
    "FULANO DE TAL (final 1111)",
    "DATA   ESTABELECIMENTO   US$   R$",
    "20/01   COURTYARD BY MARRIOTT   1.300,00",
    "JERSEY CITY   250,00   USD   250,00",
    "Dólar de Conversão R$ 5,20",
    "21/01   ACME 0192   - 40,00",
    "PAOLI   7,69   USD   - 7,69",
    "Dólar de Conversão R$ 5,20",
    "Crédito cartão final (1111) em R$   40,00",
    "Total transações inter. em R$   1.260,00",
    "Repasse de IOF em R$   25,30",
    "Total lançamentos inter. em R$   1.285,30",
    "Lançamentos: produtos e serviços",
    "27/01   TARIFA 2A VIA CARTAO   14,90",
    "Lançamentos produtos e serviços   14,90",
    "L Total dos lançamentos atuais   1.500,20",
    "Compras parceladas - próximas faturas",
    "28/10   PET LOVE*Clube 0A 05/12   10,00",
  ],
};

describe("fatura Itaú", () => {
  const st = parseItauCard(ITAU_CARD);

  it("reconhece o arquivo", () => {
    expect(looksLikeItauCard(ITAU_CARD)).toBe(true);
    expect(looksLikeItauAccount(ITAU_CARD)).toBe(false);
  });

  it("lê cabeçalho, cartões e todas as conferências batem", () => {
    expect(st.dueDate).toBe("2027-02-06");
    expect(st.statementMonth).toBe("2027-02");
    expect(st.closingDay).toBe(28);
    expect(st.last4).toBe("1234");
    expect(st.declaredTotal).toBe(150020);
    expect(st.checks.length).toBe(5);
    for (const c of st.checks) expect(c.computed, c.label).toBe(c.declared);
  });

  it("ignora as próximas faturas e lê sinais, cartões e categoria do banco", () => {
    expect(st.items).toHaveLength(9); // 5 nacionais + 2 internacionais + IOF + tarifa
    const uber = st.items[0]!;
    expect(uber).toMatchObject({ date: "2026-12-28", amount: -3000, cardLast4: "1111", bankCategory: "VEÍCULOS" });
    expect(st.items.find((i) => i.description === "ACME 0192")!.amount).toBe(4000);
    expect(st.items.find((i) => i.description.startsWith("IOF"))!.amount).toBe(-2530);
  });

  it("parcela entra no orçamento do mês da parcela", () => {
    const pet = st.items.find((i) => i.description.startsWith("PET LOVE"))!;
    expect(pet.installment).toEqual({ n: 4, total: 12 });
    expect(pet.date).toBe("2027-01-28"); // compra em 28/10/2026 + 3 meses
  });
});

const ITAU_ACCOUNT = {
  lines: [
    "FULANO DE TAL SILVA   123.456.789-00   agência: 1234   conta: 012345-6",
    "extrato conta / lançamentos",
    "período de visualização: 01/10/2026 até 10/11/2026   emitido em: 10/11/2026   18:40:19",
    "10/11/2026   SALDO DO DIA   -1.000,00",
    "09/11/2026   PIX WHATS MARIA09/11   -500,00",
    "09/11/2026   PAG BOLETO ITAU UNIBANCO HOLDING S.A.   -2.000,00",
    "09/11/2026   SALDO DO DIA   -1.000,00",
    "05/11/2026   PIX TRANSF FULANO 05/11   -300,00",
    "05/11/2026   REMUNERACAO/SALARIO 0000053   3.000,00",
    "05/11/2026   SALDO DO DIA   1.500,00",
    "01/10/2026   SALDO DO DIA   -1.200,00",
  ],
  columns: [],
};

describe("extrato Itaú", () => {
  const st = parseItauAccount(ITAU_ACCOUNT);

  it("lê saldo final, emissão e confere com os saldos", () => {
    expect(st.closingBalance).toEqual({ amount: -100000, asOf: "2026-11-10T18:40:19-03:00" });
    expect(st.checks[0]!.computed).toBe(st.checks[0]!.declared);
    expect(st.suggestedAccountName).toBe("Conta Itaú •••• 2345");
  });

  it("limpa a data do PIX e marca fatura e transferência própria como internas", () => {
    expect(st.items.map((i) => i.description)).toEqual([
      "PIX WHATS MARIA",
      "PAG BOLETO ITAU UNIBANCO HOLDING S.A.",
      "PIX TRANSF FULANO",
      "REMUNERACAO/SALARIO 0000053",
    ]);
    expect(st.items.map((i) => Boolean(i.internal))).toEqual([false, true, true, false]);
  });
});

describe("categorias", () => {
  const cat = (description: string, amount = -1000, bankCategory?: string) =>
    suggestCategory({ description, amount, bankCategory }, CATEGORIES, [])?.categoryId ?? null;

  it("usa palavras-chave antes da categoria do banco", () => {
    expect(cat("UBER * PENDING")).toBe("tra");
    expect(cat("Drogasil4632")).toBe("sau");
    expect(cat("Yukusuesushibar")).toBe("res");
    expect(cat("Amazon Prime Canais", -1000, "TURISMO E ENTRETENIM")).toBe("ass");
    expect(cat("MERCADOLIVRE*CASADOPERI")).toBe("com");
    expect(cat("OBA HORTIFRUTI S O BER", -1000, "ALIMENTAÇÃO")).toBe("mer");
    expect(cat("REMUNERACAO/SALARIO 0000053", 300000)).toBe("ren");
  });

  it("cai na categoria do banco e, sem nada, deixa em branco", () => {
    expect(cat("PADOCA DO BAIRRO", -1000, "ALIMENTAÇÃO")).toBe("res");
    expect(cat("Joaosilvaexemplo")).toBeNull();
  });

  it("regra aprendida vence tudo", () => {
    const rules = [{ pattern: rulePattern("Kennedy Boutique D"), categoryId: "res" }];
    expect(suggestCategory({ description: "KENNEDY BOUTIQUE D", amount: -100 }, CATEGORIES, rules)?.categoryId).toBe("res");
    expect(rulePattern("DROGASIL4632")).toBe(rulePattern("Drogasil4632"));
    expect(rulePattern("PIX TRANSF JOAO L14/10")).toBe(rulePattern("PIX TRANSF JOAO L28/10"));
  });
});

describe("prévia da importação", () => {
  const st = parseNubankCsv(
    [
      "date,title,amount",
      '2026-11-07,Ri Happy - NuPay,"399,91"',
      '2026-11-07,Ri Happy - NuPay,"399,91"',
      '2026-11-07,Ri Happy - NuPay,"- 399,91"',
      '2026-11-03,Joaosilvaexemplo,"120,00"',
    ].join("\n"),
    "Nubank_2026-12-01.csv",
  );

  it("chaves são estáveis e distinguem lançamentos idênticos", () => {
    const keys = importKeys(st);
    expect(new Set(keys).size).toBe(4);
    expect(importKeys(st)).toEqual(keys);
  });

  it("marca o que já foi importado ou lançado à mão e calcula o gasto líquido", () => {
    const keys = importKeys(st);
    const manual: Transaction = {
      id: "m1",
      accountId: "card",
      date: "2026-11-03",
      description: "Joao",
      amount: -12000,
      categoryId: null,
      source: "manual",
    };
    const plan = buildImportPlan({
      statement: st,
      accountId: "card",
      categories: CATEGORIES,
      rules: [],
      importedKeys: new Set([keys[0]!]),
      existing: [manual],
    });
    expect(plan.rows.map((r) => r.duplicate)).toEqual(["imported", null, null, "manual"]);
    expect(plan.newRows).toHaveLength(2);
    expect(plan.spending).toBe(39991 + 12000);
    // o estorno herda a categoria da compra
    expect(plan.rows[2]!.categoryId).toBe("com");
    expect(plan.mismatches).toEqual([]);
  });
});
