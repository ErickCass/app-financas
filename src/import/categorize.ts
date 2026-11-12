/**
 * Sugere a categoria de um lançamento importado, nesta ordem:
 * 1. regra aprendida (o usuário já classificou essa loja antes);
 * 2. palavras-chave conhecidas (Uber → Transporte, Drogasil → Saúde...);
 * 3. categoria que o banco informa na fatura (Itaú: "ALIMENTAÇÃO", "VEÍCULOS"...).
 * Cada regra aceita vários nomes de categoria, então funciona mesmo quando a pessoa
 * renomeou ("Combustível / Uber" em vez de "Transporte"). Sem nenhuma correspondência,
 * o lançamento fica sem categoria para ela escolher.
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

/**
 * Cada regra aponta para uma lista de nomes de categoria, do mais específico ao mais
 * genérico: o app usa a primeira que existir na conta da pessoa. Assim funciona tanto
 * com as categorias padrão quanto com nomes próprios ("Combustível / Uber", "PET").
 * Ordem importa: a primeira regra que casar vence.
 */
const KEYWORDS: [RegExp, string[]][] = [
  // Assinaturas digitais: nome do serviço primeiro, para quem tem categoria própria
  [/\b(anthropic|claude)\b/, ["Claude", "Assinaturas"]],
  [/\b(openai|chatgpt)\b/, ["ChatGPT", "Assinaturas"]],
  [/\bmanus\b/, ["Manus", "Assinaturas"]],
  [/\byoutub\w*\b/, ["Youtube Premium", "Youtube", "Assinaturas"]],
  [/\b(google one|google ?storage|google ?drive)\b/, ["Google Storage", "Assinaturas"]],
  [/\b(apple com bill|apple ?com|icloud)\b/, ["Apple iCloud", "Apple", "Assinaturas"]],
  [/\b(amazon ?prime|amazonprime|prime video)\b/, ["Amazon", "Assinaturas"]],
  [/\b(netflix|spotify|disney|hbo|globoplay|deezer|max |paramount|melimais|microsoft|adobe|uber one|clube latam|ifood club|companyhero)\b/, ["Assinaturas"]],

  // Casa, contas e serviços recorrentes
  [/\b(eletropaulo|enel|cpfl|light|energia|energisa|neoenergia)\b/, ["Conta de Energia", "Energia", "Casa e serviços"]],
  [/\b(vivo|claro|tim|oi fibra|internet|net ?fibra|telefonica)\b/, ["Celular + Internet", "Internet", "Telefone", "Casa e serviços"]],
  [/\b(lavanderia|maxilave|lave\b)\b/, ["Lavanderia", "Casa e serviços"]],
  [/\b(sabesp|comgas|agua|gas natural)\b/, ["Casa e serviços"]],
  [/\b(prudent\w*|previdencia|seguro de vida|metlife|icatu)\b/, ["Prudential", "Seguros", "Casa e serviços"]],
  [/\b(iptu|prefeitura)\b/, ["IPTU", "Moradia"]],
  [/\bcondominio\b/, ["Condomínio FG", "Condomínio", "Moradia"]],
  [/\b(aluguel|imobiliaria)\b/, ["Moradia"]],
  [/\b(dizimo|igreja|paroquia)\b/, ["Dízimo", "Doações"]],
  [/\b(doacao|doacoes|instituto|ong)\b/, ["Doações"]],

  // Cuidados pessoais e saúde
  [/\b(smart ?fit|bio ?ritmo|academia|gympass|totalpass|crossfit|pilates)\b/, ["Academia", "Saúde"]],
  [/\b(barbearia|barber|cabelo|salao|cabeleireiro)\b/, ["Cabelo e Barba", "Cuidados", "Compras"]],
  [/\b(lentes|otica|optica|oculos)\b/, ["Lentes de Contato", "Saúde"]],
  [/\b(droga\w*|drogasil\w*|raia|farma\w*|pharmacy|pague menos|manipul\w*|vitamina)\b|droga|farma/, ["Saúde", "Medicamentos e Vitaminas"]],
  [/\b(hospital|laborat\w*|clinica|dr|dra|odonto\w*|omint|unimed|amil|exame)\b/, ["Saúde"]],

  // Pets
  [/\b(pet ?love|petlove|petz|cobasi|petsupermark|racao|veterinari\w*)\b/, ["PET", "Pets", "Animais", "Compras"]],

  // Compras
  [/\b(mercadolivre|mercado livre|mercado (?=\S*shop)|amazon|amzn|amazonmktplc|shopee|magalu|magazine luiza|ri happy|renner|zara|riachuelo|centauro|netshoes|target|marshalls|nordstrom|olx|nupay|boutique)\b/, ["Compras"]],

  // Mercado
  [/\b(carrefour|hortifruti|hortifrut|frutaria|supermerc\w*|atacad\w*|assai|pao de acucar|st marche|sonda|market4u|mkt4u|hacs home market|home market|acougue|sacolao|feira|aliment\w*|quitanda|empor\w*)\b|hortifrut|supermerc/, ["Mercado", "Supermercado", "Alimentação"]],

  // Restaurantes
  [/\b(ifd|ifood|restaurant\w*|burguer|burger|pizz\w*|sushi\w*|bbq|grill|esfiha\w*|sorvet\w*|cacau ?show|cacaushow|doce|cafe\w*|bakery|steak\w*|shake shack|starbucks|mcdonald\w*|outback|spoleto|bistro|bacio di latte|lanch\w*|padaria|bar|tst)\b|sushi|burg(u)?er|pizz|esfih/, ["Restaurantes", "Restaurante", "Alimentação", "Comida"]],

  // Transporte e combustível
  [/\b(uber\w*|99 ?(app|pop|taxi)|posto|autpost\w*|auto posto|shell|ipiranga|petrobras|sunoco|exxon|estacion\w*|parking|zul|zona azul|sem parar|conectcar|veloe|rentcar\w*|localiza\w*|movida|turbi|unidas|sixt|mta|metro|cptm|pedagio|centro autom)\b|uber|posto|sixt|localiza|rentcar/, ["Combustível / Uber", "Combustível", "Transporte", "Carro", "Veículos"]],

  // Viagem
  [/\b(booking|hotel|airbnb|marriott|courtyard|embassy suit\w*|hilton|latam|gol |azul |decolar|expedia|aeroporto|turismo)\b/, ["Viagens", "Viagem", "Lazer"]],
  [/\b(cinema|cinemark|ingresso\w*|parques?|teatro|show)\b/, ["Lazer", "Entretenimento"]],

  // Tarifas, juros e impostos do banco
  [/\b(iof|juros|tarifa|anuidade|encargos|multa|mora)\b/, ["Tarifas e juros", "Tarifas", "Impostos"]],

  // Educação
  [/\b(escola|colegio|school|scho|faculdade|universidade|curso)\b/, ["Escola Sarah", "Escola", "Educação"]],
];

const INCOME: [RegExp, string[]][] = [
  [/\b(salario|remuneracao|proventos|pro labore)\b/, ["Renda", "Salário"]],
  [/\b(reembolso|ressarcimento)\b/, ["Reembolso", "Renda"]],
];

/** Categoria informada pelo banco na fatura, com alternativas de nome. */
const BANK: Record<string, string[]> = {
  "ALIMENTAÇÃO": ["Restaurantes", "Alimentação", "Mercado"],
  "VEÍCULOS": ["Combustível / Uber", "Transporte", "Carro"],
  "SAÚDE": ["Saúde"],
  "VESTUÁRIO": ["Compras", "Vestuário"],
  "TURISMO E ENTRETENIM": ["Viagens", "Lazer"],
  "HOBBY": ["Lazer", "Compras"],
  "MORADIA": ["Casa e serviços", "Moradia"],
  "EDUCAÇÃO": ["Educação"],
  "SERVIÇOS": ["Casa e serviços"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Primeira categoria da conta que corresponde a um dos nomes, por nome igual e,
 * depois, por palavra contida ("Combustível / Uber" atende a "Combustível").
 */
function findCategory(names: string[], categories: Category[]): string | null {
  const pool = categories.map((c) => ({ id: c.id, norm: normalizeDescription(c.name) }));
  // A ordem dos nomes manda: para cada um, tenta nome igual e depois palavra contida.
  for (const name of names) {
    const n = normalizeDescription(name);
    const exact = pool.find((c) => c.norm === n);
    if (exact) return exact.id;
    if (n.length < 3) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escape(n)}([^a-z0-9]|$)`);
    const partial = pool.find((c) => re.test(c.norm));
    if (partial) return partial.id;
  }
  return null;
}

export function suggestCategory(
  item: Pick<ParsedItem, "description" | "amount" | "bankCategory">,
  categories: Category[],
  rules: LearnedRule[],
): { categoryId: string; source: CategorySource } | null {
  const pattern = rulePattern(item.description);
  const learned = rules.find((r) => r.pattern === pattern && categories.some((c) => c.id === r.categoryId));
  if (learned) return { categoryId: learned.categoryId, source: "rule" };

  const text = normalizeDescription(item.description);
  if (item.amount > 0) {
    for (const [re, names] of INCOME) {
      if (!re.test(text)) continue;
      const id = findCategory(names, categories.filter((c) => c.kind === "income"));
      if (id) return { categoryId: id, source: "keyword" };
    }
  }
  const spending = categories.filter((c) => c.kind !== "income");
  for (const [re, names] of KEYWORDS) {
    if (!re.test(text)) continue;
    const id = findCategory(names, spending);
    if (id) return { categoryId: id, source: "keyword" };
  }
  if (item.bankCategory) {
    const id = findCategory(BANK[item.bankCategory] ?? [], spending);
    if (id) return { categoryId: id, source: "bank" };
  }
  return null;
}
