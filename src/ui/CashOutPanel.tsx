/**
 * Lente "Sai da conta" do Orçamento: quanto ainda sai da conta corrente até o fim
 * do mês, por categoria, com o % do orçamento já consumido. Visão de caixa (ver
 * domain/cashOut.ts): a fatura que vence este mês sai agora; as compras deste mês
 * no cartão, não. Com `accountId`, só o que sai por aquela conta ou cartão.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFinance } from "@/data/store";
import { useBudgetView, useCashOut } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { lastDayOfMonth, shortDate } from "@/domain/dates";
import type { CashOutItem, CashOutRow } from "@/domain/cashOut";
import { Card, ProgressBar } from "./components";
import { STATUS_COLOR, useTheme } from "./theme";

type Sort = "mais" | "menos";

const itemLabel = (i: CashOutItem) =>
  i.kind === "fatura"
    ? `${i.label} · vence ${shortDate(i.dueDate!)}`
    : i.kind === "fixa"
      ? "Conta fixa ainda não paga (valor previsto)"
      : `${i.label}${i.dueDate ? ` · ${shortDate(i.dueDate)}` : ""}`;

export function CashOutPanel({
  accountId,
  accountName,
}: {
  accountId?: string;
  accountName?: string;
}) {
  const t = useTheme();
  const f = useFinance();
  const c = useCashOut(accountId);
  // Mesmas cores e marcador de ritmo da lente "Gasto do mês" (utilizado contra o orçamento do mês).
  const budgetView = useBudgetView("all", accountId);
  const views = new Map(budgetView.map((v) => [v.category.id, v]));
  const [sort, setSort] = useState<Sort>("mais");
  const [open, setOpen] = useState<string | null>(null);
  const end = shortDate(lastDayOfMonth(c.month));

  const name = (r: CashOutRow) =>
    f.categories.find((x) => x.id === r.categoryId)?.name ?? "Sem categoria";
  // "Menos a sair": do menor ao maior entre o que ainda sai; o que não sai nada vai para o fim.
  const rows = [...c.rows].sort((a, b) => {
    if (sort === "mais") return b.toLeave - a.toLeave || b.used - a.used;
    if (!a.toLeave !== !b.toLeave) return a.toLeave ? -1 : 1;
    return a.toLeave - b.toLeave || name(a).localeCompare(name(b), "pt-BR");
  });

  /**
   * Linha do resumo. `kind` decide o sinal mostrado: o saldo de hoje e o previsto
   * aparecem com o sinal real (conta no limite fica "−R$" em vermelho); entradas e
   * saídas aparecem como "+" e "−" sobre o valor absoluto.
   */
  const line = (
    label: string,
    value: number,
    kind: "saldo" | "entra" | "sai" | "previsto",
  ) => {
    const strong = kind === "previsto";
    const negative = (kind === "saldo" || kind === "previsto") && value < 0;
    const text =
      kind === "entra"
        ? `+ ${formatBRL(value)}`
        : kind === "sai"
          ? `− ${formatBRL(value)}`
          : formatBRL(value);
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          paddingVertical: 3,
        }}
      >
        <Text
          style={{
            flexShrink: 1,
            fontSize: strong ? 16 : 15,
            color: strong ? t.ink : t.ink2,
            fontWeight: strong ? "600" : "400",
          }}
        >
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
    <>
      <Text
        style={{
          fontSize: 13,
          color: t.ink2,
          paddingHorizontal: 4,
          lineHeight: 18,
        }}
      >
        {accountName
          ? `O que ainda sai por ${accountName} até ${end}.`
          : `O que ainda sai da conta corrente até ${end}. A fatura que vence este mês entra aqui, dividida pelas categorias das compras; as compras deste mês no cartão ficam para a fatura do mês que vem.`}
      </Text>

      {accountId ? (
        <Card style={{ gap: 2 }}>
          {line(
            `Sai por ${accountName ?? "esta conta"} até ${end}`,
            c.toLeave,
            "sai",
          )}
        </Card>
      ) : (
        <Card style={{ gap: 2 }}>
          {line("Saldo hoje", c.balanceToday, "saldo")}
          {c.incomePending > 0
            ? line("A receber", c.incomePending, "entra")
            : null}
          {line("Sai da conta", c.toLeave, "sai")}
          <View
            style={{ height: 1, backgroundColor: t.line, marginVertical: 6 }}
          />
          {line(`Saldo previsto em ${end}`, c.projectedBalance, "previsto")}
          <Text
            style={{
              fontSize: 12,
              color: t.ink3,
              paddingTop: 6,
              lineHeight: 16,
            }}
          >
            Não inclui gastos variáveis que você ainda vai fazer no débito ou no
            PIX.
          </Text>
        </Card>
      )}

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          backgroundColor: t.track,
          borderRadius: 9,
          padding: 2,
        }}
      >
        {(
          [
            ["mais", "Mais a sair"],
            ["menos", "Menos a sair"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: sort === k }}
            onPress={() => setSort(k)}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 7,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: sort === k ? t.card : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: sort === k ? "600" : "500",
                color: t.ink,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ gap: 0, paddingTop: 4, paddingBottom: 4 }}>
        {rows.map((r, i) => {
          const key = r.categoryId ?? "sem";
          const isOpen = open === key;
          const v = r.categoryId ? views.get(r.categoryId) : undefined;
          const hasBudget = r.budget > 0;
          return (
            <View
              key={key}
              style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${name(r)}: utilizado ${formatBRL(r.used)}${hasBudget ? ` de ${formatBRL(r.budget)}` : ""}. Ainda sai ${formatBRL(r.toLeave)}.`}
                disabled={r.items.length === 0}
                onPress={() => setOpen(isOpen ? null : key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                }}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 16, fontWeight: "600", color: t.ink }}
                  >
                    {name(r)}
                  </Text>
                  {hasBudget && v ? (
                    <ProgressBar
                      fill={r.used / r.budget}
                      color={STATUS_COLOR[v.status]}
                      marker={
                        f.categories.find((c) => c.id === r.categoryId)
                          ?.kind === "variable"
                          ? v.expectedShareToday
                          : undefined
                      }
                    />
                  ) : (
                    <ProgressBar fill={0} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, color: t.ink2 }}
                  >
                    {hasBudget ? (
                      <Text
                        style={{
                          fontWeight: "700",
                          color: r.used > r.budget ? t.neg : t.ink,
                        }}
                      >
                        {Math.round((r.used / r.budget) * 100)}%{" "}
                      </Text>
                    ) : null}
                    {formatBRL(r.used, { noCents: true })}
                    {hasBudget ? (
                      <Text style={{ color: t.ink3 }}>
                        {" "}
                        de {formatBRL(r.budget, { noCents: true })}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <View style={{ minWidth: 84, alignItems: "flex-end" }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: r.toLeave ? t.ink : t.ink3,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {r.toLeave ? formatBRL(r.toLeave, { noCents: true }) : "—"}
                  </Text>
                  {r.toLeave ? (
                    <Text style={{ fontSize: 11, color: t.ink3 }}>a sair</Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    width: 12,
                    fontSize: 13,
                    color: r.items.length ? t.ink3 : "transparent",
                  }}
                >
                  {isOpen ? "▴" : "▾"}
                </Text>
              </Pressable>
              {isOpen ? (
                <View style={{ paddingBottom: 12, gap: 6 }}>
                  {r.items.map((it, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 13, color: t.ink2 }}>
                        {itemLabel(it)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: t.ink,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {formatBRL(it.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {c.billsOther > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: t.line,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: t.ink }}>
                Outros na fatura
              </Text>
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                Saldo anterior, juros ou encargos
              </Text>
            </View>
            <Text
              style={{
                minWidth: 84,
                textAlign: "right",
                fontSize: 16,
                fontWeight: "700",
                color: t.ink,
              }}
            >
              {formatBRL(c.billsOther, { noCents: true })}
            </Text>
            <View style={{ width: 12 }} />
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 12,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{ flex: 1, fontSize: 16, fontWeight: "600", color: t.ink }}
          >
            Total a sair
          </Text>
          <Text
            style={{
              minWidth: 84,
              textAlign: "right",
              fontSize: 17,
              fontWeight: "700",
              color: t.ink,
            }}
          >
            {formatBRL(c.toLeave, { noCents: true })}
          </Text>
          <View style={{ width: 12 }} />
        </View>
      </Card>
    </>
  );
}
