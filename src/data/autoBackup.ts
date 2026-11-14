/**
 * Cópia automática: uma vez por dia, quando o app abre e os dados já carregaram.
 *
 * Falha em silêncio de propósito. Se a tabela ainda não existe ou a rede caiu,
 * o usuário não tem nada a fazer a respeito — e um alerta sobre backup assusta
 * sem motivo. O estado real aparece na tela de Backup.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dueForSnapshot, saveSnapshot } from "./backup";

const KEY = "finia.lastSnapshotAt";

export async function lastSnapshotAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function runDailySnapshot(userId: string): Promise<void> {
  try {
    const last = await lastSnapshotAt();
    if (!dueForSnapshot(last)) return;
    const snap = await saveSnapshot(userId);
    if (snap) await AsyncStorage.setItem(KEY, snap.createdAt);
  } catch {
    // Sem backup hoje. A tela de Backup mostra a data da última cópia.
  }
}
