/**
 * Backup e restauração.
 *
 * O backup é uma cópia fiel das linhas do banco, não uma versão resumida:
 * restaurar devolve exatamente o estado anterior, com os mesmos identificadores.
 * Tudo roda no aparelho, protegido por RLS — ninguém além do dono lê os dados.
 */
import { supabase } from "./supabase";

/** Ordem de gravação: cada tabela só entra depois daquelas de que depende. */
export const TABLES = [
  "accounts",
  "categories",
  "recurring_rules",
  "import_batches",
  "budgets",
  "planned",
  "transactions",
  "transaction_splits",
  "classification_rules",
  "alert_settings",
] as const;

export type TableName = (typeof TABLES)[number];

export interface BackupFile {
  app: "finia";
  version: 1;
  exportedAt: string;
  rows: Record<string, Record<string, unknown>[]>;
}

/** Quantas linhas por vez ao gravar: lotes grandes estouram o limite da requisição. */
const CHUNK = 400;

export function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function countRows(file: BackupFile): number {
  return TABLES.reduce((sum, t) => sum + (file.rows[t]?.length ?? 0), 0);
}

/**
 * Confere se o arquivo escolhido é mesmo um backup do Finia antes de tocar no banco.
 * Devolve o arquivo já tipado ou lança com um motivo em português.
 */
export function parseBackupFile(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Este arquivo não é um backup do Finia (não consegui ler o conteúdo).");
  }
  const file = data as Partial<BackupFile>;
  if (file?.app !== "finia") throw new Error("Este arquivo não é um backup do Finia.");
  if (file.version !== 1) throw new Error(`Este backup é da versão ${String(file.version)}, que este app ainda não lê.`);
  if (!file.rows || typeof file.rows !== "object") throw new Error("Backup incompleto: não encontrei os dados.");
  for (const table of TABLES) {
    const rows = file.rows[table];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Backup inválido na tabela ${table}.`);
  }
  return { app: "finia", version: 1, exportedAt: file.exportedAt ?? "", rows: file.rows };
}

/** Troca o dono das linhas: permite restaurar um backup em outra conta. */
export function withOwner(rows: Record<string, unknown>[], userId: string): Record<string, unknown>[] {
  return rows.map((r) => ({ ...r, user_id: userId }));
}

export function backupFileName(exportedAt: string): string {
  const stamp = exportedAt.replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  return `finia-backup-${stamp}.json`;
}

/** Lê todas as linhas do usuário. Páginas de 1000 porque é o teto do PostgREST. */
async function fetchAll(table: TableName): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await supabase.from(table).select("*").range(from, from + 999);
    if (res.error) throw new Error(`Falha ao ler ${table}: ${res.error.message}`);
    const page = (res.data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function buildBackup(): Promise<BackupFile> {
  const rows: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) rows[table] = await fetchAll(table);
  return { app: "finia", version: 1, exportedAt: new Date().toISOString(), rows };
}

/**
 * Restaura sem apagar nada: cada linha é gravada pelo seu identificador.
 * Rodar duas vezes dá o mesmo resultado que rodar uma — ao contrário do script
 * que custou os dados de novembro.
 */
export async function restoreBackup(file: BackupFile, userId: string): Promise<{ restored: number }> {
  let restored = 0;
  for (const table of TABLES) {
    const rows = file.rows[table] ?? [];
    if (rows.length === 0) continue;
    const conflict = table === "alert_settings" ? "user_id" : "id";
    for (const part of chunk(withOwner(rows, userId))) {
      const res = await supabase.from(table).upsert(part, { onConflict: conflict });
      if (res.error) throw new Error(`Falha ao restaurar ${table}: ${res.error.message}`);
      restored += part.length;
    }
  }
  return { restored };
}

/* ------------------------------------------------------------------ *
 * Cópia automática guardada no próprio banco (tabela backups).
 * Serve para o acidente mais provável: um comando ou um toque errado
 * apagando dados. Não substitui o arquivo exportado, que fica com você.
 * ------------------------------------------------------------------ */

export interface SnapshotInfo {
  id: string;
  createdAt: string;
  rowCount: number;
}

/** Guarda uma cópia. Nunca grava cópia vazia por cima de um histórico bom. */
export async function saveSnapshot(userId: string): Promise<SnapshotInfo | null> {
  const file = await buildBackup();
  const rowCount = countRows(file);
  if (rowCount === 0) return null;
  const res = await supabase
    .from("backups")
    .insert({ user_id: userId, row_count: rowCount, payload: file })
    .select("id, created_at, row_count")
    .single();
  if (res.error) throw new Error(`Falha ao guardar a cópia: ${res.error.message}`);
  const row = res.data as { id: string; created_at: string; row_count: number };
  return { id: row.id, createdAt: row.created_at, rowCount: row.row_count };
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const res = await supabase.from("backups").select("id, created_at, row_count").order("created_at", { ascending: false });
  if (res.error) throw new Error(`Falha ao listar as cópias: ${res.error.message}`);
  return (res.data as { id: string; created_at: string; row_count: number }[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    rowCount: r.row_count,
  }));
}

export async function fetchSnapshot(id: string): Promise<BackupFile> {
  const res = await supabase.from("backups").select("payload").eq("id", id).single();
  if (res.error) throw new Error(`Falha ao ler a cópia: ${res.error.message}`);
  return parseBackupFile(JSON.stringify((res.data as { payload: unknown }).payload));
}

/** Decide se já passou um dia desde a última cópia. */
export function dueForSnapshot(lastAt: string | null, now = new Date()): boolean {
  if (!lastAt) return true;
  const last = new Date(lastAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= 20 * 60 * 60 * 1000;
}
