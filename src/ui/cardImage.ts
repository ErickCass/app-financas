/**
 * Escolhe uma imagem do aparelho e a reduz para uma miniatura de cartão
 * (até 200 px de largura, JPEG), devolvida como data URL para guardar na conta.
 */
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";

const MAX_W = 200;
const MAX_BYTES = 120_000;

export async function pickCardImage(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    return shrinkOnWeb(blob);
  }
  // No celular, sem redimensionar: só aceita imagem já pequena.
  const buf = await (await fetch(asset.uri)).arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("Imagem grande demais. Use uma de até 120 KB ou faça pelo site, que reduz sozinho.");
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return `data:${asset.mimeType ?? "image/jpeg"};base64,${btoa(bin)}`;
}

function shrinkOnWeb(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      // PNG preserva cantos transparentes de recortes; JPEG fica menor para fotos.
      const png = canvas.toDataURL("image/png");
      const jpg = canvas.toDataURL("image/jpeg", 0.82);
      resolve(blob.type === "image/png" && png.length < MAX_BYTES * 1.4 ? png : jpg);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui abrir essa imagem."));
    };
    img.src = url;
  });
}
