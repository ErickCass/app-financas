/**
 * Levar o backup para fora do app: baixar no computador, salvar/compartilhar no
 * iPhone, e escolher um arquivo para restaurar.
 */
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { backupFileName, type BackupFile } from "./backup";

/** Entrega o arquivo ao usuário. Na web baixa; no iPhone abre o menu de compartilhar. */
export async function saveBackupFile(file: BackupFile): Promise<void> {
  const name = backupFileName(file.exportedAt);
  const text = JSON.stringify(file);

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sem o adiamento o Safari cancela o download ao liberar o endereço.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  const FileSystem = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const path = `${FileSystem.Paths.cache.uri}${name}`;
  const target = new FileSystem.File(path);
  target.create({ overwrite: true });
  target.write(text);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Backup do Finia" });
  }
}

export async function pickBackupFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return { name: asset.name, text: new TextDecoder("utf-8").decode(new Uint8Array(buffer)) };
}
