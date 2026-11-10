import { Pressable, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { shortDate, monthLabel } from "@/domain/dates";
import { Card, ProgressBar, Screen, SectionTitle } from "@/ui/components";
import { NavBar } from "@/ui/NavBar";
import { useTheme } from "@/ui/theme";

export default function FaturaDetalhe() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useFinance();
  const p = f.planned.find((x) => x.id === id && x.creditCardStatement);

  if (!p || !p.creditCardStatement) {
    return (
      <Screen>
        <NavBar back="Voltar" />
        <Text style={{ color: t.ink }}>Fatura não encontrada.</Text>
      </Screen>
    );
  }

  const { accountId, month } = p.creditCardStatement;
  const purchases = f.transactions
    .filter((tx) => tx.accountId === accountId && tx.statementMonth === month && tx.amount < 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = purchases.reduce((a, tx) => a - tx.amount, 0);
  const diff = -p.amount - total;

  const byCategory = new Map<string, { cents: number; count: number }>();
  for (const tx of purchases) {
    const key = tx.categoryId ?? "sem";
    const cur = byCategory.get(key) ?? { cents: 0, count: 0 };
    byCategory.set(key, { cents: cur.cents - tx.amount, count: cur.count + 1 });
  }
  const groups = [...byCategory.entries()]
    .map(([catId, v]) => ({ cat: f.categories.find((c) => c.id === catId), ...v }))
    .sort((a, b) => b.cents - a.cents);
  const catName = (catId: string | null) => f.categories.find((c) => c.id === catId)?.name ?? "Sem categoria";

  return (
    <Screen>
      <NavBar back="Voltar" />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", color: t.ink }}>
              {p.description}
            </Text>
            <Text style={{ fontSize: 13, color: t.ink2 }}>Fatura de {monthLabel(month).toLowerCase()}</Text>
          </View>
          <View style={{ backgroundColor: "#FDF0D5", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#8A5A00" }}>{p.status === "paid" ? "Paga" : "A pagar"}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 40, fontWeight: "600", color: t.ink, letterSpacing: -1 }}>{formatBRL(-p.amount)}</Text>
        <Text style={{ fontSize: 15, color: t.ink2 }}>
          Vence {shortDate(p.dueDate)} · {purchases.length} compras
        </Text>
        {diff !== 0 ? (
          <Text style={{ fontSize: 13, color: t.neg }}>
            {formatBRL(Math.abs(diff))} de diferença entre a fatura e as compras importadas.
          </Text>
        ) : null}
        <View style={{ backgroundColor: t.bg, borderRadius: 14, padding: 12 }}>
          <Text style={{ fontSize: 14, lineHeight: 20, color: t.ink2 }}>
            O pagamento da fatura não conta de novo como despesa. Cada compra já está na sua categoria do orçamento.
          </Text>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Por categoria</Text>
        <ProgressBar
          height={14}
          segments={groups.map((g) => ({ value: total ? g.cents / total : 0, color: g.cat?.color ?? t.ink3 }))}
        />
        {groups.map((g, i) => {
          const row = (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: i < groups.length - 1 ? 1 : 0,
                borderBottomColor: t.line,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: g.cat?.color ?? t.ink3 }} />
              <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>{g.cat?.name ?? "Sem categoria"}</Text>
              <Text style={{ fontSize: 15, color: t.ink2 }}>
                {g.count} {g.count === 1 ? "compra" : "compras"}
              </Text>
              <Text style={{ width: 96, textAlign: "right", fontSize: 15, fontWeight: "600", color: t.ink }}>{formatBRL(g.cents)}</Text>
            </View>
          );
          return g.cat?.kind === "variable" ? (
            <Link key={g.cat.id} href={`/categoria/${g.cat.id}`} asChild>
              <Pressable accessibilityRole="link">{row}</Pressable>
            </Link>
          ) : (
            <View key={g.cat?.id ?? "sem"}>{row}</View>
          );
        })}
      </Card>

      <SectionTitle>Compras desta fatura</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {purchases.map((tx, i) => (
          <View
            key={tx.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 11,
              borderBottomWidth: i < purchases.length - 1 ? 1 : 0,
              borderBottomColor: t.line,
            }}
          >
            <Text style={{ width: 48, fontSize: 13, color: t.ink2 }}>{shortDate(tx.date)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: t.ink }}>{tx.description}</Text>
              <Text style={{ fontSize: 12, color: t.ink2 }}>{catName(tx.categoryId)}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: t.ink }}>{formatBRL(-tx.amount)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
