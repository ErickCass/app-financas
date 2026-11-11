import type { Cents } from "@/domain/money";
import type { ISODate } from "@/domain/types";

export type Institution = "itau" | "nubank" | "flash";
export type StatementKind = "credit_card" | "checking" | "benefit";

/** Um lançamento lido do arquivo, antes de virar transação. */
export interface ParsedItem {
  /** Data usada no orçamento (compra; para parcelas, o mês de cada parcela). */
  date: ISODate;
  description: string;
  /** Negativo = saída (compra, débito), positivo = entrada (estorno, salário). */
  amount: Cents;
  /** Categoria que o banco informa ("ALIMENTAÇÃO", "VEÍCULOS"...). */
  bankCategory?: string;
  /** Final do cartão (faturas com cartão adicional/virtual). */
  cardLast4?: string;
  installment?: { n: number; total: number };
  international?: boolean;
  /** Transferência interna: pagamento de fatura, PIX para conta própria. */
  internal?: boolean;
}

/** Conferências de soma: cada uma compara o que o banco declara com o que lemos. */
export interface TotalCheck {
  label: string;
  declared: Cents;
  computed: Cents;
}

export interface ParsedStatement {
  institution: Institution;
  kind: StatementKind;
  /** Nome sugerido para a conta ao criar ("Cartão Itaú •••• 1234"). */
  suggestedAccountName: string;
  last4?: string;
  /** Cartão: vencimento e mês da fatura (AAAA-MM, mês do vencimento). */
  dueDate?: ISODate;
  statementMonth?: string;
  closingDay?: number;
  dueDay?: number;
  /** Cartão: total declarado da fatura (despesas positivas, em centavos). */
  declaredTotal?: Cents;
  /** Conta corrente: saldo final do extrato e quando foi emitido. */
  closingBalance?: { amount: Cents; asOf: string };
  items: ParsedItem[];
  /** Agendados que ainda não saíram ("saídas futuras" do extrato): viram previstos. */
  upcoming: ParsedItem[];
  /** Avisos para a prévia (ex.: parcial da fatura inclui saldo anterior). */
  notes?: string[];
  checks: TotalCheck[];
}
