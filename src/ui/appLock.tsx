/**
 * Desbloqueio com Face ID / Touch ID no app do iPhone (como em apps de banco).
 *
 * Com a opção ligada em Ajustes, o app pede biometria ao abrir e ao voltar depois
 * de um tempo em segundo plano. Enquanto o app não está em primeiro plano, uma
 * capa esconde os valores — inclusive na tela de alternar entre apps.
 *
 * Não substitui o login: a sessão do Supabase continua guardada no aparelho; a
 * biometria só libera o acesso a ela. Na web não existe (a biblioteca é só nativa).
 * Se a biometria falhar, o iOS oferece o código do aparelho.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import { useAuth } from "@/data/auth";
import { useTheme } from "./theme";

const KEY = "finia.biometricLock";
/** Volta do segundo plano depois disso: pede biometria de novo. */
export const RELOCK_AFTER_MS = 60_000;

export function shouldRelock(
  backgroundSince: number | null,
  now: number,
): boolean {
  return backgroundSince !== null && now - backgroundSince >= RELOCK_AFTER_MS;
}

interface AppLock {
  /** O aparelho tem biometria cadastrada (só no app nativo). */
  available: boolean;
  enabled: boolean;
  /** "Face ID", "Touch ID" ou "biometria". */
  label: string;
  /** Liga ou desliga. Ligar pede a biometria antes, para confirmar que funciona. Devolve um erro, se houver. */
  setEnabled: (on: boolean) => Promise<string | null>;
}

const Ctx = createContext<AppLock>({
  available: false,
  enabled: false,
  label: "biometria",
  setEnabled: async () => null,
});
export const useAppLock = () => useContext(Ctx);

const native = Platform.OS !== "web";

async function authenticate(label: string): Promise<string | null> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: "Desbloquear o Finia",
    cancelLabel: "Cancelar",
    fallbackLabel: "Usar código",
  });
  if (res.success) return null;
  if (
    res.error === "user_cancel" ||
    res.error === "system_cancel" ||
    res.error === "app_cancel"
  )
    return "cancelado";
  if (res.error === "lockout")
    return `${label} bloqueado por tentativas. Use o código do aparelho.`;
  return `Não foi possível confirmar com ${label}.`;
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { session, signOut } = useAuth();
  const [ready, setReady] = useState(!native);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [label, setLabel] = useState("biometria");
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const backgroundSince = useRef<number | null>(null);
  const prompting = useRef(false);

  // Descobre o que o aparelho oferece e se a opção está ligada.
  useEffect(() => {
    if (!native) return;
    void (async () => {
      try {
        const [hardware, enrolled, types, saved] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
          AsyncStorage.getItem(KEY),
        ]);
        const ok = hardware && enrolled;
        setAvailable(ok);
        setLabel(
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
            ? "Face ID"
            : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
              ? "Touch ID"
              : "biometria",
        );
        const on = ok && saved === "on";
        setEnabledState(on);
        setLocked(on);
      } catch {
        // Sem biometria: o app segue sem bloqueio.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const err = await authenticate(label);
      if (err === null) {
        setLocked(false);
        setMessage(null);
      } else if (err !== "cancelado") {
        setMessage(err);
      }
    } finally {
      prompting.current = false;
    }
  }, [label]);

  // Ao voltar do segundo plano: capa sai, e o bloqueio volta se passou do tempo.
  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (
          enabled &&
          session &&
          shouldRelock(backgroundSince.current, Date.now())
        )
          setLocked(true);
        backgroundSince.current = null;
        setCovered(false);
      } else {
        if (backgroundSince.current === null)
          backgroundSince.current = Date.now();
        if (enabled) setCovered(true);
      }
    });
    return () => sub.remove();
  }, [enabled, session]);

  // Pede a biometria assim que a tela de bloqueio aparece com o app em primeiro plano.
  const mustLock = locked && enabled && !!session;
  useEffect(() => {
    if (mustLock && AppState.currentState === "active") void unlock();
  }, [mustLock, unlock]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (on) {
        const err = await authenticate(label);
        if (err) return err === "cancelado" ? null : err;
      }
      await AsyncStorage.setItem(KEY, on ? "on" : "off");
      setEnabledState(on);
      setLocked(false);
      return null;
    },
    [label],
  );

  const showLock = mustLock || !ready;

  return (
    <Ctx.Provider value={{ available, enabled, label, setEnabled }}>
      {children}
      {showLock || (covered && enabled) ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: t.bg,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              gap: 16,
            },
          ]}
        >
          {showLock && ready ? (
            <>
              <Text style={{ fontSize: 28, fontWeight: "700", color: t.ink }}>
                Finia
              </Text>
              <Text
                style={{ fontSize: 15, color: t.ink2, textAlign: "center" }}
              >
                Bloqueado para proteger seus dados.
              </Text>
              {message ? (
                <Text
                  style={{ fontSize: 14, color: t.neg, textAlign: "center" }}
                >
                  {message}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => void unlock()}
                style={{
                  height: 48,
                  paddingHorizontal: 24,
                  borderRadius: 14,
                  backgroundColor: t.accent,
                  justifyContent: "center",
                  marginTop: 8,
                }}
              >
                <Text
                  style={{ color: t.onAccent, fontSize: 16, fontWeight: "600" }}
                >
                  Desbloquear com {label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLocked(false);
                  void signOut().then(() => router.replace("/entrar"));
                }}
                style={{ padding: 12 }}
              >
                <Text style={{ color: t.accent, fontSize: 15 }}>
                  Entrar com outra conta
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </Ctx.Provider>
  );
}
