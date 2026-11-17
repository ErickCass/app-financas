/**
 * Entrar com Face ID / Touch ID no app do iPhone, como em apps de banco.
 *
 * Com a opção ligada em Ajustes, abrir o Finia do zero mostra a tela de entrada
 * com "Entrar com Face ID". Voltar ao app depois de um tempo em segundo plano NÃO
 * pede de novo: só a abertura do app.
 *
 * A sessão do Supabase continua guardada no aparelho; a biometria é o que libera a
 * entrada nela. "Entrar com outra conta" encerra a sessão e volta ao login por
 * código. Se a biometria falhar, o iOS oferece o código do aparelho. Não existe na
 * web (a biblioteca é só nativa).
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

interface FaceLogin {
  /** O aparelho tem biometria cadastrada (só no app nativo). */
  available: boolean;
  enabled: boolean;
  /** "Face ID", "Touch ID" ou "biometria". */
  label: string;
  /** Liga ou desliga. Ligar pede a biometria antes, para confirmar que funciona. Devolve um erro, se houver. */
  setEnabled: (on: boolean) => Promise<string | null>;
  /** "Sair" com Face ID ligado: volta para a tela de entrada sem apagar a sessão. */
  lockNow: () => void;
}

const Ctx = createContext<FaceLogin>({
  available: false,
  enabled: false,
  label: "biometria",
  setEnabled: async () => null,
  lockNow: () => {},
});
export const useAppLock = () => useContext(Ctx);

const native = Platform.OS !== "web";

async function authenticate(
  label: string,
  prompt: string,
): Promise<string | null> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
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
  const { session, email, signOut } = useAuth();
  const [ready, setReady] = useState(!native);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [label, setLabel] = useState("biometria");
  // Só a abertura do app pede a entrada; depois de entrar, fica liberado até o app ser fechado.
  const [mustEnter, setMustEnter] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const prompting = useRef(false);

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
        setMustEnter(on);
      } catch {
        // Sem biometria: o app segue sem a tela de entrada.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const enter = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const err = await authenticate(label, "Entrar no Finia");
      if (err === null) {
        setMustEnter(false);
        setMessage(null);
      } else if (err !== "cancelado") {
        setMessage(err);
      }
    } finally {
      prompting.current = false;
    }
  }, [label]);

  const showEntry = (mustEnter && enabled && !!session) || !ready;

  // Pede a biometria assim que a tela de entrada aparece com o app em primeiro plano.
  useEffect(() => {
    if (!showEntry || !ready) return;
    if (AppState.currentState === "active") void enter();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void enter();
    });
    return () => sub.remove();
  }, [showEntry, ready, enter]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (on) {
        const err = await authenticate(label, `Ativar entrada com ${label}`);
        if (err) return err === "cancelado" ? null : err;
      }
      await AsyncStorage.setItem(KEY, on ? "on" : "off");
      setEnabledState(on);
      return null;
    },
    [label],
  );

  return (
    <Ctx.Provider
      value={{
        available,
        enabled,
        label,
        setEnabled,
        lockNow: () => setMustEnter(true),
      }}
    >
      {children}
      {showEntry ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: t.bg,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              gap: 14,
            },
          ]}
        >
          {ready ? (
            <>
              <Text style={{ fontSize: 34, fontWeight: "700", color: t.ink }}>
                Finia
              </Text>
              {email ? (
                <Text
                  style={{ fontSize: 15, color: t.ink2, textAlign: "center" }}
                >
                  {email}
                </Text>
              ) : null}
              {message ? (
                <Text
                  style={{ fontSize: 14, color: t.neg, textAlign: "center" }}
                >
                  {message}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => void enter()}
                style={{
                  height: 50,
                  alignSelf: "stretch",
                  maxWidth: 360,
                  borderRadius: 14,
                  backgroundColor: t.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 12,
                }}
              >
                <Text
                  style={{ color: t.onAccent, fontSize: 17, fontWeight: "600" }}
                >
                  Entrar com {label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMustEnter(false);
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
