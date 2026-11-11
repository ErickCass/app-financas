import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { shortDate } from "@/domain/dates";
import { Card, Screen } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { useTheme } from "@/ui/theme";

const toBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function fromBR(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * Renda a receber ou conta a pagar. Sem `id`: cria (avulsa ou mensal).
 * Com `id`: marca como recebida/paga ou exclui.
 */
export default function Previsto() {
  const { id, tipo } = useLocalSearchParams<{ id?: string; tipo?: string }>();
  return id ? <Manage id={id} /> : <Create initialKind={tipo === "pagar" ? "out" : "in"} />;
}

function Header({ title, onSave, canSave }: { title: string; onSave?: () => void; canSave?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center", minWidth: 70 }}>
        <Text style={{ color: t.accent, fontSize: 17 }}>{onSave ? "Cancelar" : "Fechar"}</Text>
      </Pressable>
      <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>{title}</Text>
      {onSave ? (
        <Pressable accessibilityRole="button" disabled={!canSave} onPress={onSave} style={{ height: 44, justifyContent: "center", minWidth: 70, alignItems: "flex-end" }}>
          <Text style={{ color: t.accent, fontSize: 17, fontWeight: "600", opacity: canSave ? 1 : 0.4 }}>Salvar</Text>
        </Pressable>
      ) : (
        <View style={{ minWidth: 70 }} />
      )}
    </View>
  );
}

function Create({ initialKind }: { initialKind: "in" | "out" }) {
  const t = useTheme();
  const f = useFinance();
  const [kind, setKind] = useState<"in" | "out">(initialKind);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toBR(f.today));
  const [monthly, setMonthly] = useState(true);
  const [estimated, setEstimated] = useState(false);
  const checking = f.accounts.filter((a) => a.kind !== "credit_card");
  const [accountId, setAccountId] = useState<string | null>(checking[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iso = fromBR(date);
  const options = f.categories
    .filter((c) => (kind === "in" ? c.kind === "income" : c.kind !== "income"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const category = categoryId ?? (kind === "in" && options.length === 1 ? options[0]!.id : null);
  const canSave = amount > 0 && description.trim() !== "" && iso !== null && accountId !== null && !busy;

  async function save() {
    if (!canSave || !iso || !accountId) return;
    setBusy(true);
    setError(null);
    try {
      await f.addPlanned({
        accountId,
        categoryId: category,
        description: description.trim(),
        amount: kind === "in" ? amount : -amount,
        dueDate: iso,
        estimated,
        monthly,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const field = { height: 44, borderRadius: 10, paddingHorizontal: 12, backgroundColor: t.bg, color: t.ink, fontSize: 16 } as const;

  return (
    <Screen>
      <Header title={kind === "in" ? "Renda a receber" : "Conta a pagar"} onSave={save} canSave={canSave} />

      <View style={{ flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: t.track, gap: 2 }}>
        {(
          [
            ["in", "A receber"],
            ["out", "A pagar"],
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
          placeholder={kind === "in" ? "Descrição (ex.: Salário dia 15)" : "Descrição (ex.: Condomínio, Escola)"}
          placeholderTextColor={t.ink3}
          accessibilityLabel="Descrição"
          style={field}
        />
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>{kind === "in" ? "Próximo recebimento" : "Próximo vencimento"}</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={t.ink3}
            accessibilityLabel="Data no formato dia, mês, ano"
            style={[field, iso === null && { borderWidth: 1, borderColor: t.neg }]}
          />
        </View>
        <Toggle label="Repete todo mês" hint={iso ? `Todo dia ${Number(iso.slice(8, 10))}` : undefined} on={monthly} onChange={setMonthly} />
        <Toggle label="Valor aproximado" hint="Ex.: conta de energia" on={estimated} onChange={setEstimated} />
        {checking.length > 1 ? (
          <>
            <Text style={{ fontSize: 13, color: t.ink2 }}>Conta</Text>
            <Chips items={checking.map((a) => ({ id: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
          </>
        ) : null}
        {options.length > 1 ? (
          <>
            <Text style={{ fontSize: 13, color: t.ink2 }}>Categoria</Text>
            <Chips items={options.map((c) => ({ id: c.id, label: c.name }))} value={category} onChange={setCategoryId} />
          </>
        ) : null}
      </Card>

      {checking.length === 0 ? <Text style={{ color: t.neg, textAlign: "center" }}>Crie uma conta corrente antes.</Text> : null}
      {error ? <Text style={{ color: t.neg, textAlign: "center" }}>{error}</Text> : null}
      <Text style={{ fontSize: 13, color: t.ink2, textAlign: "center", lineHeight: 18 }}>
        Entra no saldo projetado do mês e, se for mensal, no do fim do ano.
      </Text>
    </Screen>
  );
}

function Manage({ id }: { id: string }) {
  const t = useTheme();
  const f = useFinance();
  const p = f.planned.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!p) {
    return (
      <Screen>
        <Header title="Previsto" />
        <Text style={{ color: t.ink2, textAlign: "center", padding: 24 }}>Este lançamento previsto não existe mais.</Text>
      </Screen>
    );
  }
  const income = p.amount > 0;
  const paid = p.status === "paid";
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      router.back();
    } finally {
      setBusy(false);
    }
  };
  const button = (label: string, onPress: () => void, style: "main" | "soft" | "danger") => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={{
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: style === "main" ? t.accent : style === "soft" ? t.accentSoft : t.negSoft,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", color: style === "main" ? t.onAccent : style === "soft" ? t.accent : t.neg }}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen>
      <Header title={income ? "Renda a receber" : "Conta a pagar"} />
      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 24 }}>
        <Text style={{ fontSize: 15, color: t.ink2 }}>{p.description}</Text>
        <Text style={{ fontSize: 34, fontWeight: "700", color: income ? t.pos : t.ink, fontVariant: ["tabular-nums"] }}>
          {p.estimated ? "≈ " : ""}
          {formatBRL(Math.abs(p.amount))}
        </Text>
        <Text style={{ fontSize: 14, color: t.ink2 }}>
          {paid ? (income ? "Recebido" : "Pago") : income ? "A receber" : "Vence"} em {shortDate(p.dueDate)}
          {p.recurringRuleId ? " · todo mês" : ""}
        </Text>
      </Card>

      {paid
        ? button(income ? "Marcar como não recebido" : "Marcar como não pago", () => run(() => f.setPlannedStatus(p.id, "pending")), "soft")
        : button(income ? "Marcar como recebido" : "Marcar como pago", () => run(() => f.setPlannedStatus(p.id, "paid")), "main")}
      <Text style={{ fontSize: 13, color: t.ink2, textAlign: "center", lineHeight: 18 }}>
        {income
          ? "Marque quando o dinheiro cair, para ele não ser contado duas vezes no saldo projetado."
          : "Marque quando pagar, para a conta não ser descontada duas vezes do saldo projetado."}
      </Text>

      {confirm ? (
        <View style={{ gap: 8 }}>
          {button("Excluir só este mês", () => run(() => f.removePlanned(p.id)), "danger")}
          {p.recurringRuleId ? button("Excluir este e os próximos meses", () => run(() => f.removePlanned(p.id, true)), "danger") : null}
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => (p.recurringRuleId ? setConfirm(true) : run(() => f.removePlanned(p.id)))} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.neg, fontSize: 15 }}>Excluir</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: t.ink }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 13, color: t.ink2 }}>{hint}</Text> : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, padding: 2, backgroundColor: on ? t.pos : t.track, alignItems: on ? "flex-end" : "flex-start" }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF" }} />
      </View>
    </Pressable>
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
            accessibilityState={{ checked: on }}
            onPress={() => onChange(it.id)}
            style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: "center", backgroundColor: on ? t.accent : t.track }}
          >
            <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 14, fontWeight: on ? "600" : "500" }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
