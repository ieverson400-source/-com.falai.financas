/// <reference types="node" />
// Executar com: node --test src/lib/insights/alerts.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { alertId, priceIncreaseAlerts, MAX_ALERTS } from "./alerts.ts";
import { detectRecurring, localIso, type ExpenseLike } from "./recurring.ts";

let seq = 0;
const exp = (date: string, amount: number, description: string, category = "Assinaturas"): ExpenseLike => ({
  id: `a${++seq}`,
  amount,
  category,
  description,
  expense_date: date,
});
const today = new Date(2026, 10, 15, 12);

const raised = [exp("2026-08-10", 20, "Streaming Z"), exp("2026-09-10", 20, "Streaming Z"), exp("2026-10-10", 23, "Streaming Z")];

describe("aviso de reajuste (dentro do app)", () => {
  it("avisa quando uma assinatura ativa ficou mais cara", () => {
    const alerts = priceIncreaseAlerts(detectRecurring(raised, today), today);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].label, "Streaming Z");
    assert.equal(alerts[0].fromAmount, 20);
    assert.equal(alerts[0].toAmount, 23);
    assert.equal(alerts[0].pct, 15);
  });

  it("não avisa para variações pequenas, quedas de preço ou preço estável", () => {
    const small = [exp("2026-08-10", 100, "Servico A"), exp("2026-09-10", 100, "Servico A"), exp("2026-10-10", 103, "Servico A")];
    const drop = [exp("2026-08-10", 30, "Servico B"), exp("2026-09-10", 30, "Servico B"), exp("2026-10-10", 24, "Servico B")];
    const flat = [exp("2026-08-10", 30, "Servico C"), exp("2026-09-10", 30, "Servico C"), exp("2026-10-10", 30, "Servico C")];
    for (const list of [small, drop, flat]) assert.deepEqual(priceIncreaseAlerts(detectRecurring(list, today), today), []);
  });

  it("conta variável (luz) não gera aviso de reajuste nem 'Vale revisar'", () => {
    const luz = [exp("2026-08-05", 120, "Conta Enel", "Conta de luz"), exp("2026-09-05", 150, "Conta Enel", "Conta de luz"), exp("2026-10-05", 170, "Conta Enel", "Conta de luz")];
    const rec = detectRecurring(luz, today);
    assert.equal(rec.length, 1, "continua detectada como cobrança recorrente");
    assert.equal(rec[0].review, false);
    assert.deepEqual(priceIncreaseAlerts(rec, today), []);
  });

  it("reconhece assinatura que sobe de preço em degraus e usa o preço atual como custo mensal", () => {
    const stair = [exp("2026-07-10", 20, "Streaming W"), exp("2026-08-10", 23, "Streaming W"), exp("2026-09-10", 23, "Streaming W"), exp("2026-10-10", 27, "Streaming W")];
    const rec = detectRecurring(stair, today);
    assert.equal(rec.length, 1);
    assert.equal(rec[0].monthlyCost, 27);
    assert.equal(rec[0].annualCost, 324);
  });

  it("não avisa sobre cobrança antiga ou parada", () => {
    const old = [exp("2026-02-10", 20, "Servico D"), exp("2026-03-10", 20, "Servico D"), exp("2026-04-10", 25, "Servico D")];
    assert.deepEqual(priceIncreaseAlerts(detectRecurring(old, today), today), []);
  });

  it("respeita avisos dispensados e volta a avisar quando entra uma nova cobrança", () => {
    const rec = detectRecurring(raised, today);
    const dismissed = new Set([alertId(rec[0])]);
    assert.deepEqual(priceIncreaseAlerts(rec, today, dismissed), []);

    const next = [...raised, exp("2026-11-10", 26, "Streaming Z")];
    const again = priceIncreaseAlerts(detectRecurring(next, today), today, dismissed);
    assert.equal(again.length, 1);
    assert.equal(again[0].toAmount, 26);
  });

  it("limita a quantidade e ordena pelo maior reajuste", () => {
    const many: ExpenseLike[] = [];
    for (let i = 0; i < 5; i++) {
      const name = `Servico Numero${String.fromCharCode(65 + i)}`;
      many.push(exp("2026-08-10", 100, name), exp("2026-09-10", 100, name), exp("2026-10-10", 110 + i * 5, name));
    }
    const alerts = priceIncreaseAlerts(detectRecurring(many, today), today);
    assert.equal(alerts.length, MAX_ALERTS);
    assert.ok(alerts[0].pct >= alerts[1].pct && alerts[1].pct >= alerts[2].pct);
  });
});

describe("data local", () => {
  it("localIso usa a data local, não UTC", () => {
    assert.equal(localIso(new Date(2026, 10, 15, 23, 30)), "2026-11-15");
    assert.equal(localIso(new Date(2026, 0, 5, 0, 10)), "2026-01-05");
  });
});
