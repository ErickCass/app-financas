/**
 * A lista de lançamentos usada em todo o app: aba Lançamentos, detalhe da
 * categoria e detalhe da fatura. Por data, agrupa por dia; por valor, uma lista só.
 */
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { shortDate } from "@/domain/dates";
import type { TxRow } from "@/domain/txList";
import { AccountMark } from "./AccountMark";
import { Card } from "./components";
import { useTheme } from "./theme";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function TransactionList({
  rows,
  byDate = true,
  empty = "Nenhum lançamento encontrado.",
}: {
  rows: TxRow[];
  byDate?: boolean;
  empty?: string;
}) {
  const t = useTheme();
  const f = useFinance();
  if (rows.length === 0)
    return (
      <Text style={{ color: t.ink2, textAlign: "center", padding: 24 }}>
        {empty}
      </Text>
    );

  const groups: [string | null, TxRow[]][] = byDate ? [] : [[null, rows]];
  if (byDate)
    for (const r of rows) {
      const last = groups[groups.length - 1];
      if (last && last[0] === r.date) last[1].push(r);
      else groups.push([r.date, [r]]);
    }

  return (
    <>
      {groups.map(([date, items]) => (
        <View key={date ?? "todos"} style={{ gap: 8 }}>
          {date ? (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: t.ink2,
                paddingHorizontal: 4,
                letterSpacing: 0.3,
              }}
            >
              {`${date === f.today ? "HOJE · " : ""}${WEEKDAYS[new Date(`${date}T12:00:00`).getDay()]}, ${shortDate(date).toUpperCase()}`}
            </Text>
          ) : null}
          <Card style={{ gap: 0, paddingVertical: 0, paddingHorizontal: 16 }}>
            {items.map((r, i) => (
              <Row
                key={r.key}
                r={r}
                last={i === items.length - 1}
                showDate={!date}
              />
            ))}
          </Card>
        </View>
      ))}
    </>
  );
}

function Row({
  r,
  last,
  showDate,
}: {
  r: TxRow;
  last: boolean;
  showDate: boolean;
}) {
  const t = useTheme();
  const f = useFinance();
  const account = f.accounts.find((a) => a.id === r.accountId);
  const pending = r.status === "a_pagar" || r.status === "a_receber";
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.line,
      }}
    >
      {account ? <AccountMark account={account} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, color: t.ink }}>{r.title}</Text>
        <Text
          style={{ fontSize: 13, color: r.href && pending ? t.accent : t.ink2 }}
        >
          {showDate ? `${shortDate(r.date)} · ` : ""}
          {r.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: r.amount > 0 ? t.pos : t.ink,
          }}
        >
          {formatBRL(r.amount, { signed: true })}
        </Text>
        {pending ? (
          <View
            style={{
              backgroundColor: "#FDF0D5",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#8A5A00" }}>
              {r.status === "a_pagar" ? "A pagar" : "A receber"}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: t.ink2 }}>
            {r.status === "pago" ? "Pago" : "Recebido"}
          </Text>
        )}
      </View>
    </View>
  );
  return r.href ? (
    <Link href={r.href as never} asChild>
      <Pressable accessibilityRole="link">{content}</Pressable>
    </Link>
  ) : (
    content
  );
}
