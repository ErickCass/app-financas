import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { hasNewWebVersion, reloadWebApp } from "./webUpdate";
import { useTheme } from "./theme";

/**
 * Posição vertical do dedo. Na web o evento do navegador traz a coordenada
 * dentro da lista de toques; o campo direto do evento vem vazio.
 */
function fingerY(e: GestureResponderEvent): number | null {
  const n = e.nativeEvent as unknown as {
    pageY?: number;
    touches?: { pageY?: number }[];
    changedTouches?: { pageY?: number }[];
  };
  const y = n.touches?.[0]?.pageY ?? n.changedTouches?.[0]?.pageY ?? n.pageY;
  return typeof y === "number" && Number.isFinite(y) ? y : null;
}

/** Quanto é preciso arrastar para disparar a atualização. */
const THRESHOLD = 64;
/** Limite do quanto o conteúdo desce enquanto se arrasta. */
const MAX_PULL = 96;
/** O conteúdo acompanha o dedo pela metade: dá a sensação de resistência. */
const DAMPING = 0.5;

/**
 * Puxar para atualizar.
 *
 * No iPhone nativo usamos o RefreshControl do sistema. Na web ele não existe
 * (o React Native Web o substitui por um componente vazio), então detectamos
 * o gesto na mão: só vale quando a lista já está no topo.
 *
 * Em qualquer plataforma o gesto recarrega os dados. Na web ele também verifica
 * se há uma versão nova publicada e, nesse caso, recarrega o app — assim o mesmo
 * gesto resolve as duas coisas, sem botão de "atualizar" em lugar nenhum.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true) {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const atTop = useRef(true);
  const startY = useRef<number | null>(null);
  // O quanto já foi arrastado, também em ref: o React Native Web pode manter o
  // manipulador de toque registrado de uma renderização anterior, e aí o valor
  // lido do estado chegaria desatualizado (zero) justo na hora de soltar o dedo.
  const pullNow = useRef(0);

  const setPullTo = useCallback((value: number) => {
    pullNow.current = value;
    setPull(value);
  }, []);

  const run = useCallback(async () => {
    if (!enabled || refreshing) return;
    setRefreshing(true);
    try {
      if (await hasNewWebVersion()) {
        reloadWebApp();
        return;
      }
      await onRefresh();
    } catch {
      // Falha de rede não precisa de alarme: o gesto pode ser repetido.
    } finally {
      setRefreshing(false);
      setPullTo(0);
    }
  }, [enabled, onRefresh, refreshing, setPullTo]);

  if (Platform.OS !== "web") {
    const scrollProps: ScrollViewProps = enabled
      ? { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={run} tintColor={t.ink3} /> }
      : {};
    return { refreshing, pull: 0, scrollProps };
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = e.nativeEvent.contentOffset.y <= 0;
  };

  const onTouchStart = (e: GestureResponderEvent) => {
    startY.current = atTop.current && !refreshing ? fingerY(e) : null;
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    if (startY.current === null) return;
    const y = fingerY(e);
    if (y === null) return;
    const distance = (y - startY.current) * DAMPING;
    if (distance <= 0) {
      startY.current = null;
      setPullTo(0);
      return;
    }
    setPullTo(Math.min(distance, MAX_PULL));
  };

  const onTouchEnd = () => {
    const reached = pullNow.current >= THRESHOLD;
    startY.current = null;
    if (reached) void run();
    else setPullTo(0);
  };

  const scrollProps: ScrollViewProps = enabled
    ? {
        onScroll,
        scrollEventThrottle: 16,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel: onTouchEnd,
      }
    : {};

  return { refreshing, pull, scrollProps };
}

/** Faixa que aparece no topo enquanto se arrasta e durante a atualização (só na web). */
export function PullIndicator({ refreshing, pull }: { refreshing: boolean; pull: number }) {
  const t = useTheme();
  if (Platform.OS !== "web") return null;
  const height = refreshing ? 44 : pull;
  if (height <= 0) return null;
  const ready = refreshing || pull >= THRESHOLD;
  return (
    <View style={{ height, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <ActivityIndicator color={ready ? t.accent : t.ink3} />
    </View>
  );
}
