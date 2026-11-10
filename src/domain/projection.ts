import type { Cents } from "./money";
import type { Account, Budget, ISODate, Planned, Transaction } from "./types";
import { addMonths, dayOfMonth, daysInMonth, monthOf } from "./dates";
import { categorySpent } from "./budget";

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
  /** Previsão de gasto variável por categoria até o fim do mês (da tela de orçamento). */
  variableProjection?: { categoryId: string; projected: Cents }[];
}): MonthSummary {
  const month = monthOf(params.today);
  const inMonth = (d: ISODate) => monthOf(d) === month;

  // Visão de caixa: o que já saiu ou entrou nas contas. Compras no cartão
  // ficam de fora aqui porque saem pela fatura, que está nos previstos.
  const cardAccounts = new Set(params.accounts.filter((a) => a.kind === "credit_card").map((a) => a.id));
  const real = params.transactions.filter((t) => inMonth(t.date) && !t.isCardPayment && !cardAccounts.has(t.accountId));
  const expensesPaid = real.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);
  const incomeReceived = real.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);

  const pending = params.planned.filter((p) => p.status !== "paid" && inMonth(p.dueDate));
  const expensesPending = pending.filter((p) => p.amount < 0).reduce((a, p) => a - p.amount, 0);
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
  planned?: Pick<Planned, "dueDate" | "amount" | "status">[];
}): Cents {
  const month = monthOf(params.today);
  const year = month.slice(0, 4);
  let balance = params.monthEnd;
  for (let m = addMonths(month, 1); m.slice(0, 4) === year; m = addMonths(m, 1)) {
    const net = params.recurringPlanned.reduce((a, p) => a + p.amount, 0);
    const oneOff = (params.planned ?? [])
      .filter((p) => p.status !== "paid" && monthOf(p.dueDate) === m)
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
