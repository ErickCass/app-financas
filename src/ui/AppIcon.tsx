/** O ícone do Finia (o mesmo da tela de início do iPhone), para as telas de entrada. */
import { Image } from "react-native";

export function AppIcon({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/icon.png")}
      accessibilityLabel="Finia"
      style={{ width: size, height: size, borderRadius: size * 0.225 }}
    />
  );
}
