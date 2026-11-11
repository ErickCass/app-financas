import type { Cents } from "./money";

/** Data no formato ISO "AAAA-MM-DD" (sem fuso). */
export type ISODate = string;

export type AccountKind = "checking" | "credit_card" | "investment" | "cash";

export interface Account {
  id: string;
  name: string; // "Itaú", "Nubank •••• 3029"
  kind: AccountKind;
  /** Saldo informado ou sincronizado e quando isso aconteceu. */
  balance: Cents;
  balanceUpdatedAt: string; // ISO datetime
  /** Só para cartão: dia de fechamento e de vencimento da fatura. */
  closingDay?: number;
  dueDay?: number;
  /** Final do cartão e cor escolhida para a miniatura. */
  last4?: string;
  color?: string;
}

export interface Category {
  id: string;
  name: string;
  /** "variable" tem limite mensal; "fixed" são contas fixas; "income" é renda. */
  kind: "variable" | "fixed" | "income";
  color: string;
}

export type TransactionSource = "manual" | "import" | "apple_pay" | "open_finance";

/** Algo que já aconteceu: uma compra, um PIX, um salário recebido. */
export interface Transaction {
  id: string;
  accountId: string;
  date: ISODate; // data da compra (competência)
  description: string;
  /** Negativo = saída, positivo = entrada. */
  amount: Cents;
  categoryId: string | null;
  source: TransactionSource;
  /** Para compras no cartão: a fatura (AAAA-MM) em que a compra entra. */
  statementMonth?: string;
  /** Previsto que esta transação "baixou", se houver. */
  plannedId?: string;
  /** Transferência interna (pagamento de fatura, PIX entre contas próprias): não conta como despesa. */
  isCardPayment?: boolean;
  /** Compra parcelada: parcela n de total. */
  installment?: { n: number; total: number };
}

export type PlannedStatus = "pending" | "paid" | "overdue";

/** Algo que vai acontecer: conta de luz dia 15, salário dia 5, fatura dia 12. */
export interface Planned {
  id: string;
  accountId: string;
  dueDate: ISODate;
  description: string;
  amount: Cents; // negativo = a pagar, positivo = a receber
  categoryId: string | null;
  status: PlannedStatus;
  /** Para valores que variam (energia): o valor é estimado. */
  estimated?: boolean;
  /** Fatura de cartão: o previsto é a soma das compras daquele mês de fatura. */
  creditCardStatement?: { accountId: string; month: string };
  /** Gerado por uma recorrência mensal (salário, condomínio...). */
  recurringRuleId?: string;
}

/** Limite mensal de uma categoria variável. */
export interface Budget {
  categoryId: string;
  month: string; // AAAA-MM
  limit: Cents;
}

/**
 * Histórico de gasto da categoria: média mensal e, para cada dia do mês,
 * a fração do total mensal que costuma já ter sido gasta até aquele dia.
 */
export interface CategoryHistory {
  categoryId: string;
  monthlyAverage: Cents;
  /** cumulativeShare[d-1] = fração média gasta até o dia d (0..1). */
  cumulativeShare: number[];
}
