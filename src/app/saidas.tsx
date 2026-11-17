/** Endereço antigo da tela "Até o fim do mês": agora é a lente "Sai da conta" do Orçamento. */
import { Redirect } from "expo-router";

export default function Saidas() {
  return <Redirect href="/orcamento?lente=caixa" />;
}
