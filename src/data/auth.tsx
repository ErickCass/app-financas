import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { fetchEnabledProviders, signInWithProvider, type EnabledProviders, type Provider } from "./oauth";

type Mode = "loading" | "signed_out" | "signed_in" | "demo";

interface AuthValue {
  mode: Mode;
  session: Session | null;
  email: string | null;
  /** Provedores sociais ativos no Supabase (Google, Apple). */
  providers: EnabledProviders;
  /** Envia um código de acesso para o e-mail. */
  sendCode(email: string): Promise<void>;
  /** Login com Google ou Apple. Retorna false se a pessoa cancelou. */
  signInWith(provider: Provider): Promise<boolean>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  enterDemo(): void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<Mode>(supabaseConfigured ? "loading" : "demo");
  const [providers, setProviders] = useState<EnabledProviders>({ google: false, apple: false });

  useEffect(() => {
    if (supabaseConfigured) fetchEnabledProviders().then(setProviders);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setMode(data.session ? "signed_in" : "signed_out");
      })
      .catch(() => setMode("signed_out"));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setMode((m) => (s ? "signed_in" : m === "demo" ? "demo" : "signed_out"));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      mode,
      session,
      email: session?.user.email ?? null,
      providers,
      async signInWith(provider) {
        try {
          return await signInWithProvider(provider);
        } catch (e) {
          throw new Error(translateAuthError(e instanceof Error ? e.message : String(e)));
        }
      },
      async sendCode(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true },
        });
        if (error) throw new Error(translateAuthError(error.message));
      },
      async verifyCode(email, code) {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code.trim(),
          type: "email",
        });
        if (error) throw new Error(translateAuthError(error.message));
      },
      async signOut() {
        if (mode === "demo") {
          setMode(supabaseConfigured ? "signed_out" : "demo");
          return;
        }
        // Encerra a sessão local na hora; o servidor é avisado em seguida (sem travar se a rede falhar).
        setSession(null);
        setMode("signed_out");
        try {
          await supabase.auth.signOut({ scope: "local" });
          void supabase.auth.signOut().catch(() => {});
        } catch {
          /* sessão local já foi limpa */
        }
      },
      enterDemo() {
        setMode("demo");
      },
    }),
    [mode, session, providers],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "Esse tipo de login ainda não foi ativado.";
  if (m.includes("access_denied") || m.includes("cancel")) return "Login cancelado.";
  if (m.includes("expired") || m.includes("invalid")) return "Código inválido ou expirado. Peça um novo código.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("email")) return "Confira o e-mail digitado.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique a internet.";
  return "Não foi possível entrar agora. Tente de novo.";
}
