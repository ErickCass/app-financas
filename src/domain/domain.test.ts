import { describe, expect, it } from "vitest";
import { formatBRL, toCents } from "./money";
import {
  buildBudgetView,
  categorySpent,
  dailyAllowance,
  expectedShare,
  paceStatus,
  projectMonthEnd,
} from "./budget";
import { buildMonthSummary, projectYearEnd } from "./projection";
import { areLikelyDuplicates, deduplicate, normalizeDescription } from "./dedup";
import { isCardPayment } from "./cardPayment";
import { daysInMonth } from "./dates";
import type { Category, CategoryHistory, Transaction } from "./types";

describe("dinheiro", () => {
  it("converte para centavos sem erro de ponto flutuante", () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(toCents("1.234,56")).toBe(123456);
    expect(toCents("R$ 86,10")).toBe(8610);
    expect(toCents("1234.56")).toBe(123456);
  });
  it("recusa texto inválido", () => {
    expect(() => toCents("abc")).toThrow();
  });
  it("formata em reais", () => {
    expect(formatBRL(842015)).toBe("R$ 8.420,15");
    expect(formatBRL(-396025)).toBe("−R$ 3.960,25");
    expect(formatBRL(92000, { signed: true })).toBe("+R$ 920,00");
    expect(formatBRL(100000, { noCents: true })).toBe("R$ 1.000");
  });
});

describe("as quatro cores do orçamento", () => {
  const limit = 100_000; // R$ 1.000
  it("vermelho quando já passou do limite", () => {
    expect(paceStatus(138_665, limit, 206_000)).toBe("estourou");
  });
  it("amarelo quando ainda não passou mas a previsão passa", () => {
    expect(paceStatus(45_000, limit, 117_000)).toBe("vai");
  });
  it("azul quando deve fechar entre 85% e 100%", () => {
    expect(paceStatus(50_000, limit, 98_000)).toBe("ritmo");
    expect(paceStatus(50_000, limit, 85_000)).toBe("ritmo");
    expect(paceStatus(50_000, limit, 100_000)).toBe("ritmo");
  });
  it("verde quando deve sobrar", () => {
    expect(paceStatus(30_000, limit, 75_000)).toBe("sobra");
  });
  it("categoria sem limite fica neutra, mesmo com gasto", () => {
    expect(paceStatus(1_000, 0, 1_000)).toBe("semlimite");
    expect(paceStatus(0, 0, 0)).toBe("semlimite");
  });
});

describe("ritmo pelo histórico (o exemplo do Mercado no dia 2)", () => {
  const total = 30;
  // Mercado: gasto espalhado no mês; ~12% até o dia 2
  const mercado: CategoryHistory = {
    categoryId: "mercado",
    monthlyAverage: 172_000,
    cumulativeShare: Array.from({ length: 30 }, (_, i) => (i === 1 ? 0.12 : (i + 1) / 30)),
  };
  // Assinaturas: quase tudo cobrado no dia 1
  const assinaturas: CategoryHistory = {
    categoryId: "assinaturas",
    monthlyAverage: 21_500,
    cumulativeShare: Array.from({ length: 30 }, () => 0.9),
  };

  it("usa a curva da categoria quando há histórico", () => {
    expect(expectedShare(2, total, mercado)).toBeCloseTo(0.12);
    expect(expectedShare(2, total, assinaturas)).toBeCloseTo(0.9);
  });
  it("sem histórico, usa o calendário", () => {
    expect(expectedShare(15, 30)).toBeCloseTo(0.5);
  });
  it("Mercado com 80% gasto no dia 2 vai estourar", () => {
    const limit = 180_000;
    const spent = 144_000; // 80%
    const projected = projectMonthEnd(spent, 2, total, mercado);
    expect(projected).toBe(144_000 + Math.round(172_000 * 0.88));
    expect(paceStatus(spent, limit, projected)).toBe("vai");
  });
  it("Assinaturas com 86% no dia 2 está no ritmo, não dispara alerta", () => {
    const limit = 22_000;
    const spent = 18_970;
    const projected = projectMonthEnd(spent, 2, total, assinaturas);
    expect(paceStatus(spent, limit, projected)).toBe("ritmo");
  });
  it("sem histórico extrapola linearmente", () => {
    expect(projectMonthEnd(30_000, 10, 30)).toBe(90_000);
  });
  it("quanto dá para gastar por dia", () => {
    // Mercado do mockup: (1.800 − 812,73) / 21 dias = R$ 47,01
    expect(dailyAllowance(81_273, 180_000, 9, 30)).toBe(4_701);
    expect(dailyAllowance(200_000, 180_000, 9, 30)).toBe(0);
  });
});

const tx = (p: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction => ({
  accountId: "itau",
  description: "x",
  categoryId: "restaurantes",
  source: "import",
  ...p,
});

describe("gasto da categoria", () => {
  it("soma compras pela data da compra, desconta estornos e ignora pagamento de fatura", () => {
    const rows = [
      tx({ id: "1", date: "2026-11-09", amount: -38_600 }),
      tx({ id: "2", date: "2026-11-07", amount: -9_490 }),
      tx({ id: "3", date: "2026-10-31", amount: -5_000 }), // outro mês
      tx({ id: "4", date: "2026-11-12", amount: -231_044, isCardPayment: true }),
      tx({ id: "5", date: "2026-11-08", amount: 2_000 }), // estorno
    ];
    expect(categorySpent(rows, "restaurantes", "2026-11")).toBe(46_090);
    // estorno maior que as compras não deixa o gasto negativo
    expect(categorySpent([tx({ id: "6", date: "2026-11-01", amount: 5_000 })], "restaurantes", "2026-11")).toBe(0);
  });

  it("ordena a tela de orçamento por risco", () => {
    const categories: Category[] = [
      { id: "lazer", name: "Lazer", kind: "variable", color: "#000" },
      { id: "restaurantes", name: "Restaurantes", kind: "variable", color: "#000" },
      { id: "transporte", name: "Transporte", kind: "variable", color: "#000" },
      { id: "moradia", name: "Moradia", kind: "fixed", color: "#000" },
    ];
    const view = buildBudgetView({
      today: "2026-11-09",
      categories,
      budgets: [
        { categoryId: "lazer", month: "2026-11", limit: 80_000 },
        { categoryId: "restaurantes", month: "2026-11", limit: 100_000 },
        { categoryId: "transporte", month: "2026-11", limit: 90_000 },
      ],
      transactions: [
        tx({ id: "a", date: "2026-11-05", amount: -138_665 }),
        tx({ id: "b", date: "2026-11-05", amount: -62_040, categoryId: "transporte" }),
        tx({ id: "c", date: "2026-11-05", amount: -5_000, categoryId: "lazer" }),
      ],
      history: [],
    });
    expect(view.map((v) => v.category.id)).toEqual(["restaurantes", "transporte", "lazer"]);
    expect(view.map((v) => v.status)).toEqual(["estourou", "vai", "sobra"]);
  });
});

describe("resumo do mês (números do mockup)", () => {
  it("saldo projetado = hoje + a receber − a pagar", () => {
    const s = buildMonthSummary({
      today: "2026-11-09",
      accounts: [
        { id: "itau", name: "Itaú", kind: "checking", balance: 1_238_040, balanceUpdatedAt: "" },
        { id: "visa", name: "Visa", kind: "credit_card", balance: 0, balanceUpdatedAt: "" },
      ],
      transactions: [
        tx({ id: "sal", date: "2026-11-05", amount: 1_420_000, categoryId: "renda" }),
        tx({ id: "g1", date: "2026-11-03", amount: -624_010 }),
        tx({ id: "fat", date: "2026-11-02", amount: -100_000, isCardPayment: true }),
        tx({ id: "cc", date: "2026-11-04", amount: -50_000, accountId: "visa" }), // compra no cartão: sai pela fatura
      ],
      planned: [
        { id: "p1", accountId: "itau", dueDate: "2026-11-10", description: "Condomínio", amount: -115_000, categoryId: null, status: "pending" },
        { id: "p2", accountId: "itau", dueDate: "2026-11-12", description: "Fatura Visa", amount: -231_044, categoryId: null, status: "pending" },
        { id: "p3", accountId: "itau", dueDate: "2026-11-14", description: "Reembolso", amount: 92_000, categoryId: null, status: "pending" },
        { id: "p4", accountId: "itau", dueDate: "2026-11-15", description: "Escola", amount: -108_000, categoryId: null, status: "pending" },
        { id: "p5", accountId: "itau", dueDate: "2026-11-20", description: "Saúde", amount: -33_981, categoryId: null, status: "pending" },
        { id: "p6", accountId: "itau", dueDate: "2026-11-03", description: "Internet", amount: -12_990, categoryId: null, status: "paid" },
        { id: "p7", accountId: "itau", dueDate: "2026-12-10", description: "Condomínio", amount: -115_000, categoryId: null, status: "pending" },
      ],
      budgets: [],
    });
    expect(s.expensesPaid).toBe(624_010); // sem pagamento de fatura e sem compra no cartão
    expect(s.expensesPending).toBe(488_025);
    expect(s.incomeReceived).toBe(1_420_000);
    expect(s.incomePending).toBe(92_000);
    expect(s.projectedMonthEnd).toBe(842_015); // R$ 8.420,15
    expect(s.upcoming.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("projeção do ano soma os meses restantes", () => {
    expect(
      projectYearEnd({
        today: "2026-11-09",
        monthEnd: 842_015,
        recurringPlanned: [{ amount: 1_512_000 }, { amount: -298_711 }],
        monthlyVariableLimits: 662_000,
      }),
    ).toBe(842_015 + 1_512_000 - 298_711 - 662_000);
  });

  it("conhece o tamanho dos meses", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-11")).toBe(30);
  });
});

describe("duplicados (Apple Pay + extrato + Open Finance)", () => {
  it("normaliza descrições", () => {
    expect(normalizeDescription("05/nov UBER *TRIP")).toBe("uber trip");
    expect(normalizeDescription("NOTEBOOK DELL (3/10)")).toBe("notebook dell");
    expect(normalizeDescription("Pão de Açúcar")).toBe("pao de acucar");
  });
  it("mesma compra por duas vias vira uma", () => {
    const applePay = { date: "2026-11-09", description: "Posto Petrobrás", amount: -8_610, source: "apple_pay" };
    const extrato = { date: "2026-11-09", description: "POSTO PETROBRAS", amount: -8_610, source: "import" };
    expect(areLikelyDuplicates(applePay, extrato)).toBe(true);
    expect(deduplicate([applePay, extrato])).toHaveLength(1);
  });
  it("valores ou datas diferentes não são duplicados", () => {
    const a = { date: "2026-11-09", description: "Uber", amount: -300 };
    expect(areLikelyDuplicates(a, { ...a, amount: -2_587 })).toBe(false);
    expect(areLikelyDuplicates(a, { ...a, date: "2026-11-08" })).toBe(false);
  });
  it("descrição cortada pelo banco só é duplicada entre importações diferentes da mesma fonte", () => {
    const a = { date: "2026-11-01", description: "SUPERMERCADO PAO DE ACU", amount: -38_922, source: "import", importBatchId: "1" };
    const b = { date: "2026-11-01", description: "SUPERMERCADO PAO DE ACUCAR", amount: -38_922, source: "import", importBatchId: "2" };
    expect(areLikelyDuplicates(a, b)).toBe(true);
    expect(deduplicate([a, b])[0]!.description).toBe("SUPERMERCADO PAO DE ACUCAR");
    expect(areLikelyDuplicates(a, { ...b, importBatchId: "1" })).toBe(false);
  });
});

describe("pagamento de fatura", () => {
  it("reconhece os formatos comuns", () => {
    expect(isCardPayment("PAGAMENTO FATURA ITAU")).toBe(true);
    expect(isCardPayment("Pagto cartão Nubank")).toBe(true);
    expect(isCardPayment("DEBITO AUTOMATICO FATURA")).toBe(true);
  });
  it("não confunde com compras", () => {
    expect(isCardPayment("Posto Petrobrás")).toBe(false);
    expect(isCardPayment(null)).toBe(false);
  });
});
