/// <reference types="node" />
// Executar com: node --test src/lib/subscriptions/plans.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ALL_PLAN_IDS, PLANS, PLAN_IDS, PLAN_KEYS, formatPlanPrice } from "./plans.ts";

const norm = (s: string) => s.replace(/ /g, " ");

describe("planos", () => {
  it("tem exatamente os três planos com os IDs informados", () => {
    assert.deepEqual(PLAN_KEYS, ["pro", "premium", "familia"]);
    assert.deepEqual(PLAN_IDS, { pro: "falai_pro", premium: "falai_premium", familia: "falai_familia" });
    assert.deepEqual(PLANS.map((p) => p.id), ["falai_pro", "falai_premium", "falai_familia"]);
    assert.equal(new Set(ALL_PLAN_IDS).size, 3);
  });

  it("preços em centavos inteiros e formatados em reais", () => {
    assert.deepEqual(PLANS.map((p) => p.priceCents), [1990, 3990, 6990]);
    for (const p of PLANS) assert.ok(Number.isInteger(p.priceCents));
    assert.deepEqual(PLANS.map((p) => norm(formatPlanPrice(p.priceCents))), ["R$ 19,90", "R$ 39,90", "R$ 69,90"]);
  });

  it("os benefícios são apenas placeholders", () => {
    for (const p of PLANS) {
      assert.ok(p.benefits.length >= 3 && p.benefits.length <= 5);
      for (const b of p.benefits) assert.match(b, /^Benefício \d do /);
    }
  });
});

describe("camada de assinaturas sem billing real", () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(dir, f));

  it("nenhum arquivo importa SDK de billing nem faz chamada de rede", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
      assert.ok(!/from\s+["'](stripe|@stripe\/|.*revenuecat|.*purchases|googleapis|jose)/i.test(text), f);
      assert.ok(!/(^|[^.\w])fetch\(|XMLHttpRequest|androidpublisher|api\.stripe\.com/.test(text), f);
    }
  });

  it("os stubs de servidor devolvem apenas estados neutros", () => {
    const read = (n: string) => readFileSync(join(dir, n), "utf8");
    assert.match(read("purchase-plan.functions.ts"), /status: "not_configured"/);
    assert.match(read("restore-purchases.functions.ts"), /status: "not_configured"/);
    assert.match(read("get-subscription.functions.ts"), /state: "free"/);
    assert.match(read("flags.functions.ts"), /SUBS_ENABLED === "true"/);
  });

  it("nenhum segredo ou variável de provedor é lido por esta camada", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.ok(!/process\.env\.(?!SUBS_ENABLED|SUBS_PROVIDER)/.test(text), `${f} lê variável de ambiente inesperada`);
      assert.ok(!/GOOGLE_PLAY_(SERVICE|PACKAGE)|REVENUECAT|STRIPE_|SERVICE_ACCOUNT|WEBHOOK_SECRET/i.test(text), f);
    }
  });
});
