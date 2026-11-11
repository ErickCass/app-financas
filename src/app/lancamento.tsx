import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { shortDate } from "@/domain/dates";
import { Card, Screen } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { AccountMark } from "@/ui/AccountMark";
import { useTheme } from "@/ui/theme";

const SOURCE: Record<string, string> = { manual: "lançado à mão", import: "importado", apple_pay: "Apple Pay", open_finance: "banco conectado" };
const toBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const fromBR = (text: string) => {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
};

/** Um lançamento: trocar categoria, corrigir descrição/valor/data, marcar como transferência ou excluir. */
export default function Lancamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const f = useFinance();
  const tx = f.transactions.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(tx?.description ?? "");
  const [amount, setAmount] = useState(Math.abs(tx?.amount ?? 0));
  const [date, setDate] = useState(tx ? toBR(tx.date) : "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tx) {
    return (
      <Screen>
        <Header />
        <Text style={{ color: t.ink2, textAlign: "center", padding: 24 }}>Este lançamento não existe mais.</Text>
      </Screen>
    );
  }
  const account = f.accounts.find((a) => a.id === tx.accountId);
  const category = f.categories.find((c) => c.id === tx.categoryId);
  const income = tx.amount > 0;
  const options = [...f.categories]
    .filter((c) => (income ? c.kind === "income" : c.kind !== "income"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const run = async (action: () => Promise<void>, back = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (back) router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const iso = fromBR(date);
  const field = { height: 44, borderRadius: 10, paddingHorizontal: 12, backgroundColor: t.bg, color: t.ink, fontSize: 16 } as const;

  return (
    <Screen>
      <Header />
      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 22 }}>
        {account ? <AccountMark account={account} size={36} /> : null}
        <Text style={{ fontSize: 17, color: t.ink, textAlign: "center" }}>{tx.description}</Text>
        <Text style={{ fontSize: 34, fontWeight: "700", color: income ? t.pos : t.ink, fontVariant: ["tabular-nums"] }}>
          {income ? "+" : "−"}
          {formatBRL(Math.abs(tx.amount))}
        </Text>
        <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center" }}>
          {shortDate(tx.date)} · {account?.name ?? "conta"} · {SOURCE[tx.source] ?? tx.source}
          {tx.isCardPayment ? " · transferência entre contas" : ""}
          {tx.installment ? ` · parcela ${tx.installment.n}/${tx.installment.total}` : ""}
        </Text>
      </Card>

      {!tx.isCardPayment ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>Categoria</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {options.map((c) => {
              const on = c.id === tx.categoryId;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  disabled={busy}
                  onPress={() => run(() => f.setTransactionCategory(tx.id, c.id), false)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: on ? t.accent : t.track }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? t.onAccent : c.color }} />
                  <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 14, fontWeight: on ? "600" : "500" }}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {category && category.kind !== "income" ? (
            <Link href={`/categoria/${category.id}`} style={{ fontSize: 14, color: t.accent, fontWeight: "600" }}>
              Ver {category.name} no orçamento ›
            </Link>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        {editing ? (
          <>
            <TextInput value={desc} onChangeText={setDesc} accessibilityLabel="Descrição" style={field} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, height: 44, borderRadius: 10, paddingHorizontal: 12, backgroundColor: t.bg }}>
                <Text style={{ color: t.ink2 }}>R$</Text>
                <MoneyInput cents={amount} onChangeCents={setAmount} accessibilityLabel="Valor" style={{ flex: 1, minWidth: 0, width: "100%", fontSize: 16, fontWeight: "600" }} />
              </View>
              <TextInput value={date} onChangeText={setDate} placeholder="DD/MM/AAAA" placeholderTextColor={t.ink3} accessibilityLabel="Data" style={[field, { width: 130 }, iso === null && { borderWidth: 1, borderColor: t.neg }]} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                disabled={busy || !desc.trim() || amount <= 0 || !iso}
                onPress={() =>
                  run(
                    () => f.updateTransaction(tx.id, { description: desc.trim(), amount: income ? amount : -amount, date: iso! }),
                    false,
                  ).then(() => setEditing(false))
                }
                style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", opacity: busy || !desc.trim() || amount <= 0 || !iso ? 0.5 : 1 }}
              >
                <Text style={{ color: t.onAccent, fontWeight: "600" }}>Salvar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setEditing(false)} style={{ height: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: t.track, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: t.ink }}>Cancelar</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={{ height: 44, justifyContent: "center" }}>
            <Text style={{ fontSize: 16, color: t.accent, fontWeight: "600" }}>Corrigir descrição, valor ou data</Text>
          </Pressable>
        )}
        {!tx.isCardPayment && !income ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => f.markInternal([tx.id]))} style={{ minHeight: 56, justifyContent: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.line }}>
            <Text style={{ fontSize: 16, color: t.ink }}>Marcar como transferência entre minhas contas</Text>
            <Text style={{ fontSize: 12, color: t.ink2 }}>Pagamento de fatura ou PIX para conta sua: sai do orçamento.</Text>
          </Pressable>
        ) : null}
        {tx.isCardPayment ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => f.clearClassification([tx.id]))} style={{ height: 44, justifyContent: "center" }}>
            <Text style={{ fontSize: 16, color: t.ink }}>Não é transferência: voltar a contar como gasto</Text>
          </Pressable>
        ) : null}
      </Card>

      {error ? <Text style={{ color: t.neg, textAlign: "center" }}>{error}</Text> : null}

      {confirm ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ fontSize: 14, color: t.ink2, lineHeight: 20 }}>
            {tx.source === "import"
              ? "Este lançamento veio de um arquivo importado. Se você importar o mesmo arquivo de novo, ele volta."
              : tx.plannedId
                ? "A conta prevista que ele quitou volta a ficar pendente."
                : "Isso não pode ser desfeito."}
          </Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => f.removeTransaction(tx.id))} style={{ height: 44, borderRadius: 12, backgroundColor: t.negSoft, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.neg, fontSize: 16, fontWeight: "600" }}>Excluir lançamento</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirm(false)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.ink2 }}>Cancelar</Text>
          </Pressable>
        </Card>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.neg, fontSize: 15 }}>Excluir</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Header() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center", minWidth: 70 }}>
        <Text style={{ color: t.accent, fontSize: 17 }}>Fechar</Text>
      </Pressable>
      <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Lançamento</Text>
      <View style={{ minWidth: 70 }} />
    </View>
  );
}
