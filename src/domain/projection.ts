import type { Cents } from "./money";
import type { Account, Budget, Category, ISODate, Planned, Transaction } from "./types";
import { addMonths, dayOfMonth, daysInMonth, monthOf } from "./dates";
import { categorySpent } from "./budget";
import { fixedRemaining as fixedLeft } from "./reconcile";

/**
 * Resumo do mês para a tela Início.
 * Tudo vem de fatos (transações) e compromissos (previstos), nunca de
 * "orçamento menos realizado" como no app antigo.
 */
export interface MonthSummary {
  month: string;
  balanceToday: Cents;
  expensesPaid: Cents;
  expensesPending: Cents;
  incomeReceived: Cents;
  incomePending: Cents;
  /** Saldo hoje + a receber − a pagar − o que ainda deve sair nos limites variáveis. */
  projectedMonthEnd: Cents;
  /** Parte variável estimada que ainda deve sair este mês (limites não usados, pelo ritmo). */
  variableStillToSpend: Cents;
  /** Contas fixas com valor previsto que ainda não foram pagas no mês (previsto − pago − já previsto avulso). */
  fixedRemaining: { categoryId: string; amount: Cents }[];
  upcoming: Planned[];
}

/** Saldo "líquido" de hoje: contas correntes e dinheiro (cartão entra pelos previstos de fatura). */
export function liquidBalance(accounts: Account[]): Cents {
  return accounts
    .filter((a) => a.kind === "checking" || a.kind === "cash")
    .reduce((acc, a) => acc + a.balance, 0);
}

export function buildMonthSummary(params: {
  today: ISODate;
  accounts: Account[];
  transactions: Transaction[];
  planned: Planned[];
  budgets: Budget[];
  /** Para saber quais categorias são contas fixas (com valor previsto em `budgets`). */
  categories?: Category[];
  /** Previsão de gasto variável por categoria até o fim do mês (da tela de orçamento). */
  variableProjection?: { categoryId: string; projected: Cents }[];
}): MonthSummary {
  const month = monthOf(params.today);
  const inMonth = (d: ISODate) => monthOf(d) === month;

  // Regra do app: tudo que é comprado no cartão dentro do mês é pago dentro do mês.
  // Então a compra no cartão conta como despesa "a pagar" no mês da compra, e a
  // fatura em si não entra (seria contar duas vezes). Pagamento de fatura é
  // transferência interna: já está refletido no saldo da conta.
  const cardAccounts = new Set(params.accounts.filter((a) => a.kind === "credit_card").map((a) => a.id));
  // Benefício (vale-alimentação) tem saldo próprio: não é caixa nem vira fatura.
  const benefitAccounts = new Set(params.accounts.filter((a) => a.kind === "benefit").map((a) => a.id));
  const monthTx = params.transactions.filter((t) => inMonth(t.date) && !t.isCardPayment && !benefitAccounts.has(t.accountId));
  const cash = monthTx.filter((t) => !cardAccounts.has(t.accountId));
  const card = monthTx.filter((t) => cardAccounts.has(t.accountId));
  const expensesPaid = cash.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);
  const incomeReceived = cash.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  // Compras no cartão, líquidas de estornos, nunca abaixo de zero.
  const cardPurchases = Math.max(-card.reduce((a, t) => a + t.amount, 0), 0);

  const pending = params.planned.filter((p) => p.status !== "paid" && inMonth(p.dueDate) && !p.creditCardStatement);

  // Conta fixa com valor previsto (ex.: escola R$ 1.920) e ainda não paga: o que falta
  // conta como a pagar. Desconta o que já saiu na categoria e o que já está previsto avulso nela.
  const fixedRemaining = (params.categories ?? [])
    .filter((c) => c.kind === "fixed")
    .map((c) => {
      const expected = params.budgets.find((b) => b.categoryId === c.id && b.month === month)?.limit ?? 0;
      const spent = categorySpent(params.transactions, c.id, month);
      const alreadyPlanned = pending.filter((p) => p.categoryId === c.id && p.amount < 0).reduce((a, p) => a - p.amount, 0);
      return { categoryId: c.id, amount: fixedLeft(expected, spent, alreadyPlanned) };
    })
    .filter((r) => r.amount > 0);
  const fixedRemainingTotal = fixedRemaining.reduce((a, r) => a + r.amount, 0);

  const expensesPending =
    pending.filter((p) => p.amount < 0).reduce((a, p) => a - p.amount, 0) + cardPurchases + fixedRemainingTotal;
  const incomePending = pending.filter((p) => p.amount > 0).reduce((a, p) => a + p.amount, 0);

  // Gasto variável que ainda deve acontecer no mês. Compras no cartão saem
  // pela fatura (já prevista), então aqui só conta o que ainda não foi gasto.
  const variableStillToSpend = (params.variableProjection ?? []).reduce((acc, v) => {
    const spent = categorySpent(params.transactions, v.categoryId, month);
    return acc + Math.max(v.projected - spent, 0);
  }, 0);

  const balanceToday = liquidBalance(params.accounts);
  const projectedMonthEnd = balanceToday + incomePending - expensesPending - variableStillToSpend;

  const in7 = addDays(params.today, 7);
  const upcoming = params.planned
    .filter((p) => p.status !== "paid" && p.dueDate > params.today && p.dueDate <= in7)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  return {
    month,
    balanceToday,
    expensesPaid,
    expensesPending,
    incomeReceived,
    incomePending,
    projectedMonthEnd,
    variableStillToSpend,
    fixedRemaining,
    upcoming,
  };
}

/**
 * Saldo projetado em 31/dez: fim deste mês + para cada mês seguinte,
 * previstos (renda − contas fixas) − limites das categorias variáveis.
 */
export function projectYearEnd(params: {
  today: ISODate;
  monthEnd: Cents;
  recurringPlanned: { amount: Cents }[]; // previstos mensais recorrentes
  monthlyVariableLimits: Cents;
  /** Previstos avulsos já conhecidos (ex.: fatura que vence mês que vem). */
  planned?: Pick<Planned, "dueDate" | "amount" | "status" | "creditCardStatement">[];
}): Cents {
  const month = monthOf(params.today);
  const year = month.slice(0, 4);
  let balance = params.monthEnd;
  for (let m = addMonths(month, 1); m.slice(0, 4) === year; m = addMonths(m, 1)) {
    const net = params.recurringPlanned.reduce((a, p) => a + p.amount, 0);
    // Faturas ficam de fora: as compras já foram contadas no mês em que aconteceram.
    const oneOff = (params.planned ?? [])
      .filter((p) => p.status !== "paid" && !p.creditCardStatement && monthOf(p.dueDate) === m)
      .reduce((a, p) => a + p.amount, 0);
    balance += net + oneOff - params.monthlyVariableLimits;
  }
  return balance;
}

/** Trajetória diária do saldo no mês: real até hoje, prevista depois. */
export function balanceTrajectory(params: {
  today: ISODate;
  balanceToday: Cents;
  transactions: Transaction[];
  planned: Planned[];
}): { day: number; balance: Cents; projected: boolean }[] {
  const month = monthOf(params.today);
  const total = daysInMonth(month);
  const todayDay = dayOfMonth(params.today);
  const points: { day: number; balance: Cents; projected: boolean }[] = [];

  // Para trás: desfaz as transações em conta a partir de hoje.
  const accountMoves = params.transactions.filter(
    (t) => monthOf(t.date) === month && (!t.statementMonth || t.isCardPayment),
  );
  let b = params.balanceToday;
  for (let d = todayDay; d >= 1; d--) {
    points.unshift({ day: d, balance: b, projected: false });
    const moves = accountMoves.filter((t) => dayOfMonth(t.date) === d).reduce((a, t) => a + t.amount, 0);
    b -= moves;
  }
  // Para frente: aplica os previstos pendentes.
  b = params.balanceToday;
  for (let d = todayDay + 1; d <= total; d++) {
    const due = params.planned
      .filter((p) => p.status !== "paid" && monthOf(p.dueDate) === month && dayOfMonth(p.dueDate) === d)
      .reduce((a, p) => a + p.amount, 0);
    b += due;
    points.push({ day: d, balance: b, projected: true });
  }
  return points;
}

function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
