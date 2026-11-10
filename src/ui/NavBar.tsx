import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "./icons";
import { useTheme } from "./theme";

/** Barra de navegação de telas internas: "‹ Voltar" à esquerda e uma ação à direita. */
export function NavBar({ back, right }: { back: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voltar para ${back}`}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 44 }}
      >
        <ChevronLeft color={t.accent} />
        <Text style={{ color: t.accent, fontSize: 17 }}>{back}</Text>
      </Pressable>
      {right}
    </View>
  );
}
