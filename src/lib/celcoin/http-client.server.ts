// SERVER-ONLY. Cliente HTTP da Celcoin com OAuth 2.0 (client_credentials).
//
// Nesta etapa NADA aqui acessa a rede por conta própria: o `fetch` é uma dependência
// OBRIGATÓRIA, injetada por quem constrói o cliente. Os testes injetam um fetch falso.
// O token só é solicitado quando um método é chamado; nunca na construção.
//
// Segredos: client_id/client_secret só trafegam no corpo da requisição de token.
// Nada é escrito em log e as mensagens de erro não contêm credenciais nem tokens.

import type { CelcoinConfig } from "./config.server.ts";
import { CelcoinNetworkError, CelcoinTokenError } from "./errors.ts";

export interface FetchInit {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string | FormData;
  signal?: AbortSignal;
}
export interface FetchResponseLike {
  status: number;
  text(): Promise<string>;
}
export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponseLike>;

export interface HttpDeps {
  fetch: FetchLike;
  now?: () => number;
}

export interface HttpResult {
  status: number;
  json: unknown;
}

/** UNCONFIRMED: caminho do token em produção não consta na documentação; este é o do sandbox. */
export const TOKEN_PATH = "/v5/token";
const TOKEN_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_TOKEN_TTL_S = 300;

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorCodeOf(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const direct = o.errorCode;
  if (typeof direct === "string" || typeof direct === "number") return String(direct);
  const nested = o.error;
  if (nested && typeof nested === "object") {
    const c = (nested as Record<string, unknown>).errorCode;
    if (typeof c === "string" || typeof c === "number") return String(c);
  }
  return null;
}
export { errorCodeOf };

export class CelcoinHttpClient {
  private readonly config: CelcoinConfig;
  private readonly deps: HttpDeps;
  private cached: { token: string; expiresAt: number } | null = null;
  private inflight: Promise<string> | null = null;

  constructor(config: CelcoinConfig, deps: HttpDeps) {
    if (!deps || typeof deps.fetch !== "function") {
      throw new Error("CelcoinHttpClient requires an explicit fetch implementation");
    }
    this.config = config;
    this.deps = deps;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private async send(url: string, init: Omit<FetchInit, "signal">): Promise<{ status: number; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.deps.fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { status: res.status, text };
    } catch {
      throw new CelcoinNetworkError(controller.signal.aborted ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  }

  /** Garante um token válido (cache + renovação antecipada + chamada única em paralelo). */
  async ensureToken(): Promise<string> {
    if (this.cached && this.now() < this.cached.expiresAt - TOKEN_SAFETY_MARGIN_MS) {
      return this.cached.token;
    }
    if (!this.inflight) {
      this.inflight = this.fetchToken().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  invalidateToken(): void {
    this.cached = null;
  }

  private async fetchToken(): Promise<string> {
    const fields = {
      client_id: this.config.clientId,
      grant_type: "client_credentials",
      client_secret: this.config.clientSecret,
    };
    let body: string | FormData;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.config.tokenContentType === "multipart") {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      body = form; // o content-type com boundary é definido pelo fetch
    } else {
      body = new URLSearchParams(fields).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    let res: { status: number; text: string };
    try {
      res = await this.send(`${this.config.baseUrl}${TOKEN_PATH}`, { method: "POST", headers, body });
    } catch (e) {
      const kind = e instanceof CelcoinNetworkError ? e.kind : "network";
      throw new CelcoinTokenError(`Token request failed: ${kind}`);
    }

    const json = parseJson(res.text);
    const token = json && typeof json === "object" ? (json as Record<string, unknown>).access_token : null;
    if (res.status !== 200 || typeof token !== "string" || !token) {
      throw new CelcoinTokenError(`Token request rejected (HTTP ${res.status})`, res.status, errorCodeOf(json));
    }
    const expiresIn = Number((json as Record<string, unknown>).expires_in);
    const ttlMs = (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : DEFAULT_TOKEN_TTL_S) * 1000;
    this.cached = { token, expiresAt: this.now() + ttlMs };
    return token;
  }

  /**
   * Chamada autenticada. Lança CelcoinTokenError se o token não puder ser obtido (nada foi
   * enviado ao endpoint) e CelcoinNetworkError se a chamada em si falhar (resultado incerto).
   * `retryOn401` só deve ser usado em consultas somente leitura.
   */
  async request(
    method: "GET" | "POST",
    path: string,
    opts: { query?: Record<string, string | number | undefined>; jsonBody?: unknown; retryOn401?: boolean } = {},
  ): Promise<HttpResult> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }

    const attempt = async (): Promise<HttpResult> => {
      const token = await this.ensureToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      let body: string | undefined;
      if (opts.jsonBody !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.jsonBody);
      }
      const res = await this.send(url.toString(), { method, headers, body });
      return { status: res.status, json: parseJson(res.text) };
    };

    let result = await attempt();
    if (result.status === 401) {
      this.invalidateToken();
      if (opts.retryOn401) result = await attempt();
    }
    return result;
  }
}
