// Sugestão de categoria por palavras-chave. Código puro (sem rede, sem IA, sem dados pessoais).
// Serve como apoio quando não há IA envolvida (lançamento manual, planilha, texto de notificação).
// É só uma SUGESTÃO: o usuário sempre pode trocar. Se nada combinar, devolve null.

import { type Category } from "../categories.ts";

/** Minúsculas, sem acento, só letras e números separados por um espaço. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A ordem importa: a primeira categoria que combinar vence (ex.: "uber eats" é Restaurante, "uber" é Transporte).
const RULES: ReadonlyArray<readonly [Category, readonly string[]]> = [
  ["Assinaturas", [
    "netflix", "spotify", "disney", "disney plus", "hbo", "hbo max", "prime video", "amazon prime", "youtube premium",
    "deezer", "icloud", "google one", "adobe", "canva", "chatgpt", "openai", "globoplay", "paramount", "crunchyroll",
    "apple music", "apple tv", "assinatura", "microsoft 365", "dropbox", "notion",
  ]],
  ["Restaurante", [
    "restaurante", "lanchonete", "ifood", "rappi", "uber eats", "padaria", "pizzaria", "pizza", "hamburguer", "mcdonalds",
    "mc donalds", "burger king", "subway", "starbucks", "cafeteria", "churrascaria", "sushi", "acai", "sorveteria", "delivery",
  ]],
  ["Supermercado", [
    "mercado", "supermercado", "carrefour", "pao de acucar", "assai", "atacadao", "hortifruti", "sacolao", "atacarejo",
    "mercadinho", "emporio",
  ]],
  ["Combustível", ["posto", "gasolina", "etanol", "diesel", "ipiranga", "petrobras", "combustivel", "abastecimento"]],
  ["Transporte", [
    "uber", "cabify", "metro", "onibus", "bilhete unico", "passagem", "estacionamento", "pedagio", "sem parar", "taxi",
  ]],
  ["Saúde", [
    "farmacia", "drogaria", "drogasil", "droga raia", "pague menos", "hospital", "clinica", "consulta", "exame",
    "laboratorio", "plano de saude", "unimed", "dentista", "medico", "remedio",
  ]],
  ["Educação", ["escola", "faculdade", "curso", "udemy", "alura", "universidade", "colegio", "livraria", "livro", "mensalidade escolar"]],
  ["Conta de luz", ["enel", "cemig", "cpfl", "energisa", "copel", "neoenergia", "celesc", "equatorial", "energia eletrica", "conta de luz"]],
  ["Água", ["sabesp", "copasa", "cedae", "sanepar", "embasa", "compesa", "saneamento", "conta de agua", "agua e esgoto"]],
  ["Internet", ["internet", "fibra", "wifi", "vivo fibra", "claro internet", "oi fibra", "net virtua", "tim live"]],
  ["Aluguel", ["aluguel", "condominio", "imobiliaria"]],
  ["Lazer", ["cinema", "teatro", "show", "ingresso", "parque", "viagem", "hotel", "airbnb", "balada", "steam", "playstation", "xbox"]],
];

const PATTERNS: ReadonlyArray<readonly [Category, readonly string[]]> = RULES.map(([cat, words]) => [
  cat,
  words.map((w) => normalizeText(w)),
]);

export function suggestCategory(text: string | null | undefined): Category | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const padded = ` ${normalized} `;
  for (const [category, patterns] of PATTERNS) {
    if (patterns.some((p) => p && padded.includes(` ${p} `))) return category;
  }
  return null;
}
