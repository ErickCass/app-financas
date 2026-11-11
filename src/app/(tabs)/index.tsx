import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "@/data/auth";
import { useFinance } from "@/data/store";
import { useBudgetView, useMonthSummary } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { dayOfMonth, lastDayOfMonth, monthOf, shortDate } from "@/domain/dates";
import { BalanceChart } from "@/ui/BalanceChart";
import { Card, Divider, PrimaryButton, ProgressBar, Screen } from "@/ui/components";
import { SparkIcon } from "@/ui/icons";
import { STATUS_COLOR, STATUS_LABEL, useTheme } from "@/ui/theme";

const WEEKDAYS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export default function Inicio() {
  const t = useTheme();
  const f = useFinance();
  const s = useMonthSummary();
  const view = useBudgetView();
  const auth = useAuth();
  const [hidden, setHidden] = useState(false);
  const initials = f.isDemo ? "EA" : (auth.email ?? "?").slice(0, 2).toUpperCase();
  const isEmpty = !f.isDemo && f.transactions.length === 0 && f.budgets.length === 0;
  const money = (c: number, o?: Parameters<typeof formatBRL>[1]) => (hidden ? "R$ •••" : formatBRL(c, o));

  const d = new Date(`${f.today}T12:00:00`);
  const dateLabel = `${WEEKDAYS[d.getDay()]}, ${dayOfMonth(f.today)} DE ${MONTHS[d.getMonth()]}`;
  const updated = new Date(f.balanceUpdatedAt);
  const updatedLabel = `Atualizado hoje, ${String(updated.getHours()).padStart(2, "0")}:${String(updated.getMinutes()).padStart(2, "0")}`;
  const delta = s.projectedMonthEnd - s.balanceToday;
  const lastDayLabel = shortDate(lastDayOfMonth(s.month));
  const attention = view.filter((v) => v.status === "estourou" || v.status === "vai").slice(0, 3);
  const top = view.find((v) => v.status === "estourou") ?? view[0];
  // Faturas de cartão em aberto: é por elas que as compras no cartão chegam ao saldo.
  const bills = f.planned
    .filter((p) => p.creditCardStatement && p.status !== "paid")
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const expTotal = s.expensesPaid + s.expensesPending;
  const incTotal = s.incomeReceived + s.incomePending;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: t.ink2, letterSpacing: 0.3 }}>
            {dateLabel}
            {f.isDemo ? " · DEMONSTRAÇÃO" : ""}
          </Text>
          <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, letterSpacing: -0.5 }}>
            Início
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}
            onPress={() => setHidden((h) => !h)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.ink2} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <Circle cx={12} cy={12} r={3} />
              {hidden ? <Path d="M3 3l18 18" /> : null}
            </Svg>
          </Pressable>
          <Link href="/ajustes" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Perfil e ajustes"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: t.onAccent, fontWeight: "600", fontSize: 15 }}>{initials}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {isEmpty ? (
        <Card style={{ gap: 0, paddingBottom: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink, paddingBottom: 4 }}>Comece por aqui</Text>
          {(
            [
              ["1", "Informe o saldo da conta corrente", "/ajustes"],
              ["2", "Defina os limites das categorias", "/limites"],
              ["3", "Importe uma fatura ou extrato", "/importar"],
            ] as const
          ).map(([n, label, href]) => (
            <Link key={n} href={href} asChild>
              <Pressable accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.line }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: t.onAccent, fontWeight: "600" }}>{n}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 16, color: t.ink }}>{label}</Text>
                <Text style={{ color: t.ink3, fontSize: 18 }}>›</Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink2 }}>Saldo projetado · {lastDayLabel}</Text>
          <Text style={{ fontSize: 12, color: t.ink2 }}>{updatedLabel}</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 44, fontWeight: "600", color: t.ink, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
            {money(s.projectedMonthEnd)}
          </Text>
          <Text style={{ fontSize: 14, color: t.ink2 }}>
            Hoje {money(s.balanceToday)} ·{" "}
            <Text style={{ color: delta < 0 ? t.neg : t.pos, fontWeight: "600" }}>{money(delta, { signed: true })}</Text> até o fim do mês
          </Text>
        </View>
        <BalanceChart points={s.trajectory} />
        <Divider />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 15, color: t.ink2 }}>Saldo projetado · 31 dez</Text>
          <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>{money(s.yearEnd)}</Text>
        </View>
      </Card>

      <Card style={{ gap: 18 }}>
        <FlowRow
          title="Despesas"
          total={money(expTotal)}
          empty={expTotal === 0}
          a={{ label: "Pagas", value: money(s.expensesPaid), share: expTotal ? s.expensesPaid / expTotal : 0, color: t.neg }}
          b={{ label: "A pagar", value: money(s.expensesPending), color: t.negSoft }}
        />
        <Divider />
        <FlowRow
          title="Renda"
          total={money(incTotal)}
          empty={incTotal === 0}
          a={{ label: "Recebida", value: money(s.incomeReceived), share: incTotal ? s.incomeReceived / incTotal : 0, color: t.pos }}
          b={{ label: "A receber", value: money(s.incomePending), color: t.posSoft }}
        />
      </Card>

      <Link href="/orcamento" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Orçamento do mês: ver todas as categorias">
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>
                Orçamento do mês
              </Text>
              <Text style={{ fontSize: 15, color: t.accent }}>Ver tudo ›</Text>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, color: t.ink }}>
                  <Text style={{ fontWeight: "600" }}>{money(s.spentTotal)}</Text>
                  <Text style={{ color: t.ink2 }}> de {money(s.limitsTotal)}</Text>
                </Text>
                <Text style={{ fontSize: 14, color: t.ink2 }}>{money(Math.max(s.limitsTotal - s.spentTotal, 0))} livres</Text>
              </View>
              <ProgressBar
                fill={s.limitsTotal ? s.spentTotal / s.limitsTotal : 0}
                color={s.projectedTotal > s.limitsTotal ? STATUS_COLOR.vai : STATUS_COLOR.ritmo}
              />
            </View>
            {attention.length ? <Divider /> : null}
            {attention.map((v) => (
              <View key={v.category.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>{v.category.name}</Text>
                <Text style={{ fontSize: 14, color: t.ink2 }}>{v.limit ? Math.round((v.spent / v.limit) * 100) : 0}%</Text>
                <View style={{ width: 96, alignItems: "center", paddingVertical: 3, borderRadius: 8, backgroundColor: STATUS_COLOR[v.status] }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: v.status === "vai" ? "#1C1C1E" : "#FFFFFF" }}>
                    {STATUS_LABEL[v.status]}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Pressable>
      </Link>

      {bills.length > 0 ? (
        <Card style={{ gap: 0, paddingBottom: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Faturas a pagar</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{money(bills.reduce((a, p) => a - p.amount, 0))}</Text>
          </View>
          <Text style={{ fontSize: 13, color: t.ink2, paddingBottom: 4 }}>
            Compras no cartão só saem do saldo no vencimento da fatura.
          </Text>
          {bills.map((p, i) => (
            <Link key={p.id} href={`/fatura/${p.id}`} asChild>
              <Pressable
                accessibilityRole="link"
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: t.line }}
              >
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, color: t.ink }}>{p.description}</Text>
                  <Text style={{ fontSize: 13, color: t.ink2 }}>
                    Vence {shortDate(p.dueDate)} · {monthOf(p.dueDate) === monthOf(f.today) ? "desconta do saldo deste mês" : "desconta no mês que vem"}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "600", color: t.ink }}>
                  {p.estimated ? "≈ " : ""}
                  {money(-p.amount)}
                </Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 0, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Próximos 7 dias</Text>
          <Link href="/lancamentos" style={{ fontSize: 15, color: t.accent }}>
            Ver todos
          </Link>
        </View>
        {s.upcoming.length === 0 ? (
          <Text style={{ color: t.ink2, paddingVertical: 12 }}>Nada previsto para a próxima semana.</Text>
        ) : (
          s.upcoming.map((p, i) => {
            const row = (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: i < s.upcoming.length - 1 ? 1 : 0,
                  borderBottomColor: t.line,
                }}
              >
                <View style={{ width: 40, alignItems: "center" }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: t.ink2 }}>{shortDate(p.dueDate).split(" ")[1]?.toUpperCase()}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: t.ink }}>{dayOfMonth(p.dueDate)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: t.ink }}>{p.description}</Text>
                  <Text style={{ fontSize: 13, color: p.creditCardStatement ? t.accent : t.ink2, fontWeight: p.creditCardStatement ? "600" : "400" }}>
                    {p.creditCardStatement ? "Ver composição ›" : p.amount > 0 ? "A receber" : "A pagar"}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "600", color: p.amount > 0 ? t.pos : t.ink }}>
                  {money(p.amount, { signed: true })}
                </Text>
              </View>
            );
            return p.creditCardStatement ? (
              <Link key={p.id} href={`/fatura/${p.id}`} asChild>
                <Pressable accessibilityRole="link">{row}</Pressable>
              </Link>
            ) : (
              <View key={p.id}>{row}</View>
            );
          })
        )}
      </Card>

      {top && (top.status === "estourou" || top.status === "vai" || top.status === "ritmo") ? (
        <Card style={{ borderWidth: 1, borderColor: t.accentSoft }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <SparkIcon color={t.accent} size={18} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.accent, letterSpacing: 0.3 }}>ASSISTENTE</Text>
          </View>
          <Text style={{ fontSize: 16, lineHeight: 22, color: t.ink }}>
            {top.category.name} está em <Text style={{ fontWeight: "600" }}>{money(top.spent)}</Text> de{" "}
            {money(top.limit)}. No ritmo atual, fecha o mês em <Text style={{ fontWeight: "600" }}>{money(top.projected)}</Text>.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Link href={`/categoria/${top.category.id}`} asChild>
              <PrimaryButton label="Ver transações" />
            </Link>
            <Link href="/limites" asChild>
              <PrimaryButton label="Ajustar limite" soft />
            </Link>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function FlowRow({
  title,
  total,
  a,
  b,
  empty,
}: {
  title: string;
  total: string;
  /** Sem valores no mês: mostra só o trilho cinza em vez de uma barra cheia. */
  empty?: boolean;
  a: { label: string; value: string; share: number; color: string };
  b: { label: string; value: string; color: string };
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>{title}</Text>
        <Text style={{ fontSize: 15, color: t.ink2 }}>{total} no mês</Text>
      </View>
      <ProgressBar segments={empty ? [] : [{ value: a.share, color: a.color }, { value: 1 - a.share, color: b.color }]} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: 4, columnGap: 12 }}>
        {[a, b].map((x) => (
          <View key={x.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.color }} />
            <Text style={{ fontSize: 14, color: t.ink }}>
              {x.label} <Text style={{ fontWeight: "600" }}>{x.value}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

