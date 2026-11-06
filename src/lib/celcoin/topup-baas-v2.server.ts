// SERVER-ONLY. Adaptador da recarga Celcoin BaaS v2.
//
// Nenhuma chamada de rede acontece aqui diretamente: tudo passa pelo CelcoinHttpClient, que
// exige um fetch injetado. Nesta etapa o adaptador só é exercitado nos testes, com fetch falso.
//
// Legenda de confiança:
//   CONFIRMED   = consta na documentação oficial lida (referência OpenAPI e/ou tutorial)
//   UNCONFIRMED = documentação ambígua/contraditória; precisa validar no sandbox ou com a Celcoin

import type { CelcoinConfig } from "./config.server.ts";
import { CelcoinHttpError, CelcoinNetworkError, CelcoinTokenError, classifyTopupErrorCode } from "./errors.ts";
import { type CelcoinHttpClient, errorCodeOf } from "./http-client.server.ts";
import {
  type CreateTopupRequest,
  type CreateTopupResult,
  type GetTopupResult,
  type Operator,
  type ProviderValue,
  type TopupInfo,
  type TopupProvider,
  type UnknownReason,
  centsToReais,
  reaisToCents,
} from "./topup-provider.ts";

/** CONFIRMED (referências efetuar-uma-recarga e consultar-recarga): POST/GET em /baas/v2/topup. */
export const TOPUP_PATH = "/baas/v2/topup";
/** UNCONFIRMED: dois caminhos documentados para operadoras e valores (ver config.providersPathStyle). */
export const PROVIDERS_PATHS = {
  v5: { providers: "/v5/transactions/topups/providers", values: "/v5/transactions/topups/provider-values" },
  baas: { providers: "/baas/v2/topup/providers", values: "/baas/v2/topup/provider-values" },
} as const;

const MAX_ACCOUNT = 20; // ITBE017
const MAX_CLIENT_REQUEST_ID = 200; // ITBE018
const MAX_TAGS = 20; // ITBE025

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Validação local espelhando as regras documentadas (evita enviar requisições sabidamente inválidas). */
export function validateCreateRequest(req: CreateTopupRequest, account: string): { code: string; message: string } | null {
  if (!req.clientRequestId) return { code: "ITBE003", message: "clientRequestId is required" };
  if (req.clientRequestId.length > MAX_CLIENT_REQUEST_ID) return { code: "ITBE018", message: "clientRequestId too long" };
  if (!Number.isSafeInteger(req.providerId) || req.providerId <= 0) return { code: "ITBE005", message: "providerId is required" };
  if (!Number.isSafeInteger(req.amountCents) || req.amountCents <= 0) return { code: "ITBE045", message: "invalid amount" };
  if (!account || account.length > MAX_ACCOUNT) return { code: "ITBE017", message: "invalid account" };
  const { countryCode, stateCode, number } = req.phone ?? ({} as Partial<CreateTopupRequest["phone"]>);
  if (!countryCode) return { code: "ITBE006", message: "topupData.countryCode is required" };
  if (!stateCode) return { code: "ITBE007", message: "topupData.stateCode is required" };
  if (!number || !/^[0-9]{8,9}$/.test(number)) return { code: "ITBE024", message: "invalid topupData.number" };
  const tags = req.tags ?? [];
  if (tags.length > MAX_TAGS) return { code: "ITBE025", message: "too many tags" };
  const keys = new Set<string>();
  for (const t of tags) {
    if (!t.key) return { code: "ITBE021", message: "empty tag key" };
    if (!t.value) return { code: "ITBE022", message: "empty tag value" };
    if (keys.has(t.key)) return { code: "ITBE019", message: "duplicate tag key" };
    keys.add(t.key);
  }
  return null;
}

/** Normaliza as duas formas documentadas da lista de operadoras (array puro ou {providers: [...]}). */
export function parseOperators(json: unknown): Operator[] {
  const list = Array.isArray(json) ? json : isObj(json) && Array.isArray(json.providers) ? json.providers : [];
  const out: Operator[] = [];
  for (const item of list) {
    if (!isObj(item)) continue;
    const providerId = num(item.providerId);
    const name = str(item.name);
    if (providerId === null || !name) continue;
    // Os nomes dos campos variam entre tutorial e referência (maiúsculas, plural): UNCONFIRMED.
    const kindRaw = item.tipoRecarganameProvider ?? item.TipoRecarganameProvider;
    const kind = String(kindRaw) === "1" ? "pin" : String(kindRaw) === "2" ? "online" : "unknown";
    out.push({
      providerId,
      name,
      category: num(item.category),
      kind,
      minCents: reaisToCents(item.minValue),
      maxCents: reaisToCents(item.maxValue),
    });
  }
  return out;
}

/** UNCONFIRMED: qual campo é "o valor" não está documentado; mantemos min/max/cost em centavos. */
export function parseProviderValues(json: unknown): ProviderValue[] {
  const list = isObj(json) && Array.isArray(json.value) ? json.value : [];
  const out: ProviderValue[] = [];
  for (const item of list) {
    if (!isObj(item)) continue;
    out.push({
      productName: str(item.productName),
      code: str(item.code),
      minCents: reaisToCents(item.minValue),
      maxCents: reaisToCents(item.maxValue),
      costCents: reaisToCents(item.cost),
    });
  }
  return out;
}

function unknownFromStatus(status: number): UnknownReason {
  if (status === 429) return "http_429";
  if (status >= 500) return "http_5xx";
  return "bad_response";
}

export function createBaasV2TopupProvider(client: CelcoinHttpClient, config: CelcoinConfig): TopupProvider {
  const paths = PROVIDERS_PATHS[config.providersPathStyle];

  return {
    async listProviders(q) {
      const res = await client.request("GET", paths.providers, {
        query: { stateCode: q.stateCode, type: q.type ?? 0, category: q.category ?? 0 },
        retryOn401: true,
      });
      if (res.status !== 200) throw new CelcoinHttpError(res.status, errorCodeOf(res.json));
      return parseOperators(res.json);
    },

    async listProviderValues(q) {
      const res = await client.request("GET", paths.values, {
        query: { stateCode: q.stateCode, providerId: q.providerId },
        retryOn401: true,
      });
      if (res.status !== 200) throw new CelcoinHttpError(res.status, errorCodeOf(res.json));
      return parseProviderValues(res.json);
    },

    async createTopup(req): Promise<CreateTopupResult> {
      const invalid = validateCreateRequest(req, config.account);
      if (invalid) {
        return { outcome: "rejected", kind: "validation", code: invalid.code, message: `local validation: ${invalid.message}` };
      }

      const body: Obj = {
        amount: centsToReais(req.amountCents), // reais (CONFIRMED: exemplo "amount": 13)
        providerId: req.providerId,
        account: config.account, // string (a referência diz string; o tutorial diz int: UNCONFIRMED)
        clientRequestId: req.clientRequestId,
        topupData: { countryCode: req.phone.countryCode, stateCode: req.phone.stateCode, number: req.phone.number },
      };
      if (req.tags && req.tags.length > 0) body.tags = req.tags;
      if (req.signerCode) body.signerCode = req.signerCode;

      // Etapa 1: token. Falha aqui = nada foi enviado ao endpoint de recarga.
      try {
        await client.ensureToken();
      } catch (e) {
        if (e instanceof CelcoinTokenError) return { outcome: "not_sent", reason: "auth_unavailable" };
        throw e;
      }

      // Etapa 2: POST sem nenhuma repetição automática.
      let res;
      try {
        res = await client.request("POST", TOPUP_PATH, { jsonBody: body, retryOn401: false });
      } catch (e) {
        if (e instanceof CelcoinTokenError) return { outcome: "not_sent", reason: "auth_unavailable" };
        if (e instanceof CelcoinNetworkError) return { outcome: "unknown", reason: e.kind };
        throw e;
      }

      const code = errorCodeOf(res.json);

      if (res.status === 200 || res.status === 201) {
        const b = isObj(res.json) && isObj(res.json.body) ? res.json.body : null;
        const ok = isObj(res.json) && res.json.status === "SUCCESS";
        const id = b ? str(b.id) : null;
        if (!ok || !id) return { outcome: "unknown", reason: "bad_response", httpStatus: res.status };
        // A doc de exemplo ecoa dados diferentes dos enviados; só confiamos no id e no clientRequestId.
        if (str(b!.clientRequestId) !== req.clientRequestId) {
          return { outcome: "unknown", reason: "response_mismatch", httpStatus: res.status };
        }
        return { outcome: "created", transactionId: id, clientRequestId: req.clientRequestId };
      }

      if (res.status === 401 || res.status === 403) {
        return { outcome: "rejected", kind: "auth", code, message: `HTTP ${res.status}` };
      }

      if (res.status === 400 && code) {
        const cls = classifyTopupErrorCode(code);
        if (cls === "duplicate") return { outcome: "duplicate", code };
        if (cls === "not_found") return { outcome: "rejected", kind: "unrecognized", code, message: "unexpected not-found on create" };
        return { outcome: "rejected", kind: cls, code, message: str(isObj(res.json) ? res.json.message : null) ?? `HTTP 400 ${code}` };
      }

      // 5xx, 429, 4xx sem código reconhecível, etc.: pode ter sido processada.
      return { outcome: "unknown", reason: unknownFromStatus(res.status), httpStatus: res.status };
    },

    async getTopup(q): Promise<GetTopupResult> {
      if (!q.clientRequestId && !q.transactionId) {
        throw new Error("getTopup requires clientRequestId or transactionId");
      }
      let res;
      try {
        res = await client.request("GET", TOPUP_PATH, {
          // CONFIRMED: nomes de parâmetro com inicial maiúscula.
          query: { TransactionId: q.transactionId, ClientRequestId: q.clientRequestId },
          retryOn401: true,
        });
      } catch (e) {
        if (e instanceof CelcoinNetworkError) return { outcome: "unknown", reason: e.kind };
        if (e instanceof CelcoinTokenError) return { outcome: "unknown", reason: "network" };
        throw e;
      }

      if (res.status === 200 && isObj(res.json) && res.json.status === "SUCCESS" && isObj(res.json.body)) {
        const b = res.json.body;
        const status = str(b.status);
        if (!status) return { outcome: "unknown", reason: "bad_response", httpStatus: 200 };
        const err = isObj(b.error) ? b.error : null;
        const receipt = isObj(b.topupInfo) && isObj(b.topupInfo.receipt) ? b.topupInfo.receipt : null;
        const topup: TopupInfo = {
          transactionId: str(b.id),
          clientRequestId: str(b.clientRequestId),
          status,
          amountCents: reaisToCents(b.amount),
          errorCode: err ? str(err.errorCode) : null,
          errorMessage: err ? str(err.message) : null,
          // Nunca repassamos receiptformatted/receiptData: podem conter o PIN.
          hasReceipt: Boolean(receipt && (receipt.urlreceipt || receipt.receiptformatted || receipt.receiptData)),
        };
        return { outcome: "found", topup };
      }

      const code = errorCodeOf(res.json);
      if (res.status === 400 && code && classifyTopupErrorCode(code) === "not_found") {
        return { outcome: "not_found", code };
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return { outcome: "unknown", reason: "rejected", httpStatus: res.status };
      }
      return { outcome: "unknown", reason: unknownFromStatus(res.status), httpStatus: res.status };
    },
  };
}
