import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "./theme";

/**
 * Campo de valor em reais. Guarda centavos inteiros: o usuário digita só números
 * e o campo preenche da direita para a esquerda ("8610" -> "86,10"), como apps de banco.
 */
export function MoneyInput({
  cents,
  onChangeCents,
  style,
  ...rest
}: { cents: number; onChangeCents: (c: number) => void } & Omit<TextInputProps, "value" | "onChangeText">) {
  const t = useTheme();
  const text = (Math.abs(cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <TextInput
      value={cents === 0 ? "" : text}
      placeholder="0,00"
      placeholderTextColor={t.ink3}
      keyboardType="number-pad"
      inputMode="numeric"
      onChangeText={(v) => {
        const digits = v.replace(/\D/g, "").slice(0, 12);
        onChangeCents(digits ? Number(digits) : 0);
      }}
      style={[{ color: t.ink, fontVariant: ["tabular-nums"] }, style]}
      {...rest}
    />
  );
}
