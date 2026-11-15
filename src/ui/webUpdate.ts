import { Platform } from "react-native";
import { BUILD_ID } from "@/buildId";

/**
 * Na web, o navegador pode estar servindo uma versão antiga do app guardada em cache.
 * Comparamos a versão embutida no bundle com a publicada no servidor.
 * Em caso de dúvida (rede falhou, resposta estranha) respondemos "false":
 * recarregar o app à toa é pior do que não recarregar.
 */
export async function hasNewWebVersion(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    const published = (body as { buildId?: unknown } | null)?.buildId;
    return typeof published === "string" && published.length > 0 && published !== BUILD_ID;
  } catch {
    return false;
  }
}

/** Recarrega o app do servidor, descartando o que estiver em cache. */
export function reloadWebApp(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.location.reload();
}

const RELOAD_GUARD = "finia.reloadedFor";

/**
 * Mantém a versão web em dia sem depender de gesto nenhum (no computador não há
 * "puxar para baixo"). Verifica ao abrir o app e sempre que a aba volta a ficar
 * visível; se houver versão nova, recarrega. Recarregar só nesses momentos evita
 * interromper alguém no meio de uma ação.
 *
 * A trava em sessionStorage impede um ciclo de recarregamentos caso o navegador
 * insista em servir a página antiga: tenta uma vez por versão publicada.
 */
export function watchForWebUpdates(): () => void {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => {};

  const check = async () => {
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const published = ((await res.json()) as { buildId?: unknown })?.buildId;
      if (typeof published !== "string" || !published || published === BUILD_ID) return;
      let tried: string | null = null;
      try {
        tried = sessionStorage.getItem(RELOAD_GUARD);
        sessionStorage.setItem(RELOAD_GUARD, published);
      } catch {
        // Sem sessionStorage (modo privado antigo): recarrega mesmo assim, uma vez por visita.
      }
      if (tried === published) return;
      window.location.reload();
    } catch {
      // Sem rede: tenta de novo na próxima vez que a aba ficar visível.
    }
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void check();
  };
  void check();
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}
