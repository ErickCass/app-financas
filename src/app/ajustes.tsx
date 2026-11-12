import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/data/auth";
import { useFinance } from "@/data/store";
import { formatBRL } from "@/domain/money";
import { Card, Screen, SectionTitle } from "@/ui/components";
import { MoneyInput } from "@/ui/MoneyInput";
import { NavBar } from "@/ui/NavBar";
import { useTheme } from "@/ui/theme";
import { AccountMark, ACCOUNT_COLORS, accountColor } from "@/ui/AccountMark";
import { pickCardImage } from "@/ui/cardImage";
import { useAppearance } from "@/ui/appearance";

export default function Ajustes() {
  const t = useTheme();
  const auth = useAuth();
  const f = useFinance();
  const checking = f.accounts.filter((a) => a.kind === "checking" || a.kind === "cash");
  const [colorError, setColorError] = useState<string | null>(null);
  const appearance = useAppearance();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState(0);
  const [negative, setNegative] = useState(false);

  return (
    <Screen>
      <NavBar back="Início" />
      <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, paddingHorizontal: 4 }}>
        Ajustes
      </Text>

      <Card>
        <Text style={{ fontSize: 13, color: t.ink2 }}>{f.isDemo ? "Modo demonstração" : "Conectado como"}</Text>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink }}>
          {f.isDemo ? "Dados fictícios, nada é salvo" : auth.email}
        </Text>
      </Card>

      {!f.isDemo ? (
        <>
          <SectionTitle>Saldo das contas</SectionTitle>
          <Text style={{ fontSize: 13, color: t.ink2, paddingHorizontal: 4, marginTop: -8, lineHeight: 18 }}>
            Informe o saldo atual da conta corrente. Ele é o ponto de partida do saldo projetado; quando a conexão com o banco
            estiver ativa, será atualizado sozinho.
          </Text>

      <Card style={{ gap: 0, paddingVertical: 4 }}>
            {checking.map((a, i) => (
              <View key={a.id} style={{ paddingVertical: 12, gap: 10, borderBottomWidth: i < checking.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 16, color: t.ink }}>{a.name}</Text>
                    <Text style={{ fontSize: 12, color: t.ink2 }}>
                      Atualizado em {new Date(a.balanceUpdatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setEditing(a.id);
                      setValue(Math.abs(a.balance));
                      setNegative(a.balance < 0);
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: t.accent }}>{formatBRL(a.balance)}</Text>
                  </Pressable>
                </View>
                {editing === a.id ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: negative }}
                      accessibilityLabel="Saldo negativo"
                      onPress={() => setNegative((n) => !n)}
                      style={{ height: 40, width: 40, borderRadius: 10, backgroundColor: negative ? t.neg : t.bg, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: "700", color: negative ? "#FFFFFF" : t.ink2 }}>−</Text>
                    </Pressable>
                    <View style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: t.bg, paddingHorizontal: 12, justifyContent: "center" }}>
                      <MoneyInput cents={value} onChangeCents={setValue} autoFocus accessibilityLabel={`Saldo atual de ${a.name}`} style={{ fontSize: 16, fontWeight: "600", minWidth: 0, width: "100%" }} />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void f.setAccountBalance(a.id, negative ? -value : value);
                        setEditing(null);
                      }}
                      style={{ height: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: t.accent, justifyContent: "center" }}
                    >
                      <Text style={{ color: t.onAccent, fontWeight: "600" }}>Salvar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

          <SectionTitle>Aparência</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: t.track, gap: 2 }}>
          {(
            [
              ["auto", "Automático"],
              ["light", "Claro"],
              ["dark", "Escuro"],
            ] as const
          ).map(([m, label]) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: appearance.mode === m }}
              onPress={() => appearance.setMode(m)}
              style={{ flex: 1, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: appearance.mode === m ? t.card : "transparent" }}
            >
              <Text style={{ fontSize: 14, fontWeight: appearance.mode === m ? "600" : "500", color: t.ink }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Automático segue o ajuste do aparelho.</Text>
      </Card>

      <SectionTitle>Cores das contas e cartões</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {f.accounts.map((a, i) => (
          <View key={a.id} style={{ gap: 8, paddingVertical: 10, borderBottomWidth: i < f.accounts.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AccountMark account={a} size={36} />
              <Text style={{ flex: 1, fontSize: 16, color: t.ink }} numberOfLines={1}>{a.name}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  pickCardImage()
                    .then((img) => (img ? f.setAccountImage(a.id, img) : undefined))
                    .catch((e: unknown) => setColorError(e instanceof Error ? e.message : String(e)))
                }
                style={{ height: 32, paddingHorizontal: 10, borderRadius: 8, backgroundColor: t.accentSoft, justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: t.accent }}>{a.image ? "Trocar foto" : "Usar foto do cartão"}</Text>
              </Pressable>
              {a.image ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remover foto de ${a.name}`} onPress={() => void f.setAccountImage(a.id, null)} style={{ height: 32, paddingHorizontal: 8, justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, color: t.neg }}>Remover</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {ACCOUNT_COLORS.map((c) => {
                const on = accountColor(a) === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Cor ${c} para ${a.name}`}
                    onPress={() => f.setAccountColor(a.id, c).catch((e: unknown) => setColorError(e instanceof Error ? e.message : String(e)))}
                    style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: on ? c : "transparent", alignItems: "center", justifyContent: "center" }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c }} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {colorError ? <Text style={{ color: t.neg, fontSize: 13, paddingVertical: 8 }}>{colorError}</Text> : null}
      </Card>

      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <Link href="/limites" asChild>
          <Pressable accessibilityRole="link" style={{ height: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: t.line }}>
            <Text style={{ fontSize: 16, color: t.ink }}>Categorias e limites</Text>
          </Pressable>
        </Link>
        <Link href="/importar" asChild>
          <Pressable accessibilityRole="link" style={{ height: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: t.line }}>
            <Text style={{ fontSize: 16, color: t.ink }}>Importar fatura ou extrato</Text>
          </Pressable>
        </Link>
        <Pressable
          accessibilityRole="button"
          onPress={() => void auth.signOut().finally(() => router.replace("/entrar"))}
          style={{ height: 48, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, color: t.neg }}>{f.isDemo ? "Sair da demonstração" : "Sair"}</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
