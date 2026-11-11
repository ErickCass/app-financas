import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useFinance } from "@/data/store";
import { useMonthSummary } from "@/data/selectors";
import { categorySpent } from "@/domain/budget";
import { addMonths, monthLabel, monthOf } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { liquidBalance } from "@/domain/projection";
import type { Category } from "@/domain/types";
import { Card, Divider, Screen, SectionTitle } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { useTheme } from "@/ui/theme";

/**
 * Plano do mês: quanto entra e quanto sai se tudo acontecer como planejado,
 * sem depender do ritmo real. Serve de base para planejar o ano.
 * Os valores são os "limites" de cada categoria (renda, contas fixas, variáveis),
 * editáveis aqui mesmo.
 */
export default function Plano() {
  const t = useTheme();
  const f = useFinance();
  const s = useMonthSummary();
  const month = monthOf(f.today);
  const previous = addMonths(month, -1);

  const groups = useMemo(() => {
    const byKind = (k: Category["kind"]) => f.categories.filter((c) => c.kind === k).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { income: byKind("income"), fixed: byKind("fixed"), variable: byKind("variable") };
  }, [f.categories]);

  /** Valor planejado salvo (este mês, senão o anterior); sem nada, sugere pelo que já está previsto/recebido. */
  const saved = (id: string) =>
    f.budgets.find((b) => b.categoryId === id && b.month === month)?.limit ??
    f.budgets.find((b) => b.categoryId === id && b.month === previous)?.limit;
  const suggestion = (c: Category): number => {
    const planned = f.planned
      .filter((p) => p.categoryId === c.id && monthOf(p.dueDate) === month)
      .reduce((a, p) => a + Math.abs(p.amount), 0);
    if (c.kind === "income") {
      const received = f.transactions.filter((x) => x.categoryId === c.id && monthOf(x.date) === month && x.amount > 0).reduce((a, x) => a + x.amount, 0);
      return Math.max(planned, received);
    }
    return Math.max(planned, categorySpent(f.transactions, c.id, month));
  };

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(f.categories.map((c) => [c.id, saved(c.id) ?? suggestion(c)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"valor" | "nome">("valor");
  const ordered = (cats: Category[]) =>
    sort === "nome" ? cats : [...cats].sort((a, b) => (values[b.id] ?? 0) - (values[a.id] ?? 0) || a.name.localeCompare(b.name, "pt-BR"));

  const total = (cats: Category[]) => cats.reduce((a, c) => a + (values[c.id] ?? 0), 0);
  const incomePlan = total(groups.income);
  const fixedPlan = total(groups.fixed);
  const variablePlan = total(groups.variable);
  const result = incomePlan - fixedPlan - variablePlan;

  // Realizado até hoje, por categoria, para comparar com o plano.
  const actual = (c: Category) =>
    c.kind === "income"
      ? f.transactions.filter((x) => x.categoryId === c.id && monthOf(x.date) === month && x.amount > 0).reduce((a, x) => a + x.amount, 0)
      : categorySpent(f.transactions, c.id, month);

  // Saldo em que o mês terminaria se o plano fosse cumprido à risca:
  // saldo de hoje + renda que falta entrar − despesas que faltam sair (plano − realizado).
  const remainingIn = groups.income.reduce((a, c) => a + Math.max((values[c.id] ?? 0) - actual(c), 0), 0);
  const remainingOut = [...groups.fixed, ...groups.variable].reduce((a, c) => a + Math.max((values[c.id] ?? 0) - actual(c), 0), 0);
  // Compras no cartão do mês ainda não pagas e previstos sem categoria também saem do saldo.
  const cardIds = new Set(f.accounts.filter((a) => a.kind === "credit_card").map((a) => a.id));
  const cardPurchases = Math.max(
    -f.transactions.filter((x) => cardIds.has(x.accountId) && monthOf(x.date) === month && !x.isCardPayment).reduce((a, x) => a + x.amount, 0),
    0,
  );
  const uncategorizedPlanned = f.planned
    .filter((p) => p.status !== "paid" && monthOf(p.dueDate) === month && !p.creditCardStatement && !p.categoryId)
    .reduce((a, p) => a + p.amount, 0);
  const monthEndIfPlan = liquidBalance(f.accounts) + remainingIn - remainingOut - cardPurchases + uncategorizedPlanned;

  const year = month.slice(0, 4);
  const monthsLeft = 12 - Number(month.slice(5, 7));
  const yearEndIfPlan = monthEndIfPlan + monthsLeft * result;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const c of f.categories) {
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

  const section = (title: string, cats: Category[], sign: "+" | "−") => (
    <>
      <SectionTitle right={<Text style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{sign === "+" ? "+" : "−"} {formatBRL(total(cats))}</Text>}>{title}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {cats.length === 0 ? <Text style={{ fontSize: 14, color: t.ink2, paddingVertical: 12 }}>Nenhuma categoria. Crie em Categorias e limites.</Text> : null}
        {ordered(cats).map((c, i) => {
          const real = actual(c);
          const plan = values[c.id] ?? 0;
          return (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: i < cats.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, color: t.ink }}>{c.name}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: real > plan && plan > 0 && c.kind !== "income" ? t.neg : t.ink2 }}>
                  {real > 0 ? `${c.kind === "income" ? "recebido" : "realizado"} ${formatBRL(real, { noCents: true })}` : "nada ainda"}
                  {saved(c.id) === undefined && plan > 0 ? " · sugerido" : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 38, paddingHorizontal: 10, borderRadius: 10, backgroundColor: t.bg, width: 124 }}>
                <Text style={{ fontSize: 14, color: t.ink2 }}>R$</Text>
                <MoneyInput
                  cents={plan}
                  onChangeCents={(v) => setValues((st) => ({ ...st, [c.id]: v }))}
                  accessibilityLabel={`Valor planejado de ${c.name}`}
                  style={{ flex: 1, minWidth: 0, width: "100%", textAlign: "right", fontSize: 15, fontWeight: "600" }}
                />
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Cancelar</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Plano de {monthLabel(month).toLowerCase()}</Text>
        <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={{ height: 44, justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 17, fontWeight: "600", opacity: saving ? 0.5 : 1 }}>Salvar</Text>
        </Pressable>
      </View>

      <Card style={{ gap: 12 }}>
        <View>
          <Text style={{ fontSize: 13, color: t.ink2 }}>Sobra planejada no mês</Text>
          <Text style={{ fontSize: 34, fontWeight: "700", color: result >= 0 ? t.pos : t.neg, fontVariant: ["tabular-nums"], letterSpacing: -0.5 }}>
            {result < 0 ? "−" : ""}
            {formatBRL(Math.abs(result))}
          </Text>
          <Text style={{ fontSize: 13, color: t.ink2 }}>
            renda {formatBRL(incomePlan, { noCents: true })} − fixas {formatBRL(fixedPlan, { noCents: true })} − variáveis {formatBRL(variablePlan, { noCents: true })}
          </Text>
        </View>
        <Divider />
        <Row label={`Saldo em ${monthLabel(month).toLowerCase()} se o plano for cumprido`} value={monthEndIfPlan} hint={`hoje ${formatBRL(liquidBalance(f.accounts))} · projeção pelo ritmo real: ${formatBRL(s.projectedMonthEnd)}`} />
        <Row label={`Saldo em 31/dez/${year} repetindo este plano`} value={yearEndIfPlan} hint={`${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"} × sobra planejada`} />
      </Card>

      <View style={{ flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: t.track, gap: 2 }}>
        {(
          [
            ["valor", "Maior valor"],
            ["nome", "A–Z"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: sort === k }}
            onPress={() => setSort(k)}
            style={{ flex: 1, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: sort === k ? t.card : "transparent" }}
          >
            <Text style={{ fontSize: 14, fontWeight: sort === k ? "600" : "500", color: t.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {section("Renda planejada", groups.income, "+")}
      {section("Contas fixas", groups.fixed, "−")}
      {section("Gastos variáveis (limites)", groups.variable, "−")}

      {error ? <Text style={{ color: t.neg, textAlign: "center" }}>{error}</Text> : null}
      <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18, paddingHorizontal: 4 }}>
        Os valores salvos valem como limite no Orçamento e como previsão nas Despesas do mês. Valores marcados como sugeridos vêm do que já está previsto ou aconteceu; ajuste e salve.
        {" "}
        <Link href="/limites" style={{ color: t.accent, fontWeight: "600" }}>
          Criar ou editar categorias
        </Link>
      </Text>
    </Screen>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: t.ink }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 12, color: t.ink2 }}>{hint}</Text> : null}
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: value >= 0 ? t.ink : t.neg, fontVariant: ["tabular-nums"] }}>
        {value < 0 ? "−" : ""}
        {formatBRL(Math.abs(value))}
      </Text>
    </View>
  );
}
