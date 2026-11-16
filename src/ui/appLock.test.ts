import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ AppState: {}, Platform: { OS: "ios" }, Pressable: {}, StyleSheet: {}, Text: {}, View: {} }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("expo-local-authentication", () => ({}));
vi.mock("expo-router", () => ({ router: {} }));
vi.mock("@/data/auth", () => ({ useAuth: () => ({}) }));
vi.mock("./theme", () => ({ useTheme: () => ({}) }));

const { shouldRelock, RELOCK_AFTER_MS } = await import("./appLock");

describe("bloqueio por biometria ao voltar para o app", () => {
  const t0 = 1_000_000;
  it("não bloqueia numa saída rápida (ex.: copiar um código)", () => {
    expect(shouldRelock(t0, t0 + 20_000)).toBe(false);
  });
  it("bloqueia depois de um minuto fora", () => {
    expect(shouldRelock(t0, t0 + RELOCK_AFTER_MS)).toBe(true);
  });
  it("não bloqueia se o app não chegou a sair", () => {
    expect(shouldRelock(null, t0)).toBe(false);
  });
});
