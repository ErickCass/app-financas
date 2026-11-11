import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { useMonthSummary } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { monthLabel, monthOf, shortDate } from "@/domain/dates";
import type { Planned, Transaction } from "@/domain/types";
import { Card, Screen, SectionTitle } from "@/ui/components";
import { NavBar } from "@/ui/NavBar";
import { AccountMark } from "@/ui/AccountMark";
import { useTheme } from "@/ui/theme";

type Kind = "despesas" | "renda";

/**
 * De onde vêm os números do card Despesas/Renda da Início:
 * o que já saiu/entrou na conta e o que ainda vai sair/entrar no mês
 * (previstos pendentes e, nas despesas, as compras no cartão do mês).
 */
export default function Fluxo() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const kind: Kind = tipo === "renda" ? "renda" : "despesas";
  const t = useTheme();
  const f = useFinance();
  const s = useMonthSummary();
  const month = monthOf(f.today);
  const out = kind === "despesas";

  const data = useMemo(() => {
    const cardIds = new Set(f.accounts.filter((a) => a.kind === "credit_card").map((a) => a.id));
    const inMonth = (d: string) => monthOf(d) === month;
    const tx = f.transactions.filter((x) => inMonth(x.date) && !x.isCardPayment);
    const realized = tx
      .filter((x) => !cardIds.has(x.accountId) && (out ? x.amount < 0 : x.amount > 0))
      .sort((a, b) => b.date.localeCompare(a.date));
    const planned = f.planned
      .filter((p) => p.status !== "paid" && inMonth(p.dueDate) && !p.creditCardStatement && (out ? p.amount < 0 : p.amount > 0))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    // Compras no cartão do mês, por cartão (líquidas de estornos).
    const byCard = new Map<string, { total: number; count: number; bill: Planned | undefined }>();
    if (out) {
      for (const x of tx.filter((x) => cardIds.has(x.accountId))) {
        const cur = byCard.get(x.accountId) ?? {
          total: 0,
          count: 0,
          bill: f.planned.find((p) => p.creditCardStatement?.accountId === x.accountId && p.status !== "paid" && p.creditCardStatement.month >= month),
        };
        byCard.set(x.accountId, { ...cur, total: cur.total - x.amount, count: cur.count + 1 });
      }
    }
    return { realized, planned, byCard: [...byCard.entries()].sort((a, b) => b[1].total - a[1].total) };
  }, [f.transactions, f.planned, f.accounts, month, out]);

  const accountOf = (id: string) => f.accounts.find((a) => a.id === id);
  const catName = (id: string | null) => f.categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const pendingTotal = out ? s.expensesPending : s.incomePending;
  const realizedTotal = out ? s.expensesPaid : s.incomeReceived;
  const cardTotal = data.byCard.reduce((a, [, v]) => a + Math.max(v.total, 0), 0);

  const row = (key: string, accountId: string, title: string, sub: string, amount: number, date: string, href?: string) => {
    const content = (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.line }}>
        {date ? <Text style={{ width: 40, fontSize: 12, color: t.ink2 }}>{shortDate(date)}</Text> : null}
        {accountOf(accountId) ? <AccountMark account={accountOf(accountId)!} size={24} /> : null}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, color: t.ink }}>{title}</Text>
          <Text numberOfLines={2} style={{ fontSize: 12, color: href ? t.accent : t.ink2, lineHeight: 16 }}>{sub}</Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: "600", color: out ? t.ink : t.pos, fontVariant: ["tabular-nums"] }}>{formatBRL(Math.abs(amount))}</Text>
      </View>
    );
    return href ? (
      <Link key={key} href={href as never} asChild>
        <Pressable accessibilityRole="link">{content}</Pressable>
      </Link>
    ) : (
      <View key={key}>{content}</View>
    );
  };

  return (
    <Screen>
      <NavBar back="Início" />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, color: t.ink2, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 }}>{monthLabel(month)}</Text>
        <Text style={{ fontSize: 28, fontWeight: "700", color: t.ink, letterSpacing: -0.3 }}>{out ? "Despesas do mês" : "Renda do mês"}</Text>
      </View>

      <SectionTitle right={<Text style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{formatBRL(pendingTotal)}</Text>}>
        {out ? "A pagar" : "A receber"}
      </SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {data.planned.length === 0 && data.byCard.length === 0 && s.fixedRemaining.length === 0 ? (
          <Text style={{ fontSize: 14, color: t.ink2, paddingVertical: 12 }}>{out ? "Nada previsto para pagar neste mês." : "Nada previsto para receber neste mês."}</Text>
        ) : null}
        {data.planned.map((p) =>
          row(p.id, p.accountId, p.description, `${catName(p.categoryId)} · ${p.recurringRuleId ? "todo mês" : "previsto"}${p.estimated ? " · valor aproximado" : ""}`, p.amount, p.dueDate, `/previsto?id=${p.id}`),
        )}
        {data.byCard.map(([accountId, v]) => {
          const acc = accountOf(accountId);
          return row(
            accountId,
            accountId,
            `Compras no ${acc?.name ?? "cartão"}`,
            `${v.count} ${v.count === 1 ? "compra" : "compras"}${v.bill ? ` · fatura vence ${shortDate(v.bill.dueDate)} ›` : " · ver ›"}`,
            -v.total,
            "",
            v.bill ? `/fatura/${v.bill.id}` : `/lancamentos`,
          );
        })}
        {out
          ? s.fixedRemaining.map((r) => {
              const cat = f.categories.find((c) => c.id === r.categoryId);
              const expected = f.budgets.find((b) => b.categoryId === r.categoryId && b.month === month)?.limit ?? 0;
              return row(
                `fixed-${r.categoryId}`,
                "",
                cat?.name ?? "Conta fixa",
                r.amount === expected ? `conta fixa · previsto ${formatBRL(expected)} · ainda não paga ›` : `conta fixa · falta pagar de ${formatBRL(expected)} previstos ›`,
                -r.amount,
                "",
                `/categoria/${r.categoryId}`,
              );
            })
          : null}
        {out && cardTotal > 0 ? (
          <Text style={{ fontSize: 12, color: t.ink2, lineHeight: 17, paddingVertical: 10 }}>
            Compra no cartão conta como a pagar no mês da compra, mesmo que a fatura vença no mês seguinte.
            {s.fixedRemaining.length ? " Conta fixa com valor previsto entra até ser paga; o valor se ajusta quando o pagamento aparece." : ""}
          </Text>
        ) : null}
      </Card>

      <SectionTitle right={<Text style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{formatBRL(realizedTotal)}</Text>}>
        {out ? "Pagas" : "Recebida"}
      </SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {data.realized.length === 0 ? (
          <Text style={{ fontSize: 14, color: t.ink2, paddingVertical: 12 }}>{out ? "Nenhuma saída da conta neste mês." : "Nenhuma entrada na conta neste mês."}</Text>
        ) : null}
        {data.realized.map((x: Transaction) =>
          row(x.id, x.accountId, x.description, catName(x.categoryId), x.amount, x.date, x.categoryId ? undefined : "/classificar"),
        )}
      </Card>
    </Screen>
  );
}
