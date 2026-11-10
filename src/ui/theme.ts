import { useColorScheme } from "react-native";
import type { PaceStatus } from "@/domain/budget";

const light = {
  bg: "#F2F2F7",
  card: "#FFFFFF",
  ink: "#1C1C1E",
  ink2: "#636366",
  ink3: "#AEAEB2",
  line: "#E5E5EA",
  track: "#ECECF0",
  accent: "#0E4A5C",
  accentSoft: "#E3EEF1",
  onAccent: "#FFFFFF",
  pos: "#1E7A46",
  neg: "#C2410C",
  negSoft: "#F6C9B4",
  posSoft: "#B7DEC6",
  tabBg: "#F9F9FB",
};

const dark: typeof light = {
  bg: "#0A0B0D",
  card: "#16181C",
  ink: "#F5F5F7",
  ink2: "#A1A1A8",
  ink3: "#6C6C72",
  line: "#2A2D33",
  track: "#22252A",
  accent: "#D6B77F",
  accentSoft: "#2E2A22",
  onAccent: "#14120E",
  pos: "#5CCB8A",
  neg: "#FF8F66",
  negSoft: "#5A3326",
  posSoft: "#25503A",
  tabBg: "#101114",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

/** As quatro cores do orçamento, iguais nos dois temas. */
export const STATUS_COLOR: Record<PaceStatus, string> = {
  sobra: "#2E9E5B",
  ritmo: "#2F6FD6",
  vai: "#E8B10C",
  estourou: "#D23B2A",
  semlimite: "#8E8E93",
};

export const STATUS_LABEL: Record<PaceStatus, string> = {
  sobra: "Vai sobrar",
  ritmo: "No ritmo",
  vai: "Vai estourar",
  estourou: "Estourou",
  semlimite: "Sem limite",
};

export const font = {
  rounded: { fontFamily: undefined as string | undefined, fontVariant: ["tabular-nums"] as ("tabular-nums")[] },
};
