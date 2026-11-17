/**
 * Contas fixas do mês, legíveis de relance: a pagar em cima (com o que falta e o
 * vencimento), pagas embaixo e discretas. O status vem de domain/reconcile.fixedStatus.
 */
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useFinance } from "@/data/store";
import type { CategoryBudgetView } from "@/domain/budget";
import { formatBRL } from "@/domain/money";
import { monthOf, shortDate } from "@/domain/dates";
import { fixedStatus, type FixedStatus } from "@/domain/reconcile";
import { Card, ProgressBar, SectionTitle } from "./components";
import { ChevronRight } from "./icons";
import { STATUS_COLOR, useTheme } from "./theme";

interface Item {
  v: CategoryBudgetView;
  status: FixedStatus;
  missing: number;
  due?: string;
}

export function FixedBills({ fixed }: { fixed: CategoryBudgetView[] }) {
  const t = useTheme();
  const f = useFinance();
  const month = monthOf(f.today);
  // Vencimento: a conta a pagar cadastrada para esta categoria no mês, se houver.
  const dueOf = (categoryId: string) =>
    f.planned
      .filter(
        (p) =>
          p.categoryId === categoryId &&
          p.status !== "paid" &&
          p.amount < 0 &&
          monthOf(p.dueDate) === month,
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate;

  const items: Item[] = fixed
    .filter((v) => v.limit > 0 || v.spent > 0)
    .map((v) => ({
      v,
      status: fixedStatus(v.limit, v.spent),
      missing: Math.max(v.limit - v.spent, 0),
      due: dueOf(v.category.id),
    }));
  const pending = items
    .filter((i) => i.status === "a_pagar" || i.status === "parcial")
    .sort(
      (a, b) =>
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
        b.missing - a.missing,
    );
  const paid = items
    .filter((i) => i.status === "paga" || i.status === "acima")
    .sort((a, b) => b.v.spent - a.v.spent);

  const paidTotal = items.reduce((a, i) => a + i.v.spent, 0);
  const missingTotal = pending.reduce((a, i) => a + i.missing, 0);
  const share =
    paidTotal + missingTotal > 0 ? paidTotal / (paidTotal + missingTotal) : 0;

  return (
    <>
      <SectionTitle>Contas fixas</SectionTitle>
      <Card style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Text style={{ fontSize: 15, color: t.ink }}>
            <Text style={{ fontWeight: "700" }}>{paid.length}</Text>
            <Text style={{ color: t.ink2 }}> de {items.length} pagas</Text>
          </Text>
          <Text style={{ fontSize: 15, color: t.ink2 }}>
            Falta{" "}
            <Text style={{ fontWeight: "700", color: t.ink }}>
              {formatBRL(missingTotal, { noCents: true })}
            </Text>
          </Text>
        </View>
        <ProgressBar fill={share} color={STATUS_COLOR.sobra} />
      </Card>

      {pending.length > 0 ? (
        <Group title="A pagar" items={pending} />
      ) : (
        <Text style={{ fontSize: 15, color: t.ink2, paddingHorizontal: 4 }}>
          Todas as contas fixas do mês estão pagas.
        </Text>
      )}
      {paid.length > 0 ? <Group title="Pagas" items={paid} muted /> : null}
    </>
  );
}

function Group({
  title,
  items,
  muted,
}: {
  title: string;
  items: Item[];
  muted?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: t.ink2,
          paddingHorizontal: 4,
          letterSpacing: 0.3,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <Card style={{ gap: 0, paddingVertical: 2 }}>
        {items.map((it, i) => (
          <Row
            key={it.v.category.id}
            it={it}
            last={i === items.length - 1}
            muted={muted}
          />
        ))}
      </Card>
    </View>
  );
}

function Row({
  it,
  last,
  muted,
}: {
  it: Item;
  last: boolean;
  muted?: boolean;
}) {
  const t = useTheme();
  const { v, status, missing, due } = it;
  const brl = (c: number) => formatBRL(c, { noCents: true });

  const detail =
    status === "a_pagar"
      ? due
        ? `Vence ${shortDate(due)}`
        : "Ainda não paga"
      : status === "parcial"
        ? `Pago ${brl(v.spent)} de ${brl(v.limit)}`
        : status === "acima"
          ? `${brl(v.spent - v.limit)} acima do previsto`
          : "Paga";
  const value =
    status === "a_pagar" ? v.limit : status === "parcial" ? missing : v.spent;
  const valueLabel =
    status === "parcial"
      ? "falta"
      : status === "a_pagar"
        ? "previsto"
        : undefined;

  return (
    <Link href={`/categoria/${v.category.id}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${v.category.name}: ${detail}. Ver transações`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: t.line,
        }}
      >
        <StatusIcon status={status} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 16,
              fontWeight: muted ? "500" : "600",
              color: muted ? t.ink2 : t.ink,
            }}
          >
            {v.category.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, color: status === "acima" ? t.neg : t.ink2 }}
          >
            {detail}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: muted ? "500" : "700",
              color: muted ? t.ink2 : t.ink,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatBRL(value, { noCents: true })}
          </Text>
          {valueLabel ? (
            <Text style={{ fontSize: 11, color: t.ink3 }}>{valueLabel}</Text>
          ) : null}
        </View>
        <ChevronRight color={t.ink3} />
      </Pressable>
    </Link>
  );
}

/** ○ a pagar · ◐ paga em parte · ✓ paga · ✓ vermelho acima do previsto */
function StatusIcon({ status }: { status: FixedStatus }) {
  const t = useTheme();
  const size = 22;
  if (status === "a_pagar") {
    return (
      <View
        accessibilityLabel="A pagar"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: t.ink3,
        }}
      />
    );
  }
  if (status === "parcial") {
    return (
      <View
        accessibilityLabel="Paga em parte"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: STATUS_COLOR.vai,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
        <View style={{ flex: 1, backgroundColor: STATUS_COLOR.vai }} />
        <View style={{ flex: 1 }} />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={
        status === "acima" ? "Paga acima do previsto" : "Paga"
      }
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: status === "acima" ? t.neg : STATUS_COLOR.sobra,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: "800",
          lineHeight: 15,
        }}
      >
        ✓
      </Text>
    </View>
  );
}
