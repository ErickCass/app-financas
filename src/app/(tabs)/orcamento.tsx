import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useFinance } from "@/data/store";
import { useBudgetView } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { dayOfMonth, daysInMonth, monthLabel, monthOf } from "@/domain/dates";
import { Card, ProgressBar, Screen, SectionTitle } from "@/ui/components";
import { ChevronRight } from "@/ui/icons";
import { STATUS_COLOR, STATUS_LABEL, useTheme } from "@/ui/theme";

export default function Orcamento() {
  const t = useTheme();
  const f = useFinance();
  const view = useBudgetView();
  const month = monthOf(f.today);
  const day = dayOfMonth(f.today);
  const total = daysInMonth(month);
  const remainingDays = Math.max(total - day, 1);

  const limited = view.filter((v) => v.status !== "semlimite");
  const limit = limited.reduce((a, v) => a + v.limit, 0);
  const spent = limited.reduce((a, v) => a + v.spent, 0);
  const projected = limited.reduce((a, v) => a + v.projected, 0);
  const unlimitedSpent = view.filter((v) => v.status === "semlimite").reduce((a, v) => a + v.spent, 0);
  const free = Math.max(limit - spent, 0);
  const totalStatus = spent > limit ? "estourou" : projected > limit ? "vai" : projected >= limit * 0.85 ? "ritmo" : "sobra";
  const attention = view.filter((v) => v.status === "estourou" || v.status === "vai");
  // Categorias sem limite só aparecem como linha se tiveram gasto; as demais viram um lembrete.
  const rows = view.filter((v) => v.status !== "semlimite" || v.spent > 0);
  const idle = view.filter((v) => v.status === "semlimite" && v.spent === 0);
  const willOverrun = view.filter((v) => v.status === "vai");

  return (
    <Screen
      title="Orçamento"
      right={<Text style={{ fontSize: 15, fontWeight: "600", color: t.ink, paddingBottom: 8 }}>{monthLabel(month)}</Text>}
    >
      <Card>
        <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink2 }}>Gastos variáveis no mês</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 40, fontWeight: "600", color: t.ink, letterSpacing: -1 }}>{formatBRL(spent)}</Text>
          <Text style={{ fontSize: 15, color: t.ink2 }}>de {formatBRL(limit)}</Text>
        </View>
        {unlimitedSpent > 0 ? (
          <Text style={{ fontSize: 13, color: t.ink2 }}>+ {formatBRL(unlimitedSpent)} em categorias sem limite</Text>
        ) : null}
        <ProgressBar height={12} fill={limit ? spent / limit : 0} color={STATUS_COLOR[totalStatus]} marker={day / total} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 14, color: t.ink }}>
            <Text style={{ fontWeight: "600" }}>{formatBRL(free)}</Text>
            <Text style={{ color: t.ink2 }}> disponíveis</Text>
          </Text>
          <Text style={{ fontSize: 14, color: t.ink2 }}>
            {formatBRL(Math.floor(free / remainingDays), { noCents: true })}/dia por {remainingDays} dias
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8, paddingTop: 6 }}>
          {(["sobra", "ritmo", "vai", "estourou"] as const).map((k) => (
            <View key={k} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[k] }} />
              <Text style={{ fontSize: 13, color: t.ink }}>{STATUS_LABEL[k]}</Text>
            </View>
          ))}
          <View style={{ width: "100%", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: t.ink, marginHorizontal: 7 }} />
            <Text style={{ fontSize: 13, color: t.ink2 }}>onde você costuma estar até hoje</Text>
          </View>
        </View>
      </Card>

      {limit === 0 ? (
        <Card style={{ alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Defina seus limites</Text>
          <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center", lineHeight: 20 }}>
            Diga quanto pode gastar por mês em cada categoria. O Finia acompanha o ritmo e avisa antes de estourar.
          </Text>
          <Link href="/limites" asChild>
            <Pressable accessibilityRole="link" style={{ height: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: t.accent, justifyContent: "center" }}>
              <Text style={{ color: t.onAccent, fontWeight: "600" }}>Definir limites</Text>
            </Pressable>
          </Link>
        </Card>
      ) : null}

      {attention.length ? (
        <Card style={{ gap: 0, borderWidth: 1.5, borderColor: "#F2DA8A", paddingBottom: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink, paddingBottom: 4 }}>
            {willOverrun.length
              ? `No ritmo atual, ${willOverrun.length} ${willOverrun.length === 1 ? "categoria vai" : "categorias vão"} estourar`
              : "Categorias acima do limite"}
          </Text>
          {attention.map((v, i) => (
            <Link key={v.category.id} href={`/categoria/${v.category.id}`} asChild>
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
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLOR[v.status] }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: "600", color: t.ink }}>{v.category.name}</Text>
                  <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: 13, color: t.ink2 }}>
                    {v.status === "estourou"
                      ? `${formatBRL(v.spent - v.limit)} acima do limite`
                      : `Previsto ${formatBRL(v.projected, { noCents: true })} para ${formatBRL(v.limit, { noCents: true })}`}
                  </Text>
                </View>
                {v.status === "vai" ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: t.accent }}>
                      {formatBRL(v.dailyAllowance, { noCents: true })}/dia
                    </Text>
                    <Text style={{ fontSize: 12, color: t.ink2 }}>para fechar no limite</Text>
                  </View>
                ) : null}
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : null}

      <SectionTitle
        right={
          <Link href="/limites" style={{ fontSize: 15, fontWeight: "600", color: t.accent }}>
            Editar limites
          </Link>
        }
      >
        Por categoria
      </SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {rows.map((v, i) => (
          <Link key={v.category.id} href={`/categoria/${v.category.id}`} asChild>
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: "600", color: t.ink }}>{v.category.name}</Text>
                  <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: 13, color: t.ink2 }}>
                    {formatBRL(v.spent, { noCents: true })} <Text style={{ color: t.ink3 }}>/</Text>{" "}
                    {v.status === "semlimite" ? "sem limite" : formatBRL(v.limit, { noCents: true })}
                  </Text>
                </View>
                {v.status === "semlimite" ? (
                  <ProgressBar fill={0} />
                ) : (
                  <ProgressBar fill={v.spent / v.limit} color={STATUS_COLOR[v.status]} marker={v.expectedShareToday} />
                )}
              </View>
              <Text
                style={{
                  width: 44,
                  textAlign: "right",
                  fontSize: 15,
                  fontWeight: "600",
                  color: v.status === "estourou" ? "#B42318" : t.ink,
                }}
              >
                {v.limit ? `${Math.round((v.spent / v.limit) * 100)}%` : "–"}
              </Text>
              <ChevronRight color={t.ink3} />
            </Pressable>
          </Link>
        ))}
        {idle.length > 0 ? (
          <Link href="/limites" asChild>
            <Pressable
              accessibilityRole="link"
              style={{ paddingVertical: 12, borderTopWidth: rows.length ? 1 : 0, borderTopColor: t.line, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text style={{ flex: 1, fontSize: 14, color: t.ink2, lineHeight: 20 }}>
                Sem limite e sem gasto: {idle.map((v) => v.category.name).join(", ")}.{" "}
                <Text style={{ color: t.accent, fontWeight: "600" }}>Definir limites</Text>
              </Text>
            </Pressable>
          </Link>
        ) : null}
      </Card>
    </Screen>
  );
}
