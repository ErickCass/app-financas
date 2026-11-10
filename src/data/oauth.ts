import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase, supabaseKey, supabaseUrl } from "./supabase";

export type Provider = "google" | "apple";
export type EnabledProviders = Record<Provider, boolean>;

WebBrowser.maybeCompleteAuthSession();

/**
 * Quais provedores estão ligados no painel do Supabase.
 * Os botões só aparecem quando o provedor está ativo, então ligar o Google
 * ou a Apple no painel faz o botão surgir sem publicar uma nova versão.
 */
export async function fetchEnabledProviders(): Promise<EnabledProviders> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
    if (!res.ok) return { google: false, apple: false };
    const data = (await res.json()) as { external?: Record<string, boolean> };
    return { google: Boolean(data.external?.google), apple: Boolean(data.external?.apple) };
  } catch {
    return { google: false, apple: false };
  }
}

/** Erro de retorno do login social no navegador (?error_description=...). */
export function readRedirectError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search || window.location.hash.replace(/^#/, ""));
  const desc = params.get("error_description") ?? params.get("error");
  if (!desc) return null;
  window.history.replaceState(null, "", window.location.pathname);
  return desc;
}

/** Retorna true se entrou, false se a pessoa cancelou. */
export async function signInWithProvider(provider: Provider): Promise<boolean> {
  // Navegador: redireciona a página inteira e o Supabase conclui ao voltar (PKCE).
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return true;
  }

  // iPhone + Apple: folha nativa do sistema (exigência e melhor experiência).
  if (provider === "apple" && Platform.OS === "ios") {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("A Apple não retornou a identificação.");
      const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken });
      if (error) throw error;
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return false;
      throw e;
    }
  }

  // Demais casos no celular: abre a página de login numa sessão segura e volta pelo link do app.
  const redirectTo = Linking.createURL("/");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;
  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  if (!code) throw new Error(url.searchParams.get("error_description") ?? "Login não concluído.");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}
