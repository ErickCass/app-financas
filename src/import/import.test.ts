import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "@/domain/types";
import { rulePattern, suggestCategory } from "./categorize";
import { parseItauAccount, parseItauCard, looksLikeItauAccount, looksLikeItauCard } from "./itau";
import { looksLikeItauCardXlsx, parseItauCardXlsx } from "./itauCardXlsx";
import { looksLikeFlashCsv, parseFlashCsv } from "./flashCsv";
import type { Sheet } from "./xlsx";
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
    expect(st.upcoming).toEqual([]);
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

const ITAU_ACCOUNT_V2 = {
  lines: [
    "FULANO DE TAL SILVA   123.456.789-00   agência: 1234   conta: 012345-6",
    "saldo em conta   Limite da Conta utilizado   Limite da Conta disponível",
    "R$ -1.500,00   R$ 1.500,00   R$ 8.500,00",
    "extrato conta corrente",
    "lançamentos futuros",
    "período de visualização: de 01/10/2026 até 10/11/2026",
    "emitido em: 10/11/2026   23:45:50",
    "saídas futuras",
    "data   lançamentos futuros   valor (R$)   saldo (R$)",
    "10/11/2026   DA VIVO-SP 123456   -270,10",
    "lançamentos",
    "data   lançamentos   valor (R$)   saldo (R$)",
    "10/11/2026   PAG BOLETO ESCOLA   -500,00",
    "09/11/2026   SALDO TOTAL DISPONÍVEL DIA   -1.000,00",
    "09/11/2026   PIX WHATS MARIA09/11   -200,00",
    "30/09/2026   SALDO ANTERIOR   -800,00",
  ],
  columns: [],
};

describe("extrato Itaú, formato com lançamentos futuros", () => {
  const st = parseItauAccount(ITAU_ACCOUNT_V2);

  it("reconhece o arquivo e usa o saldo do cabeçalho", () => {
    expect(looksLikeItauAccount(ITAU_ACCOUNT_V2)).toBe(true);
    // O saldo diário mais recente é de ontem; o do cabeçalho já inclui hoje.
    expect(st.closingBalance).toEqual({ amount: -150000, asOf: "2026-11-10T23:45:50-03:00" });
    expect(st.checks[0]!.computed).toBe(st.checks[0]!.declared);
  });

  it("separa as saídas futuras dos lançamentos", () => {
    expect(st.items.map((i) => i.description)).toEqual(["PAG BOLETO ESCOLA", "PIX WHATS MARIA"]);
    expect(st.upcoming).toEqual([{ date: "2026-11-10", description: "DA VIVO-SP 123456", amount: -27010, internal: undefined }]);
  });
});

describe("fatura aberta do Itaú em planilha", () => {
  // Mesma estrutura do arquivo do banco: resumo em cima, lançamentos abaixo.
  const sheet: Sheet = [
    [null, "Nome", "Fulano De Tal"],
    [null, "Fatura Aberta - Dezembro/2026"],
    [null, "Cartão", null, null, null, "Valor (parcial)", null, "Vencimento"],
    [null, "Cartao Exemplo - final 1234", null, null, null, 1500.5, null, new Date(Date.UTC(2026, 11, 6))],
    [],
    [null, "Data", "Lançamento", "Parcelamento", "Valor", null, "Titularidade", "Nome", "Tipo do cartão", "Número do cartão"],
    [null, new Date(Date.UTC(2026, 9, 30)), "Pagamento Efetuado", null, -900, null, "Titular", "F", "Físico", "****4783"],
    [null, new Date(Date.UTC(2026, 10, 7)), "Padoca Do Bairro", null, 100.5, null, "Titular", "F", "Físico", "****1234"],
    [null, new Date(Date.UTC(2026, 10, 6)), "Airbnb * Abc", null, -50, null, "Titular", "F", "Virtual recorrente", "****5678"],
    [null, new Date(Date.UTC(2026, 5, 28)), "Pet Love*clube", "Parcela 6 de 12", 2.9, null, "Titular", "F", "Virtual", "****5678"],
  ];
  const st = parseItauCardXlsx(sheet);

  it("reconhece a planilha e lê vencimento, mês e cartão", () => {
    expect(looksLikeItauCardXlsx(sheet)).toBe(true);
    expect(st.dueDate).toBe("2026-12-06");
    expect(st.statementMonth).toBe("2026-12");
    expect(st.last4).toBe("1234");
    // Fatura aberta: o total ainda vai mudar, então não vira valor declarado.
    expect(st.declaredTotal).toBeUndefined();
  });

  it("inverte o sinal, marca o pagamento e põe a parcela no mês dela", () => {
    expect(st.items.map((i) => i.amount)).toEqual([90000, -10050, 5000, -290]);
    expect(st.items[0]!.internal).toBe(true);
    expect(st.items[1]!.cardLast4).toBe("1234");
    expect(st.items[3]).toMatchObject({ date: "2026-11-28", installment: { n: 6, total: 12 } });
  });

  it("avisa quando o parcial do banco inclui o que não está detalhado", () => {
    // 100,50 − 50,00 + 2,90 = 53,40 listados; o banco informa 1.500,50.
    expect(st.notes?.[0]).toContain("R$ 1.447,10");
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

describe("extrato Flash (benefício)", () => {
  const csv = [
    "Data,Hora,Movimentação,Valor,Meio de Pagamento,Saldo",
    '10/11/2026,21:19,OBA HORTIFRUTI S SAO BERNARDO BRA,"-R$ 941,57",Cartão,"R$ 510,29"',
    '31/10/2026,17:16,Market4uGestaoDe Fazenda Rio G BR,"-R$ 0,00",Cartão,"R$ 3.397,86"',
    '28/10/2026,00:06,Depósito transferido,"R$ 1.352,56",Depósito,"R$ 3.421,62"',
  ].join("\n");
  const st = parseFlashCsv(csv, "flash_extrato_10-2026_abc.csv");

  it("reconhece, lê o saldo mais recente e ignora R$ 0,00", () => {
    expect(looksLikeFlashCsv(csv)).toBe(true);
    expect(st.kind).toBe("benefit");
    expect(st.closingBalance).toEqual({ amount: 51029, asOf: "2026-11-10T21:19:00-03:00" });
    expect(st.items).toHaveLength(2);
  });

  it("compra sai do saldo e carga da empresa é interna (não é renda)", () => {
    expect(st.items[0]).toMatchObject({ date: "2026-11-10", amount: -94157, description: "OBA HORTIFRUTI S SAO BERNARDO BRA" });
    expect(st.items[1]).toMatchObject({ amount: 135256, internal: true });
  });
});

describe("categorias com nomes próprios", () => {
  // Como ficam as categorias de quem renomeou tudo.
  const MINHAS: Category[] = [
    { id: "cu", name: "Combustível / Uber", kind: "variable", color: "#000" },
    { id: "rl", name: "Restaurantes / Lazer", kind: "variable", color: "#000" },
    { id: "me", name: "Mercado", kind: "variable", color: "#000" },
    { id: "vi", name: "Viagens", kind: "variable", color: "#000" },
    { id: "sa", name: "Saúde", kind: "variable", color: "#000" },
    { id: "pet", name: "PET", kind: "fixed", color: "#000" },
    { id: "cl", name: "Claude", kind: "fixed", color: "#000" },
    { id: "ci", name: "Celular + Internet", kind: "fixed", color: "#000" },
    { id: "es", name: "Escola Sarah", kind: "fixed", color: "#000" },
    { id: "co", name: "Condomínio FG", kind: "fixed", color: "#000" },
    { id: "re", name: "Renda", kind: "income", color: "#000" },
  ];
  const cat = (description: string, amount = -1000, bankCategory?: string) =>
    suggestCategory({ description, amount, bankCategory }, MINHAS, [])?.categoryId ?? null;

  it("encaixa pelo nome parcial e pelo mais específico", () => {
    expect(cat("UBER *TRIP HELP.UBER.CO")).toBe("cu");
    expect(cat("AUTPOSTOFLORESTAL")).toBe("cu");
    expect(cat("Ifd*Central Restaurant")).toBe("rl");
    expect(cat("Hotel At Booking.Com")).toBe("vi");
    expect(cat("PET LOVE*Clube 0A")).toBe("pet");
    expect(cat("ANTHROPIC CLAUDE")).toBe("cl");
    expect(cat("DA VIVO-SP 123456")).toBe("ci");
    expect(cat("PAG BOLETO ESCOLA SARAH")).toBe("es");
    expect(cat("CONDOMINIO EDIF")).toBe("co");
    expect(cat("REMUNERACAO/SALARIO", 300000)).toBe("re");
  });

  it("categoria do banco também aceita o nome próprio", () => {
    expect(cat("LOJA QUALQUER", -1000, "VEÍCULOS")).toBe("cu");
    expect(cat("PADOCA", -1000, "ALIMENTAÇÃO")).toBe("rl");
  });

  it("sem categoria correspondente, deixa em branco", () => {
    expect(cat("Joaosilvaexemplo")).toBeNull();
    expect(cat("IPTU PREFEITURA")).toBeNull(); // quem não tem IPTU nem Moradia
  });
});

const ITAU_APP = {
  lines: [
    "FULANO DE TAL SILVA   CPF: 123.456.789-00   agência: 1234   conta: 0012345-6",
    "Saldo em conta",
    "R$ -1.920,00",
    "Extrato conta corrente",
    "Período de visualização: 01/11/2026 até 12/11/2026   Emitido em: 12/11/2026 18:34:23",
    "Lançamentos futuros",
    "Saídas futuras",
    "Data   Lançamentos   Descrição   Valor (R$)   Saldo (R$)",
    "16/11/2026   DÉBITO AUTOMÁTICO   DA ELETROPAULO   -446,20",
    "76808015",
    "Lançamentos",
    "Data   Lançamentos   Descrição   Valor (R$)   Saldo (R$)",
    "12/11/2026   PAGAMENTO DE PIX QR   43.302.625 MARIA DE   -110,00",
    "CODE   SOUZA",
    "10/11/2026   PAGAMENTO DE BOLETO   ITAU UNIBANCO HOLDING   -1.000,00",
    "S.A.",
    "09/11/2026   390,00",
    "09/11/2026   PIX ENVIADO   JOAO DA SILVA   -210,00",
    "31/10/2026   600,00",
    "Posição consolidada",
    "31/10/2026   ESTE TEXTO NÃO É LANÇAMENTO   999,00",
  ],
  columns: [],
};

describe("extrato Itaú exportado pelo app", () => {
  const st = parseItauAccount(ITAU_APP);

  it("reconhece o layout de 5 colunas e usa o saldo do cabeçalho", () => {
    expect(looksLikeItauAccount(ITAU_APP)).toBe(true);
    expect(st.closingBalance).toEqual({ amount: -192000, asOf: "2026-11-12T18:34:23-03:00" });
    expect(st.suggestedAccountName).toBe("Conta Itaú •••• 2345");
  });

  it("junta as linhas quebradas, separa os futuros e para na posição consolidada", () => {
    expect(st.items.map((i) => i.description)).toEqual([
      "PAGAMENTO DE PIX QR 43.302.625 MARIA DE CODE SOUZA",
      "PAGAMENTO DE BOLETO ITAU UNIBANCO HOLDING S.A.",
      "PIX ENVIADO JOAO DA SILVA",
    ]);
    expect(st.upcoming[0]!.description).toBe("DÉBITO AUTOMÁTICO DA ELETROPAULO 76808015");
  });

  it("pagamento de boleto da fatura é transferência interna", () => {
    expect(st.items[1]!.internal).toBe(true);
  });

  it("deduz o sinal do saldo inicial pela aritmética e confere", () => {
    // saldo de 31/10 vem sem sinal (600,00); só -600,00 fecha com -1.920,00
    expect(st.checks[0]!.computed).toBe(st.checks[0]!.declared);
    expect(st.checks[0]!.computed).toBe(-132000);
  });
});

describe("não reimporta o mesmo período em outro formato", () => {
  const st = parseNubankCsv(
    ["date,title,amount", '2026-11-07,Loja A,"100,00"', '2026-11-07,Loja A,"100,00"'].join("\n"),
    "Nubank_2026-12-01.csv",
  );
  it("cada lançamento existente cobre só um do arquivo", () => {
    const existing: Transaction = {
      id: "x1",
      accountId: "card",
      date: "2026-11-07",
      description: "LOJA A LTDA", // descrição diferente, mesmo lançamento
      amount: -10000,
      categoryId: null,
      source: "import",
    };
    const plan = buildImportPlan({
      statement: st,
      accountId: "card",
      categories: CATEGORIES,
      rules: [],
      importedKeys: new Set(),
      existing: [existing],
    });
    expect(plan.rows.map((r) => r.duplicate)).toEqual(["manual", null]);
  });
});
