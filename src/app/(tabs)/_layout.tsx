import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { BudgetIcon, HomeIcon, ListIcon, SparkIcon } from "@/ui/icons";
import { useTheme } from "@/ui/theme";

export default function TabsLayout() {
  const t = useTheme();
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
