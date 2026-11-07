/// <reference types="node" />
// Executar com: node --test src/lib/subscriptions/state.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapSubscriptionRow } from "./state.ts";

const now = new Date("2026-11-07T12:00:00Z");
const row = (plan: string, status: string, end: string | null = null) => ({ plan, status, current_period_end: end });

describe("estado da assinatura a partir da tabela", () => {
  it("sem linha ou plano gratuito = free", () => {
    assert.equal(mapSubscriptionRow(null, now), "free");
    assert.equal(mapSubscriptionRow(row("free", "active"), now), "free");
    assert.equal(mapSubscriptionRow(row("desconhecido", "active"), now), "free");
  });

  it("active e in_grace_period mostram o plano", () => {
    for (const plan of ["pro", "premium", "familia"] as const) {
      assert.equal(mapSubscriptionRow(row(plan, "active"), now), plan);
      assert.equal(mapSubscriptionRow(row(plan, "in_grace_period"), now), plan);
    }
  });

  it("cancelada vale até o fim do período pago, depois expira", () => {
    assert.equal(mapSubscriptionRow(row("pro", "canceled", "2026-12-01T00:00:00Z"), now), "pro");
    assert.equal(mapSubscriptionRow(row("pro", "canceled", "2026-10-01T00:00:00Z"), now), "expired");
    assert.equal(mapSubscriptionRow(row("pro", "canceled", null), now), "expired");
    assert.equal(mapSubscriptionRow(row("pro", "canceled", "lixo"), now), "expired");
  });

  it("expired, on_hold, paused e inactive", () => {
    assert.equal(mapSubscriptionRow(row("premium", "expired"), now), "expired");
    assert.equal(mapSubscriptionRow(row("premium", "on_hold"), now), "pending");
    assert.equal(mapSubscriptionRow(row("premium", "paused"), now), "pending");
    assert.equal(mapSubscriptionRow(row("premium", "inactive"), now), "free");
  });

  it("status desconhecido nunca concede plano", () => {
    assert.equal(mapSubscriptionRow(row("familia", "algo_novo"), now), "pending");
  });
});
