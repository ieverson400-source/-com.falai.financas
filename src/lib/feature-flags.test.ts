/// <reference types="node" />
// Executar com: node --test src/lib/feature-flags.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_FLAG_ENV, readFeatureFlags, type FeatureFlagKey } from "./feature-flags.ts";

const KEYS: FeatureFlagKey[] = ["subscriptions", "openFinance", "recharge"];

describe("flags de recursos em liberação", () => {
  it("padrão: os três recursos vêm ligados (vitrine Em breve)", () => {
    assert.deepEqual(readFeatureFlags({}), { subscriptions: true, openFinance: true, recharge: true });
  });

  it("cada recurso desliga com false, 0, off ou no (qualquer caixa, com espaços)", () => {
    for (const key of KEYS) {
      for (const off of ["false", "FALSE", " False ", "0", "off", "OFF", "no", "No"]) {
        assert.equal(readFeatureFlags({ [FEATURE_FLAG_ENV[key]]: off })[key], false, `${key} ${JSON.stringify(off)}`);
      }
      for (const on of ["true", "1", "yes", "", "qualquer"]) {
        assert.equal(readFeatureFlags({ [FEATURE_FLAG_ENV[key]]: on })[key], true, `${key} ${JSON.stringify(on)}`);
      }
    }
  });

  it("cada recurso usa a sua própria variável", () => {
    assert.deepEqual(FEATURE_FLAG_ENV, {
      subscriptions: "SUBS_ENABLED",
      openFinance: "OF_ENABLED",
      recharge: "RECHARGE_ENABLED",
    });
    assert.deepEqual(readFeatureFlags({ OF_ENABLED: "false" }), { subscriptions: true, openFinance: false, recharge: true });
    assert.deepEqual(readFeatureFlags({ RECHARGE_ENABLED: "off" }), { subscriptions: true, openFinance: true, recharge: false });
    assert.deepEqual(readFeatureFlags({ SUBS_ENABLED: "0" }), { subscriptions: false, openFinance: true, recharge: true });
  });

  it("variáveis sem relação não alteram nada", () => {
    assert.deepEqual(
      readFeatureFlags({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "false", CELCOIN_CLIENT_ID: "false" }),
      { subscriptions: true, openFinance: true, recharge: true },
    );
  });
});
