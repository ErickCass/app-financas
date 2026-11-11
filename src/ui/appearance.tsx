import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppearanceMode = "auto" | "light" | "dark";
const KEY = "appearance";

const Ctx = createContext<{ mode: AppearanceMode; scheme: "light" | "dark"; setMode: (m: AppearanceMode) => void }>({
  mode: "auto",
  scheme: "light",
  setMode: () => {},
});

/** Tema claro/escuro: segue o sistema, ou o que a pessoa escolher em Ajustes (guardado no aparelho). */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() ?? "light";
  const [mode, setModeState] = useState<AppearanceMode>("auto");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "auto") setModeState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      mode,
      scheme: mode === "auto" ? system : mode,
      setMode: (m: AppearanceMode) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
        // No celular, muda também a barra de status e os componentes nativos.
        Appearance.setColorScheme?.(m === "auto" ? "unspecified" : m);
      },
    }),
    [mode, system],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppearance = () => useContext(Ctx);
