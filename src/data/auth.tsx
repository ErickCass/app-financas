import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";

type Mode = "loading" | "signed_out" | "signed_in" | "demo";

interface AuthValue {
  mode: Mode;
  session: Session | null;
  email: string | null;
  /** Envia um código de 6 dígitos para o e-mail. */
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  enterDemo(): void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<Mode>(supabaseConfigured ? "loading" : "demo");

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
        await supabase.auth.signOut();
      },
      enterDemo() {
        setMode("demo");
      },
    }),
    [mode, session],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("expired") || m.includes("invalid")) return "Código inválido ou expirado. Peça um novo código.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("email")) return "Confira o e-mail digitado.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique a internet.";
  return "Não foi possível entrar agora. Tente de novo.";
}
