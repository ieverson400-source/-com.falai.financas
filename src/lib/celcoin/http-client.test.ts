/// <reference types="node" />
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CelcoinHttpClient, TOKEN_PATH } from "./http-client.server.ts";
import { CelcoinNetworkError, CelcoinTokenError } from "./errors.ts";
import { TEST_CONFIG, TOKEN_OK, installNetworkGuard, makeFakeFetch } from "./test-support.ts";

let guard: ReturnType<typeof installNetworkGuard>;
beforeEach(() => {
  guard = installNetworkGuard();
});
afterEach(() => {
  assert.equal(guard.attempts(), 0, "o fetch global não pode ser usado");
  guard.restore();
});

describe("cliente HTTP: OAuth 2.0", () => {
  it("exige um fetch injetado (nunca usa a rede por padrão)", () => {
    assert.throws(() => new CelcoinHttpClient(TEST_CONFIG, {} as never), /explicit fetch/);
  });

  it("não solicita token na construção", () => {
    const f = makeFakeFetch(() => TOKEN_OK);
    new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch });
    assert.equal(f.calls.length, 0);
  });

  it("pede token com client_credentials em urlencoded e reutiliza em cache", async () => {
    const f = makeFakeFetch((c) => (c.url.endsWith(TOKEN_PATH) ? TOKEN_OK : { status: 200, json: { ok: 1 } }));
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch, now: () => 0 });
    await client.request("GET", "/x");
    await client.request("GET", "/y");
    const tokenCalls = f.calls.filter((c) => c.url.endsWith(TOKEN_PATH));
    assert.equal(tokenCalls.length, 1);
    assert.equal(tokenCalls[0].headers["Content-Type"], "application/x-www-form-urlencoded");
    const params = new URLSearchParams(String(tokenCalls[0].body));
    assert.equal(params.get("grant_type"), "client_credentials");
    assert.equal(params.get("client_id"), TEST_CONFIG.clientId);
    assert.equal(f.calls.find((c) => c.url.endsWith("/x"))!.headers.Authorization, "Bearer tok-abc");
  });

  it("suporta multipart quando configurado", async () => {
    const f = makeFakeFetch(() => TOKEN_OK);
    const client = new CelcoinHttpClient({ ...TEST_CONFIG, tokenContentType: "multipart" }, { fetch: f.fetch });
    await client.ensureToken();
    assert.ok(f.calls[0].body instanceof FormData);
    assert.equal(f.calls[0].headers["Content-Type"], undefined);
  });

  it("renova o token antes de expirar", async () => {
    let t = 0;
    const f = makeFakeFetch(() => TOKEN_OK);
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch, now: () => t });
    await client.ensureToken();
    t = 2300 * 1000; // ainda válido (margem de 60 s só começa em 2340 s)
    await client.ensureToken();
    assert.equal(f.calls.length, 1);
    t = 2350 * 1000; // dentro da margem de 60 s antes dos 2400 s
    await client.ensureToken();
    assert.equal(f.calls.length, 2);
  });

  it("chamadas simultâneas compartilham uma única requisição de token", async () => {
    const f = makeFakeFetch(async () => TOKEN_OK);
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch });
    await Promise.all([client.ensureToken(), client.ensureToken(), client.ensureToken()]);
    assert.equal(f.calls.length, 1);
  });

  it("falha de token vira CelcoinTokenError sem vazar segredo", async () => {
    const f = makeFakeFetch(() => ({ status: 400, json: { errorCode: "999", message: "invalid secret" } }));
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch });
    await assert.rejects(client.ensureToken(), (e: unknown) => {
      assert.ok(e instanceof CelcoinTokenError);
      assert.equal(e.code, "999");
      assert.ok(!e.message.includes(TEST_CONFIG.clientSecret));
      return true;
    });
  });

  it("timeout na chamada vira CelcoinNetworkError(timeout) e na rede vira (network)", async () => {
    const hang = makeFakeFetch((c) => (c.url.endsWith(TOKEN_PATH) ? TOKEN_OK : { hang: true }));
    const c1 = new CelcoinHttpClient(TEST_CONFIG, { fetch: hang.fetch });
    await assert.rejects(c1.request("GET", "/x"), (e: unknown) => e instanceof CelcoinNetworkError && e.kind === "timeout");

    const broken = makeFakeFetch((c) => (c.url.endsWith(TOKEN_PATH) ? TOKEN_OK : { throw: true }));
    const c2 = new CelcoinHttpClient(TEST_CONFIG, { fetch: broken.fetch });
    await assert.rejects(c2.request("GET", "/x"), (e: unknown) => e instanceof CelcoinNetworkError && e.kind === "network");
  });

  it("401 invalida o token; só refaz a consulta quando retryOn401 está ativo", async () => {
    let apiCalls = 0;
    const f = makeFakeFetch((c) => {
      if (c.url.endsWith(TOKEN_PATH)) return TOKEN_OK;
      apiCalls += 1;
      return apiCalls === 1 ? { status: 401, json: {} } : { status: 200, json: { ok: true } };
    });
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch });
    const r = await client.request("GET", "/x", { retryOn401: true });
    assert.equal(r.status, 200);
    assert.equal(f.calls.filter((c) => c.url.endsWith(TOKEN_PATH)).length, 2);

    apiCalls = 0;
    const g = makeFakeFetch((c) => (c.url.endsWith(TOKEN_PATH) ? TOKEN_OK : { status: 401, json: {} }));
    const c2 = new CelcoinHttpClient(TEST_CONFIG, { fetch: g.fetch });
    const post = await c2.request("POST", "/x", { jsonBody: { a: 1 } });
    assert.equal(post.status, 401);
    assert.equal(g.calls.filter((c) => c.method === "POST" && c.url.endsWith("/x")).length, 1, "POST nunca é repetido");
  });

  it("monta query string ignorando valores vazios e envia JSON", async () => {
    const f = makeFakeFetch((c) => (c.url.endsWith(TOKEN_PATH) ? TOKEN_OK : { status: 200, json: {} }));
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch });
    await client.request("GET", "/q", { query: { a: 1, b: undefined, c: "" } });
    assert.equal(f.calls.at(-1)!.url, "https://sandbox.example.test/q?a=1");
    await client.request("POST", "/p", { jsonBody: { z: 1 } });
    assert.equal(f.calls.at(-1)!.headers["Content-Type"], "application/json");
    assert.equal(f.calls.at(-1)!.body, '{"z":1}');
  });
});
