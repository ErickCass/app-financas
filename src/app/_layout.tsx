import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/data/auth";
import { FinanceProvider } from "@/data/store";
import { useTheme } from "@/ui/theme";
import { AppearanceProvider, useAppearance } from "@/ui/appearance";

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <Shell />
    </AppearanceProvider>
  );
}

function Shell() {
  const t = useTheme();
  const { scheme } = useAppearance();
  return (
    <AuthProvider>
      <FinanceProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entrar" />
          <Stack.Screen name="categoria/[id]" />
          <Stack.Screen name="fatura/[id]" />
          <Stack.Screen name="limites" options={{ presentation: "modal" }} />
          <Stack.Screen name="novo" options={{ presentation: "modal" }} />
          <Stack.Screen name="importar" options={{ presentation: "modal" }} />
          <Stack.Screen name="classificar" />
          <Stack.Screen name="fluxo" />
          <Stack.Screen name="plano" options={{ presentation: "modal" }} />
          <Stack.Screen name="previsto" options={{ presentation: "modal" }} />
          <Stack.Screen name="ajustes" />
        </Stack>
      </FinanceProvider>
    </AuthProvider>
  );
}
