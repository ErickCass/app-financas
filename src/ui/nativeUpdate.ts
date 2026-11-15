import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * No iPhone, o expo-updates baixa a versão nova ao abrir o app, mas por padrão só
 * a aplica na abertura seguinte — o usuário fecharia e abriria duas vezes sem
 * entender por quê. Aqui, assim que o download termina, o app recarrega na hora.
 * Também verifica quando o app volta do segundo plano.
 *
 * Nada roda no navegador, em modo de desenvolvimento ou com as atualizações
 * desligadas: nesses casos as funções do expo-updates rejeitam.
 */
export function useNativeUpdates(): void {
  const { isUpdatePending } = Updates.useUpdates();
  const active = Platform.OS !== "web" && !__DEV__ && Updates.isEnabled;

  useEffect(() => {
    // Nada depois do reloadAsync: a execução não continua após o recarregamento.
    if (active && isUpdatePending) void Updates.reloadAsync().catch(() => {});
  }, [active, isUpdatePending]);

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void (async () => {
        try {
          const check = await Updates.checkForUpdateAsync();
          if (check.isAvailable) await Updates.fetchUpdateAsync();
          // O fetch marca a atualização como pendente; o efeito acima recarrega.
        } catch {
          // Sem rede ou servidor fora: tenta de novo na próxima volta ao app.
        }
      })();
    });
    return () => sub.remove();
  }, [active]);
}
