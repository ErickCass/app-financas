import { Text, View } from "react-native";
import { useBudgetView } from "@/data/selectors";
import { formatBRL } from "@/domain/money";
import { Card, Screen } from "@/ui/components";
import { SparkIcon } from "@/ui/icons";
import { STATUS_COLOR, useTheme } from "@/ui/theme";

/**
 * O chat com o especialista chega na fase 4. Por enquanto, a aba mostra
 * o resumo da semana calculado a partir dos dados reais do orçamento.
 */
export default function Assistente() {
  const t = useTheme();
  const view = useBudgetView();
  const risks = view.filter((v) => v.status === "estourou" || v.status === "vai");
  const room = view.filter((v) => v.status === "sobra").sort((a, b) => b.limit - b.projected - (a.limit - a.projected))[0];

  return (
    <Screen title="Assistente">
      <Text style={{ fontSize: 15, color: t.ink2, paddingHorizontal: 4, marginTop: -8 }}>
        Analisa suas contas, compromissos e metas
      </Text>
      <Card style={{ gap: 0, paddingBottom: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink, paddingBottom: 4 }}>Resumo da semana</Text>
        {risks.map((v) => (
          <Item key={v.category.id} color={STATUS_COLOR[v.status]} tag={v.status === "estourou" ? "Estourou" : "Risco"}>
            {v.status === "estourou"
              ? `${v.category.name} passou do limite em ${formatBRL(v.spent - v.limit)}.`
              : `${v.category.name} deve fechar em ${formatBRL(v.projected, { noCents: true })} para um limite de ${formatBRL(v.limit, { noCents: true })}. Dá para gastar ${formatBRL(v.dailyAllowance)} por dia e fechar no limite.`}
          </Item>
        ))}
        {room ? (
          <Item color={STATUS_COLOR.sobra} tag="Folga">
            {`${room.category.name} deve sobrar ${formatBRL(room.limit - room.projected, { noCents: true })}. Dá para remanejar parte para quem está estourando.`}
          </Item>
        ) : null}
      </Card>
      <Card style={{ alignItems: "center", gap: 10, paddingVertical: 28 }}>
        <SparkIcon color={t.accent} size={32} />
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Chat com o especialista</Text>
        <Text style={{ fontSize: 15, color: t.ink2, textAlign: "center", lineHeight: 21 }}>
          Em breve: pergunte sobre suas finanças, simule compras e receba análises com base nas suas transações.
        </Text>
      </Card>
    </Screen>
  );
}

function Item({ color, tag, children }: { color: string; tag: string; children: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, width: 86, height: 22 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: t.ink }}>{tag}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: t.ink }}>{children}</Text>
    </View>
  );
}
