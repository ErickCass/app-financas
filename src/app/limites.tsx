import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { addMonths, monthLabel, monthOf } from "@/domain/dates";
import { Card, Screen, SectionTitle } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { useTheme } from "@/ui/theme";

/** Categorias e limites: o usuário define quanto pode gastar por mês em cada categoria variável. */
export default function Limites() {
  const t = useTheme();
  const f = useFinance();
  const month = monthOf(f.today);
  const variable = f.categories.filter((c) => c.kind === "variable");
  const previous = addMonths(month, -1);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      variable.map((c) => [
        c.id,
        f.budgets.find((b) => b.categoryId === c.id && b.month === month)?.limit ??
          f.budgets.find((b) => b.categoryId === c.id && b.month === previous)?.limit ??
          0,
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const avg = (id: string) => f.history.find((h) => h.categoryId === id)?.monthlyAverage;
  const total = Object.values(values).reduce((a, b) => a + b, 0);

  async function save() {
    setSaving(true);
    try {
      for (const c of variable) {
        const current = f.budgets.find((b) => b.categoryId === c.id && b.month === month)?.limit;
        const next = values[c.id] ?? 0;
        if (current !== next) await f.setBudgetLimit(c.id, month, next);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function suggest() {
    setValues((v) =>
      Object.fromEntries(
        variable.map((c) => {
          const a = avg(c.id);
          // média dos últimos meses arredondada para cima de R$ 50
          return [c.id, a ? Math.ceil(a / 5_000) * 5_000 : (v[c.id] ?? 0)];
        }),
      ),
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Cancelar</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Limites</Text>
        <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17, fontWeight: "600", opacity: saving ? 0.5 : 1 }}>Salvar</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={{ fontSize: 15, color: t.ink2 }}>Limites de {monthLabel(month).toLowerCase()}</Text>
        <Text style={{ fontSize: 28, fontWeight: "600", color: t.ink }}>{formatBRL(total)}</Text>
        <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
          Para gastos variáveis. Contas fixas, como condomínio e escola, entram como lançamentos previstos.
        </Text>
      </Card>

      {f.history.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={suggest}
          style={{ height: 48, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: t.accent, fontSize: 15, fontWeight: "600" }}>Sugerir limites pelo meu histórico</Text>
        </Pressable>
      ) : null}

      <SectionTitle right={<Text style={{ fontSize: 13, color: t.ink2 }}>limite por mês</Text>}>Gastos variáveis</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {variable.map((c, i) => (
          <View
            key={c.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: i < variable.length - 1 ? 1 : 0,
              borderBottomColor: t.line,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: t.ink }}>{c.name}</Text>
              {avg(c.id) ? (
                <Text style={{ fontSize: 12, color: t.ink2 }}>média 3 meses {formatBRL(avg(c.id)!, { noCents: true })}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: t.bg, width: 130 }}>
              <Text style={{ fontSize: 15, color: t.ink2 }}>R$</Text>
              <MoneyInput
                cents={values[c.id] ?? 0}
                onChangeCents={(v) => setValues((s) => ({ ...s, [c.id]: v }))}
                accessibilityLabel={`Limite mensal de ${c.name}`}
                style={{ flex: 1, minWidth: 0, width: "100%", textAlign: "right", fontSize: 16, fontWeight: "600" }}
              />
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
