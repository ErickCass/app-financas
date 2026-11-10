import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { FinanceProvider } from "@/data/store";
import { useTheme } from "@/ui/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <FinanceProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="categoria/[id]" />
        <Stack.Screen name="fatura/[id]" />
      </Stack>
    </FinanceProvider>
  );
}
