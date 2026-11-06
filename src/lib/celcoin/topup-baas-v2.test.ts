/// <reference types="node" />
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CelcoinHttpClient, TOKEN_PATH } from "./http-client.server.ts";
import { TOPUP_PATH, createBaasV2TopupProvider, parseOperators, parseProviderValues, validateCreateRequest } from "./topup-baas-v2.server.ts";
import { classifyTopupErrorCode, CelcoinHttpError } from "./errors.ts";
import { exactAmountsCents, type CreateTopupRequest } from "./topup-provider.ts";
import { TEST_CONFIG, TOKEN_OK, installNetworkGuard, makeFakeFetch, type FakeCall, type FakeReply } from "./test-support.ts";

let guard: ReturnType<typeof installNetworkGuard>;
beforeEach(() => {
  guard = installNetworkGuard();
});
afterEach(() => {
  assert.equal(guard.attempts(), 0, "o fetch global não pode ser usado");
  guard.restore();
});

const ORDER_ID = "8292f923-df12-494a-8bc8-6de9ad420cb4";
const request: CreateTopupRequest = {
  clientRequestId: ORDER_ID,
  providerId: 2087,
  amountCents: 1300,
  phone: { countryCode: 55, stateCode: 11, number: "994114386" },
  tags: [{ key: "orderId", value: ORDER_ID }],
};

function setup(api: (c: FakeCall, n: number) => FakeReply | Promise<FakeReply>, config = TEST_CONFIG) {
  const f = makeFakeFetch((c, n) => (c.url.endsWith(TOKEN_PATH) ? TOKEN_OK : api(c, n)));
  const client = new CelcoinHttpClient(config, { fetch: f.fetch });
  return { provider: createBaasV2TopupProvider(client, config), calls: f.calls };
}
const topupCalls = (calls: FakeCall[], method: string) =>
  calls.filter((c) => c.method === method && c.url.includes(TOPUP_PATH));

describe("adaptador BaaS v2: operadoras e valores", () => {
  it("lê operadoras no formato de array (referência) e no de objeto (tutorial)", () => {
    const item = { providerId: 2125, name: "Op", category: 1, tipoRecarganameProvider: 2, minValue: 10, maxValue: 100 };
    const a = parseOperators([item]);
    const b = parseOperators({ providers: [{ ...item, TipoRecarganameProvider: "1", tipoRecarganameProvider: undefined }] });
    assert.deepEqual(a, [{ providerId: 2125, name: "Op", category: 1, kind: "online", minCents: 1000, maxCents: 10000 }]);
    assert.equal(b[0].kind, "pin");
    assert.deepEqual(parseOperators(null), []);
    assert.deepEqual(parseOperators([{ name: "sem id" }]), []);
  });

  it("consulta operadoras com os parâmetros documentados (caminho v5 por padrão)", async () => {
    const { provider, calls } = setup(() => ({ status: 200, json: [{ providerId: 1, name: "X", category: 1 }] }));
    const ops = await provider.listProviders({ stateCode: 11 });
    assert.equal(ops.length, 1);
    const url = new URL(calls.at(-1)!.url);
    assert.equal(url.pathname, "/v5/transactions/topups/providers");
    assert.equal(url.searchParams.get("stateCode"), "11");
    assert.equal(url.searchParams.get("type"), "0");
    assert.equal(url.searchParams.get("category"), "0");
  });

  it("usa o caminho /baas/v2/topup/* quando configurado", async () => {
    const { provider, calls } = setup(() => ({ status: 200, json: { value: [] } }), { ...TEST_CONFIG, providersPathStyle: "baas" });
    await provider.listProviderValues({ stateCode: 11, providerId: 2125 });
    assert.equal(new URL(calls.at(-1)!.url).pathname, "/baas/v2/topup/provider-values");
  });

  it("interpreta valores disponíveis e identifica quantias exatas", async () => {
    const json = {
      value: [
        { productName: "R$ 10", code: "a", minValue: 10, maxValue: 10, cost: 9.5 },
        { productName: "faixa", code: "b", minValue: 15, maxValue: 100 },
      ],
      errorCode: "000",
      status: 0,
    };
    const { provider } = setup(() => ({ status: 200, json }));
    const values = await provider.listProviderValues({ stateCode: 11, providerId: 1 });
    assert.equal(values.length, 2);
    assert.equal(values[0].costCents, 950);
    assert.deepEqual(exactAmountsCents(values), [1000]);
    assert.deepEqual(parseProviderValues({}), []);
  });

  it("consultas somente leitura que falham lançam CelcoinHttpError", async () => {
    const { provider } = setup(() => ({ status: 500, json: {} }));
    await assert.rejects(provider.listProviders({ stateCode: 11 }), CelcoinHttpError);
  });
});

describe("adaptador BaaS v2: solicitação de recarga", () => {
  it("envia o corpo documentado (valor em reais, conta como string, sem signerCode)", async () => {
    const { provider, calls } = setup(() => ({
      status: 200,
      json: { version: "1.0.0", status: "SUCCESS", body: { id: "tx-1", clientRequestId: ORDER_ID } },
    }));
    const r = await provider.createTopup(request);
    assert.deepEqual(r, { outcome: "created", transactionId: "tx-1", clientRequestId: ORDER_ID });
    const post = topupCalls(calls, "POST");
    assert.equal(post.length, 1);
    const body = JSON.parse(String(post[0].body));
    assert.deepEqual(body, {
      amount: 13,
      providerId: 2087,
      account: TEST_CONFIG.account,
      clientRequestId: ORDER_ID,
      topupData: { countryCode: 55, stateCode: 11, number: "994114386" },
      tags: [{ key: "orderId", value: ORDER_ID }],
    });
    assert.ok(!("signerCode" in body));
    assert.equal(post[0].headers.Authorization, "Bearer tok-abc");
  });

  it("solicitação duplicada (ITBE011) pede consulta e não é falha", async () => {
    const { provider } = setup(() => ({ status: 400, json: { errorCode: "ITBE011", message: "Já existe" } }));
    assert.deepEqual(await provider.createTopup(request), { outcome: "duplicate", code: "ITBE011" });
  });

  it("erros de validação documentados são 'rejected' (nada foi criado)", async () => {
    for (const code of ["ITBE045", "ITBE024", "ITBE005"]) {
      const { provider } = setup(() => ({ status: 400, json: { errorCode: code, message: "x" } }));
      const r = await provider.createTopup(request);
      assert.equal(r.outcome, "rejected");
      if (r.outcome === "rejected") {
        assert.equal(r.kind, "validation");
        assert.equal(r.code, code);
      }
    }
    const { provider } = setup(() => ({ status: 400, json: { errorCode: "ITBE020", message: "conta" } }));
    const r = await provider.createTopup(request);
    assert.equal(r.outcome === "rejected" && r.kind, "configuration");
  });

  it("código 400 desconhecido é 'rejected/unrecognized' para revisão", async () => {
    const { provider } = setup(() => ({ status: 400, json: { errorCode: "ZZZ999", message: "?" } }));
    const r = await provider.createTopup(request);
    assert.equal(r.outcome === "rejected" && r.kind, "unrecognized");
  });

  it("401/403 é rejeição de autenticação e não repete o POST", async () => {
    const { provider, calls } = setup(() => ({ status: 401, json: {} }));
    const r = await provider.createTopup(request);
    assert.equal(r.outcome === "rejected" && r.kind, "auth");
    assert.equal(topupCalls(calls, "POST").length, 1);
  });

  it("timeout após enviar = resultado desconhecido, sem repetir o POST", async () => {
    const { provider, calls } = setup(() => ({ hang: true }));
    const r = await provider.createTopup(request);
    assert.deepEqual(r, { outcome: "unknown", reason: "timeout" });
    assert.equal(topupCalls(calls, "POST").length, 1);
  });

  it("erro de rede, 5xx, 429 e corpo inválido = resultado desconhecido", async () => {
    const cases: Array<[FakeReply, string]> = [
      [{ throw: true }, "network"],
      [{ status: 503, json: {} }, "http_5xx"],
      [{ status: 429, json: {} }, "http_429"],
      [{ status: 200, text: "<html>" }, "bad_response"],
      [{ status: 200, json: { status: "SUCCESS", body: {} } }, "bad_response"],
      [{ status: 404, json: {} }, "bad_response"],
    ];
    for (const [reply, reason] of cases) {
      const { provider, calls } = setup(() => reply);
      const r = await provider.createTopup(request);
      assert.equal(r.outcome, "unknown", reason);
      if (r.outcome === "unknown") assert.equal(r.reason, reason);
      assert.equal(topupCalls(calls, "POST").length, 1);
    }
  });

  it("resposta com clientRequestId diferente do enviado não é aceita", async () => {
    const { provider } = setup(() => ({
      status: 200,
      json: { status: "SUCCESS", body: { id: "tx-9", clientRequestId: "outro" } },
    }));
    const r = await provider.createTopup(request);
    assert.deepEqual(r, { outcome: "unknown", reason: "response_mismatch", httpStatus: 200 });
  });

  it("token indisponível = 'not_sent': nenhuma chamada de recarga é feita", async () => {
    const f = makeFakeFetch(() => ({ status: 400, json: { errorCode: "999" } }));
    const client = new CelcoinHttpClient(TEST_CONFIG, { fetch: f.fetch });
    const provider = createBaasV2TopupProvider(client, TEST_CONFIG);
    assert.deepEqual(await provider.createTopup(request), { outcome: "not_sent", reason: "auth_unavailable" });
    assert.equal(f.calls.filter((c) => c.url.includes(TOPUP_PATH)).length, 0);
  });

  it("validação local impede o envio de requisições inválidas", async () => {
    const { provider, calls } = setup(() => ({ status: 200, json: {} }));
    const bad: CreateTopupRequest[] = [
      { ...request, clientRequestId: "" },
      { ...request, clientRequestId: "a".repeat(201) },
      { ...request, amountCents: 0 },
      { ...request, providerId: 0 },
      { ...request, phone: { countryCode: 55, stateCode: 11, number: "12" } },
      { ...request, tags: [{ key: "a", value: "1" }, { key: "a", value: "2" }] },
      { ...request, tags: [{ key: "a", value: "" }] },
      { ...request, tags: Array.from({ length: 21 }, (_, i) => ({ key: `k${i}`, value: "v" })) },
    ];
    for (const r of bad) {
      const res = await provider.createTopup(r);
      assert.equal(res.outcome, "rejected");
    }
    assert.equal(calls.length, 0, "nem token nem recarga são solicitados");
    assert.equal(validateCreateRequest(request, "x".repeat(21))?.code, "ITBE017");
  });
});

describe("adaptador BaaS v2: consulta de status", () => {
  const found = (status: string, extra: object = {}) => ({
    status: 200,
    json: {
      version: "1.0.0",
      status: "SUCCESS",
      body: {
        id: "tx-1",
        clientRequestId: ORDER_ID,
        amount: 13,
        status,
        topupInfo: { receipt: { receiptformatted: "PIN 1234-5678", urlreceipt: "https://r" } },
        ...extra,
      },
    },
  });

  for (const status of ["INITIATED", "PROCESSING", "CONFIRMED", "ERROR"]) {
    it(`devolve o status ${status}`, async () => {
      const { provider, calls } = setup(() => found(status));
      const r = await provider.getTopup({ clientRequestId: ORDER_ID });
      assert.equal(r.outcome, "found");
      if (r.outcome === "found") {
        assert.equal(r.topup.status, status);
        assert.equal(r.topup.amountCents, 1300);
      }
      const url = new URL(topupCalls(calls, "GET")[0].url);
      assert.equal(url.searchParams.get("ClientRequestId"), ORDER_ID);
    });
  }

  it("expõe o erro de processamento", async () => {
    const { provider } = setup(() => found("ERROR", { error: { errorCode: "E1", message: "recusada" } }));
    const r = await provider.getTopup({ transactionId: "tx-1" });
    assert.equal(r.outcome === "found" && r.topup.errorCode, "E1");
  });

  it("nunca repassa o conteúdo do comprovante (pode conter PIN)", async () => {
    const { provider } = setup(() => found("CONFIRMED"));
    const r = await provider.getTopup({ clientRequestId: ORDER_ID });
    assert.ok(r.outcome === "found" && r.topup.hasReceipt);
    assert.ok(!JSON.stringify(r).includes("PIN"));
  });

  it("status ausente ou desconhecido não é aceito como conhecido", async () => {
    const { provider } = setup(() => found("PAUSED"));
    const r = await provider.getTopup({ clientRequestId: ORDER_ID });
    assert.equal(r.outcome === "found" && r.topup.status, "PAUSED"); // a máquina de estados leva a revisão
    const { provider: p2 } = setup(() => ({ status: 200, json: { status: "SUCCESS", body: { id: "x" } } }));
    assert.deepEqual(await p2.getTopup({ clientRequestId: ORDER_ID }), { outcome: "unknown", reason: "bad_response", httpStatus: 200 });
  });

  it("ITBE002/ITBE029 = não encontrada", async () => {
    for (const code of ["ITBE002", "ITBE029"]) {
      const { provider } = setup(() => ({ status: 400, json: { errorCode: code } }));
      assert.deepEqual(await provider.getTopup({ clientRequestId: ORDER_ID }), { outcome: "not_found", code });
    }
  });

  it("falhas de consulta são 'unknown' e exigem exatamente um identificador", async () => {
    const { provider } = setup(() => ({ hang: true }));
    assert.deepEqual(await provider.getTopup({ clientRequestId: ORDER_ID }), { outcome: "unknown", reason: "timeout" });
    const { provider: p2 } = setup(() => ({ status: 503, json: {} }));
    assert.equal((await p2.getTopup({ clientRequestId: ORDER_ID })).outcome, "unknown");
    await assert.rejects(provider.getTopup({}), /requires/);
  });
});

describe("classificação de códigos de erro", () => {
  it("classifica a tabela documentada", () => {
    assert.equal(classifyTopupErrorCode("ITBE011"), "duplicate");
    assert.equal(classifyTopupErrorCode("itbe029"), "not_found");
    assert.equal(classifyTopupErrorCode("ITBE045"), "validation");
    assert.equal(classifyTopupErrorCode("ITBE020"), "configuration");
    assert.equal(classifyTopupErrorCode("XYZ"), "unrecognized");
    assert.equal(classifyTopupErrorCode(null), "unrecognized");
  });
});
