import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/data/auth";
import { FinanceProvider } from "@/data/store";
import { useTheme } from "@/ui/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <AuthProvider>
      <FinanceProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entrar" />
          <Stack.Screen name="categoria/[id]" />
          <Stack.Screen name="fatura/[id]" />
          <Stack.Screen name="limites" options={{ presentation: "modal" }} />
          <Stack.Screen name="novo" options={{ presentation: "modal" }} />
          <Stack.Screen name="ajustes" />
        </Stack>
      </FinanceProvider>
    </AuthProvider>
  );
}
