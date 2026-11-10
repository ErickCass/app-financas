import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { normalizeDescription } from "@/domain/dedup";
import { monthOf, shortDate } from "@/domain/dates";
import { Card, Screen } from "@/ui/components";
import { useTheme } from "@/ui/theme";

type Filter = "todos" | "previstos" | "realizados";
type Row = {
  key: string;
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  status: "a_pagar" | "a_receber" | "pago" | "recebido";
  href?: string;
};

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export default function Lancamentos() {
  const t = useTheme();
  const f = useFinance();
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const month = monthOf(f.today);
  const catName = (id: string | null) => f.categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const accName = (id: string) => f.accounts.find((a) => a.id === id)?.name ?? "";

  const rows = useMemo(() => {
    const planned: Row[] = f.planned
      .filter((p) => p.status !== "paid" && monthOf(p.dueDate) === month)
      .map((p) => ({
        key: p.id,
        date: p.dueDate,
        title: p.description,
        subtitle: p.creditCardStatement ? "Ver as compras desta fatura ›" : `${catName(p.categoryId)} · ${accName(p.accountId)}`,
        amount: p.amount,
        status: p.amount > 0 ? "a_receber" : "a_pagar",
        href: p.creditCardStatement ? `/fatura/${p.id}` : undefined,
      }));
    const real: Row[] = f.transactions
      .filter((tx) => monthOf(tx.date) === month && !tx.isCardPayment)
      .map((tx) => ({
        key: tx.id,
        date: tx.date,
        title: tx.description,
        subtitle: `${catName(tx.categoryId)} · ${accName(tx.accountId)}${tx.source === "apple_pay" ? " · Apple Pay" : ""}`,
        amount: tx.amount,
        status: tx.amount > 0 ? "recebido" : "pago",
        href: tx.categoryId && f.categories.find((c) => c.id === tx.categoryId)?.kind === "variable" ? `/categoria/${tx.categoryId}` : undefined,
      }));
    let all = filter === "previstos" ? planned : filter === "realizados" ? real : [...planned, ...real];
    const q = normalizeDescription(query);
    if (q) all = all.filter((r) => normalizeDescription(`${r.title} ${r.subtitle}`).includes(q));
    return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [f, filter, query, month]);

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return [...m.entries()];
  }, [rows]);

  const pendingOut = f.planned.filter((p) => p.status !== "paid" && monthOf(p.dueDate) === month && p.amount < 0);
  const pendingIn = f.planned.filter((p) => p.status !== "paid" && monthOf(p.dueDate) === month && p.amount > 0);

  return (
    <Screen
      title="Lançamentos"
      right={
        <Link href="/novo" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Novo lançamento"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: t.onAccent, fontSize: 26, lineHeight: 28, fontWeight: "400" }}>+</Text>
          </Pressable>
        </Link>
      }
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar estabelecimento ou categoria"
        placeholderTextColor={t.ink2}
        accessibilityLabel="Buscar lançamentos"
        style={{ height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: t.track, color: t.ink, fontSize: 16 }}
      />
      <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: t.track, gap: 2 }}>
        {(
          [
            ["todos", "Todos"],
            ["previstos", "A pagar e receber"],
            ["realizados", "Realizados"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === k }}
            onPress={() => setFilter(k)}
            style={{ flex: 1, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: filter === k ? t.card : "transparent" }}
          >
            <Text style={{ fontSize: 14, fontWeight: filter === k ? "600" : "500", color: t.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1, padding: 14, gap: 4 }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>A pagar no mês</Text>
          <Text style={{ fontSize: 20, fontWeight: "600", color: t.neg }}>{formatBRL(-pendingOut.reduce((a, p) => a + p.amount, 0))}</Text>
          <Text style={{ fontSize: 13, color: t.ink2 }}>{pendingOut.length} lançamentos</Text>
        </Card>
        <Card style={{ flex: 1, padding: 14, gap: 4 }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>A receber no mês</Text>
          <Text style={{ fontSize: 20, fontWeight: "600", color: t.pos }}>{formatBRL(pendingIn.reduce((a, p) => a + p.amount, 0))}</Text>
          <Text style={{ fontSize: 13, color: t.ink2 }}>{pendingIn.length} lançamento{pendingIn.length === 1 ? "" : "s"}</Text>
        </Card>
      </View>

      {groups.map(([date, items]) => {
        const d = new Date(`${date}T12:00:00`);
        const label = `${date === f.today ? "HOJE · " : ""}${WEEKDAYS[d.getDay()]}, ${shortDate(date).toUpperCase()}`;
        return (
          <View key={date} style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.ink2, paddingHorizontal: 4, letterSpacing: 0.3 }}>{label}</Text>
            <Card style={{ gap: 0, paddingVertical: 0, paddingHorizontal: 16 }}>
              {items.map((r, i) => {
                const content = (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: i < items.length - 1 ? 1 : 0,
                      borderBottomColor: t.line,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 16, color: t.ink }}>{r.title}</Text>
                      <Text style={{ fontSize: 13, color: r.href && r.status.startsWith("a_") ? t.accent : t.ink2 }}>{r.subtitle}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: r.amount > 0 ? t.pos : t.ink }}>
                        {formatBRL(r.amount, { signed: true })}
                      </Text>
                      {r.status.startsWith("a_") ? (
                        <View style={{ backgroundColor: "#FDF0D5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#8A5A00" }}>
                            {r.status === "a_pagar" ? "A pagar" : "A receber"}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: t.ink2 }}>{r.status === "pago" ? "Pago" : "Recebido"}</Text>
                      )}
                    </View>
                  </View>
                );
                return r.href ? (
                  <Link key={r.key} href={r.href as never} asChild>
                    <Pressable accessibilityRole="link">{content}</Pressable>
                  </Link>
                ) : (
                  <View key={r.key}>{content}</View>
                );
              })}
            </Card>
          </View>
        );
      })}
      {groups.length === 0 ? <Text style={{ color: t.ink2, textAlign: "center", padding: 24 }}>Nenhum lançamento encontrado.</Text> : null}
    </Screen>
  );
}
