import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useAppearance } from "@/ui/appearance";
import { Redirect } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { translateAuthError, useAuth } from "@/data/auth";
import { readRedirectError, type Provider } from "@/data/oauth";
import { Screen } from "@/ui/components";
import { useTheme } from "@/ui/theme";

export default function Entrar() {
  const t = useTheme();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  // Ao voltar do Google/Apple no navegador com erro (ex.: pessoa cancelou), já mostra a mensagem.
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(() => {
    const err = readRedirectError();
    return err ? { kind: "error", text: translateAuthError(err) } : null;
  });

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
      <Screen refreshable={false}>
        <View style={{ gap: 8, paddingTop: 40, paddingBottom: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.onAccent, fontSize: 28, fontWeight: "700" }}>F</Text>
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, letterSpacing: -0.5 }}>
            Entrar
          </Text>
          <Text style={{ fontSize: 16, color: t.ink2, lineHeight: 22 }}>
            {step === "email"
              ? "Informe seu e-mail. Enviamos um código de acesso; não há senha para lembrar."
              : `Digite o código enviado para ${email.trim()}.`}
          </Text>
        </View>

        {step === "email" && (auth.providers.apple || auth.providers.google) ? (
          <View style={{ gap: 12 }}>
            {auth.providers.apple ? (
              <SocialButton provider="apple" disabled={busy} onPress={() => run(async () => void (await auth.signInWith("apple")))} />
            ) : null}
            {auth.providers.google ? (
              <SocialButton provider="google" disabled={busy} onPress={() => run(async () => void (await auth.signInWith("google")))} />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
              <Text style={{ color: t.ink3, fontSize: 13 }}>ou com e-mail</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
            </View>
          </View>
        ) : null}

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
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 10))}
              placeholder="00000000"
              placeholderTextColor={t.ink3}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              accessibilityLabel="Código de acesso"
              maxLength={10}
              style={[input, { fontSize: 28, letterSpacing: 8, textAlign: "center" }]}
            />
            <MainButton
              label="Entrar"
              disabled={code.length < 6 || busy}
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

/** Botões no padrão das marcas: Apple preto (branco no modo escuro), Google branco com o "G" colorido. */
function SocialButton({ provider, onPress, disabled }: { provider: Provider; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  const dark = useAppearance().scheme === "dark";
  const apple = provider === "apple";
  const bg = apple ? (dark ? "#FFFFFF" : "#000000") : "#FFFFFF";
  const fg = apple ? (dark ? "#000000" : "#FFFFFF") : "#1F1F1F";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: 50,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: apple ? 0 : 1,
        borderColor: t.line,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {apple ? (
        <Svg width={18} height={22} viewBox="0 0 24 24">
          <Path
            fill={fg}
            d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
          />
        </Svg>
      ) : (
        <Svg width={18} height={18} viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </Svg>
      )}
      <Text style={{ color: fg, fontSize: 17, fontWeight: "600" }}>
        {apple ? "Continuar com Apple" : "Continuar com Google"}
      </Text>
    </Pressable>
  );
}
