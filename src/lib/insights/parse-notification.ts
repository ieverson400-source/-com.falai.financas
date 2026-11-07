// Leitura de texto colado (notificação de banco, SMS ou e-mail) para sugerir um gasto.
// Código puro, local ao navegador/servidor que o chamar: nenhum texto sai daqui. O resultado é uma
// SUGESTÃO que o usuário confere antes de salvar. Não conhece o formato exato de nenhum banco: usa
// padrões genéricos (valor em R$, "em <estabelecimento>", data dd/mm).

import type { Category } from "../categories.ts";
import { normalizeText, suggestCategory } from "./categorize.ts";

export interface ParsedNotification {
  kind: "expense" | "income" | "unknown";
  /** Valor em reais, ou null se não foi possível identificar com segurança. */
  amount: number | null;
  /** Estabelecimento/descrição sugerida (pode ficar vazia). */
  description: string;
  /** yyyy-mm-dd, ou null se o texto não traz data. */
  date: string | null;
  category: Category | null;
}

const AMOUNT_RE = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
const POSITIVE = ["valor", "compra", "debito", "pagamento", "pagou", "pix", "enviado", "enviou", "transferencia", "aprovada", "realizada", "cobranca", "boleto", "paga"];
const NEGATIVE = ["saldo", "limite", "disponivel", "minimo", "juros", "fatura", "desconto", "cashback", "rendimento"];
const INCOME = ["recebeu", "recebido", "recebimento", "credito em conta", "deposito", "estorno", "reembolso", "salario"];
const EXPENSE_HINT = ["voce pagou", "compra", "debito", "enviou", "enviado", "pagamento"];

export function parseBrAmount(raw: string): number | null {
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(text: string, now: Date): string | null {
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    let year = m[3] ? Number(m[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    let candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() !== month - 1) return null; // dia inexistente (ex.: 31/02)
    // Sem ano e no futuro: o gasto é do ano passado.
    if (!m[3] && candidate.getTime() > now.getTime() + 86_400_000) candidate = new Date(year - 1, month - 1, day);
    return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}`;
  }
  if (/\bontem\b/i.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

function cleanMerchant(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim().replace(/[\s:;,\-–]+$/, "");
  if (s.length > 60) s = s.slice(0, 60).trim();
  // Texto todo em maiúsculas vira capitalizado para ficar legível.
  if (s && s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase());
  }
  return s;
}

function extractMerchant(text: string, amountStart: number, amountEnd: number): string {
  const labeled = text.match(/(?:local|estabelecimento|loja|favorecido)\s*:\s*([^.;\n]{2,60})/i);
  if (labeled) return cleanMerchant(labeled[1]);

  const after = text.slice(amountEnd);
  const afterMatch = after.match(/^\s*(?:em|no|na|para|a favor de|:|-)\s+([^.;\n]{2,60})/i);
  if (afterMatch) {
    // Corta antes de palavras que começam outra informação ("... MERCADO XYZ às 10:32", "... cartão final 1234").
    const cut = afterMatch[1].split(/\s+(?:às|as|em|dia|com|via|cart[aã]o|final|hoje|ontem)\b/i)[0];
    return cleanMerchant(cut);
  }

  const before = text.slice(0, amountStart);
  const beforeMatch = before.match(/([\p{L}0-9*&'.][\p{L}0-9*&' .-]{2,40})\s*[:\-–]\s*$/u);
  return beforeMatch ? cleanMerchant(beforeMatch[1]) : "";
}

export function parseNotificationText(text: string, now: Date): ParsedNotification | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const normalizedAll = ` ${normalizeText(trimmed)} `;

  // Escolhe o valor mais provável pelo contexto que vem antes dele (ex.: ignora "saldo disponível").
  let best: { amount: number; score: number; start: number; end: number } | null = null;
  let index = 0;
  let prevEnd = 0;
  for (const m of trimmed.matchAll(AMOUNT_RE)) {
    const amount = parseBrAmount(m[1]);
    const start = m.index ?? 0;
    if (amount === null) continue;
    // Contexto = só o trecho entre o valor anterior e este, dentro da mesma frase (no máximo 40 caracteres),
    // para que "saldo disponível" de outra frase não contamine o valor da compra.
    const raw = trimmed.slice(Math.max(prevEnd, start - 40), start);
    const clause = raw.split(/[.;!?]\s+|\n/).pop() ?? "";
    const context = ` ${normalizeText(clause)} `;
    prevEnd = start + m[0].length;
    let score = index === 0 ? 0.5 : 0;
    for (const w of POSITIVE) if (context.includes(` ${w} `)) score += 2;
    for (const w of NEGATIVE) if (context.includes(` ${w} `)) score -= 3;
    if (!best || score > best.score) best = { amount, score, start, end: start + m[0].length };
    index++;
  }

  const hasIncome = INCOME.some((w) => normalizedAll.includes(` ${w} `));
  const hasExpenseHint = EXPENSE_HINT.some((w) => normalizedAll.includes(` ${w} `));
  const kind: ParsedNotification["kind"] = hasIncome && !hasExpenseHint ? "income" : best && best.score >= 0 ? "expense" : "unknown";

  const usable = best && best.score >= 0 ? best : null;
  const description = usable ? extractMerchant(trimmed, usable.start, usable.end) : "";
  const withoutAmounts = trimmed.replace(AMOUNT_RE, " ");
  return {
    kind,
    amount: usable ? usable.amount : null,
    description,
    date: parseDate(trimmed, now),
    category: suggestCategory(description) ?? suggestCategory(withoutAmounts),
  };
}
