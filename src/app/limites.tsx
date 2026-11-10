import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { addMonths, monthLabel, monthOf } from "@/domain/dates";
import type { Category } from "@/domain/types";
import { Card, Screen, SectionTitle } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { useTheme } from "@/ui/theme";

const KIND_LABEL: Record<Category["kind"], string> = { variable: "Gasto variável", fixed: "Conta fixa", income: "Renda" };

/**
 * Categorias e limites: criar, renomear e arquivar categorias, e definir
 * quanto pode gastar por mês (variáveis) ou quanto costuma pagar (contas fixas).
 */
export default function Limites() {
  const t = useTheme();
  const f = useFinance();
  const month = monthOf(f.today);
  const previous = addMonths(month, -1);
  const limitOf = (id: string) =>
    f.budgets.find((b) => b.categoryId === id && b.month === month)?.limit ??
    f.budgets.find((b) => b.categoryId === id && b.month === previous)?.limit ??
    0;
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(f.categories.filter((c) => c.kind !== "income").map((c) => [c.id, limitOf(c.id)])),
  );
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variable = f.categories.filter((c) => c.kind === "variable");
  const fixed = f.categories.filter((c) => c.kind === "fixed");
  const income = f.categories.filter((c) => c.kind === "income");
  const avg = (id: string) => f.history.find((h) => h.categoryId === id)?.monthlyAverage;
  const total = variable.reduce((a, c) => a + (values[c.id] ?? 0), 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const c of f.categories.filter((x) => x.kind !== "income")) {
        const current = f.budgets.find((b) => b.categoryId === c.id && b.month === month)?.limit;
        const next = values[c.id] ?? 0;
        if (current !== next && !(current === undefined && next === 0)) await f.setBudgetLimit(c.id, month, next);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function suggest() {
    setValues((v) => ({
      ...v,
      ...Object.fromEntries(
        [...variable, ...fixed].map((c) => {
          const a = avg(c.id);
          // média dos últimos meses arredondada para cima de R$ 50
          return [c.id, a ? Math.ceil(a / 5_000) * 5_000 : (v[c.id] ?? 0)];
        }),
      ),
    }));
  }

  const section = (title: string, hint: string, cats: Category[], withLimit: boolean) => (
    <>
      <SectionTitle right={withLimit ? <Text style={{ fontSize: 13, color: t.ink2 }}>{hint}</Text> : undefined}>{title}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {cats.length === 0 ? <Text style={{ fontSize: 14, color: t.ink2, paddingVertical: 12 }}>Nenhuma categoria.</Text> : null}
        {cats.map((c, i) => (
          <View key={c.id} style={{ borderBottomWidth: i < cats.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar categoria ${c.name}`}
                onPress={() => setEditing(editing === c.id ? null : c.id)}
                style={{ flex: 1, minHeight: 40, justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, color: t.ink }}>
                  {c.name} <Text style={{ fontSize: 13, color: t.accent }}>editar</Text>
                </Text>
                {withLimit && avg(c.id) ? (
                  <Text style={{ fontSize: 12, color: t.ink2 }}>média 3 meses {formatBRL(avg(c.id)!, { noCents: true })}</Text>
                ) : null}
              </Pressable>
              {withLimit ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: t.bg, width: 130 }}>
                  <Text style={{ fontSize: 15, color: t.ink2 }}>R$</Text>
                  <MoneyInput
                    cents={values[c.id] ?? 0}
                    onChangeCents={(v) => setValues((s) => ({ ...s, [c.id]: v }))}
                    accessibilityLabel={`${c.kind === "fixed" ? "Valor mensal previsto" : "Limite mensal"} de ${c.name}`}
                    style={{ flex: 1, minWidth: 0, width: "100%", textAlign: "right", fontSize: 16, fontWeight: "600" }}
                  />
                </View>
              ) : null}
            </View>
            {editing === c.id ? <CategoryEditor category={c} onDone={() => setEditing(null)} /> : null}
          </View>
        ))}
      </Card>
    </>
  );

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Cancelar</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Categorias e limites</Text>
        <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17, fontWeight: "600", opacity: saving ? 0.5 : 1 }}>Salvar</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={{ fontSize: 15, color: t.ink2 }}>Limites de {monthLabel(month).toLowerCase()}</Text>
        <Text style={{ fontSize: 28, fontWeight: "600", color: t.ink }}>{formatBRL(total)}</Text>
        <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
          Soma dos gastos variáveis. Deixe em zero a categoria que não precisa de limite: ela aparece no orçamento sem alerta.
        </Text>
      </Card>

      {f.history.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={suggest}
          style={{ height: 48, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: t.accent, fontSize: 15, fontWeight: "600" }}>Sugerir valores pelo meu histórico</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={{ color: t.neg, textAlign: "center" }}>{error}</Text> : null}

      {section("Gastos variáveis", "limite por mês", variable, true)}
      {section("Contas fixas", "valor previsto", fixed, true)}
      {section("Renda", "", income, false)}

      {creating ? (
        <Card>
          <CategoryEditor onDone={() => setCreating(false)} />
        </Card>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(true)}
          style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>+ Nova categoria</Text>
        </Pressable>
      )}
    </Screen>
  );
}

/** Criar (sem `category`) ou editar uma categoria: nome, tipo e arquivar. */
function CategoryEditor({ category, onDone }: { category?: Category; onDone: () => void }) {
  const t = useTheme();
  const f = useFinance();
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<Category["kind"]>(category?.kind ?? "variable");
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const used = category ? f.transactions.filter((tx) => tx.categoryId === category.id).length : 0;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10, paddingBottom: 12 }}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nome (ex.: Viagem, Pets, Tarifas)"
        placeholderTextColor={t.ink3}
        accessibilityLabel="Nome da categoria"
        autoFocus={!category}
        style={{ height: 44, borderRadius: 10, paddingHorizontal: 12, backgroundColor: t.bg, color: t.ink, fontSize: 16 }}
      />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(KIND_LABEL) as Category["kind"][]).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: kind === k }}
            onPress={() => setKind(k)}
            style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: "center", backgroundColor: kind === k ? t.accent : t.track }}
          >
            <Text style={{ color: kind === k ? t.onAccent : t.ink, fontSize: 14, fontWeight: kind === k ? "600" : "500" }}>{KIND_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={{ color: t.neg, fontSize: 14 }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !name.trim()}
          onPress={() =>
            run(() => (category ? f.updateCategory(category.id, { name, kind }) : f.createCategory(name, kind)))
          }
          style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", opacity: busy || !name.trim() ? 0.5 : 1 }}
        >
          <Text style={{ color: t.onAccent, fontSize: 15, fontWeight: "600" }}>{category ? "Salvar" : "Criar categoria"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDone}
          style={{ height: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: t.track, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: t.ink, fontSize: 15 }}>Cancelar</Text>
        </Pressable>
      </View>
      {category ? (
        confirmArchive ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
              {used > 0
                ? `${used} lançamento${used > 1 ? "s ficam" : " fica"} sem categoria. Você pode reclassificar depois.`
                : "A categoria some das telas. Nada é apagado."}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => run(() => f.archiveCategory(category.id))}
              style={{ height: 40, borderRadius: 10, backgroundColor: t.negSoft, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: t.neg, fontSize: 15, fontWeight: "600" }}>Arquivar {category.name}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirmArchive(true)} style={{ height: 36, justifyContent: "center" }}>
            <Text style={{ color: t.neg, fontSize: 14 }}>Arquivar categoria</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}
