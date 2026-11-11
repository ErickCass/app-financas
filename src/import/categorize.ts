/**
 * Sugere a categoria de um lançamento importado, nesta ordem:
 * 1. regra aprendida (o usuário já classificou essa loja antes);
 * 2. palavras-chave conhecidas (Uber → Transporte, Drogasil → Saúde...);
 * 3. categoria que o banco informa na fatura (Itaú: "ALIMENTAÇÃO", "VEÍCULOS"...).
 * As regras apontam para nomes das categorias padrão; se o usuário renomeou
 * ou apagou a categoria, o lançamento fica sem categoria para ele escolher.
 */
import { normalizeDescription } from "@/domain/dedup";
import type { Category } from "@/domain/types";
import type { ParsedItem } from "./types";

export type CategorySource = "rule" | "keyword" | "bank";

export interface LearnedRule {
  pattern: string; // normalizeDescription(descrição)
  categoryId: string;
}

/** Padrão usado nas regras aprendidas: descrição normalizada, sem números soltos. */
export function rulePattern(description: string): string {
  // Data colada no nome ("JOAO L14/10") ou parcela ("05/12") não faz parte da loja.
  return normalizeDescription(description.replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " "))
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ordem importa: a primeira que casar vence. Testadas sobre o texto normalizado. */
const KEYWORDS: [RegExp, string][] = [
  // Assinaturas antes de Compras (Amazon Prime x Amazon) e de Lazer
  [/\b(apple com bill|netflix|spotify|amazon ?prime|amazonprime|prime video|youtub|google one|disney|hbo|globoplay|deezer|anthropic|openai|chatgpt|melimais|icloud|microsoft|adobe|uber one|clube latam|ifood club|manus ai|companyhero)\b/, "Assinaturas"],
  [/\b(mercadolivre|mercado livre|mercado (?=\S*shop)|amazon|amzn|amazonmktplc|shopee|magalu|magazine luiza|ri happy|renner|zara|riachuelo|centauro|netshoes|target|marshalls|nordstrom|olx|pet ?love|petsupermark|petz|cobasi|nupay)\b/, "Compras"],
  [/\b(carrefour|hortifruti|hortifrut|frutaria|supermerc\w*|atacad\w*|assai|pao de acucar|st marche|sonda|market4u|mkt4u|hacs home market|home market|acougue|sacolao|feira)\b|hortifrut|supermerc/, "Mercado"],
  [/\b(ifd|ifood|restaurant\w*|burguer|burger|pizz\w*|sushi\w*|bbq|grill|esfiha\w*|sorvet\w*|cacau ?show|cacaushow|doce|cafe\w*|bakery|steak\w*|shake shack|starbucks|mcdonald\w*|outback|spoleto|bistro|bacio di latte|lanch\w*|padaria|bar|tst)\b|sushi|burg(u)?er|pizz|esfih/, "Restaurantes"],
  [/\b(uber\w*|99 ?(app|pop|taxi)|posto|autpost\w*|auto posto|shell|ipiranga|petrobras|sunoco|exxon|estacion\w*|parking|zul|zona azul|sem parar|conectcar|veloe|rentcar\w*|localiza\w*|movida|turbi|unidas|sixt|mta|metro|cptm|pedagio|centro autom)\b|uber|posto|sixt|localiza|rentcar/, "Transporte"],
  [/\b(droga\w*|drogasil\w*|raia|farma\w*|pharmacy|pague menos|hospital|laborat\w*|clinica|dr|dra|manipul\w*|odonto\w*|omint)\b|droga|farma/, "Saúde"],
  [/\b(booking|hotel|airbnb|marriott|courtyard|embassy suit\w*|hilton|latam|decolar|cinema|cinemark|ingresso\w*|parques?|teatro)\b/, "Lazer"],
  [/\b(eletropaulo|enel|sabesp|comgas|vivo|claro|tim|internet|lavanderia|maxilave)\b/, "Casa e serviços"],
  [/\b(condominio|aluguel)\b/, "Moradia"],
  [/\b(escola|colegio|school|scho|faculdade|universidade|curso)\b/, "Educação"],
];

const INCOME = /\b(salario|remuneracao|proventos|pro labore)\b/;

const BANK: Record<string, string> = {
  "ALIMENTAÇÃO": "Restaurantes",
  "VEÍCULOS": "Transporte",
  "SAÚDE": "Saúde",
  "VESTUÁRIO": "Compras",
  "TURISMO E ENTRETENIM": "Lazer",
  "HOBBY": "Lazer",
  "MORADIA": "Casa e serviços",
  "EDUCAÇÃO": "Educação",
};

export function suggestCategory(
  item: Pick<ParsedItem, "description" | "amount" | "bankCategory">,
  categories: Category[],
  rules: LearnedRule[],
): { categoryId: string; source: CategorySource } | null {
  const byName = (name: string) => categories.find((c) => c.name === name)?.id;

  const pattern = rulePattern(item.description);
  const learned = rules.find((r) => r.pattern === pattern && categories.some((c) => c.id === r.categoryId));
  if (learned) return { categoryId: learned.categoryId, source: "rule" };

  const text = normalizeDescription(item.description);
  if (item.amount > 0 && INCOME.test(text)) {
    const id = byName("Renda");
    return id ? { categoryId: id, source: "keyword" } : null;
  }
  for (const [re, name] of KEYWORDS) {
    if (re.test(text)) {
      const id = byName(name);
      if (id) return { categoryId: id, source: "keyword" };
    }
  }
  if (item.bankCategory) {
    const id = BANK[item.bankCategory] && byName(BANK[item.bankCategory]!);
    if (id) return { categoryId: id, source: "bank" };
  }
  return null;
}
