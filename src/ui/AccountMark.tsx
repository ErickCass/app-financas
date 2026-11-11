import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { Account } from "@/domain/types";

/**
 * Miniatura da conta: um cartãozinho na cor do cartão (com o final do número)
 * ou um ícone de banco para conta corrente. A cor é escolhida pelo usuário em
 * Ajustes; sem escolha, vem de uma paleta pelo nome do banco.
 */
export const ACCOUNT_COLORS = ["#820AD1", "#EC7000", "#1D1D1F", "#1A3C8E", "#0E4A5C", "#B42318", "#047857", "#6B7280"];

export function accountColor(a: Pick<Account, "name" | "kind" | "color">): string {
  if (a.color) return a.color;
  const n = a.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (n.includes("nubank") || n.includes("nu ")) return "#820AD1";
  if (n.includes("itau")) return "#EC7000";
  if (n.includes("latam") || n.includes("black") || n.includes("infinite")) return "#1D1D1F";
  if (n.includes("inter")) return "#FF7A00";
  if (n.includes("bradesco")) return "#CC092F";
  if (n.includes("santander")) return "#EC0000";
  if (n.includes("c6")) return "#1D1D1F";
  if (n.includes("xp")) return "#1D1D1F";
  return a.kind === "credit_card" ? "#1A3C8E" : "#0E4A5C";
}

export function AccountMark({ account, size = 28 }: { account: Pick<Account, "name" | "kind" | "color" | "last4">; size?: number }) {
  const color = accountColor(account);
  if (account.kind === "credit_card") {
    const w = size;
    const h = Math.round(size * 0.66);
    return (
      <View accessibilityLabel={account.name} style={{ width: w, height: h, borderRadius: Math.round(h * 0.2), backgroundColor: color, overflow: "hidden", justifyContent: "flex-end" }}>
        {/* chip e final do cartão: o bastante para reconhecer de relance */}
        <View style={{ position: "absolute", left: Math.round(w * 0.12), top: Math.round(h * 0.22), width: Math.round(w * 0.2), height: Math.round(h * 0.26), borderRadius: 2, backgroundColor: "rgba(255,255,255,0.75)" }} />
        {account.last4 ? (
          <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: Math.max(6, Math.round(size * 0.22)), fontWeight: "700", textAlign: "right", paddingRight: 3, paddingBottom: 1, fontVariant: ["tabular-nums"] }}>
            {account.last4}
          </Text>
        ) : null}
      </View>
    );
  }
  const s = Math.round(size * 0.78);
  return (
    <View accessibilityLabel={account.name} style={{ width: size, height: Math.round(size * 0.66), alignItems: "center", justifyContent: "center" }}>
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path d="M3 9.5 12 4l9 5.5v1H3z" fill={color} />
        <Rect x="5" y="11" width="2.4" height="7" fill={color} />
        <Rect x="10.8" y="11" width="2.4" height="7" fill={color} />
        <Rect x="16.6" y="11" width="2.4" height="7" fill={color} />
        <Rect x="3" y="18.5" width="18" height="2" rx="0.6" fill={color} />
      </Svg>
    </View>
  );
}
