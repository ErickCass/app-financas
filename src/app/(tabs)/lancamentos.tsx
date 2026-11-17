import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { addMonths, monthLabel, monthOf } from "@/domain/dates";
import { buildTxRows, totals } from "@/domain/txList";
import { Card, Screen } from "@/ui/components";
import { AccountChips } from "@/ui/AccountChips";
import { TransactionList } from "@/ui/TransactionList";
import { useTheme } from "@/ui/theme";

type Filter = "todos" | "previstos" | "realizados";
const fold = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function Lancamentos() {
  const t = useTheme();
  const f = useFinance();
  // Pode abrir já filtrada: /lancamentos?status=previstos&conta=<id>&categoria=<id|sem>
  const params = useLocalSearchParams<{
    status?: string;
    conta?: string;
    categoria?: string;
  }>();
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"data" | "valor">("data");
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  // undefined = todas; null = só as sem categoria
  const [categoryId, setCategoryId] = useState<string | null | undefined>(
    undefined,
  );
  const [picking, setPicking] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  // Mês mostrado: compras de fatura entram na data da compra, então é comum
  // precisar voltar um ou dois meses para ver o que veio de uma fatura.
  const [month, setMonth] = useState(monthOf(f.today));
  const isCurrent = month === monthOf(f.today);

  // A aba fica montada: um link novo com filtros substitui os anteriores.
  useEffect(() => {
    if (!params.status && !params.conta && !params.categoria) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setFilter(
      params.status === "previstos" || params.status === "realizados"
        ? params.status
        : "todos",
    );
    setAccountId(params.conta || undefined);
    setCategoryId(
      params.categoria === "sem" ? null : params.categoria || undefined,
    );
    setMonth(monthOf(f.today));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [params.status, params.conta, params.categoria, f.today]);

  const rows = useMemo(
    () =>
      buildTxRows(f, {
        month,
        accountId,
        categoryId,
        status: filter,
        query,
        sort,
      }),
    [f, month, accountId, categoryId, filter, query, sort],
  );
  const sum = totals(rows);
  const pendingOut = rows.filter((r) => r.status === "a_pagar");
  const pendingIn = rows.filter((r) => r.status === "a_receber");
  const usedAccounts = f.accounts.filter(
    (a) =>
      f.transactions.some(
        (tx) => tx.accountId === a.id && monthOf(tx.date) === month,
      ) ||
      f.planned.some(
        (p) =>
          (p.creditCardStatement?.accountId ?? p.accountId) === a.id &&
          monthOf(p.dueDate) === month,
      ),
  );
  const categories = [...f.categories].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const catChoices = catQuery.trim()
    ? categories.filter((c) => fold(c.name).includes(fold(catQuery.trim())))
    : categories;
  const categoryLabel =
    categoryId === undefined
      ? "Todas as categorias"
      : categoryId === null
        ? "Sem categoria"
        : (f.categories.find((c) => c.id === categoryId)?.name ?? "Categoria");
  const filtered =
    accountId !== undefined ||
    categoryId !== undefined ||
    filter !== "todos" ||
    query.trim() !== "";

  const uncategorized = f.transactions.filter(
    (tx) => !tx.categoryId && !tx.isCardPayment,
  ).length;

  return (
    <Screen
      title="Lançamentos"
      right={
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Link href="/importar" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Importar fatura ou extrato"
              style={{
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 22,
                backgroundColor: t.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: t.accent, fontSize: 15, fontWeight: "600" }}
              >
                Importar
              </Text>
            </Pressable>
          </Link>
          <Link href="/novo" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Novo lançamento"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: t.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: t.onAccent,
                  fontSize: 26,
                  lineHeight: 28,
                  fontWeight: "400",
                }}
              >
                +
              </Text>
            </Pressable>
          </Link>
        </View>
      }
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar estabelecimento ou categoria"
        placeholderTextColor={t.ink2}
        accessibilityLabel="Buscar lançamentos"
        style={{
          height: 40,
          borderRadius: 12,
          paddingHorizontal: 12,
          backgroundColor: t.track,
          color: t.ink,
          fontSize: 16,
        }}
      />
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
            ["todos", "Todos"],
            ["previstos", "Previstos"],
            ["realizados", "Realizados"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === k }}
            onPress={() => setFilter(k)}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: filter === k ? t.card : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: filter === k ? "600" : "500",
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

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: picking }}
          onPress={() => {
            setPicking((v) => !v);
            setCatQuery("");
          }}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 10,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: categoryId !== undefined ? t.accentSoft : t.card,
            borderWidth: 1,
            borderColor: categoryId !== undefined ? t.accent : t.line,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 14,
              fontWeight: "600",
              color: categoryId !== undefined ? t.accent : t.ink,
            }}
          >
            {categoryLabel}
          </Text>
          <Text style={{ fontSize: 12, color: t.ink3 }}>
            {picking ? "▴" : "▾"}
          </Text>
        </Pressable>
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
              ["data", "Data"],
              ["valor", "Valor"],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: sort === k }}
              onPress={() => setSort(k)}
              style={{
                height: 32,
                paddingHorizontal: 14,
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
      </View>

      {picking ? (
        <Card style={{ gap: 10 }}>
          <TextInput
            value={catQuery}
            onChangeText={setCatQuery}
            placeholder="Buscar categoria"
            placeholderTextColor={t.ink3}
            style={{
              height: 38,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: t.track,
              color: t.ink,
              fontSize: 16,
            }}
          />
          <ScrollView
            style={{ maxHeight: 260 }}
            contentContainerStyle={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {[
              { id: "__todas", name: "Todas as categorias", color: t.ink3 },
              { id: "__sem", name: "Sem categoria", color: t.ink3 },
              ...catChoices,
            ].map((c) => {
              const value =
                c.id === "__todas" ? undefined : c.id === "__sem" ? null : c.id;
              const on = value === categoryId;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setCategoryId(value);
                    setPicking(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: on ? t.accent : t.track,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.color,
                    }}
                  />
                  <Text
                    style={{ color: on ? t.onAccent : t.ink, fontSize: 14 }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MonthButton
          label="‹"
          hint="Mês anterior"
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: t.ink }}>
            {monthLabel(month)}
          </Text>
          {!isCurrent ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setMonth(monthOf(f.today))}
              style={{ paddingVertical: 2 }}
            >
              <Text
                style={{ fontSize: 13, color: t.accent, fontWeight: "600" }}
              >
                Voltar para o mês atual
              </Text>
            </Pressable>
          ) : null}
        </View>
        <MonthButton
          label="›"
          hint="Próximo mês"
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>

      {uncategorized > 0 ? (
        <Link href="/classificar" asChild>
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
                {uncategorized} sem categoria
              </Text>
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                Classifique por loja de uma vez
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: t.accent }}>
              Classificar ›
            </Text>
          </Pressable>
        </Link>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {(
          [
            ["pagar", "+ Conta a pagar"],
            ["receber", "+ Renda a receber"],
          ] as const
        ).map(([tipo, label]) => (
          <Link key={tipo} href={`/previsto?tipo=${tipo}`} asChild>
            <Pressable
              accessibilityRole="link"
              style={{
                flex: 1,
                height: 40,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: t.line,
                backgroundColor: t.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: t.accent }}
              >
                {label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {filter === "realizados" ? (
          <>
            <Card style={{ flex: 1, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 13, color: t.ink2 }}>Saiu</Text>
              <Text style={{ fontSize: 20, fontWeight: "600", color: t.ink }}>
                {formatBRL(sum.out)}
              </Text>
            </Card>
            <Card style={{ flex: 1, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 13, color: t.ink2 }}>Entrou</Text>
              <Text style={{ fontSize: 20, fontWeight: "600", color: t.pos }}>
                {formatBRL(sum.in)}
              </Text>
            </Card>
          </>
        ) : (
          <>
            <Card style={{ flex: 1, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                A pagar{filtered ? " (filtro)" : " no mês"}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "600", color: t.neg }}>
                {formatBRL(-pendingOut.reduce((a, r) => a + r.amount, 0))}
              </Text>
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                {pendingOut.length} lançamento
                {pendingOut.length === 1 ? "" : "s"}
              </Text>
            </Card>
            <Card style={{ flex: 1, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                A receber{filtered ? " (filtro)" : " no mês"}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "600", color: t.pos }}>
                {formatBRL(pendingIn.reduce((a, r) => a + r.amount, 0))}
              </Text>
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                {pendingIn.length} lançamento{pendingIn.length === 1 ? "" : "s"}
              </Text>
            </Card>
          </>
        )}
      </View>

      {filtered ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ fontSize: 13, color: t.ink2 }}>
            {rows.length} lançamento{rows.length === 1 ? "" : "s"} ·{" "}
            {formatBRL(sum.out)} de saídas
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFilter("todos");
              setAccountId(undefined);
              setCategoryId(undefined);
              setQuery("");
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.accent }}>
              Limpar filtros
            </Text>
          </Pressable>
        </View>
      ) : null}

      <TransactionList rows={rows} byDate={sort === "data"} />
    </Screen>
  );
}

function MonthButton({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: t.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 20, color: t.accent, lineHeight: 22 }}>
        {label}
      </Text>
    </Pressable>
  );
}
