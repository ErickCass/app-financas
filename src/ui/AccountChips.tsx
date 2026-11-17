/** Filtro por conta ou cartão: "Todas as contas" + as que tiveram lançamento no mês. Igual em todas as telas. */
import { Pressable, ScrollView, Text } from "react-native";
import type { Account } from "@/domain/types";
import { AccountMark } from "./AccountMark";
import { useTheme } from "./theme";

export function AccountChips({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const t = useTheme();
  if (accounts.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
      {[undefined, ...accounts].map((a) => {
        const on = a?.id === value;
        return (
          <Pressable
            key={a?.id ?? "todas"}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(a?.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 34,
              paddingLeft: a ? 6 : 14,
              paddingRight: 12,
              borderRadius: 17,
              backgroundColor: on ? t.accent : t.card,
              borderWidth: 1,
              borderColor: on ? t.accent : t.line,
            }}
          >
            {a ? <AccountMark account={a} size={22} /> : null}
            <Text style={{ fontSize: 14, fontWeight: "600", color: on ? t.onAccent : t.ink }} numberOfLines={1}>
              {a ? a.name : "Todas as contas"}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
