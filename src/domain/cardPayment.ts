/**
 * Identifica o pagamento da fatura do cartão na conta corrente.
 * É uma transferência interna: as compras já entraram uma a uma no orçamento,
 * então o pagamento não pode contar de novo como despesa.
 * Portado do app antigo (shared/cardPayment.ts).
 */
const CARD_PAYMENT_PATTERNS = [
  /pagamento\s+fatura/i,
  /pagto\s+fatura/i,
  /pag\s+fatura/i,
  /fatura\s+paga/i,
  /paga\s+fatura/i,
  /pagamento\s+cart[aã]o/i,
  /pagto\s+cart[aã]o/i,
  /pag\.?\s*cart/i,
  /d[eé]bito\s+autom[aá]tico\s+fatura/i,
  /d[eé]bito\s+autom\.\s+fatura/i,
  /transfer[eê]ncia\s+para\s+cart[aã]o/i,
  /ted\s+fatura/i,
  /doc\s+fatura/i,
  /pag(amento)?\s+boleto\s+ita[uú]\s+unibanco/i, // fatura Itaú paga por boleto
  /fatura.*(latam|mastercard|visa|ita[uú]|nubank|inter|bradesco|santander|c6|xp|next|neon)/i,
];

export function isCardPayment(description: string | null | undefined): boolean {
  const text = description ?? "";
  return CARD_PAYMENT_PATTERNS.some((p) => p.test(text));
}
