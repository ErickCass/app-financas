import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { useBudgetView } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { dayOfMonth, daysInMonth, monthLabel, monthOf, shortDate } from "@/domain/dates";
import type { Transaction } from "@/domain/types";
import { Card, ProgressBar, Screen, SectionTitle } from "@/ui/components";
import { NavBar } from "@/ui/NavBar";
import { overrunDay, PaceChart } from "@/ui/PaceChart";
import { STATUS_COLOR, STATUS_LABEL, useTheme } from "@/ui/theme";

export default function CategoriaDetalhe() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useFinance();
  const view = useBudgetView();
  const v = view.find((x) => x.category.id === id);
  const [openTx, setOpenTx] = useState<string | null>(null);

  if (!v) {
    return (
      <Screen>
        <NavBar back="Orçamento" />
        <Text style={{ color: t.ink }}>Categoria não encontrada.</Text>
      </Screen>
    );
  }

  const month = monthOf(f.today);
  const totalDays = daysInMonth(month);
  const day = dayOfMonth(f.today);
  const color = STATUS_COLOR[v.status];
  const over = v.spent - v.limit;
  const crossedOn = overrunDay(v.transactions, v.limit);
  const accountName = (accountId: string) => f.accounts.find((a) => a.id === accountId)?.name ?? "";
  const byKind = countBy(v.transactions, (tx) => f.accounts.find((a) => a.id === tx.accountId)?.kind ?? "");
  const others = f.categories.filter((c) => c.kind === "variable" && c.id !== v.category.id);
  const statementPlanned = (tx: Transaction) =>
    f.planned.find((p) => p.creditCardStatement?.accountId === tx.accountId && p.creditCardStatement.month === tx.statementMonth);

  return (
    <Screen>
      <NavBar
        back="Orçamento"
        right={
          <Link href="/limites" style={{ color: t.accent, fontSize: 17 }}>
            Editar limite
          </Link>
        }
      />

      <Card>
        <View>
          <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", color: t.ink }}>
            {v.category.name}
          </Text>
          <Text style={{ fontSize: 13, color: t.ink2 }}>{monthLabel(month)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 40, fontWeight: "600", color: t.ink, letterSpacing: -1 }}>{formatBRL(v.spent)}</Text>
          <Text style={{ fontSize: 15, color: t.ink2 }}>{v.limit ? `de ${formatBRL(v.limit)}` : "sem limite"}</Text>
        </View>
        {v.status === "semlimite" ? (
          <ProgressBar height={12} fill={0} />
        ) : (
          <ProgressBar height={12} fill={v.spent / v.limit} color={color} marker={v.expectedShareToday} />
        )}
        <Text style={{ fontSize: 15, fontWeight: "600", color: v.status === "estourou" ? "#B42318" : t.ink }}>
          {v.status === "estourou"
            ? `${formatBRL(over)} acima do limite, com ${totalDays - day} dias pela frente`
            : v.status === "vai"
              ? `Previsto ${formatBRL(v.projected)}. Para fechar no limite: ${formatBRL(v.dailyAllowance)}/dia`
              : v.status === "semlimite"
                ? `Sem limite definido · previsto ${formatBRL(v.projected)} no mês`
                : `${STATUS_LABEL[v.status]} · previsto ${formatBRL(v.projected)}`}
        </Text>
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Ritmo do mês</Text>
          <View style={{ backgroundColor: color, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: v.status === "vai" ? "#1C1C1E" : "#FFFFFF" }}>
              {STATUS_LABEL[v.status]}
            </Text>
          </View>
        </View>
        <PaceChart
          transactions={v.transactions}
          limit={v.limit}
          projected={v.projected}
          today={day}
          totalDays={totalDays}
          history={f.history.find((h) => h.categoryId === v.category.id)}
          color={color}
        />
        <Text style={{ fontSize: 14, lineHeight: 20, color: t.ink2 }}>
          {crossedOn ? `Passou do limite no dia ${crossedOn}. ` : ""}
          Se o resto do mês seguir o seu padrão, termina em{" "}
          <Text style={{ fontWeight: "600", color: t.ink }}>{formatBRL(v.projected, { noCents: true })}</Text>.
        </Text>
      </Card>

      <SectionTitle
        right={
          <Text style={{ fontSize: 13, color: t.ink2 }}>
            {[
              byKind.credit_card ? `${byKind.credit_card} no cartão` : "",
              byKind.checking ? `${byKind.checking} na conta` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        }
      >
        {`${v.transactions.length} ${v.transactions.length === 1 ? "transação" : "transações"}`}
      </SectionTitle>

      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {v.transactions.map((tx, i) => {
          const card = f.accounts.find((a) => a.id === tx.accountId)?.kind === "credit_card";
          const stmt = card ? statementPlanned(tx) : undefined;
          const origin = card
            ? `${accountName(tx.accountId)} · fatura de ${monthLabel(tx.statementMonth ?? month).split(" ")[0]!.toLowerCase().slice(0, 3)}`
            : `${accountName(tx.accountId)}`;
          const open = openTx === tx.id;
          return (
            <View key={tx.id} style={{ borderBottomWidth: i < v.transactions.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Toque para mudar a categoria"
                onPress={() => setOpenTx(open ? null : tx.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}
              >
                <View style={{ width: 34, alignItems: "center" }}>
                  <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>{String(dayOfMonth(tx.date)).padStart(2, "0")}</Text>
                  <Text style={{ fontSize: 11, color: t.ink2 }}>{shortDate(tx.date).split(" ")[1]}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 16, color: t.ink }}>{tx.description}</Text>
                  <Text style={{ fontSize: 12, color: card ? t.accent : t.ink2, fontWeight: card ? "600" : "400" }}>
                    {origin}
                    {tx.source === "apple_pay" ? " · Apple Pay" : ""}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "600", color: t.ink }}>{formatBRL(-tx.amount)}</Text>
              </Pressable>
              {open ? (
                <View style={{ paddingBottom: 12, gap: 8 }}>
                  <Text style={{ fontSize: 13, color: t.ink2 }}>Mover para:</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {others.map((c) => (
                      <Pressable
                        key={c.id}
                        accessibilityRole="button"
                        onPress={() => {
                          f.setTransactionCategory(tx.id, c.id);
                          setOpenTx(null);
                        }}
                        style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1, borderColor: t.line, justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 14, color: t.accent, fontWeight: "600" }}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {stmt ? (
                    <Link href={`/fatura/${stmt.id}`} style={{ fontSize: 14, color: t.accent, fontWeight: "600" }}>
                      Ver a fatura desta compra ›
                    </Link>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 15, color: t.ink2 }}>Total da categoria</Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{formatBRL(v.spent)}</Text>
      </View>
      <Text style={{ fontSize: 13, color: t.ink2, paddingHorizontal: 4 }}>
        Toque numa transação para mudar a categoria. O total e o orçamento se ajustam na hora.
      </Text>
    </Screen>
  );
}

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}
