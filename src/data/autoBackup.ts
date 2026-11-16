/**
 * Cópia automática: uma por dia, quando o app abre e os dados já carregaram.
 *
 * Quem decide se "já copiou hoje" é a cópia mais recente no banco, não o
 * aparelho: com iPhone, Mac e navegadores diferentes, cada um achava que era o
 * primeiro do dia, e as 7 cópias guardadas cobriam só dois ou três dias.
 *
 * Falha em silêncio de propósito. Se a rede caiu, o usuário não tem nada a
 * fazer a respeito, e a tela de Backup mostra a data da última cópia.
 */
import { supabase } from "./supabase";
import { dueForSnapshot, saveSnapshot } from "./backup";

export async function latestSnapshotAt(): Promise<string | null> {
  const res = await supabase.from("backups").select("created_at").order("created_at", { ascending: false }).limit(1);
  if (res.error) throw new Error(res.error.message);
  return (res.data as { created_at: string }[])[0]?.created_at ?? null;
}

export async function runDailySnapshot(userId: string): Promise<void> {
  try {
    if (!dueForSnapshot(await latestSnapshotAt())) return;
    await saveSnapshot(userId);
  } catch {
    // Sem cópia agora; tenta de novo na próxima abertura.
  }
}
