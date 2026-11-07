/// <reference types="node" />
// Executar com: node --test src/lib/insights/insights.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, suggestCategory } from "./categorize.ts";
import { detectRecurring, expenseKey, type ExpenseLike } from "./recurring.ts";
import { projectMonthEnd } from "./projection.ts";
import { parseBrAmount, parseNotificationText } from "./parse-notification.ts";
import { CATEGORIES } from "../categories.ts";

const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
let seq = 0;
const exp = (date: string, amount: number, description: string, category = "Outros"): ExpenseLike => ({
  id: `e${++seq}`,
  amount,
  category,
  description,
  expense_date: date,
});

describe("categorização por palavras-chave", () => {
  it("normaliza acentos, caixa e pontuação", () => {
    assert.equal(normalizeText("  Água & Esgoto!! "), "agua esgoto");
    assert.equal(normalizeText(null), "");
  });

  it("sugere categorias conhecidas", () => {
    assert.equal(suggestCategory("Netflix"), "Assinaturas");
    assert.equal(suggestCategory("Spotify Premium"), "Assinaturas");
    assert.equal(suggestCategory("Supermercado Carrefour"), "Supermercado");
    assert.equal(suggestCategory("Posto Ipiranga"), "Combustível");
    assert.equal(suggestCategory("Farmácia Drogasil"), "Saúde");
    assert.equal(suggestCategory("Sabesp"), "Água");
    assert.equal(suggestCategory("Conta de luz Enel"), "Conta de luz");
    assert.equal(suggestCategory("Aluguel de novembro"), "Aluguel");
  });

  it("respeita a precedência (Uber Eats é Restaurante, Uber é Transporte)", () => {
    assert.equal(suggestCategory("Uber Eats pedido"), "Restaurante");
    assert.equal(suggestCategory("Uber viagem"), "Transporte");
  });

  it("só combina palavras inteiras e devolve null sem correspondência", () => {
    assert.equal(suggestCategory("minha amiga Maria"), null);
    assert.equal(suggestCategory("gastei 99 reais"), null);
    assert.equal(suggestCategory(""), null);
    assert.equal(suggestCategory(undefined), null);
  });

  it("só devolve categorias que existem no app", () => {
    for (const text of ["netflix", "mercado", "posto", "uber", "farmacia", "sabesp", "internet", "aluguel", "cinema", "curso", "enel"]) {
      const c = suggestCategory(text);
      assert.ok(c && (CATEGORIES as readonly string[]).includes(c), text);
    }
  });
});

describe("chave do estabelecimento", () => {
  it("ignora ruído, números e acentos", () => {
    assert.equal(expenseKey("Compra Netflix 12345"), "netflix");
    assert.equal(expenseKey("PIX Spotify AB"), "spotify ab");
    assert.equal(expenseKey("  "), "");
    assert.equal(expenseKey(null), "");
  });
});

describe("cobranças recorrentes", () => {
  const today = noon(2026, 11, 15);

  it("detecta uma assinatura mensal estável", () => {
    const list = [
      exp("2026-06-10", 39.9, "Netflix", "Assinaturas"),
      exp("2026-07-10", 39.9, "Netflix", "Assinaturas"),
      exp("2026-08-10", 39.9, "Netflix", "Assinaturas"),
      exp("2026-09-10", 39.9, "Netflix", "Assinaturas"),
      exp("2026-10-10", 39.9, "Netflix", "Assinaturas"),
      exp("2026-11-10", 39.9, "Netflix", "Assinaturas"),
    ];
    const r = detectRecurring(list, today);
    assert.equal(r.length, 1);
    assert.equal(r[0].status, "active");
    assert.equal(r[0].monthlyCost, 39.9);
    assert.equal(r[0].annualCost, 478.8);
    assert.equal(r[0].monthsActive, 6);
    assert.equal(r[0].nextExpectedDate, "2026-12-10");
    assert.equal(r[0].likelySubscription, true);
    assert.equal(r[0].review, true); // assinatura ativa há 6 meses
  });

  it("não considera compras avulsas frequentes (mercado várias vezes no mês)", () => {
    const list = [
      exp("2026-09-02", 80, "Mercado Bom"), exp("2026-09-09", 95, "Mercado Bom"), exp("2026-09-16", 70, "Mercado Bom"),
      exp("2026-10-03", 85, "Mercado Bom"), exp("2026-10-12", 90, "Mercado Bom"),
    ];
    assert.equal(detectRecurring(list, today).length, 0);
  });

  it("exige valor parecido", () => {
    const list = [exp("2026-08-05", 30, "Loja X"), exp("2026-09-05", 120, "Loja X"), exp("2026-10-05", 15, "Loja X")];
    assert.equal(detectRecurring(list, today).length, 0);
  });

  it("três cobranças mensais de conta fixa são detectadas; duas não (se não for assinatura conhecida)", () => {
    const three = [exp("2026-08-05", 1500, "Aluguel Silva"), exp("2026-09-05", 1500, "Aluguel Silva"), exp("2026-10-05", 1500, "Aluguel Silva")];
    assert.equal(detectRecurring(three, today).length, 1);
    assert.equal(detectRecurring(three.slice(0, 2), today).length, 0);
  });

  it("marca como parada quando a última cobrança é antiga", () => {
    const old = [exp("2026-03-05", 20, "Revista Y", "Assinaturas"), exp("2026-04-05", 20, "Revista Y", "Assinaturas"), exp("2026-05-05", 20, "Revista Y", "Assinaturas")];
    const r = detectRecurring(old, today);
    assert.equal(r[0].status, "stopped");
    assert.equal(r[0].review, false);
  });

  it("detecta reajuste de preço e sugere revisar", () => {
    const list = [exp("2026-08-10", 20, "Streaming Z", "Assinaturas"), exp("2026-09-10", 20, "Streaming Z", "Assinaturas"), exp("2026-10-10", 23, "Streaming Z", "Assinaturas")];
    const r = detectRecurring(list, today);
    assert.equal(r[0].priceChangePct, 15);
    assert.equal(r[0].review, true);
  });

  it("ignora descrições vazias, valores inválidos e datas inválidas", () => {
    const list = [exp("2026-08-10", 0, "X Serv"), exp("lixo", 10, "Y Serv"), exp("2026-09-10", 10, null as unknown as string), exp("2026-10-10", 10, "")];
    assert.deepEqual(detectRecurring(list, today), []);
  });
});

describe("projeção do fim do mês", () => {
  it("mês sem nenhum dado devolve null", () => {
    assert.equal(projectMonthEnd([], noon(2026, 11, 15)), null);
  });

  it("projeta pelo ritmo do mês quando não há histórico", () => {
    const list = [exp("2026-11-03", 100, "Mercado A"), exp("2026-11-08", 150, "Posto B"), exp("2026-11-12", 50, "Padaria C")];
    const p = projectMonthEnd(list, noon(2026, 11, 15))!;
    assert.equal(p.spentSoFar, 300);
    assert.equal(p.daysElapsed, 15);
    assert.equal(p.daysInMonth, 30);
    assert.equal(p.projectedTotal, 600); // 300 / 15 * 30
    assert.equal(p.historicalAvg, null);
    assert.equal(p.vsHistoricalPct, null);
  });

  it("no começo do mês dá mais peso ao histórico", () => {
    const list = [exp("2026-11-01", 500, "Compra grande"), exp("2026-10-10", 1000, "Mes anterior"), exp("2026-09-10", 1000, "Mes anterior 2")];
    const p = projectMonthEnd(list, noon(2026, 11, 2))!;
    assert.equal(p.historicalAvg, 1000);
    assert.ok(p.projectedTotal < 5000, "não extrapola 500 em 2 dias para o mês inteiro");
    assert.ok(p.projectedTotal >= 500);
    assert.equal(p.confidence, "low");
  });

  it("inclui cobrança recorrente que ainda vai cair neste mês", () => {
    const list = [
      exp("2026-08-20", 40, "Netflix", "Assinaturas"), exp("2026-09-20", 40, "Netflix", "Assinaturas"), exp("2026-10-20", 40, "Netflix", "Assinaturas"),
      exp("2026-11-05", 100, "Mercado A"),
    ];
    const p = projectMonthEnd(list, noon(2026, 11, 15))!;
    assert.equal(p.pendingFixed, 40);
    assert.equal(p.pendingCharges.length, 1);
    assert.equal(p.pendingCharges[0].label, "Netflix");
    assert.ok(p.projectedTotal >= p.spentSoFar + 40);
  });

  it("não conta de novo a recorrente que já caiu neste mês", () => {
    const list = [
      exp("2026-08-05", 40, "Netflix", "Assinaturas"), exp("2026-09-05", 40, "Netflix", "Assinaturas"), exp("2026-10-05", 40, "Netflix", "Assinaturas"),
      exp("2026-11-05", 40, "Netflix", "Assinaturas"),
    ];
    const p = projectMonthEnd(list, noon(2026, 11, 15))!;
    assert.equal(p.pendingFixed, 0);
  });

  it("ignora gastos com data futura e valores inválidos", () => {
    const list = [exp("2026-11-20", 999, "Futuro"), exp("2026-11-03", -5, "Invalido"), exp("2026-11-03", 100, "Valido")];
    const p = projectMonthEnd(list, noon(2026, 11, 15))!;
    assert.equal(p.spentSoFar, 100);
  });

  it("confiança sobe com mais dias e mais lançamentos", () => {
    const many = Array.from({ length: 16 }, (_, i) => exp(`2026-11-${String(i + 1).padStart(2, "0")}`, 20, `Loja ${i}`));
    assert.equal(projectMonthEnd(many, noon(2026, 11, 16))!.confidence, "high");
  });

  it("calcula a variação em relação à média histórica", () => {
    const list = [exp("2026-10-10", 1000, "Antigo"), exp("2026-11-14", 1500, "Mes atual")];
    const p = projectMonthEnd(list, noon(2026, 11, 15))!;
    assert.equal(p.historicalAvg, 1000);
    assert.ok(typeof p.vsHistoricalPct === "number" && p.vsHistoricalPct > 0);
  });
});

describe("leitura de texto de notificação", () => {
  const now = noon(2026, 11, 15);

  it("lê valor, estabelecimento e categoria de uma compra", () => {
    const r = parseNotificationText("Compra aprovada no valor de R$ 45,90 em MERCADO BOM PRECO LTDA. Cartão final 1234.", now)!;
    assert.equal(r.kind, "expense");
    assert.equal(r.amount, 45.9);
    assert.match(r.description, /Mercado Bom Preco/);
    assert.equal(r.category, "Supermercado");
  });

  it("converte valores com milhar", () => {
    assert.equal(parseBrAmount("1.234,56"), 1234.56);
    assert.equal(parseBrAmount("10"), 10);
    assert.equal(parseBrAmount("0,00"), null);
    const r = parseNotificationText("Pagamento de R$ 1.234,56 em Imobiliaria Centro", now)!;
    assert.equal(r.amount, 1234.56);
    assert.equal(r.category, "Aluguel");
  });

  it("não confunde saldo com o valor da compra", () => {
    const r = parseNotificationText("Saldo disponível: R$ 2.000,00. Compra de R$ 30,00 em Farmácia Popular", now)!;
    assert.equal(r.amount, 30);
    assert.equal(r.category, "Saúde");
  });

  it("texto só com saldo não vira gasto", () => {
    const r = parseNotificationText("Seu saldo disponível é R$ 500,00", now)!;
    assert.equal(r.amount, null);
    assert.equal(r.kind, "unknown");
  });

  it("identifica entrada de dinheiro", () => {
    const r = parseNotificationText("Você recebeu um Pix de R$ 200,00 de João", now)!;
    assert.equal(r.kind, "income");
  });

  it("lê a data dd/mm e dd/mm/aaaa; sem ano e no futuro vira ano anterior", () => {
    assert.equal(parseNotificationText("Compra R$ 10,00 em Loja em 03/11", now)!.date, "2026-11-03");
    assert.equal(parseNotificationText("Compra R$ 10,00 em Loja em 03/11/2025", now)!.date, "2025-11-03");
    assert.equal(parseNotificationText("Compra R$ 10,00 em Loja em 20/12", now)!.date, "2025-12-20");
    assert.equal(parseNotificationText("Compra R$ 10,00 em Loja em 31/02", now)!.date, null);
    assert.equal(parseNotificationText("Compra R$ 10,00 em Loja", now)!.date, null);
  });

  it("usa o rótulo 'Local:' quando existe", () => {
    const r = parseNotificationText("Débito R$ 25,00. Local: POSTO IPIRANGA CENTRO", now)!;
    assert.match(r.description, /Posto Ipiranga Centro/);
    assert.equal(r.category, "Combustível");
  });

  it("texto vazio ou sem valor", () => {
    assert.equal(parseNotificationText("   ", now), null);
    const r = parseNotificationText("Olá, tudo bem?", now)!;
    assert.equal(r.amount, null);
    assert.equal(r.kind, "unknown");
  });
});
