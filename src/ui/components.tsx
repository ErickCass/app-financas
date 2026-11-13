import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme";
import { useFinance } from "@/data/store";
import { PullIndicator, usePullToRefresh } from "./pullToRefresh";

/**
 * Tela rolável com largura máxima no computador (versão web).
 * Puxar para baixo no topo recarrega os dados (ver usePullToRefresh).
 * `refreshable={false}` para telas que não dependem dos dados, como a de entrar.
 */
export function Screen({
  children,
  title,
  right,
  refreshable = true,
}: {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  refreshable?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { reload } = useFinance();
  const { refreshing, pull, scrollProps } = usePullToRefresh(reload, refreshable);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 16 }]}
      {...scrollProps}
    >
      <PullIndicator refreshing={refreshing} pull={pull} />
      <View style={styles.column}>
        {title ? (
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.largeTitle, { color: t.ink }]}>
              {title}
            </Text>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.ink }]}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/**
 * Barra de progresso do orçamento.
 * fill = quanto já foi gasto (0..1); marker = onde você costuma estar hoje (0..1).
 */
export function ProgressBar({
  fill,
  color,
  marker,
  height = 10,
  segments,
}: {
  fill?: number;
  color?: string;
  marker?: number;
  height?: number;
  segments?: { value: number; color: string }[];
}) {
  const t = useTheme();
  const parts = segments ?? [{ value: fill ?? 0, color: color ?? t.accent }];
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.track, flexDirection: "row", gap: segments ? 2 : 0 }}>
      {parts.map((p, i) => (
        <View
          key={i}
          style={{
            width: `${Math.min(Math.max(p.value, 0), 1) * 100}%`,
            backgroundColor: p.color,
            borderRadius: height / 2,
          }}
        />
      ))}
      {marker !== undefined ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: "absolute",
            left: `${Math.min(Math.max(marker, 0), 1) * 100}%`,
            top: -3,
            width: 3,
            height: height + 6,
            borderRadius: 2,
            backgroundColor: t.ink,
            borderWidth: 1,
            borderColor: t.card,
            marginLeft: -1.5,
          }}
        />
      ) : null}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line }} />;
}

export function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, soft }: { label: string; onPress?: () => void; soft?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: soft ? t.accentSoft : t.accent, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ color: soft ? t.accent : t.onAccent, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingBottom: 40, alignItems: "center" },
  column: { width: "100%", maxWidth: 680, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 4 },
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  card: {
    borderRadius: 22,
    padding: 20,
    gap: 12,
    ...(Platform.OS === "web" ? {} : {}),
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4, paddingTop: 6 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  button: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
