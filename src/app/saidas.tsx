/**
 * "Até o fim do mês": quanto ainda sai da conta corrente, por categoria, com o
 * orçamento e o utilizado ao lado. É a visão de caixa (ver domain/cashOut.ts):
 * a fatura que vence este mês sai agora; as compras deste mês no cartão, não.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFinance } from "@/data/store";
import { useCashOut } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { lastDayOfMonth, shortDate } from "@/domain/dates";
import type { CashOutItem, CashOutRow } from "@/domain/cashOut";
import { Card, Screen } from "@/ui/components";
import { NavBar } from "@/ui/NavBar";
import { useTheme } from "@/ui/theme";

type Sort = "sair" | "usado" | "nome";

const itemLabel = (i: CashOutItem) =>
  i.kind === "fatura"
    ? `${i.label} · vence ${shortDate(i.dueDate!)}`
    : i.kind === "fixa"
      ? "Conta fixa ainda não paga (valor previsto)"
      : `${i.label}${i.dueDate ? ` · ${shortDate(i.dueDate)}` : ""}`;

export default function Saidas() {
  const t = useTheme();
  const f = useFinance();
  const c = useCashOut();
  const [sort, setSort] = useState<Sort>("sair");
  const [open, setOpen] = useState<string | null>(null);
  const end = shortDate(lastDayOfMonth(c.month));

  const name = (r: CashOutRow) => f.categories.find((x) => x.id === r.categoryId)?.name ?? "Sem categoria";
  const color = (r: CashOutRow) => f.categories.find((x) => x.id === r.categoryId)?.color ?? t.ink3;
  const rows = [...c.rows].sort((a, b) =>
    sort === "nome"
      ? name(a).localeCompare(name(b), "pt-BR")
      : sort === "usado"
        ? b.used - a.used || b.toLeave - a.toLeave
        : b.toLeave - a.toLeave || b.used - a.used,
  );
  const totals = c.rows.reduce((a, r) => ({ budget: a.budget + r.budget, used: a.used + r.used }), { budget: 0, used: 0 });

  const Num = ({ v, strong, muted, color: col }: { v: number; strong?: boolean; muted?: boolean; color?: string }) => (
    <Text
      style={{
        flex: 1,
        textAlign: "right",
        fontSize: 14,
        fontVariant: ["tabular-nums"],
        fontWeight: strong ? "600" : "400",
        color: col ?? (muted ? t.ink3 : t.ink),
      }}
    >
      {v === 0 ? "—" : formatBRL(v, { noCents: true })}
    </Text>
  );

  /**
   * Linha do resumo. `kind` decide o sinal mostrado: o saldo de hoje e o previsto
   * aparecem com o sinal real (conta no limite fica "−R$" em vermelho); entradas e
   * saídas aparecem como "+" e "−" sobre o valor absoluto.
   */
  const Line = ({ label, value, kind }: { label: string; value: number; kind: "saldo" | "entra" | "sai" | "previsto" }) => {
    const strong = kind === "previsto";
    const negative = (kind === "saldo" || kind === "previsto") && value < 0;
    const text =
      kind === "entra" ? `+ ${formatBRL(value)}` : kind === "sai" ? `− ${formatBRL(value)}` : formatBRL(value);
    return (
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingVertical: 3 }}>
        <Text style={{ flexShrink: 1, fontSize: strong ? 16 : 15, color: strong ? t.ink : t.ink2, fontWeight: strong ? "600" : "400" }}>
          {label}
        </Text>
        <Text
          style={{
            fontSize: strong ? 17 : 15,
            fontWeight: strong ? "700" : "500",
            fontVariant: ["tabular-nums"],
            color: negative ? t.neg : t.ink,
          }}
        >
          {text}
        </Text>
      </View>
    );
  };

  return (
    <Screen>
      <NavBar back="Início" />
      <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, paddingHorizontal: 4 }}>
        Até o fim do mês
      </Text>
      <Text style={{ fontSize: 13, color: t.ink2, paddingHorizontal: 4, lineHeight: 18 }}>
        O que ainda sai da conta corrente até {end}. A fatura que vence este mês entra aqui, dividida pelas categorias das
        compras; as compras deste mês no cartão ficam para a fatura do mês que vem.
      </Text>

      <Card style={{ gap: 2 }}>
        <Line label="Saldo hoje" value={c.balanceToday} kind="saldo" />
        {c.incomePending > 0 ? <Line label="A receber" value={c.incomePending} kind="entra" /> : null}
        <Line label="Sai da conta" value={c.toLeave} kind="sai" />
        <View style={{ height: 1, backgroundColor: t.line, marginVertical: 6 }} />
        <Line label={`Saldo previsto em ${end}`} value={c.projectedBalance} kind="previsto" />
        <Text style={{ fontSize: 12, color: t.ink3, paddingTop: 6, lineHeight: 16 }}>
          Não inclui gastos variáveis que você ainda vai fazer no débito ou no PIX.
        </Text>
      </Card>

      <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: t.track, borderRadius: 9, padding: 2 }}>
        {(
          [
            ["sair", "A sair"],
            ["usado", "Utilizado"],
            ["nome", "Nome"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: sort === k }}
            onPress={() => setSort(k)}
            style={{ flex: 1, height: 32, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: sort === k ? t.card : "transparent" }}
          >
            <Text style={{ fontSize: 13, fontWeight: sort === k ? "600" : "500", color: t.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ gap: 0, paddingTop: 10 }}>
        <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={{ flex: 1.3, fontSize: 12, color: t.ink2 }}>Categoria</Text>
          <Text style={{ flex: 1, fontSize: 12, color: t.ink2, textAlign: "right" }}>Orçamento</Text>
          <Text style={{ flex: 1, fontSize: 12, color: t.ink2, textAlign: "right" }}>Utilizado</Text>
          <Text style={{ flex: 1, fontSize: 12, color: t.ink, fontWeight: "600", textAlign: "right" }}>A sair</Text>
        </View>

        {rows.map((r) => {
          const key = r.categoryId ?? "sem";
          const isOpen = open === key;
          const over = r.budget > 0 && r.used > r.budget;
          return (
            <View key={key} style={{ borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                disabled={r.items.length === 0}
                onPress={() => setOpen(isOpen ? null : key)}
                style={{ paddingVertical: 10, gap: 4 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color(r) }} />
                  <Text style={{ flex: 1, fontSize: 15, color: t.ink }} numberOfLines={1}>
                    {name(r)}
                  </Text>
                  {r.items.length > 0 ? <Text style={{ fontSize: 13, color: t.ink3 }}>{isOpen ? "▴" : "▾"}</Text> : null}
                </View>
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1.3 }} />
                  <Num v={r.budget} muted />
                  <Num v={r.used} color={over ? t.neg : undefined} />
                  <Num v={r.toLeave} strong />
                </View>
              </Pressable>
              {isOpen ? (
                <View style={{ paddingBottom: 10, paddingLeft: 14, gap: 6 }}>
                  {r.items.map((i, idx) => (
                    <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ flex: 1, fontSize: 13, color: t.ink2 }}>{itemLabel(i)}</Text>
                      <Text style={{ fontSize: 13, color: t.ink, fontVariant: ["tabular-nums"] }}>{formatBRL(i.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {c.billsOther > 0 ? (
          <View style={{ paddingVertical: 10, gap: 4, borderBottomWidth: 1, borderBottomColor: t.line }}>
            <Text style={{ fontSize: 15, color: t.ink }}>Outros na fatura</Text>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ flex: 3.3, fontSize: 12, color: t.ink3 }}>Saldo anterior, juros ou encargos</Text>
              <Num v={c.billsOther} strong />
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", paddingTop: 10 }}>
          <Text style={{ flex: 1.3, fontSize: 15, fontWeight: "600", color: t.ink }}>Total</Text>
          <Num v={totals.budget} muted />
          <Num v={totals.used} />
          <Num v={c.toLeave} strong />
        </View>
      </Card>
    </Screen>
  );
}
