import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useFinance } from "@/data/store";
import { addMonths, monthOf } from "@/domain/dates";
import { isCardPayment } from "@/domain/cardPayment";
import { Card, Screen } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { useTheme } from "@/ui/theme";

/** Lançamento manual de uma despesa ou receita já realizada. */
export default function NovoLancamento() {
  const t = useTheme();
  const f = useFinance();
  const [kind, setKind] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(f.today);
  const [accountId, setAccountId] = useState(f.accounts[0]?.id ?? "");
  const options = f.categories.filter((c) => (kind === "in" ? c.kind === "income" : c.kind !== "income"));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
  const canSave = amount > 0 && description.trim().length > 0 && validDate && accountId && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const account = f.accounts.find((a) => a.id === accountId);
      const statementMonth =
        account?.kind === "credit_card" && account.closingDay
          ? Number(date.slice(8, 10)) > account.closingDay
            ? addMonths(monthOf(date), 1)
            : monthOf(date)
          : undefined;
      await f.addTransaction({
        accountId,
        date,
        description: description.trim(),
        amount: kind === "out" ? -amount : amount,
        categoryId,
        source: "manual",
        statementMonth,
        isCardPayment: isCardPayment(description) || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const field = { height: 46, borderRadius: 12, paddingHorizontal: 14, backgroundColor: t.bg, color: t.ink, fontSize: 16 } as const;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Cancelar</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Novo lançamento</Text>
        <Pressable accessibilityRole="button" disabled={!canSave} onPress={save} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17, fontWeight: "600", opacity: canSave ? 1 : 0.4 }}>Salvar</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: t.track, gap: 2 }}>
        {(
          [
            ["out", "Despesa"],
            ["in", "Receita"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === k }}
            onPress={() => {
              setKind(k);
              setCategoryId(null);
            }}
            style={{ flex: 1, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: kind === k ? t.card : "transparent" }}
          >
            <Text style={{ fontSize: 14, fontWeight: kind === k ? "600" : "500", color: t.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Valor</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={{ fontSize: 28, color: t.ink2 }}>R$</Text>
          <MoneyInput
            cents={amount}
            onChangeCents={setAmount}
            autoFocus
            accessibilityLabel="Valor em reais"
            style={{ fontSize: 40, fontWeight: "600", minWidth: 160, textAlign: "center", color: kind === "in" ? t.pos : t.ink }}
          />
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descrição (ex.: Padaria, Salário)"
          placeholderTextColor={t.ink3}
          accessibilityLabel="Descrição"
          style={field}
        />
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={t.ink3}
          accessibilityLabel="Data no formato ano-mês-dia"
          style={[field, !validDate && { borderWidth: 1, borderColor: t.neg }]}
        />
        <Text style={{ fontSize: 13, color: t.ink2 }}>Conta</Text>
        <Chips items={f.accounts.map((a) => ({ id: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
        <Text style={{ fontSize: 13, color: t.ink2 }}>Categoria</Text>
        <Chips items={options.map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
      </Card>

      {error ? <Text style={{ color: t.neg, textAlign: "center" }}>{error}</Text> : null}
    </Screen>
  );
}

function Chips({ items, value, onChange }: { items: { id: string; label: string }[]; value: string | null; onChange: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.id)}
            style={{
              height: 36,
              paddingHorizontal: 12,
              borderRadius: 18,
              justifyContent: "center",
              backgroundColor: on ? t.accent : "transparent",
              borderWidth: 1,
              borderColor: on ? t.accent : t.line,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: on ? t.onAccent : t.ink }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
