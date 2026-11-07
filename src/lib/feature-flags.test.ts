/// <reference types="node" />
// Executar com: node --test src/lib/feature-flags.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_FLAG_ENV, readFeatureFlags } from "./feature-flags.ts";

describe("flags de recursos em liberação", () => {
  it("padrão: assinaturas ligada (vitrine); Open Finance e recarga desligados", () => {
    assert.deepEqual(readFeatureFlags({}), { subscriptions: true, openFinance: false, recharge: false });
  });

  it("Open Finance e recarga: só o valor exato 'true' liga", () => {
    for (const bad of ["TRUE", "True", " true", "1", "yes", "on", "false", ""]) {
      assert.equal(readFeatureFlags({ OF_ENABLED: bad }).openFinance, false, JSON.stringify(bad));
      assert.equal(readFeatureFlags({ RECHARGE_ENABLED: bad }).recharge, false, JSON.stringify(bad));
    }
    assert.equal(readFeatureFlags({ OF_ENABLED: "true" }).openFinance, true);
    assert.equal(readFeatureFlags({ RECHARGE_ENABLED: "true" }).recharge, true);
  });

  it("assinaturas: desliga com false, 0, off ou no (qualquer caixa, com espaços)", () => {
    for (const off of ["false", "FALSE", " False ", "0", "off", "OFF", "no", "No"]) {
      assert.equal(readFeatureFlags({ SUBS_ENABLED: off }).subscriptions, false, JSON.stringify(off));
    }
    for (const on of ["true", "1", "yes", "", "qualquer"]) {
      assert.equal(readFeatureFlags({ SUBS_ENABLED: on }).subscriptions, true, JSON.stringify(on));
    }
  });

  it("cada recurso usa a sua própria variável", () => {
    assert.deepEqual(FEATURE_FLAG_ENV, {
      subscriptions: "SUBS_ENABLED",
      openFinance: "OF_ENABLED",
      recharge: "RECHARGE_ENABLED",
    });
    assert.deepEqual(readFeatureFlags({ OF_ENABLED: "true" }), { subscriptions: true, openFinance: true, recharge: false });
    assert.deepEqual(readFeatureFlags({ RECHARGE_ENABLED: "true" }), { subscriptions: true, openFinance: false, recharge: true });
  });

  it("variáveis sem relação não alteram nada", () => {
    assert.deepEqual(
      readFeatureFlags({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "true", CELCOIN_CLIENT_ID: "true" }),
      { subscriptions: true, openFinance: false, recharge: false },
    );
  });
});
