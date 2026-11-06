// Interface do provedor de recargas. Código puro (sem segredos, sem rede).
// O núcleo do sistema só conhece esta interface; o adaptador BaaS v2 e o mock a implementam.

import type { BrPhone } from "../recharge/types.ts";
import type { TopupErrorClass } from "./errors.ts";

export interface Operator {
  providerId: number;
  name: string;
  category: number | null;
  kind: "pin" | "online" | "unknown";
  minCents: number | null;
  maxCents: number | null;
}

export interface ProviderValue {
  productName: string | null;
  code: string | null;
  minCents: number | null;
  maxCents: number | null;
  costCents: number | null;
}

export interface Tag {
  key: string;
  value: string;
}

export interface CreateTopupRequest {
  /** Igual ao id do pedido. Reenvios usam SEMPRE o mesmo valor (idempotência). */
  clientRequestId: string;
  providerId: number;
  amountCents: number;
  phone: BrPhone;
  tags?: Tag[];
  /** UNCONFIRMED: a referência diz "somente TV"; o exemplo do tutorial envia telefone. Omitido por padrão. */
  signerCode?: string;
}

export type UnknownReason =
  | "timeout"
  | "network"
  | "http_5xx"
  | "http_429"
  | "bad_response"
  | "response_mismatch";

export type CreateTopupResult =
  /** Criada. Ainda NÃO significa concluída: consultar o status. */
  | { outcome: "created"; transactionId: string; clientRequestId: string }
  /** ITBE011: já existe. Consultar por clientRequestId; nunca gerar outro id. */
  | { outcome: "duplicate"; code: string }
  /** Rejeitada antes de criar. Não há recarga no provedor. */
  | { outcome: "rejected"; kind: Exclude<TopupErrorClass, "duplicate" | "not_found"> | "auth"; code: string | null; message: string }
  /** Nada saiu do nosso servidor (ex.: token indisponível). Seguro tentar depois. */
  | { outcome: "not_sent"; reason: "auth_unavailable" }
  /** A requisição pode ter sido processada. CONSULTAR antes de qualquer nova ação. */
  | { outcome: "unknown"; reason: UnknownReason; httpStatus?: number };

export interface TopupInfo {
  transactionId: string | null;
  clientRequestId: string | null;
  /** Status bruto do provedor (INITIATED | PROCESSING | CONFIRMED | ERROR, ou valor inesperado). */
  status: string;
  amountCents: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Indica que há comprovante; o conteúdo (pode conter PIN) nunca é exposto. */
  hasReceipt: boolean;
}

export type GetTopupResult =
  | { outcome: "found"; topup: TopupInfo }
  | { outcome: "not_found"; code: string }
  | { outcome: "unknown"; reason: UnknownReason | "rejected"; httpStatus?: number };

export interface TopupProvider {
  listProviders(q: { stateCode: number; type?: 0 | 1 | 2; category?: number }): Promise<Operator[]>;
  listProviderValues(q: { stateCode: number; providerId: number }): Promise<ProviderValue[]>;
  createTopup(req: CreateTopupRequest): Promise<CreateTopupResult>;
  getTopup(q: { clientRequestId?: string; transactionId?: string }): Promise<GetTopupResult>;
}

export function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

export function reaisToCents(reais: unknown): number | null {
  const n = typeof reais === "string" ? Number(reais) : reais;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Valores de recarga que a operadora oferece em quantia exata (mín = máx).
 * UNCONFIRMED: a documentação não diz qual campo de provider-values é o valor da recarga;
 * entradas com faixa (mín != máx) são ignoradas aqui e devem ser tratadas como intervalo.
 */
export function exactAmountsCents(values: readonly ProviderValue[]): number[] {
  const out = new Set<number>();
  for (const v of values) {
    if (v.minCents !== null && v.minCents === v.maxCents && v.minCents > 0) out.add(v.minCents);
  }
  return [...out].sort((a, b) => a - b);
}
