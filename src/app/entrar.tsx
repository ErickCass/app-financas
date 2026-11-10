import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/data/auth";
import { Screen } from "@/ui/components";
import { useTheme } from "@/ui/theme";

export default function Entrar() {
  const t = useTheme();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  if (auth.mode === "signed_in" || auth.mode === "demo") return <Redirect href="/" />;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const input = {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: t.card,
    color: t.ink,
    fontSize: 17,
    borderWidth: 1,
    borderColor: t.line,
  } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ gap: 8, paddingTop: 40, paddingBottom: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.onAccent, fontSize: 28, fontWeight: "700" }}>F</Text>
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, letterSpacing: -0.5 }}>
            Entrar
          </Text>
          <Text style={{ fontSize: 16, color: t.ink2, lineHeight: 22 }}>
            {step === "email"
              ? "Informe seu e-mail. Enviamos um código de 6 dígitos; não há senha para lembrar."
              : `Digite o código enviado para ${email.trim()}.`}
          </Text>
        </View>

        {step === "email" ? (
          <View style={{ gap: 12 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              placeholderTextColor={t.ink3}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="E-mail"
              style={input}
              onSubmitEditing={() =>
                validEmail &&
                run(async () => {
                  await auth.sendCode(email);
                  setStep("code");
                })
              }
            />
            <MainButton
              label="Enviar código"
              disabled={!validEmail || busy}
              busy={busy}
              onPress={() =>
                run(async () => {
                  await auth.sendCode(email);
                  setStep("code");
                })
              }
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={t.ink3}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              accessibilityLabel="Código de 6 dígitos"
              maxLength={6}
              style={[input, { fontSize: 28, letterSpacing: 8, textAlign: "center" }]}
            />
            <MainButton
              label="Entrar"
              disabled={code.length !== 6 || busy}
              busy={busy}
              onPress={() => run(() => auth.verifyCode(email, code))}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                run(async () => {
                  await auth.sendCode(email);
                  setMessage({ kind: "info", text: "Enviamos um novo código." });
                })
              }
              style={{ height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: t.accent, fontSize: 15, fontWeight: "600" }}>Reenviar código</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep("email");
                setCode("");
                setMessage(null);
              }}
              style={{ height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: t.ink2, fontSize: 15 }}>Usar outro e-mail</Text>
            </Pressable>
          </View>
        )}

        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontSize: 14, color: message.kind === "error" ? t.neg : t.pos, textAlign: "center" }}
          >
            {message.text}
          </Text>
        ) : null}

        <View style={{ height: 1, backgroundColor: t.line, marginVertical: 12 }} />
        <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center", lineHeight: 20 }}>
          Entrar com Apple e com Google chega em breve.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={auth.enterDemo}
          style={{ height: 48, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>Ver demonstração com dados fictícios</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function MainButton({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: 50,
        borderRadius: 14,
        backgroundColor: t.accent,
        opacity: disabled ? 0.45 : 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {busy ? <ActivityIndicator color={t.onAccent} /> : <Text style={{ color: t.onAccent, fontSize: 17, fontWeight: "600" }}>{label}</Text>}
    </Pressable>
  );
}
