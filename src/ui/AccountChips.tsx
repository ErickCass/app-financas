/**
 * Filtro por conta ou cartão. Um botão "Todas as contas ▾" que abre as contas em
 * grade: ocupa o mesmo espaço com 2 ou com 20 cartões, e funciona igual ao filtro
 * de categoria. Só aparece quando há mais de uma conta para escolher.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Account } from "@/domain/types";
import { AccountMark } from "./AccountMark";
import { Card } from "./components";
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
  const [open, setOpen] = useState(false);
  if (accounts.length < 2) return null;
  const current = accounts.find((a) => a.id === value);
  const pick = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Filtrar por conta: ${current?.name ?? "todas as contas"}`}
        onPress={() => setOpen((o) => !o)}
        style={{
          height: 38,
          borderRadius: 10,
          paddingLeft: current ? 6 : 12,
          paddingRight: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: current ? t.accentSoft : t.card,
          borderWidth: 1,
          borderColor: current ? t.accent : t.line,
        }}
      >
        {current ? <AccountMark account={current} size={24} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: current ? t.accent : t.ink }}>
          {current?.name ?? "Todas as contas"}
        </Text>
        <Text style={{ fontSize: 12, color: t.ink3 }}>{open ? "▴" : "▾"}</Text>
      </Pressable>

      {open ? (
        <Card style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[undefined, ...accounts].map((a) => {
            const on = a?.id === value;
            return (
              <Pressable
                key={a?.id ?? "todas"}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => pick(a?.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  height: 36,
                  paddingLeft: a ? 6 : 14,
                  paddingRight: 12,
                  borderRadius: 18,
                  backgroundColor: on ? t.accent : t.track,
                }}
              >
                {a ? <AccountMark account={a} size={24} /> : null}
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: on ? t.onAccent : t.ink }}>
                  {a ? a.name : "Todas as contas"}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}
