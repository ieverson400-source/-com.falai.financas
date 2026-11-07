/// <reference types="node" />
// Executar com: node --test src/lib/feature-flags.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_FLAG_ENV, readFeatureFlags, type FeatureFlagKey } from "./feature-flags.ts";

const KEYS: FeatureFlagKey[] = ["subscriptions", "openFinance", "recharge", "assistant"];
const ALL_ON = { subscriptions: true, openFinance: true, recharge: true, assistant: true };

describe("flags de recursos em liberação", () => {
  it("padrão: todos os recursos vêm ligados", () => {
    assert.deepEqual(readFeatureFlags({}), ALL_ON);
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
      assistant: "ASSISTANT_ENABLED",
    });
    assert.deepEqual(readFeatureFlags({ OF_ENABLED: "false" }), { ...ALL_ON, openFinance: false });
    assert.deepEqual(readFeatureFlags({ RECHARGE_ENABLED: "off" }), { ...ALL_ON, recharge: false });
    assert.deepEqual(readFeatureFlags({ SUBS_ENABLED: "0" }), { ...ALL_ON, subscriptions: false });
    assert.deepEqual(readFeatureFlags({ ASSISTANT_ENABLED: "no" }), { ...ALL_ON, assistant: false });
  });

  it("variáveis sem relação não alteram nada", () => {
    assert.deepEqual(readFeatureFlags({ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "false", CELCOIN_CLIENT_ID: "false" }), ALL_ON);
  });
});
