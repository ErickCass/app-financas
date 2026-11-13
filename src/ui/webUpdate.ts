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
