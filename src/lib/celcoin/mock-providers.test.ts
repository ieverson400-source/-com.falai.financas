/// <reference types="node" />
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MOCK_OPERATORS, MockTopupProvider } from "./mock-providers.server.ts";
import { exactAmountsCents, type CreateTopupRequest } from "./topup-provider.ts";
import { nextStatusAfterTopupStatus } from "../recharge/state-machine.ts";
import { installNetworkGuard } from "./test-support.ts";

let guard: ReturnType<typeof installNetworkGuard>;
beforeEach(() => {
  guard = installNetworkGuard();
});
afterEach(() => {
  assert.equal(guard.attempts(), 0, "o mock não pode usar a rede");
  guard.restore();
});

const req = (id: string): CreateTopupRequest => ({
  clientRequestId: id,
  providerId: 9001,
  amountCents: 1000,
  phone: { countryCode: 55, stateCode: 11, number: "994114386" },
});
const A = "11111111-1111-4111-8111-111111111111";

describe("provedor mock", () => {
  it("consulta de operadoras e de valores disponíveis", async () => {
    const p = new MockTopupProvider();
    const ops = await p.listProviders();
    assert.deepEqual(ops.map((o) => o.providerId), MOCK_OPERATORS.map((o) => o.providerId));
    const values = await p.listProviderValues({ stateCode: 11, providerId: 9001 });
    assert.deepEqual(exactAmountsCents(values), [1000, 2000]);
    assert.deepEqual(await p.listProviderValues({ stateCode: 11, providerId: 1 }), []);
  });

  it("solicitação de recarga é criada e consultável", async () => {
    const p = new MockTopupProvider();
    const r = await p.createTopup(req(A));
    assert.equal(r.outcome, "created");
    assert.equal(p.createdCount, 1);
  });

  it("recarga em processamento: INITIATED -> PROCESSING -> CONFIRMED", async () => {
    const p = new MockTopupProvider({ statusSequence: ["INITIATED", "PROCESSING", "CONFIRMED"] });
    await p.createTopup(req(A));
    const seen: string[] = [];
    let state = "topup_submitting" as Parameters<typeof nextStatusAfterTopupStatus>[0];
    for (let i = 0; i < 4; i++) {
      const g = await p.getTopup({ clientRequestId: A });
      assert.equal(g.outcome, "found");
      if (g.outcome !== "found") return;
      seen.push(g.topup.status);
      const d = nextStatusAfterTopupStatus(state, g.topup.status);
      if (d) state = d.status;
    }
    assert.deepEqual(seen, ["INITIATED", "PROCESSING", "CONFIRMED", "CONFIRMED"]);
    assert.equal(state, "topup_done");
  });

  it("recarga confirmada", async () => {
    const p = new MockTopupProvider({ statusSequence: ["CONFIRMED"] });
    await p.createTopup(req(A));
    const g = await p.getTopup({ clientRequestId: A });
    assert.ok(g.outcome === "found" && g.topup.status === "CONFIRMED" && g.topup.hasReceipt);
  });

  it("recarga com erro", async () => {
    const p = new MockTopupProvider({ statusSequence: ["PROCESSING", "ERROR"], errorCode: "MOCK_X" });
    await p.createTopup(req(A));
    await p.getTopup({ clientRequestId: A });
    const g = await p.getTopup({ clientRequestId: A });
    assert.ok(g.outcome === "found" && g.topup.status === "ERROR" && g.topup.errorCode === "MOCK_X");
    assert.deepEqual(nextStatusAfterTopupStatus("topup_pending", "ERROR"), { status: "topup_failed" });
  });

  it("timeout com recarga criada: resultado desconhecido, consulta encontra, sem duplicar", async () => {
    const p = new MockTopupProvider({ createBehavior: "timeout", creates: true });
    const r = await p.createTopup(req(A));
    assert.deepEqual(r, { outcome: "unknown", reason: "timeout" });
    const g = await p.getTopup({ clientRequestId: A });
    assert.equal(g.outcome, "found");
    // Um novo envio com o MESMO clientRequestId nunca cria uma segunda recarga.
    p.configure({ createBehavior: "ok" });
    assert.deepEqual(await p.createTopup(req(A)), { outcome: "duplicate", code: "ITBE011" });
    assert.equal(p.createdCount, 1);
  });

  it("timeout sem recarga criada: a consulta não encontra", async () => {
    const p = new MockTopupProvider({ createBehavior: "timeout", creates: false });
    assert.equal((await p.createTopup(req(A))).outcome, "unknown");
    assert.deepEqual(await p.getTopup({ clientRequestId: A }), { outcome: "not_found", code: "ITBE029" });
    assert.equal(p.createdCount, 0);
  });

  it("erro 5xx também é resultado desconhecido", async () => {
    const p = new MockTopupProvider({ createBehavior: "server_error" });
    const r = await p.createTopup(req(A));
    assert.equal(r.outcome === "unknown" && r.reason, "http_5xx");
  });

  it("resultado desconhecido e status inesperado levam à revisão manual", async () => {
    const p = new MockTopupProvider({ statusSequence: ["SOMETHING_NEW"] });
    await p.createTopup(req(A));
    const g = await p.getTopup({ clientRequestId: A });
    assert.ok(g.outcome === "found");
    if (g.outcome === "found") {
      assert.deepEqual(nextStatusAfterTopupStatus("topup_pending", g.topup.status), {
        status: "needs_review",
        reviewReason: "topup_unknown_status",
      });
    }
  });

  it("solicitação duplicada (mesmo clientRequestId)", async () => {
    const p = new MockTopupProvider();
    await p.createTopup(req(A));
    assert.deepEqual(await p.createTopup(req(A)), { outcome: "duplicate", code: "ITBE011" });
    assert.equal(p.createdCount, 1);
    const other = await p.createTopup(req("22222222-2222-4222-8222-222222222222"));
    assert.equal(other.outcome, "created");
    assert.equal(p.createdCount, 2);
  });

  it("rejeição e token indisponível", async () => {
    const rej = new MockTopupProvider({ createBehavior: "reject" });
    const r = await rej.createTopup(req(A));
    assert.ok(r.outcome === "rejected" && r.kind === "validation");
    assert.equal(rej.createdCount, 0);
    const ns = new MockTopupProvider({ createBehavior: "not_sent" });
    assert.deepEqual(await ns.createTopup(req(A)), { outcome: "not_sent", reason: "auth_unavailable" });
  });

  it("consulta por transactionId e exigência de identificador", async () => {
    const p = new MockTopupProvider();
    const c = await p.createTopup(req(A));
    assert.ok(c.outcome === "created");
    if (c.outcome === "created") {
      assert.equal((await p.getTopup({ transactionId: c.transactionId })).outcome, "found");
    }
    assert.equal((await p.getTopup({ transactionId: "nao-existe" })).outcome, "not_found");
    await assert.rejects(p.getTopup({}), /identifier/);
  });

  it("registra as chamadas feitas", async () => {
    const p = new MockTopupProvider();
    await p.createTopup(req(A));
    await p.getTopup({ clientRequestId: A });
    assert.deepEqual(p.calls.map((c) => c.method), ["createTopup", "getTopup"]);
  });
});
