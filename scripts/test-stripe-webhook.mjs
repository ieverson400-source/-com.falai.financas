#!/usr/bin/env node
/**
 * Teste automatizado do webhook Stripe.
 *
 * Simula um evento `customer.subscription.created` assinado com
 * PAYMENTS_SANDBOX_WEBHOOK_SECRET, envia para o endpoint público
 * `/api/public/payments/webhook?env=sandbox` e valida via Supabase
 * REST se a linha na tabela `subscriptions` foi criada/atualizada
 * corretamente com plano ativo.
 *
 * Uso:
 *   PAYMENTS_SANDBOX_WEBHOOK_SECRET=whsec_... \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   TEST_USER_ID=<uuid do auth.users> \
 *   [WEBHOOK_URL=https://falai-finan-as.lovable.app/api/public/payments/webhook] \
 *   [PLAN=pro|premium|familia] \
 *   node scripts/test-stripe-webhook.mjs
 */
import { createHmac, randomUUID } from "node:crypto";

const {
  PAYMENTS_SANDBOX_WEBHOOK_SECRET: SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TEST_USER_ID,
  WEBHOOK_URL = "https://falai-finan-as.lovable.app/api/public/payments/webhook",
  PLAN = "pro",
} = process.env;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!SECRET) fail("PAYMENTS_SANDBOX_WEBHOOK_SECRET não definido");
if (!SUPABASE_URL) fail("SUPABASE_URL não definido");
if (!SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY não definido");
if (!TEST_USER_ID) fail("TEST_USER_ID não definido");
if (!["pro", "premium", "familia"].includes(PLAN)) fail(`PLAN inválido: ${PLAN}`);

const lookupKey = `${PLAN}_monthly`;
const subscriptionId = `sub_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
const customerId = `cus_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
const now = Math.floor(Date.now() / 1000);
const periodEnd = now + 30 * 24 * 60 * 60;

const event = {
  id: `evt_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
  object: "event",
  type: "customer.subscription.created",
  api_version: "2026-03-25.dahlia",
  created: now,
  data: {
    object: {
      id: subscriptionId,
      object: "subscription",
      customer: customerId,
      status: "active",
      cancel_at_period_end: false,
      current_period_end: periodEnd,
      metadata: { userId: TEST_USER_ID },
      items: {
        object: "list",
        data: [
          {
            id: `si_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
            current_period_end: periodEnd,
            current_period_start: now,
            price: {
              id: `price_test_${PLAN}`,
              lookup_key: lookupKey,
              product: `prod_test_${PLAN}`,
            },
          },
        ],
      },
    },
  },
};

const body = JSON.stringify(event);
const timestamp = now;
const signature = createHmac("sha256", SECRET)
  .update(`${timestamp}.${body}`)
  .digest("hex");
const stripeSignature = `t=${timestamp},v1=${signature}`;

const url = `${WEBHOOK_URL}?env=sandbox`;
console.log(`▶️  POST ${url}`);
console.log(`   user=${TEST_USER_ID} plan=${PLAN} sub=${subscriptionId}`);

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": stripeSignature },
  body,
});
const text = await res.text();
if (!res.ok) fail(`Webhook respondeu ${res.status}: ${text}`);
console.log(`✅ Webhook OK (${res.status}): ${text}`);

// Aguarda propagação
await new Promise((r) => setTimeout(r, 1500));

const rest = `${SUPABASE_URL}/rest/v1/subscriptions?provider_subscription_id=eq.${subscriptionId}&select=*`;
const dbRes = await fetch(rest, {
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
if (!dbRes.ok) fail(`Erro consultando subscriptions: ${dbRes.status} ${await dbRes.text()}`);
const rows = await dbRes.json();
if (!rows.length) fail("Linha não encontrada em subscriptions — webhook não gravou");

const row = rows[0];
const checks = [
  ["user_id", row.user_id === TEST_USER_ID],
  ["plan", row.plan === PLAN],
  ["status", row.status === "active"],
  ["provider", row.provider === "stripe"],
  ["current_period_end", !!row.current_period_end],
];
let ok = true;
for (const [k, pass] of checks) {
  console.log(`${pass ? "✅" : "❌"} ${k} = ${JSON.stringify(row[k])}`);
  if (!pass) ok = false;
}

// Cleanup
await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?provider_subscription_id=eq.${subscriptionId}`, {
  method: "DELETE",
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
console.log("🧹 Linha de teste removida");

if (!ok) fail("Uma ou mais asserções falharam");
console.log("\n🎉 Webhook Stripe atualiza subscriptions corretamente");
