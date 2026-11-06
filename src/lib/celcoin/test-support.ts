// Apoio aos testes. Nunca importar em código de produção.
/// <reference types="node" />
import type { CelcoinConfig } from "./config.server.ts";
import type { FetchInit, FetchLike } from "./http-client.server.ts";

/** Faz qualquer uso do fetch global falhar o teste e conta as tentativas. */
export function installNetworkGuard() {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (() => {
    attempts += 1;
    throw new Error("NETWORK ACCESS BLOCKED IN TESTS");
  }) as typeof fetch;
  return {
    attempts: () => attempts,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

export const TEST_CONFIG: CelcoinConfig = {
  environment: "sandbox",
  baseUrl: "https://sandbox.example.test",
  clientId: "test-client-id",
  clientSecret: "test-client-secret-VALUE",
  account: "300000000001",
  timeoutMs: 50,
  tokenContentType: "urlencoded",
  providersPathStyle: "v5",
};

export interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | FormData | undefined;
}
export type FakeReply =
  | { status: number; json?: unknown; text?: string }
  | { throw: true }
  | { hang: true };

export function makeFakeFetch(handler: (call: FakeCall, n: number) => FakeReply | Promise<FakeReply>) {
  const calls: FakeCall[] = [];
  const fetchFake: FetchLike = async (url: string, init: FetchInit) => {
    const call: FakeCall = { url, method: init.method, headers: init.headers, body: init.body };
    calls.push(call);
    const reply = await handler(call, calls.length);
    if ("throw" in reply) throw new Error("connection reset");
    if ("hang" in reply) {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    const text = reply.text ?? (reply.json !== undefined ? JSON.stringify(reply.json) : "");
    return { status: reply.status, text: async () => text };
  };
  return { fetch: fetchFake, calls };
}

export const TOKEN_OK = { status: 200, json: { access_token: "tok-abc", expires_in: 2400, token_type: "bearer" } };
