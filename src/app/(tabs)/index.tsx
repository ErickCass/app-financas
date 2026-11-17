import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "@/data/auth";
import { useFinance } from "@/data/store";
import { useBudgetView, useCashOut, useMonthSummary } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { dayOfMonth, lastDayOfMonth, shortDate } from "@/domain/dates";
import { Card, Divider, ProgressBar, Screen } from "@/ui/components";
import { STATUS_COLOR, useTheme } from "@/ui/theme";

const WEEKDAYS = [
  "DOMINGO",
  "SEGUNDA",
  "TERÇA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÁBADO",
];
const MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

export default function Inicio() {
  const t = useTheme();
  const f = useFinance();
  const s = useMonthSummary();
  const cash = useCashOut();
  const view = useBudgetView();
  const auth = useAuth();
  const [hidden, setHidden] = useState(false);
  const initials = f.isDemo
    ? "EA"
    : (auth.email ?? "?").slice(0, 2).toUpperCase();
  const isEmpty =
    !f.isDemo && f.transactions.length === 0 && f.budgets.length === 0;
  const money = (c: number, o?: Parameters<typeof formatBRL>[1]) =>
    hidden ? "R$ •••" : formatBRL(c, o);

  const d = new Date(`${f.today}T12:00:00`);
  const dateLabel = `${WEEKDAYS[d.getDay()]}, ${dayOfMonth(f.today)} DE ${MONTHS[d.getMonth()]}`;
  const updated = new Date(f.balanceUpdatedAt);
  const updatedLabel = `Atualizado hoje, ${String(updated.getHours()).padStart(2, "0")}:${String(updated.getMinutes()).padStart(2, "0")}`;
  const lastDayLabel = shortDate(lastDayOfMonth(s.month));
  const attention = view
    .filter((v) => v.status === "estourou" || v.status === "vai")
    .slice(0, 3);
  // Vale-alimentação e afins: saldo próprio, mostrado à parte do caixa.
  const benefits = f.accounts.filter((a) => a.kind === "benefit");
  const uncategorized = f.transactions.filter(
    (tx) => !tx.categoryId && !tx.isCardPayment,
  ).length;
  // O que pede ação, nesta ordem: categorias estourando, contas que vencem em 7 dias, lançamentos sem categoria.
  const todo: {
    key: string;
    title: string;
    detail: string;
    value?: string;
    href: string;
    color: string;
  }[] = [
    ...attention.map((v) => ({
      key: `cat-${v.category.id}`,
      title: v.category.name,
      detail:
        v.status === "estourou"
          ? `Estourou: ${money(v.spent, { noCents: true })} de ${money(v.limit, { noCents: true })}`
          : `Deve fechar em ${money(v.projected, { noCents: true })} de ${money(v.limit, { noCents: true })}`,
      value: `${v.limit ? Math.round((v.spent / v.limit) * 100) : 0}%`,
      href: `/categoria/${v.category.id}`,
      color: STATUS_COLOR[v.status],
    })),
    ...s.upcoming
      .filter((p) => p.amount < 0)
      .map((p) => ({
        key: `due-${p.id}`,
        title: p.description,
        detail: `Vence ${p.dueDate === f.today ? "hoje" : shortDate(p.dueDate)}${p.creditCardStatement ? " · ver as compras" : ""}`,
        value: `${p.estimated ? "≈ " : ""}${money(-p.amount)}`,
        href: p.creditCardStatement
          ? `/fatura/${p.id}`
          : `/previsto?id=${p.id}`,
        color: t.accent,
      })),
    ...(uncategorized > 0
      ? [
          {
            key: "classificar",
            title: `${uncategorized} sem categoria`,
            detail: "Classifique por loja de uma vez",
            href: "/classificar",
            color: t.ink3,
          },
        ]
      : []),
  ];
  const expTotal = s.expensesPaid + s.expensesPending;
  const incTotal = s.incomeReceived + s.incomePending;

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingHorizontal: 4,
        }}
      >
        <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: t.ink2,
              letterSpacing: 0.3,
            }}
          >
            {dateLabel}
            {f.isDemo ? " · DEMONSTRAÇÃO" : ""}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 34,
              fontWeight: "700",
              color: t.ink,
              letterSpacing: -0.5,
            }}
          >
            Início
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}
            onPress={() => setHidden((h) => !h)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: t.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.ink2}
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <Circle cx={12} cy={12} r={3} />
              {hidden ? <Path d="M3 3l18 18" /> : null}
            </Svg>
          </Pressable>
          <Link href="/ajustes" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Perfil e ajustes"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: t.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: t.onAccent, fontWeight: "600", fontSize: 15 }}
              >
                {initials}
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {isEmpty ? (
        <Card style={{ gap: 0, paddingBottom: 8 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: t.ink,
              paddingBottom: 4,
            }}
          >
            Comece por aqui
          </Text>
          {(
            [
              ["1", "Informe o saldo da conta corrente", "/ajustes"],
              ["2", "Defina os limites das categorias", "/limites"],
              ["3", "Importe uma fatura ou extrato", "/importar"],
            ] as const
          ).map(([n, label, href]) => (
            <Link key={n} href={href} asChild>
              <Pressable
                accessibilityRole="link"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: t.line,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: t.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: t.onAccent, fontWeight: "600" }}>
                    {n}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontSize: 16, color: t.ink }}>
                  {label}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 18 }}>›</Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : null}

      {/* 1. Saldo previsto: um número só, pela visão de caixa (o que deve estar na conta no fim do mês). */}
      <Link href="/orcamento?lente=caixa" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Saldo previsto no fim do mês: ver o que ainda sai da conta"
        >
          <Card style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink2 }}>
                Saldo previsto · {lastDayLabel}
              </Text>
              <Text style={{ fontSize: 12, color: t.ink2 }}>
                {updatedLabel}
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: 44,
                  fontWeight: "600",
                  color: cash.projectedBalance < 0 ? t.neg : t.ink,
                  letterSpacing: -1,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {money(cash.projectedBalance)}
              </Text>
              <Text style={{ fontSize: 14, color: t.ink2, lineHeight: 20 }}>
                Hoje{" "}
                <Text
                  style={{
                    color: cash.balanceToday < 0 ? t.neg : t.ink,
                    fontWeight: "600",
                  }}
                >
                  {money(cash.balanceToday)}
                </Text>
                {cash.incomePending > 0 ? (
                  <>
                    {" · "}
                    <Text style={{ color: t.pos, fontWeight: "600" }}>
                      +{money(cash.incomePending)}
                    </Text>{" "}
                    a receber
                  </>
                ) : null}
                {" · "}
                <Text style={{ fontWeight: "600", color: t.ink }}>
                  −{money(cash.toLeave)}
                </Text>{" "}
                a sair ›
              </Text>
              <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 16 }}>
                Depois das faturas e contas que vencem até {lastDayLabel}. Não
                inclui gastos que você ainda vai fazer no débito ou PIX.
              </Text>
              {benefits.length > 0 ? (
                <Text style={{ fontSize: 13, color: t.ink2 }}>
                  Benefícios à parte:{" "}
                  {benefits
                    .map((a) => `${a.name} ${money(a.balance)}`)
                    .join(" · ")}
                </Text>
              ) : null}
            </View>
            <Divider />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, color: t.ink2 }}>
                Projeção para 31 dez
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: s.yearEnd < 0 ? t.neg : t.ink,
                }}
              >
                {money(s.yearEnd)}
              </Text>
            </View>
          </Card>
        </Pressable>
      </Link>

      {/* 2. Precisa de você: só o que pede ação. Some quando não há nada. */}
      {todo.length > 0 ? (
        <Card style={{ gap: 0, paddingBottom: 4 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: t.ink,
              paddingBottom: 6,
            }}
          >
            Precisa de você
          </Text>
          {todo.map((item, i) => (
            <Link key={item.key} href={item.href as never} asChild>
              <Pressable
                accessibilityRole="link"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: t.line,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: item.color,
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 16, color: t.ink }}
                  >
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: t.ink2 }}>
                    {item.detail}
                  </Text>
                </View>
                {item.value ? (
                  <Text
                    style={{ fontSize: 16, fontWeight: "600", color: t.ink }}
                  >
                    {item.value}
                  </Text>
                ) : null}
                <Text style={{ color: t.ink3, fontSize: 18 }}>›</Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : null}

      {/* 3. Orçamento do mês, com atalhos para despesas e renda. */}
      <Card style={{ gap: 14 }}>
        <Link href="/orcamento" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Orçamento do mês: ver todas as categorias"
            style={{ gap: 10 }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>
                Orçamento do mês
              </Text>
              <Text style={{ fontSize: 15, color: t.accent }}>Ver tudo ›</Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={{ fontSize: 14, color: t.ink }}>
                <Text style={{ fontWeight: "600" }}>{money(s.spentTotal)}</Text>
                <Text style={{ color: t.ink2 }}>
                  {" "}
                  de {money(s.limitsTotal)}
                </Text>
              </Text>
              <Text style={{ fontSize: 14, color: t.ink2 }}>
                {s.limitsTotal
                  ? `${Math.round((s.spentTotal / s.limitsTotal) * 100)}% · `
                  : ""}
                {money(Math.max(s.limitsTotal - s.spentTotal, 0))} livres
              </Text>
            </View>
            <ProgressBar
              fill={s.limitsTotal ? s.spentTotal / s.limitsTotal : 0}
              color={
                s.projectedTotal > s.limitsTotal
                  ? STATUS_COLOR.vai
                  : STATUS_COLOR.ritmo
              }
            />
          </Pressable>
        </Link>
        <Divider />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(
            [
              ["despesas", "Despesas", expTotal, s.expensesPending, "a pagar"],
              ["renda", "Renda", incTotal, s.incomePending, "a receber"],
            ] as const
          ).map(([tipo, label, total, pending, pendingLabel]) => (
            <Link key={tipo} href={`/fluxo?tipo=${tipo}`} asChild>
              <Pressable accessibilityRole="link" style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 13, color: t.ink2 }}>
                  {label} no mês ›
                </Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: tipo === "renda" ? t.pos : t.ink,
                  }}
                >
                  {money(total)}
                </Text>
                <Text style={{ fontSize: 12, color: t.ink2 }}>
                  {money(pending)} {pendingLabel}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
