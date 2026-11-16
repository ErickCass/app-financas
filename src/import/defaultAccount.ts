import type { Account } from "@/domain/types";
import type { ParsedStatement } from "./types";

export const NEW = "__new__";
export const INSTITUTION: Record<ParsedStatement["institution"], string> = { itau: "Itaú", nubank: "Nubank", flash: "Flash" };

/**
 * Conta sugerida para o arquivo. Cartão com final conhecido vai só para a conta com
 * o mesmo final; se não houver, sugere um cartão novo. Antes, caía em qualquer
 * cartão do mesmo banco, e o Mastercard 9121 foi parar no Visa 9265.
 * Sem final no arquivo, vale o banco; extrato de conta corrente única vai para ela.
 */
export function defaultAccount(st: Pick<ParsedStatement, "institution" | "kind" | "last4">, accounts: Account[]): string {
  const sameKind = accounts.filter((a) => a.kind === st.kind);
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const bank = fold(INSTITUTION[st.institution]);
  const ofBank = sameKind.filter((a) => fold(a.name).includes(bank));
  const last4Of = (a: Account) => a.last4 ?? a.name.match(/(\d{4})\s*$/)?.[1];
  if (st.last4) {
    const byLast4 = sameKind.find((a) => last4Of(a) === st.last4);
    if (byLast4) return byLast4.id;
    // Cartão do mesmo banco sem final registrado ainda pode ser este; com outro final, não.
    const unnamed = ofBank.find((a) => !last4Of(a));
    if (unnamed && st.kind !== "credit_card") return unnamed.id;
    if (unnamed && ofBank.length === 1) return unnamed.id;
    if (st.kind === "credit_card") return NEW;
  }
  if (ofBank[0]) return ofBank[0].id;
  if ((st.kind === "checking" || st.kind === "benefit") && sameKind.length === 1) return sameKind[0]!.id;
  return NEW;
}

