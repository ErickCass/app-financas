import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { shortDate } from "@/domain/dates";
import type { Transaction } from "@/domain/types";
import { rulePattern } from "@/import/categorize";
import { Card, Screen } from "@/ui/components";
import { NavBar } from "@/ui/NavBar";
import { useTheme } from "@/ui/theme";

interface Group {
  key: string;
  title: string;
  items: Transaction[];
  total: number;
}

/**
 * Lançamentos sem categoria, agrupados pela mesma loja/pessoa.
 * Escolher a categoria de um grupo classifica todos e ensina o app para as próximas importações.
 */
export default function Classificar() {
  const t = useTheme();
  const f = useFinance();
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<{ ids: string[]; label: string; learned: boolean } | null>(null);
  // Lançamentos desmarcados dentro do grupo aberto (ficam de fora da classificação).
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const toggleOpen = (key: string | null) => {
    setOpen(key);
    setSkipped(new Set());
  };
  const chosen = (g: Group) => g.items.filter((i) => !skipped.has(i.id));
  const [sort, setSort] = useState<"valor" | "data">("valor");

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const tx of f.transactions) {
      if (tx.categoryId || tx.isCardPayment) continue;
      const pattern = rulePattern(tx.description);
      const key = pattern.length >= 3 ? pattern : `tx:${tx.id}`;
      const g = map.get(key) ?? { key, title: tx.description, items: [], total: 0 };
      g.items.push(tx);
      g.total += tx.amount;
      map.set(key, g);
    }
    // Maiores primeiro: classificar o que mais pesa já resolve a maior parte do orçamento.
    const latest = (g: Group) => g.items.reduce((m, x) => (x.date > m ? x.date : m), "");
    return [...map.values()].sort((a, b) =>
      sort === "data" ? latest(b).localeCompare(latest(a)) || Math.abs(b.total) - Math.abs(a.total) : Math.abs(b.total) - Math.abs(a.total),
    );
  }, [f.transactions, sort]);

  const pending = groups.reduce((a, g) => a + g.items.length, 0);
  // Ordem alfabética única, para achar a categoria de relance.
  const choices = [...f.categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  async function assign(g: Group, categoryId: string) {
    const items = chosen(g);
    if (items.length === 0) return;
    // Só ensina a regra da loja quando o grupo inteiro vai para a mesma categoria.
    const whole = items.length === g.items.length;
    if (whole) toggleOpen(null);
    else setSkipped(new Set());
    setDone((d) => d + items.length);
    setLast({
      ids: items.map((i) => i.id),
      label: `${items.length} em ${f.categories.find((c) => c.id === categoryId)?.name ?? "categoria"}`,
      learned: whole,
    });
    await f.categorizeMany(items.map((i) => i.id), categoryId, whole);
  }

  async function undo() {
    if (!last) return;
    const action = last;
    setLast(null);
    setDone((d) => Math.max(0, d - action.ids.length));
    await f.clearClassification(action.ids, action.learned);
  }

  async function transfer(g: Group) {
    const items = chosen(g);
    if (items.length === 0) return;
    if (items.length === g.items.length) toggleOpen(null);
    else setSkipped(new Set());
    setDone((d) => d + items.length);
    setLast({ ids: items.map((i) => i.id), label: `${items.length} como transferência`, learned: false });
    await f.markInternal(items.map((i) => i.id));
  }

  return (
    <Screen>
      <NavBar back="Voltar" />
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: t.ink, letterSpacing: -0.3 }}>Sem categoria</Text>
        <Text style={{ fontSize: 15, color: t.ink2, lineHeight: 21 }}>
          {pending === 0
            ? done > 0
              ? `Pronto! ${done} lançamentos classificados.`
              : "Tudo classificado."
            : `${pending} lançamento${pending > 1 ? "s" : ""} em ${groups.length} grupo${groups.length > 1 ? "s" : ""}. Escolha uma vez por loja ou pessoa: o app aplica a todos iguais e lembra nas próximas importações.`}
        </Text>
      </View>

      {last ? (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 14, paddingRight: 6, minHeight: 48, borderRadius: 14, backgroundColor: t.posSoft }}
        >
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: t.ink }}>
            ✓ {last.label}
          </Text>
          <Pressable accessibilityRole="button" onPress={undo} style={{ height: 44, paddingHorizontal: 12, justifyContent: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: t.accent }}>Desfazer</Text>
          </Pressable>
        </View>
      ) : null}

      {groups.length > 1 ? (
        <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: t.track, gap: 2 }}>
          {(
            [
              ["valor", "Maior valor"],
              ["data", "Mais recentes"],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: sort === k }}
              onPress={() => setSort(k)}
              style={{ flex: 1, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: sort === k ? t.card : "transparent" }}
            >
              <Text style={{ fontSize: 14, fontWeight: sort === k ? "600" : "500", color: t.ink }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {groups.length > 0 ? (
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {groups.map((g, i) => {
            const isOpen = open === g.key;
            const dates = g.items.map((x) => x.date).sort();
            const accounts = [...new Set(g.items.map((x) => f.accounts.find((a) => a.id === x.accountId)?.name ?? ""))].join(", ");
            return (
              <View key={g.key} style={{ borderBottomWidth: i < groups.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Toque para escolher a categoria"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => toggleOpen(isOpen ? null : g.key)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontSize: 16, color: t.ink, fontWeight: "500" }}>
                      {g.title}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: t.ink2 }}>
                      {g.items.length > 1 ? `${g.items.length}× · ${shortDate(dates[0]!)} a ${shortDate(dates.at(-1)!)}` : shortDate(dates[0]!)} · {accounts}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: g.total > 0 ? t.pos : t.ink, fontVariant: ["tabular-nums"] }}>
                    {g.total > 0 ? "+" : ""}
                    {formatBRL(Math.abs(g.total))}
                  </Text>
                </Pressable>
                {isOpen ? (
                  <View style={{ gap: 10, paddingBottom: 14 }}>
                    {g.items.length > 1 ? (
                      <View>
                        <Text style={{ fontSize: 13, color: t.ink2, paddingBottom: 4 }}>
                          Desmarque o que for de outra categoria; depois classifique o restante.
                        </Text>
                        {g.items.map((x) => {
                          const on = !skipped.has(x.id);
                          return (
                            <Pressable
                              key={x.id}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: on }}
                              onPress={() =>
                                setSkipped((s) => {
                                  const n = new Set(s);
                                  if (on) n.add(x.id);
                                  else n.delete(x.id);
                                  return n;
                                })
                              }
                              style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 }}
                            >
                              <View
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 6,
                                  borderWidth: on ? 0 : 1.5,
                                  borderColor: t.ink3,
                                  backgroundColor: on ? t.accent : "transparent",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {on ? <Text style={{ color: t.onAccent, fontSize: 13, fontWeight: "700" }}>✓</Text> : null}
                              </View>
                              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: on ? t.ink : t.ink2 }}>
                                {shortDate(x.date)} · {x.description}
                              </Text>
                              <Text style={{ fontSize: 14, color: on ? t.ink : t.ink2, fontVariant: ["tabular-nums"] }}>
                                {formatBRL(Math.abs(x.amount))}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {choices.map((c) => (
                        <Pressable
                          key={c.id}
                          accessibilityRole="button"
                          onPress={() => assign(g, c.id)}
                          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: t.track }}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
                          <Text style={{ color: t.ink, fontSize: 14 }}>{c.name}</Text>
                        </Pressable>
                      ))}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityHint="Pagamento de fatura ou PIX entre contas suas: não conta no orçamento"
                        onPress={() => transfer(g)}
                        style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: "center", borderWidth: 1, borderColor: t.line }}
                      >
                        <Text style={{ color: t.ink2, fontSize: 14 }}>Transferência entre minhas contas</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}
      <Link href="/limites" style={{ fontSize: 14, color: t.accent, fontWeight: "600", textAlign: "center", paddingVertical: 8 }}>
        Faltou uma categoria? Criar categoria
      </Link>
    </Screen>
  );
}
