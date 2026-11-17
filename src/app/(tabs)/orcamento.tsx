import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { useBudgetView } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { dayOfMonth, daysInMonth, monthLabel, monthOf } from "@/domain/dates";
import { Card, ProgressBar, Screen, SectionTitle } from "@/ui/components";
import { ChevronRight } from "@/ui/icons";
import { AccountChips } from "@/ui/AccountChips";
import { CashOutPanel } from "@/ui/CashOutPanel";
import { FixedBills } from "@/ui/FixedBills";
import { STATUS_COLOR, STATUS_LABEL, useTheme } from "@/ui/theme";

export default function Orcamento() {
  const t = useTheme();
  const f = useFinance();
  // Lente: "gasto" = quanto gastei no mês (competência); "caixa" = o que ainda sai da conta até o fim do mês.
  const params = useLocalSearchParams<{ lente?: string }>();
  const [lens, setLens] = useState<"gasto" | "caixa">(
    params.lente === "caixa" ? "caixa" : "gasto",
  );
  // A aba fica montada: quando o card da Início pede a lente de caixa, troca para ela.
  useEffect(() => {
    if (params.lente === "caixa" || params.lente === "gasto") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLens(params.lente);
    }
  }, [params.lente]);
  // Filtro por conta ou cartão: só aparecem as que tiveram lançamento no mês.
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const view = useBudgetView("variable", accountId);
  const fixed = useBudgetView("fixed", accountId);
  const [sort, setSort] = useState<"risco" | "gasto" | "limite">("risco");
  // "Por risco" é a ordem padrão da view (estourou → vai → ritmo → sobra); as outras ordenam por valor.
  const sorted = <T extends { spent: number; limit: number }>(
    list: T[],
  ): T[] =>
    sort === "risco"
      ? list
      : [...list].sort((a, b) =>
          sort === "gasto" ? b.spent - a.spent : b.limit - a.limit,
        );
  const month = monthOf(f.today);
  const usedAccounts = f.accounts.filter((a) =>
    f.transactions.some(
      (tx) => tx.accountId === a.id && monthOf(tx.date) === month,
    ),
  );
  const accountName = f.accounts.find((a) => a.id === accountId)?.name;
  const day = dayOfMonth(f.today);
  const total = daysInMonth(month);
  const remainingDays = Math.max(total - day, 1);

  const limited = view.filter((v) => v.status !== "semlimite");
  const limit = limited.reduce((a, v) => a + v.limit, 0);
  const spent = limited.reduce((a, v) => a + v.spent, 0);
  const projected = limited.reduce((a, v) => a + v.projected, 0);
  const unlimitedSpent = view
    .filter((v) => v.status === "semlimite")
    .reduce((a, v) => a + v.spent, 0);
  const free = Math.max(limit - spent, 0);
  const totalStatus =
    spent > limit
      ? "estourou"
      : projected > limit
        ? "vai"
        : projected >= limit * 0.85
          ? "ritmo"
          : "sobra";
  const attention = view.filter(
    (v) => v.status === "estourou" || v.status === "vai",
  );
  // Categorias sem limite só aparecem como linha se tiveram gasto; as demais viram um lembrete.
  const rows = view.filter((v) => v.status !== "semlimite" || v.spent > 0);
  const idle = view.filter((v) => v.status === "semlimite" && v.spent === 0);
  const willOverrun = view.filter((v) => v.status === "vai");

  return (
    <Screen
      title="Orçamento"
      right={
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: t.ink,
            paddingBottom: 8,
          }}
        >
          {monthLabel(month)}
        </Text>
      }
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          padding: 2,
          borderRadius: 10,
          backgroundColor: t.track,
          gap: 2,
        }}
      >
        {(
          [
            ["gasto", "Gasto do mês"],
            ["caixa", "Sai da conta"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: lens === k }}
            onPress={() => setLens(k)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: lens === k ? t.card : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: lens === k ? "600" : "500",
                color: t.ink,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <AccountChips
        accounts={usedAccounts}
        value={accountId}
        onChange={setAccountId}
      />

      {lens === "caixa" ? (
        <CashOutPanel accountId={accountId} accountName={accountName} />
      ) : (
        <>
          {accountName ? (
            <Text
              style={{
                fontSize: 13,
                color: t.ink2,
                paddingHorizontal: 4,
                lineHeight: 18,
              }}
            >
              Só o gasto feito em {accountName}, contra o orçamento total de
              cada categoria.
            </Text>
          ) : null}
          <Card>
            <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink2 }}>
              Gastos variáveis no mês
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Text
                style={{
                  fontSize: 40,
                  fontWeight: "600",
                  color: t.ink,
                  letterSpacing: -1,
                }}
              >
                {formatBRL(spent)}
              </Text>
              <Text style={{ fontSize: 15, color: t.ink2 }}>
                de {formatBRL(limit)}
              </Text>
            </View>
            {unlimitedSpent > 0 ? (
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                + {formatBRL(unlimitedSpent)} em categorias sem limite
              </Text>
            ) : null}
            <ProgressBar
              height={12}
              fill={limit ? spent / limit : 0}
              color={STATUS_COLOR[totalStatus]}
              marker={day / total}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={{ fontSize: 14, color: t.ink }}>
                <Text style={{ fontWeight: "600" }}>{formatBRL(free)}</Text>
                <Text style={{ color: t.ink2 }}> disponíveis</Text>
              </Text>
              <Text style={{ fontSize: 14, color: t.ink2 }}>
                {formatBRL(Math.floor(free / remainingDays), { noCents: true })}
                /dia por {remainingDays} dias
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                rowGap: 8,
                paddingTop: 6,
              }}
            >
              {(["sobra", "ritmo", "vai", "estourou"] as const).map((k) => (
                <View
                  key={k}
                  style={{
                    width: "50%",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: STATUS_COLOR[k],
                    }}
                  />
                  <Text style={{ fontSize: 13, color: t.ink }}>
                    {STATUS_LABEL[k]}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 3,
                    height: 14,
                    borderRadius: 2,
                    backgroundColor: t.ink,
                    marginHorizontal: 7,
                  }}
                />
                <Text style={{ fontSize: 13, color: t.ink2 }}>
                  onde você costuma estar até hoje
                </Text>
              </View>
            </View>
          </Card>

          {limit === 0 ? (
            <Card style={{ alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>
                Defina seus limites
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: t.ink2,
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                Diga quanto pode gastar por mês em cada categoria. O Finia
                acompanha o ritmo e avisa antes de estourar.
              </Text>
              <Link href="/limites" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={{
                    height: 44,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    backgroundColor: t.accent,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: t.onAccent, fontWeight: "600" }}>
                    Definir limites
                  </Text>
                </Pressable>
              </Link>
            </Card>
          ) : null}

          {attention.length ? (
            <Card
              style={{
                gap: 0,
                borderWidth: 1.5,
                borderColor: "#F2DA8A",
                paddingBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: t.ink,
                  paddingBottom: 4,
                }}
              >
                {attentionTitle(
                  attention.length - willOverrun.length,
                  willOverrun.length,
                )}
              </Text>
              {attention.map((v, i) => (
                <Link
                  key={v.category.id}
                  href={`/categoria/${v.category.id}`}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: i < attention.length - 1 ? 1 : 0,
                      borderBottomColor: t.line,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: STATUS_COLOR[v.status],
                      }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          flexShrink: 1,
                          fontSize: 16,
                          fontWeight: "600",
                          color: t.ink,
                        }}
                      >
                        {v.category.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ flexShrink: 0, fontSize: 13, color: t.ink2 }}
                      >
                        {v.status === "estourou"
                          ? `${formatBRL(v.spent - v.limit)} acima do limite`
                          : `Previsto ${formatBRL(v.projected, { noCents: true })} para ${formatBRL(v.limit, { noCents: true })}`}
                      </Text>
                    </View>
                    {v.status === "vai" ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: t.accent,
                          }}
                        >
                          {formatBRL(v.dailyAllowance, { noCents: true })}/dia
                        </Text>
                        <Text style={{ fontSize: 12, color: t.ink2 }}>
                          para fechar no limite
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                </Link>
              ))}
            </Card>
          ) : null}

          <Link href="/plano" asChild>
            <Pressable
              accessibilityRole="link"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 14,
                backgroundColor: t.accentSoft,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: t.accent }}
                >
                  Plano do mês
                </Text>
                <Text style={{ fontSize: 13, color: t.ink2 }}>
                  Renda, contas fixas e limites: quanto sobra se tudo sair como
                  planejado
                </Text>
              </View>
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: t.accent }}
              >
                Abrir ›
              </Text>
            </Pressable>
          </Link>

          <SectionTitle
            right={
              <Link
                href="/limites"
                style={{ fontSize: 15, fontWeight: "600", color: t.accent }}
              >
                Editar categorias
              </Link>
            }
          >
            Por categoria
          </SectionTitle>
          <View
            style={{
              flexDirection: "row",
              padding: 2,
              borderRadius: 10,
              backgroundColor: t.track,
              gap: 2,
            }}
          >
            {(
              [
                ["risco", "Por risco"],
                ["gasto", "Maior gasto"],
                ["limite", "Maior limite"],
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
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: sort === k ? t.card : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: sort === k ? "600" : "500",
                    color: t.ink,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {sorted(rows).map((v, i) => (
              <Link
                key={v.category.id}
                href={`/categoria/${v.category.id}`}
                asChild
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${v.category.name}: ${STATUS_LABEL[v.status]}. ${formatBRL(v.spent)} de ${formatBRL(v.limit)}. Ver transações`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                    borderBottomColor: t.line,
                  }}
                >
                  <View style={{ flex: 1, gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          flexShrink: 1,
                          fontSize: 16,
                          fontWeight: "600",
                          color: t.ink,
                        }}
                      >
                        {v.category.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ flexShrink: 0, fontSize: 13, color: t.ink2 }}
                      >
                        {formatBRL(v.spent, { noCents: true })}{" "}
                        <Text style={{ color: t.ink3 }}>/</Text>{" "}
                        {v.status === "semlimite"
                          ? "sem limite"
                          : formatBRL(v.limit, { noCents: true })}
                      </Text>
                    </View>
                    {v.status === "semlimite" ? (
                      <ProgressBar fill={0} />
                    ) : (
                      <ProgressBar
                        fill={v.spent / v.limit}
                        color={STATUS_COLOR[v.status]}
                        marker={v.expectedShareToday}
                      />
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      minWidth: 52,
                      textAlign: "right",
                      fontSize: 15,
                      fontWeight: "600",
                      color: v.status === "estourou" ? "#B42318" : t.ink,
                    }}
                  >
                    {v.limit
                      ? `${Math.round((v.spent / v.limit) * 100)}%`
                      : "–"}
                  </Text>
                  <ChevronRight color={t.ink3} />
                </Pressable>
              </Link>
            ))}
            {idle.length > 0 ? (
              <Link href="/limites" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: rows.length ? 1 : 0,
                    borderTopColor: t.line,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: t.ink2,
                      lineHeight: 20,
                    }}
                  >
                    Sem limite e sem gasto:{" "}
                    {idle.map((v) => v.category.name).join(", ")}.{" "}
                    <Text style={{ color: t.accent, fontWeight: "600" }}>
                      Definir limites
                    </Text>
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </Card>

          {fixed.length > 0 ? (
            <>
              <FixedBills fixed={fixed} />
              <Text
                style={{
                  fontSize: 13,
                  color: t.ink2,
                  lineHeight: 18,
                  paddingHorizontal: 4,
                }}
              >
                Conta paga a até 10% do previsto conta como paga certinho.
                Contas fixas não entram no ritmo dos gastos variáveis.
              </Text>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** "1 categoria estourou e 2 vão estourar" */
function attentionTitle(over: number, will: number): string {
  const n = (k: number) => `${k} ${k === 1 ? "categoria" : "categorias"}`;
  const overText = over
    ? `${n(over)} ${over === 1 ? "estourou" : "estouraram"}`
    : "";
  const willText = will
    ? `${will === 1 ? "vai" : "vão"} estourar no ritmo atual`
    : "";
  if (over && will) return `${overText} e ${will} ${willText}`;
  if (over) return overText;
  return `${n(will)} ${willText}`;
}
