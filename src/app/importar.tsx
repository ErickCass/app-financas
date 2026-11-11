import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useFinance } from "@/data/store";
import * as remote from "@/data/remote";
import { formatBRL } from "@/domain/money";
import { shortDate } from "@/domain/dates";
import type { Account } from "@/domain/types";
import type { LearnedRule } from "@/import/categorize";
import { buildImportPlan, importKeys } from "@/import/plan";
import { parseStatementFile, pickStatementFile } from "@/import/readFile";
import type { ParsedStatement } from "@/import/types";
import { Card, Divider, Screen } from "@/ui/components";
import { useTheme } from "@/ui/theme";

type Phase =
  | { name: "pick" }
  | { name: "reading" }
  | { name: "preview"; fileName: string; statement: ParsedStatement; rules: LearnedRule[]; imported: Set<string> }
  | { name: "saving" }
  | { name: "done"; inserted: number; kind: ParsedStatement["kind"] };

const NEW = "__new__";
const INSTITUTION: Record<ParsedStatement["institution"], string> = { itau: "Itaú", nubank: "Nubank" };

/** Importar fatura de cartão ou extrato de conta, com prévia antes de gravar. */
export default function Importar() {
  const t = useTheme();
  const f = useFinance();
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [accountChoice, setAccountChoice] = useState<string>(NEW);

  async function choose() {
    setError(null);
    try {
      const file = await pickStatementFile();
      if (!file) return;
      setPhase({ name: "reading" });
      const statement = await parseStatementFile(file);
      if (statement.items.length === 0) throw new Error("Não encontrei lançamentos neste arquivo.");
      // Na demonstração dá para ver a prévia; gravar exige conta.
      const [rules, imported] = f.isDemo
        ? [[], new Set<string>()]
        : await Promise.all([remote.fetchClassificationRules(), remote.fetchImportedKeys(importKeys(statement))]);
      setAccountChoice(defaultAccount(statement, f.accounts));
      setPhase({ name: "preview", fileName: file.name, statement, rules, imported });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase({ name: "pick" });
    }
  }

  const preview = phase.name === "preview" ? phase : null;
  const plan = useMemo(
    () =>
      preview
        ? buildImportPlan({
            statement: preview.statement,
            accountId: accountChoice === NEW ? null : accountChoice,
            categories: f.categories,
            rules: preview.rules,
            importedKeys: preview.imported,
            existing: f.transactions,
            existingPlanned: f.planned,
          })
        : null,
    [preview, accountChoice, f.categories, f.transactions, f.planned],
  );

  async function save() {
    if (!preview || !plan) return;
    const st = preview.statement;
    const existing = f.accounts.find((a) => a.id === accountChoice);
    setPhase({ name: "saving" });
    try {
      const res = await f.importStatement({
        plan,
        fileName: preview.fileName,
        account: existing ?? {
          create: {
            name: st.suggestedAccountName,
            kind: st.kind,
            closingDay: st.closingDay,
            dueDay: st.dueDay,
            last4: st.last4,
          },
        },
      });
      setPhase({ name: "done", inserted: res.inserted, kind: st.kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase(preview);
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: "center", minWidth: 70 }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>{phase.name === "done" ? "Fechar" : "Cancelar"}</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>Importar</Text>
        <View style={{ minWidth: 70 }} />
      </View>

      {phase.name === "pick" || phase.name === "reading" ? (
        <PickStep busy={phase.name === "reading"} demo={f.isDemo} onChoose={choose} />
      ) : null}

      {preview && plan ? (
        <>
          <Summary statement={preview.statement} spending={plan.spending} count={plan.rows.length} period={plan.period} />
          <Checks statement={preview.statement} mismatches={plan.mismatches} />

          <Card style={{ gap: 10 }}>
            <Text style={{ fontSize: 13, color: t.ink2 }}>{preview.statement.kind === "credit_card" ? "Lançar no cartão" : "Lançar na conta"}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {f.accounts
                .filter((a) => a.kind === preview.statement.kind)
                .map((a) => (
                  <Choice key={a.id} label={a.name} on={accountChoice === a.id} onPress={() => setAccountChoice(a.id)} />
                ))}
              <Choice
                label={`+ ${preview.statement.suggestedAccountName}`}
                on={accountChoice === NEW}
                onPress={() => setAccountChoice(NEW)}
              />
            </View>
            {accountChoice === NEW && preview.statement.kind === "credit_card" ? (
              <Text style={{ fontSize: 13, color: t.ink2 }}>
                Novo cartão: fecha dia {preview.statement.closingDay}, vence dia {preview.statement.dueDay}.
              </Text>
            ) : null}
          </Card>

          <Card style={{ gap: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink, marginBottom: 6 }}>Por categoria</Text>
            {plan.byCategory.map((g, i) => {
              const cat = f.categories.find((c) => c.id === g.categoryId);
              return (
                <View key={g.categoryId ?? "sem"}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat?.color ?? t.ink3 }} />
                    <Text style={{ flex: 1, fontSize: 16, color: cat ? t.ink : t.ink2 }} numberOfLines={1}>
                      {cat?.name ?? "Sem categoria"}
                    </Text>
                    <Text style={{ fontSize: 14, color: t.ink2 }}>{g.count}</Text>
                    <Text style={{ fontSize: 16, color: t.ink, fontVariant: ["tabular-nums"], minWidth: 96, textAlign: "right" }}>
                      {formatBRL(g.total)}
                    </Text>
                  </View>
                </View>
              );
            })}
            {plan.uncategorized > 0 ? (
              <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18, marginTop: 6 }}>
                {plan.uncategorized} sem categoria: você escolhe depois em Lançamentos, e o app passa a reconhecer essas lojas nas próximas importações.
              </Text>
            ) : null}
          </Card>

          {plan.newUpcoming.length > 0 ? (
            <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center", lineHeight: 20 }}>
              {plan.newUpcoming.length} agendado{plan.newUpcoming.length > 1 ? "s" : ""} do extrato {plan.newUpcoming.length > 1 ? "entram" : "entra"} como previsto a pagar.
            </Text>
          ) : null}

          {plan.rows.length > plan.newRows.length ? (
            <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center" }}>
              {plan.rows.length - plan.newRows.length} lançamento(s) já estavam no app e serão ignorados.
            </Text>
          ) : null}

          {error ? <Text style={{ color: t.neg, textAlign: "center" }}>{error}</Text> : null}

          <BigButton
            label={
              plan.newRows.length === 0 && plan.newUpcoming.length === 0
                ? "Nada novo para importar"
                : `${plan.mismatches.length ? "Importar mesmo assim" : "Importar"} ${plan.newRows.length + plan.newUpcoming.length} lançamento${plan.newRows.length + plan.newUpcoming.length > 1 ? "s" : ""}`
            }
            disabled={plan.newRows.length === 0 && plan.newUpcoming.length === 0}
            onPress={save}
          />
        </>
      ) : null}

      {phase.name === "saving" ? (
        <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.ink2 }}>Gravando os lançamentos…</Text>
        </View>
      ) : null}

      {phase.name === "done" ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 28 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.posSoft, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 26, color: t.pos }}>✓</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: t.ink }}>
            {phase.inserted} lançamento{phase.inserted === 1 ? "" : "s"} importado{phase.inserted === 1 ? "" : "s"}
          </Text>
          <Text style={{ fontSize: 15, color: t.ink2, textAlign: "center", lineHeight: 21 }}>
            {phase.kind === "credit_card"
              ? "As compras já contam no orçamento de cada categoria, pela data da compra."
              : "O saldo da conta foi atualizado com o do extrato."}
          </Text>
          <View style={{ alignSelf: "stretch", gap: 8, marginTop: 8 }}>
            <BigButton label="Ver orçamento" onPress={() => router.replace("/orcamento")} />
            <BigButton label="Importar outro arquivo" soft onPress={() => setPhase({ name: "pick" })} />
          </View>
        </Card>
      ) : null}

      {phase.name === "pick" && error ? <Text style={{ color: t.neg, textAlign: "center", lineHeight: 20 }}>{error}</Text> : null}
    </Screen>
  );
}

/** Cartão/conta do mesmo banco, se já existir; senão, a conta corrente única (extrato) ou um cartão novo. */
function defaultAccount(st: ParsedStatement, accounts: Account[]): string {
  const sameKind = accounts.filter((a) => a.kind === st.kind);
  const bank = INSTITUTION[st.institution].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const byLast4 = st.last4 ? sameKind.find((a) => a.name.includes(st.last4!)) : undefined;
  const byBank = sameKind.find((a) => a.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(bank));
  if (byLast4 ?? byBank) return (byLast4 ?? byBank)!.id;
  if (st.kind === "checking" && sameKind.length === 1) return sameKind[0]!.id;
  return NEW;
}

function PickStep({ busy, demo, onChoose }: { busy: boolean; demo: boolean; onChoose: () => void }) {
  const t = useTheme();
  const formats = [
    ["Fatura do cartão Itaú", "PDF da fatura fechada, ou planilha (.xlsx) da fatura aberta"],
    ["Extrato da conta Itaú", "PDF do extrato da conta corrente"],
    ["Fatura do Nubank", "CSV: no app, Cartão › Fatura › Exportar fatura"],
  ];
  return (
    <>
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: t.ink, letterSpacing: -0.3 }}>Faturas e extratos</Text>
        <Text style={{ fontSize: 16, color: t.ink2, lineHeight: 22 }}>
          Traga os lançamentos do banco de uma vez. O app separa por categoria e confere com o total do banco antes de gravar.
        </Text>
      </View>
      <Card style={{ gap: 2 }}>
        {formats.map(([title, sub], i) => (
          <View key={title}>
            {i > 0 ? <Divider /> : null}
            <View style={{ paddingVertical: 10, gap: 2 }}>
              <Text style={{ fontSize: 16, color: t.ink, fontWeight: "500" }}>{title}</Text>
              <Text style={{ fontSize: 13, color: t.ink2 }}>{sub}</Text>
            </View>
          </View>
        ))}
      </Card>
      {demo ? (
        <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center" }}>Na demonstração você vê a prévia, mas nada é gravado.</Text>
      ) : null}
      <BigButton label={busy ? "Lendo o arquivo…" : "Escolher arquivo"} disabled={busy} onPress={onChoose} />
      <Text style={{ fontSize: 13, color: t.ink2, textAlign: "center", lineHeight: 18 }}>
        O arquivo é lido aqui no seu aparelho. Só os lançamentos são salvos na sua conta.
      </Text>
    </>
  );
}

function Summary({
  statement: st,
  spending,
  count,
  period,
}: {
  statement: ParsedStatement;
  spending: number;
  count: number;
  period: { from: string; to: string } | null;
}) {
  const t = useTheme();
  const bank = INSTITUTION[st.institution];
  const title =
    st.kind === "credit_card"
      ? `Fatura ${bank}${st.dueDate ? ` · vence ${shortDate(st.dueDate)}` : ""}`
      : `Extrato ${bank}`;
  return (
    <Card style={{ gap: 6 }}>
      <Text style={{ fontSize: 15, color: t.ink2, fontWeight: "600" }}>{title}</Text>
      <Text style={{ fontSize: 34, fontWeight: "700", color: t.ink, fontVariant: ["tabular-nums"], letterSpacing: -0.5 }}>
        {formatBRL(spending)}
      </Text>
      <Text style={{ fontSize: 14, color: t.ink2 }}>
        {st.kind === "credit_card" ? "em compras" : "em saídas"}
        {period ? ` de ${shortDate(period.from)} a ${shortDate(period.to)}` : ""} · {count} lançamentos
      </Text>
    </Card>
  );
}

function Checks({ statement: st, mismatches }: { statement: ParsedStatement; mismatches: { label: string; declared: number; computed: number }[] }) {
  const t = useTheme();
  const rows: { ok: boolean; text: string }[] = [];
  if (st.checks.length > 0) {
    rows.push(
      mismatches.length === 0
        ? { ok: true, text: st.kind === "credit_card" ? `Confere com o total da fatura (${formatBRL(st.declaredTotal ?? 0)})` : "Confere com os saldos do extrato" }
        : {
            ok: false,
            text: `A soma lida não bate com o banco em: ${mismatches
              .map((m) => `${m.label} (diferença de ${formatBRL(Math.abs(m.declared - m.computed))})`)
              .join("; ")}. Confira antes de importar.`,
          },
    );
  } else if (st.institution === "nubank") {
    rows.push({ ok: true, text: "O CSV do Nubank não traz o total; a fatura entra como estimativa até fechar." });
  }
  if (st.closingBalance) {
    const d = new Date(st.closingBalance.asOf);
    const when = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    rows.push({ ok: true, text: `Saldo em ${when}: ${formatBRL(st.closingBalance.amount)}. Vira o saldo atual da conta.` });
  }
  for (const note of st.notes ?? []) rows.push({ ok: true, text: note });
  if (rows.length === 0) return null;
  return (
    <Card style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.text} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Text style={{ fontSize: 15, color: r.ok ? t.pos : t.neg, fontWeight: "700", width: 16 }}>{r.ok ? "✓" : "!"}</Text>
          <Text style={{ flex: 1, fontSize: 14, color: t.ink, lineHeight: 20 }}>{r.text}</Text>
        </View>
      ))}
    </Card>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        backgroundColor: on ? t.accent : t.track,
      }}
    >
      <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 14, fontWeight: on ? "600" : "500" }}>{label}</Text>
    </Pressable>
  );
}

function BigButton({ label, onPress, disabled, soft }: { label: string; onPress: () => void; disabled?: boolean; soft?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: 50,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: soft ? t.accentSoft : t.accent,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text style={{ color: soft ? t.accent : t.onAccent, fontSize: 17, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
