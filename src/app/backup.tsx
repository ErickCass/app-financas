/**
 * Backup: exportar um arquivo, restaurar a partir dele e ver as cópias
 * automáticas guardadas no banco.
 *
 * Restaurar não apaga nada: cada linha volta pelo seu identificador, então
 * restaurar duas vezes dá o mesmo resultado que restaurar uma.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/data/auth";
import { useFinance } from "@/data/store";
import {
  buildBackup,
  countRows,
  fetchSnapshot,
  listSnapshots,
  parseBackupFile,
  restoreBackup,
  saveSnapshot,
  type SnapshotInfo,
} from "@/data/backup";
import { pickBackupFile, saveBackupFile } from "@/data/backupFile";
import { Card, PrimaryButton, Screen, SectionTitle } from "@/ui/components";
import { NavBar } from "@/ui/NavBar";
import { useTheme } from "@/ui/theme";

const whenText = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function Backup() {
  const t = useTheme();
  const auth = useAuth();
  const f = useFinance();
  const userId = auth.session?.user.id ?? null;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ label: string; run: () => Promise<string> } | null>(null);

  const refreshSnapshots = useCallback(async () => {
    try {
      // Com o aparelho sem rede a consulta pode ficar pendurada; 15s e desistimos.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("A consulta demorou demais. Verifique a conexão.")), 15_000),
      );
      setSnapshots(await Promise.race([listSnapshots(), timeout]));
      setSnapshotsError(null);
    } catch (e) {
      setSnapshots([]);
      setSnapshotsError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Busca assíncrona: o estado só muda quando a resposta chega.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!f.isDemo && userId) void refreshSnapshots();
  }, [f.isDemo, userId, refreshSnapshots]);

  const run = async (label: string, task: () => Promise<string>) => {
    setBusy(label);
    setError(null);
    setDone(null);
    try {
      setDone(await task());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const exportNow = () =>
    run("exportar", async () => {
      const file = await buildBackup();
      await saveBackupFile(file);
      return `Backup com ${countRows(file)} registros pronto.`;
    });

  const copyNow = () =>
    run("copiar", async () => {
      if (!userId) throw new Error("Entre com sua conta.");
      const snap = await saveSnapshot(userId);
      await refreshSnapshots();
      return snap ? `Cópia guardada com ${snap.rowCount} registros.` : "Não há nada para copiar ainda.";
    });

  const restoreFromFile = async () => {
    setError(null);
    setDone(null);
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      const file = parseBackupFile(picked.text);
      const total = countRows(file);
      setConfirm({
        label: `Restaurar ${total} registros do arquivo ${picked.name}${file.exportedAt ? `, de ${whenText(file.exportedAt)}` : ""}?`,
        run: async () => {
          if (!userId) throw new Error("Entre com sua conta.");
          const { restored } = await restoreBackup(file, userId);
          await f.reload();
          return `${restored} registros restaurados.`;
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const restoreSnapshot = (snap: SnapshotInfo) =>
    setConfirm({
      label: `Restaurar a cópia de ${whenText(snap.createdAt)}, com ${snap.rowCount} registros?`,
      run: async () => {
        if (!userId) throw new Error("Entre com sua conta.");
        const file = await fetchSnapshot(snap.id);
        const { restored } = await restoreBackup(file, userId);
        await f.reload();
        return `${restored} registros restaurados.`;
      },
    });

  if (f.isDemo || !userId) {
    return (
      <Screen>
        <NavBar back="Ajustes" />
        <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, paddingHorizontal: 4 }}>
          Backup
        </Text>
        <Card>
          <Text style={{ color: t.ink2, lineHeight: 20 }}>
            {f.isDemo
              ? "No modo demonstração nada é salvo, então não há o que copiar. Entre com sua conta para usar o backup."
              : "Entre com sua conta para exportar ou restaurar seus dados."}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar back="Ajustes" />
      <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "700", color: t.ink, paddingHorizontal: 4 }}>
        Backup
      </Text>

      <Text style={{ fontSize: 13, color: t.ink2, paddingHorizontal: 4, lineHeight: 18 }}>
        O arquivo exportado fica com você e serve para restaurar tudo, inclusive em outra conta. As cópias automáticas são
        guardadas uma vez por dia, dentro do seu banco.
      </Text>

      {confirm ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, color: t.ink, lineHeight: 22 }}>{confirm.label}</Text>
          <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
            Nada é apagado: os registros do backup voltam, e o que você criou depois continua onde está.
          </Text>
          <PrimaryButton
            label="Restaurar"
            onPress={() => {
              const task = confirm.run;
              setConfirm(null);
              void run("restaurar", task);
            }}
          />
          <PrimaryButton label="Cancelar" soft onPress={() => setConfirm(null)} />
        </Card>
      ) : null}

      {done ? <Text style={{ color: t.pos, paddingHorizontal: 4, lineHeight: 20 }}>{done}</Text> : null}
      {error ? <Text style={{ color: t.neg, paddingHorizontal: 4, lineHeight: 20 }}>{error}</Text> : null}

      <SectionTitle>Arquivo</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
          Guarde o arquivo onde você confia: iCloud, Google Drive ou o próprio computador.
        </Text>
        <PrimaryButton label={busy === "exportar" ? "Preparando…" : "Baixar backup agora"} onPress={busy ? undefined : exportNow} />
        <PrimaryButton label="Restaurar de um arquivo" soft onPress={busy ? undefined : restoreFromFile} />
      </Card>

      <SectionTitle>Cópias automáticas</SectionTitle>
      <Card style={{ gap: 12 }}>
        {snapshots === null ? (
          <ActivityIndicator color={t.ink3} />
        ) : snapshotsError ? (
          <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
            As cópias automáticas ainda não estão ativas neste banco. Rode a migração 20261114000000_backups.sql no Supabase
            para ligá-las.
          </Text>
        ) : snapshots.length === 0 ? (
          <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>Nenhuma cópia ainda. A primeira é feita hoje.</Text>
        ) : (
          snapshots.map((s, i) => (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: i < snapshots.length - 1 ? 12 : 0,
                borderBottomWidth: i < snapshots.length - 1 ? 1 : 0,
                borderBottomColor: t.line,
              }}
            >
              <View>
                <Text style={{ fontSize: 16, color: t.ink }}>{whenText(s.createdAt)}</Text>
                <Text style={{ fontSize: 12, color: t.ink2 }}>{s.rowCount} registros</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => restoreSnapshot(s)} disabled={!!busy}>
                <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>Restaurar</Text>
              </Pressable>
            </View>
          ))
        )}
        <PrimaryButton label={busy === "copiar" ? "Copiando…" : "Copiar agora"} soft onPress={busy ? undefined : copyNow} />
      </Card>

      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 16 }}>
        <Text style={{ color: t.accent, fontSize: 16 }}>Voltar aos ajustes</Text>
      </Pressable>
    </Screen>
  );
}
