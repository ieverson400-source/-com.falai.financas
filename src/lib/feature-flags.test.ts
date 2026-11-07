/// <reference types="node" />
// Executar com: node --test src/lib/feature-flags.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_FLAG_ENV, readFeatureFlags } from "./feature-flags.ts";

describe("flags de recursos em liberação", () => {
  it("tudo fica desligado por padrão", () => {
    assert.deepEqual(readFeatureFlags({}), { subscriptions: false, openFinance: false, recharge: false });
  });

  it("só o valor exato 'true' liga um recurso", () => {
    for (const bad of ["TRUE", "True", " true", "1", "yes", "on", "false", ""]) {
      assert.equal(readFeatureFlags({ SUBS_ENABLED: bad }).subscriptions, false, JSON.stringify(bad));
    }
    assert.equal(readFeatureFlags({ SUBS_ENABLED: "true" }).subscriptions, true);
  });

  it("cada recurso usa a sua própria variável", () => {
    assert.deepEqual(FEATURE_FLAG_ENV, {
      subscriptions: "SUBS_ENABLED",
      openFinance: "OF_ENABLED",
      recharge: "RECHARGE_ENABLED",
    });
    assert.deepEqual(readFeatureFlags({ OF_ENABLED: "true" }), { subscriptions: false, openFinance: true, recharge: false });
    assert.deepEqual(readFeatureFlags({ RECHARGE_ENABLED: "true" }), { subscriptions: false, openFinance: false, recharge: true });
  });

  it("variáveis sem relação não ligam nada", () => {
    assert.deepEqual(
      readFeatureFlags({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "true", CELCOIN_CLIENT_ID: "true" }),
      { subscriptions: false, openFinance: false, recharge: false },
    );
  });
});
