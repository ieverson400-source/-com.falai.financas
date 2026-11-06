/// <reference types="node" />
// Executar com: node --test src/lib/celcoin/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CELCOIN_SANDBOX_BASE_URL, CelcoinConfigError, describeConfig, loadCelcoinConfig } from "./config.server.ts";

const base = {
  CELCOIN_CLIENT_ID: "my-id-123",
  CELCOIN_CLIENT_SECRET: "my-secret-ABC",
  CELCOIN_ACCOUNT: "300000000001",
};

describe("configuração Celcoin (server-only)", () => {
  it("usa sandbox e URL padrão do sandbox", () => {
    const c = loadCelcoinConfig(base);
    assert.equal(c.environment, "sandbox");
    assert.equal(c.baseUrl, CELCOIN_SANDBOX_BASE_URL);
    assert.equal(c.timeoutMs, 15000);
    assert.equal(c.tokenContentType, "urlencoded");
    assert.equal(c.providersPathStyle, "v5");
  });

  it("lista só os NOMES das variáveis ausentes, sem valores", () => {
    try {
      loadCelcoinConfig({ CELCOIN_CLIENT_ID: "my-id-123" });
      assert.fail("deveria lançar");
    } catch (e) {
      assert.ok(e instanceof CelcoinConfigError);
      assert.deepEqual(e.missing.sort(), ["CELCOIN_ACCOUNT", "CELCOIN_CLIENT_SECRET"]);
      assert.ok(!e.message.includes("my-id-123"));
    }
  });

  it("não vaza segredos nas mensagens de erro", () => {
    const bad = { ...base, CELCOIN_BASE_URL: "http://sandbox.example.com" };
    try {
      loadCelcoinConfig(bad);
      assert.fail();
    } catch (e) {
      const msg = (e as Error).message;
      assert.ok(!msg.includes("my-secret-ABC") && !msg.includes("my-id-123"));
    }
  });

  it("exige https e host de sandbox no ambiente sandbox", () => {
    assert.throws(() => loadCelcoinConfig({ ...base, CELCOIN_BASE_URL: "http://sandbox.example.com" }), /https/);
    assert.throws(() => loadCelcoinConfig({ ...base, CELCOIN_BASE_URL: "https://api.example.com" }), /sandbox host/);
    assert.throws(() => loadCelcoinConfig({ ...base, CELCOIN_BASE_URL: "not a url" }), /valid URL/);
  });

  it("produção exige opt-in explícito e URL informada", () => {
    assert.throws(() => loadCelcoinConfig({ ...base, CELCOIN_ENV: "production" }), /disabled/);
    assert.throws(
      () => loadCelcoinConfig({ ...base, CELCOIN_ENV: "production", CELCOIN_ALLOW_PRODUCTION: "true" }),
      /CELCOIN_BASE_URL is required/,
    );
    assert.throws(
      () =>
        loadCelcoinConfig({
          ...base,
          CELCOIN_ENV: "production",
          CELCOIN_ALLOW_PRODUCTION: "true",
          CELCOIN_BASE_URL: "https://sandbox.example.com",
        }),
      /cannot use a sandbox host/,
    );
  });

  it("rejeita ambiente desconhecido e conta longa demais", () => {
    assert.throws(() => loadCelcoinConfig({ ...base, CELCOIN_ENV: "staging" }), /sandbox' or 'production/);
    assert.throws(() => loadCelcoinConfig({ ...base, CELCOIN_ACCOUNT: "1".repeat(21) }), /20 characters/);
  });

  it("limita o timeout e aceita as opções não confirmadas", () => {
    assert.equal(loadCelcoinConfig({ ...base, CELCOIN_TIMEOUT_MS: "1" }).timeoutMs, 1000);
    assert.equal(loadCelcoinConfig({ ...base, CELCOIN_TIMEOUT_MS: "999999" }).timeoutMs, 60000);
    const c = loadCelcoinConfig({ ...base, CELCOIN_TOKEN_CONTENT_TYPE: "multipart", CELCOIN_PROVIDERS_PATH_STYLE: "baas" });
    assert.equal(c.tokenContentType, "multipart");
    assert.equal(c.providersPathStyle, "baas");
  });

  it("describeConfig mascara segredos", () => {
    const text = JSON.stringify(describeConfig(loadCelcoinConfig(base)));
    assert.ok(!text.includes("my-secret-ABC"));
    assert.ok(!text.includes("my-id-123"));
    assert.ok(!text.includes("300000000001"));
    assert.ok(text.includes("[redacted]"));
  });
});
