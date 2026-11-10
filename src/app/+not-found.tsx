import { Redirect } from "expo-router";

/** Qualquer endereço desconhecido volta para o Início (útil na versão web). */
export default function NotFound() {
  return <Redirect href="/" />;
}
