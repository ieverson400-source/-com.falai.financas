/// <reference types="node" />
// Executar com: node --test src/lib/recharge/rules.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildClientRequestId,
  computeFeeCents,
  isPixExpired,
  maskPhone,
  normalizeBrPhone,
  pixExpiresAt,
  validateOrderRequest,
  verifyPixPayment,
} from "./rules.ts";
import {
  ADMIN_ONLY_PAIRS,
  ADMIN_OR_RECONCILE_PAIRS,
  TRANSITIONS,
  assertTransition,
  canTransition,
  isTerminal,
  nextStatusAfterPixVerification,
  nextStatusAfterTopupStatus,
  pairKey,
  topupMayExist,
} from "./state-machine.ts";
import {
  ORDER_STATUSES,
  type ActorKind,
  type OrderStatus,
  type PixExpected,
  type RechargeSettings,
} from "./types.ts";

const settings: RechargeSettings = {
  enabled: true,
  minCents: 1000,
  maxCents: 20000,
  feeBps: 0,
  feeFixedCents: 0,
  dailyLimitPerUserCents: 50000,
  pixExpiryMinutes: 15,
};
const now = new Date("2026-11-05T12:00:00Z");
const expected: PixExpected = {
  amountCents: 1500,
  receiverKey: "chave-falai",
  expiresAt: pixExpiresAt(now, 15),
};

describe("telefone", () => {
  it("aceita celular com e sem +55", () => {
    assert.deepEqual(normalizeBrPhone("(11) 99411-4386"), { countryCode: 55, stateCode: 11, number: "994114386" });
    assert.deepEqual(normalizeBrPhone("+55 11 99411-4386"), { countryCode: 55, stateCode: 11, number: "994114386" });
  });
  it("aceita fixo de 8 dígitos", () => {
    assert.deepEqual(normalizeBrPhone("1134567890"), { countryCode: 55, stateCode: 11, number: "34567890" });
  });
  it("rejeita números inválidos", () => {
    for (const bad of ["", "123", "00999999999", "1188888888888", "11 89411-4386", "10 99411-4386", "11 11411-4386"]) {
      assert.equal(normalizeBrPhone(bad), null, bad);
    }
  });
  it("mascara o número", () => {
    const phone = normalizeBrPhone("11994114386")!;
    assert.equal(maskPhone(phone), "(11) *****-4386");
  });
});

describe("taxa e validação do pedido", () => {
  it("calcula taxa percentual arredondada mais fixa, em centavos", () => {
    assert.equal(computeFeeCents(1000, { feeBps: 250, feeFixedCents: 50 }), 75);
    assert.equal(computeFeeCents(1001, { feeBps: 150, feeFixedCents: 0 }), 15);
  });
  it("aceita um pedido válido e calcula total", () => {
    const r = validateOrderRequest(
      { phone: "11994114386", amountCents: 1500, providerId: 2087 },
      { settings: { ...settings, feeBps: 200 }, spentTodayCents: 0 },
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.feeCents, 30);
      assert.equal(r.value.totalCents, 1530);
    }
  });
  it("reúne vários erros", () => {
    const r = validateOrderRequest(
      { phone: "123", amountCents: 50, providerId: 0 },
      { settings, spentTodayCents: 0 },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors.sort(), ["below_min", "invalid_phone", "invalid_provider"].sort());
  });
  it("rejeita quando desativado, fora dos limites, valor não oferecido e limite diário", () => {
    const base = { phone: "11994114386", amountCents: 1500, providerId: 1 };
    const err = (over: Partial<typeof base>, ctx: Parameters<typeof validateOrderRequest>[1]) => {
      const r = validateOrderRequest({ ...base, ...over }, ctx);
      return r.ok ? [] : r.errors;
    };
    assert.deepEqual(err({}, { settings: { ...settings, enabled: false }, spentTodayCents: 0 }), ["disabled"]);
    assert.deepEqual(err({ amountCents: 30000 }, { settings, spentTodayCents: 0 }), ["above_max"]);
    assert.deepEqual(err({}, { settings, spentTodayCents: 0, allowedAmountsCents: [1000, 2000] }), ["amount_not_offered"]);
    assert.deepEqual(err({}, { settings, spentTodayCents: 49000 }), ["daily_limit_exceeded"]);
  });
  it("rejeita valores não inteiros ou não finitos", () => {
    for (const amountCents of [15.5, NaN, Infinity, -100, 0]) {
      const r = validateOrderRequest(
        { phone: "11994114386", amountCents, providerId: 1 },
        { settings, spentTodayCents: 0 },
      );
      assert.equal(r.ok, false);
    }
  });
});

describe("clientRequestId", () => {
  it("é o id do pedido, estável e dentro de 200 caracteres", () => {
    const id = "8292F923-DF12-494A-8BC8-6DE9AD420CB4";
    assert.equal(buildClientRequestId(id), id.toLowerCase());
    assert.equal(buildClientRequestId(id), buildClientRequestId(id));
    assert.ok(buildClientRequestId(id).length <= 200);
  });
  it("rejeita ids que não são UUID", () => {
    assert.throws(() => buildClientRequestId("pedido-1"));
    assert.throws(() => buildClientRequestId(""));
  });
});

describe("verificação do pagamento PIX", () => {
  it("pagamento pendente dentro do prazo", () => {
    assert.deepEqual(verifyPixPayment(expected, { status: "pending" }, now), { outcome: "pending" });
  });
  it("pendente após o prazo vira expirado", () => {
    const later = new Date(now.getTime() + 16 * 60_000);
    assert.equal(isPixExpired(expected.expiresAt, later), true);
    assert.deepEqual(verifyPixPayment(expected, { status: "pending" }, later), { outcome: "expired" });
  });
  it("pagamento confirmado correto", () => {
    const paid = { status: "confirmed", paidAmountCents: 1500, receiverKey: "chave-falai", paidAt: now } as const;
    assert.deepEqual(verifyPixPayment(expected, paid, now), { outcome: "confirmed" });
  });
  it("valor pago diferente do esperado", () => {
    const r = verifyPixPayment(expected, { status: "confirmed", paidAmountCents: 1000, receiverKey: "chave-falai" }, now);
    assert.deepEqual(r, { outcome: "mismatch", reason: "amount" });
  });
  it("recebedor diferente", () => {
    const r = verifyPixPayment(expected, { status: "confirmed", paidAmountCents: 1500, receiverKey: "outra" }, now);
    assert.deepEqual(r, { outcome: "mismatch", reason: "receiver" });
  });
  it("confirmação sem dados completos não é aceita", () => {
    assert.deepEqual(verifyPixPayment(expected, { status: "confirmed" }, now), { outcome: "mismatch", reason: "missing_data" });
  });
  it("pagamento depois do vencimento é tratado como tardio", () => {
    const paidAt = new Date(expected.expiresAt.getTime() + 1000);
    const r = verifyPixPayment(expected, { status: "confirmed", paidAmountCents: 1500, receiverKey: "chave-falai", paidAt }, now);
    assert.deepEqual(r, { outcome: "late_payment" });
  });
  it("status desconhecido, expirado e cancelado", () => {
    assert.deepEqual(verifyPixPayment(expected, { status: "unknown" }, now), { outcome: "unknown_status" });
    assert.deepEqual(verifyPixPayment(expected, { status: "expired" }, now), { outcome: "expired" });
    assert.deepEqual(verifyPixPayment(expected, { status: "canceled" }, now), { outcome: "canceled" });
  });
});

describe("transições permitidas", () => {
  const allowed: Array<[OrderStatus, OrderStatus, ActorKind]> = [
    ["pix_pending", "pix_confirmed", "webhook"],
    ["pix_pending", "pix_confirmed", "reconcile"],
    ["pix_pending", "pix_expired", "reconcile"],
    ["pix_pending", "needs_review", "system"],
    ["pix_expired", "needs_review", "webhook"],
    ["pix_confirmed", "topup_submitting", "system"],
    ["topup_submitting", "topup_pending", "system"],
    ["topup_submitting", "topup_done", "reconcile"],
    ["topup_submitting", "needs_review", "reconcile"],
    ["topup_pending", "topup_done", "reconcile"],
    ["topup_pending", "topup_failed", "reconcile"],
    ["topup_failed", "needs_review", "system"],
    ["needs_review", "topup_submitting", "admin"],
    ["needs_review", "topup_done", "admin"],
    ["needs_review", "topup_done", "reconcile"],
    ["needs_review", "closed", "admin"],
  ];
  for (const [from, to, actor] of allowed) {
    it(`${from} -> ${to} por ${actor}`, () => {
      assert.equal(canTransition(from, to, actor), true);
      assert.doesNotThrow(() => assertTransition(from, to, actor));
    });
  }
});

describe("transições proibidas", () => {
  it("o usuário (frontend) não pode executar nenhuma transição", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        assert.equal(canTransition(from, to, "user"), false, pairKey(from, to));
      }
    }
  });
  it("não é possível pular o pagamento: pix_pending não vai direto para a recarga", () => {
    for (const to of ["topup_submitting", "topup_pending", "topup_done"] as const) {
      assert.equal(canTransition("pix_pending", to, "system"), false);
    }
  });
  it("pix_expired nunca vira recarga sem revisão", () => {
    assert.equal(canTransition("pix_expired", "pix_confirmed", "webhook"), false);
    assert.equal(canTransition("pix_expired", "topup_submitting", "system"), false);
  });
  it("não há reenvio automático: só o admin sai de needs_review para topup_submitting", () => {
    for (const actor of ["system", "webhook", "reconcile", "user"] as const) {
      assert.equal(canTransition("needs_review", "topup_submitting", actor), false, actor);
    }
    assert.equal(canTransition("topup_submitting", "topup_submitting", "system"), false);
    assert.equal(canTransition("topup_pending", "topup_submitting", "system"), false);
    assert.equal(canTransition("topup_failed", "topup_submitting", "system"), false);
  });
  it("só o admin fecha um caso em revisão", () => {
    for (const actor of ["system", "webhook", "reconcile", "user"] as const) {
      assert.equal(canTransition("needs_review", "closed", actor), false);
    }
  });
  it("admin não atua fora de needs_review", () => {
    assert.equal(canTransition("pix_pending", "pix_confirmed", "admin"), false);
    assert.equal(canTransition("pix_confirmed", "topup_submitting", "admin"), false);
  });
  it("estados terminais não têm saída", () => {
    for (const s of ["topup_done", "closed"] as const) {
      assert.equal(isTerminal(s), true);
      for (const to of ORDER_STATUSES) assert.equal(canTransition(s, to, "admin"), false);
    }
  });
  it("recarga concluída nunca regride", () => {
    assert.equal(canTransition("topup_done", "topup_pending", "reconcile"), false);
    assert.equal(canTransition("topup_done", "topup_failed", "reconcile"), false);
  });
  it("assertTransition lança nos casos proibidos", () => {
    assert.throws(() => assertTransition("pix_pending", "topup_done", "system"), /not allowed/);
    assert.throws(() => assertTransition("needs_review", "closed", "system"), /may not perform/);
  });
});

describe("decisões a partir do PIX", () => {
  it("pendente não muda nada", () => {
    assert.equal(nextStatusAfterPixVerification("pix_pending", { outcome: "pending" }), null);
  });
  it("confirmado avança para pix_confirmed", () => {
    assert.deepEqual(nextStatusAfterPixVerification("pix_pending", { outcome: "confirmed" }), { status: "pix_confirmed" });
  });
  it("confirmação duplicada é idempotente", () => {
    for (const s of ["pix_confirmed", "topup_submitting", "topup_pending", "topup_done"] as const) {
      assert.equal(nextStatusAfterPixVerification(s, { outcome: "confirmed" }), null, s);
    }
  });
  it("confirmação após expirar vai para revisão", () => {
    assert.deepEqual(nextStatusAfterPixVerification("pix_expired", { outcome: "confirmed" }), {
      status: "needs_review",
      reviewReason: "late_payment",
    });
  });
  it("expirado e cancelado", () => {
    assert.deepEqual(nextStatusAfterPixVerification("pix_pending", { outcome: "expired" }), { status: "pix_expired" });
    assert.deepEqual(nextStatusAfterPixVerification("pix_pending", { outcome: "canceled" }), { status: "pix_expired" });
    assert.equal(nextStatusAfterPixVerification("topup_pending", { outcome: "expired" }), null);
  });
  it("valor ou recebedor divergente vai para revisão", () => {
    assert.deepEqual(nextStatusAfterPixVerification("pix_pending", { outcome: "mismatch", reason: "amount" }), {
      status: "needs_review",
      reviewReason: "amount_mismatch",
    });
    assert.deepEqual(nextStatusAfterPixVerification("pix_pending", { outcome: "mismatch", reason: "receiver" }), {
      status: "needs_review",
      reviewReason: "receiver_mismatch",
    });
  });
  it("status de PIX desconhecido vai para revisão", () => {
    assert.deepEqual(nextStatusAfterPixVerification("pix_pending", { outcome: "unknown_status" }), {
      status: "needs_review",
      reviewReason: "unknown_pix_status",
    });
  });
  it("toda decisão devolvida é uma transição permitida para um ator de servidor", () => {
    const outcomes = [
      { outcome: "confirmed" }, { outcome: "expired" }, { outcome: "canceled" }, { outcome: "late_payment" },
      { outcome: "mismatch", reason: "amount" }, { outcome: "mismatch", reason: "receiver" },
      { outcome: "mismatch", reason: "missing_data" }, { outcome: "unknown_status" },
    ] as const;
    for (const from of ORDER_STATUSES) {
      for (const o of outcomes) {
        const d = nextStatusAfterPixVerification(from, o);
        if (d) assert.equal(canTransition(from, d.status, "webhook"), true, `${from} ${o.outcome}`);
      }
    }
  });
});

describe("decisões a partir do status da recarga (Celcoin)", () => {
  it("recarga em processamento permanece pendente", () => {
    assert.deepEqual(nextStatusAfterTopupStatus("topup_submitting", "INITIATED"), { status: "topup_pending" });
    assert.deepEqual(nextStatusAfterTopupStatus("topup_submitting", "PROCESSING"), { status: "topup_pending" });
    assert.equal(nextStatusAfterTopupStatus("topup_pending", "PROCESSING"), null);
  });
  it("sucesso", () => {
    assert.deepEqual(nextStatusAfterTopupStatus("topup_pending", "CONFIRMED"), { status: "topup_done" });
    assert.deepEqual(nextStatusAfterTopupStatus("topup_submitting", "confirmed"), { status: "topup_done" });
  });
  it("erro", () => {
    assert.deepEqual(nextStatusAfterTopupStatus("topup_pending", "ERROR"), { status: "topup_failed" });
  });
  it("status desconhecido ou ausente exige revisão manual", () => {
    for (const s of ["PAUSED", "", null, undefined, "SUCESSO"]) {
      assert.deepEqual(nextStatusAfterTopupStatus("topup_pending", s), {
        status: "needs_review",
        reviewReason: "topup_unknown_status",
      });
    }
  });
  it("resultado repetido ou em estado final não regride", () => {
    assert.equal(nextStatusAfterTopupStatus("topup_done", "PROCESSING"), null);
    assert.equal(nextStatusAfterTopupStatus("topup_done", "ERROR"), null);
    assert.equal(nextStatusAfterTopupStatus("closed", "CONFIRMED"), null);
  });
  it("revisão manual pode ser resolvida pela reconciliação quando a Celcoin confirma", () => {
    const d = nextStatusAfterTopupStatus("needs_review", "CONFIRMED");
    assert.deepEqual(d, { status: "topup_done" });
    assert.equal(canTransition("needs_review", "topup_done", "reconcile"), true);
  });
  it("em revisão, ERRO ou processamento não mudam o estado sozinhos", () => {
    assert.equal(nextStatusAfterTopupStatus("needs_review", "ERROR"), null);
    assert.equal(nextStatusAfterTopupStatus("needs_review", "PROCESSING"), null);
  });
});

describe("recarga já enviada", () => {
  it("identifica estados em que a recarga pode existir no provedor", () => {
    assert.equal(topupMayExist("pix_confirmed"), false);
    assert.equal(topupMayExist("topup_submitting"), true);
    assert.equal(topupMayExist("topup_pending"), true);
  });
});

describe("consistência com o SQL proposto", () => {
  const sql = readFileSync(
    fileURLToPath(new URL("../../../docs/recharge/proposed-schema.sql", import.meta.url)),
    "utf8",
  );
  const arrayOf = (name: string): string[] => {
    const m = sql.match(new RegExp(`${name} constant text\\[\\] := array\\[([\\s\\S]*?)\\];`));
    assert.ok(m, `${name} não encontrado no SQL`);
    return [...m![1].matchAll(/'([a-z_]+>[a-z_]+)'/g)].map((x) => x[1]).sort();
  };
  it("lista de transições idêntica", () => {
    const ts = ORDER_STATUSES.flatMap((f) => TRANSITIONS[f].map((t) => pairKey(f, t))).sort();
    assert.deepEqual(arrayOf("v_allowed"), ts);
  });
  it("regras de ator idênticas", () => {
    assert.deepEqual(arrayOf("v_admin_only"), [...ADMIN_ONLY_PAIRS].sort());
    assert.deepEqual(arrayOf("v_admin_or_reconcile"), [...ADMIN_OR_RECONCILE_PAIRS].sort());
  });
  it("lista de status do CHECK idêntica", () => {
    const m = sql.match(/status text not null default 'pix_pending' check \(status in \(([\s\S]*?)\)\)/);
    assert.ok(m);
    const found = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    assert.deepEqual(found, [...ORDER_STATUSES].sort());
  });
});
