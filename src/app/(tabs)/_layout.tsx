import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/data/auth";
import { useFinance } from "@/data/store";
import { BudgetIcon, HomeIcon, ListIcon, SparkIcon } from "@/ui/icons";
import { useTheme } from "@/ui/theme";

export default function TabsLayout() {
  const t = useTheme();
  const auth = useAuth();
  const f = useFinance();
  if (auth.mode === "signed_out") return <Redirect href="/entrar" />;
  if (auth.mode === "loading" || (f.status === "loading" && !f.categories.length)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  if (f.status === "error" && !f.categories.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg, padding: 32, gap: 16 }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: t.ink, textAlign: "center" }}>Não foi possível carregar seus dados</Text>
        <Text style={{ fontSize: 14, color: t.ink2, textAlign: "center" }}>{f.error}</Text>
        <Pressable accessibilityRole="button" onPress={() => void f.reload()} style={{ height: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: t.accent, justifyContent: "center" }}>
          <Text style={{ color: t.onAccent, fontWeight: "600" }}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.ink2,
        tabBarStyle: {
          backgroundColor: t.tabBg,
          borderTopColor: t.line,
          ...(Platform.OS === "web" ? { height: 60 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ color }) => <HomeIcon color={String(color)} /> }} />
      <Tabs.Screen name="orcamento" options={{ title: "Orçamento", tabBarIcon: ({ color }) => <BudgetIcon color={String(color)} /> }} />
      <Tabs.Screen name="lancamentos" options={{ title: "Lançamentos", tabBarIcon: ({ color }) => <ListIcon color={String(color)} /> }} />
      <Tabs.Screen name="assistente" options={{ title: "Assistente", tabBarIcon: ({ color }) => <SparkIcon color={String(color)} /> }} />
    </Tabs>
  );
}
