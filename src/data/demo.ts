/**
 * Dados de demonstração (fictícios), os mesmos números dos mockups aprovados.
 * Servem para ver o app funcionando antes do Supabase estar ligado.
 */
import type { Account, Budget, Category, CategoryHistory, Planned, Transaction } from "@/domain/types";

export const DEMO_TODAY = "2026-11-09";
export const DEMO_UPDATED_AT = "2026-11-09T09:40:00-03:00";

export const accounts: Account[] = [
  { id: "itau", name: "Itaú", kind: "checking", balance: 1_238_040, balanceUpdatedAt: DEMO_UPDATED_AT },
  { id: "visa", name: "Itaú Visa", kind: "credit_card", balance: 0, balanceUpdatedAt: DEMO_UPDATED_AT, closingDay: 5, dueDay: 12 },
  { id: "nubank", name: "Nubank •••• 3029", kind: "credit_card", balance: 0, balanceUpdatedAt: DEMO_UPDATED_AT, closingDay: 28, dueDay: 5 },
];

export const categories: Category[] = [
  { id: "restaurantes", name: "Restaurantes", kind: "variable", color: "#C2410C" },
  { id: "mercado", name: "Mercado", kind: "variable", color: "#0E4A5C" },
  { id: "transporte", name: "Transporte", kind: "variable", color: "#E7A36B" },
  { id: "compras", name: "Compras", kind: "variable", color: "#4D8A9A" },
  { id: "assinaturas", name: "Assinaturas", kind: "variable", color: "#8C8C94" },
  { id: "lazer", name: "Lazer", kind: "variable", color: "#C98BB9" },
  { id: "casa", name: "Casa e serviços", kind: "variable", color: "#7C6FB0" },
  { id: "moradia", name: "Moradia", kind: "fixed", color: "#0E4A5C" },
  { id: "educacao", name: "Educação", kind: "fixed", color: "#0E4A5C" },
  { id: "saude", name: "Saúde", kind: "fixed", color: "#0E4A5C" },
  { id: "renda", name: "Renda", kind: "income", color: "#1E7A46" },
];

export const budgets: Budget[] = [
  ["restaurantes", 100_000],
  ["mercado", 180_000],
  ["transporte", 90_000],
  ["compras", 100_000],
  ["assinaturas", 22_000],
  ["lazer", 80_000],
  ["casa", 90_000],
].map(([categoryId, limit]) => ({ categoryId: categoryId as string, month: "2026-11", limit: limit as number }));

/** Curva acumulada "linear com início lento" e "tudo no começo" para a demo. */
const spread = (front = 0) => Array.from({ length: 30 }, (_, i) => Math.min(1, front + (1 - front) * ((i + 1) / 30)));

export const history: CategoryHistory[] = [
  { categoryId: "restaurantes", monthlyAverage: 100_500, cumulativeShare: spread(0) },
  { categoryId: "mercado", monthlyAverage: 172_000, cumulativeShare: spread(0).map((s, i) => (i < 9 ? s * 0.93 : s)) },
  { categoryId: "transporte", monthlyAverage: 94_000, cumulativeShare: spread(0.05) },
  { categoryId: "compras", monthlyAverage: 65_000, cumulativeShare: spread(0) },
  { categoryId: "assinaturas", monthlyAverage: 21_500, cumulativeShare: spread(0.85) },
  { categoryId: "lazer", monthlyAverage: 45_000, cumulativeShare: spread(0.1) },
  { categoryId: "casa", monthlyAverage: 60_000, cumulativeShare: spread(0) },
];

let n = 0;
const t = (
  date: string,
  description: string,
  amount: number,
  categoryId: string | null,
  accountId = "visa",
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: `t${++n}`,
  accountId,
  date,
  description,
  amount,
  categoryId,
  source: "import",
  statementMonth: accountId === "visa" ? (date <= "2026-11-05" ? "2026-11" : "2026-12") : undefined,
  ...extra,
});

export const transactions: Transaction[] = [
  // Restaurantes: 8 transações = R$ 1.386,65
  t("2026-11-09", "Restaurante Fasano", -38_600, "restaurantes"),
  t("2026-11-07", "iFood", -9_490, "restaurantes"),
  t("2026-11-06", "Coco Bambu", -31_240, "restaurantes"),
  t("2026-11-05", "iFood", -6_850, "restaurantes"),
  t("2026-11-04", "Padaria Real", -4_235, "restaurantes", "itau"),
  t("2026-11-02", "Outback", -24_800, "restaurantes"),
  t("2026-11-01", "iFood", -11_260, "restaurantes"),
  t("2026-11-01", "Rappi", -12_190, "restaurantes", "itau"),
  // Mercado: R$ 812,73
  t("2026-11-09", "Pão de Açúcar", -41_273, "mercado"),
  t("2026-11-03", "Carrefour", -40_000, "mercado"),
  // Transporte: R$ 620,40
  t("2026-11-04", "Posto Shell", -18_000, "transporte"),
  t("2026-11-07", "Posto Petrobrás", -8_610, "transporte", "nubank", { source: "apple_pay" }),
  t("2026-11-08", "Uber", -2_587, "transporte", "nubank"),
  t("2026-11-06", "Sem Parar", -32_843, "transporte", "itau"),
  // Compras: R$ 540,20
  t("2026-11-02", "Amazon", -23_896, "compras"),
  t("2026-11-08", "Mercado Livre", -30_124, "compras"),
  // Assinaturas: R$ 189,70
  t("2026-11-01", "Spotify", -2_190, "assinaturas"),
  t("2026-11-03", "Netflix", -5_590, "assinaturas"),
  t("2026-11-01", "iCloud", -11_190, "assinaturas"),
  // Lazer: R$ 310,00
  t("2026-11-07", "Cinemark", -12_000, "lazer"),
  t("2026-11-08", "Cacau Show", -1_980, "lazer", "nubank", { source: "apple_pay" }),
  t("2026-11-08", "Livraria Cultura", -17_020, "lazer"),
  // Casa e serviços: R$ 250,00
  t("2026-11-09", "PIX — M. Souza", -25_000, "casa", "itau"),
  // Contas fixas já pagas
  t("2026-11-03", "Internet Vivo", -12_990, "moradia", "itau"),
  t("2026-11-06", "Energia Enel", -28_740, "moradia", "itau"),
  // Compras de outubro que entram na fatura Visa de novembro (fecha dia 5)
  t("2026-10-31", "Pão de Açúcar", -38_922, "mercado"),
  t("2026-10-28", "iFood", -7_826, "restaurantes"),
  t("2026-10-28", "Notebook Dell (3/10)", -28_470, "compras"),
  t("2026-10-20", "Posto Shell", -12_050, "transporte"),
  // Renda
  t("2026-11-05", "Salário", 1_420_000, "renda", "itau"),
];

export const planned: Planned[] = [
  { id: "p1", accountId: "itau", dueDate: "2026-11-10", description: "Condomínio", amount: -115_000, categoryId: "moradia", status: "pending" },
  {
    id: "p2", accountId: "itau", dueDate: "2026-11-12", description: "Fatura Itaú Visa", amount: -231_044, categoryId: null,
    status: "pending", creditCardStatement: { accountId: "visa", month: "2026-11" },
  },
  { id: "p3", accountId: "itau", dueDate: "2026-11-14", description: "Reembolso de despesas", amount: 92_000, categoryId: "renda", status: "pending" },
  { id: "p4", accountId: "itau", dueDate: "2026-11-15", description: "Mensalidade escolar", amount: -108_000, categoryId: "educacao", status: "pending" },
  { id: "p5", accountId: "itau", dueDate: "2026-11-20", description: "Plano de saúde", amount: -33_981, categoryId: "saude", status: "pending" },
  { id: "p6", accountId: "itau", dueDate: "2026-11-03", description: "Internet Vivo", amount: -12_990, categoryId: "moradia", status: "paid" },
  { id: "p7", accountId: "itau", dueDate: "2026-11-06", description: "Energia Enel", amount: -28_740, categoryId: "moradia", status: "paid", estimated: true },
  { id: "p8", accountId: "itau", dueDate: "2026-11-05", description: "Salário", amount: 1_420_000, categoryId: "renda", status: "paid" },
];

/** Previstos que se repetem todo mês (para a projeção do ano). */
export const recurringMonthly = [
  { amount: 1_420_000 }, // salário
  { amount: -115_000 }, // condomínio
  { amount: -108_000 }, // escola
  { amount: -33_981 }, // saúde
  { amount: -12_990 }, // internet
  { amount: -29_000 }, // energia (estimado)
];
