// Provedor de recargas FALSO, em memória. Nunca acessa rede nem usa credenciais.
// Serve para testar o fluxo (estados, duplicidade, timeout, erro) sem a Celcoin.
// Os ids e operadoras abaixo são fictícios.

import {
  type CreateTopupRequest,
  type CreateTopupResult,
  type GetTopupResult,
  type Operator,
  type ProviderValue,
  type TopupProvider,
} from "./topup-provider.ts";

export type MockCreateBehavior = "ok" | "reject" | "timeout" | "server_error" | "not_sent";

export interface MockOptions {
  createBehavior?: MockCreateBehavior;
  /** Em "timeout"/"server_error": se a recarga foi de fato criada no provedor (resultado desconhecido). */
  creates?: boolean;
  /** Status devolvidos em consultas sucessivas (o último se repete). */
  statusSequence?: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
}

export const MOCK_OPERATORS: Operator[] = [
  { providerId: 9001, name: "Operadora Fictícia A", category: 1, kind: "online", minCents: 1000, maxCents: 20000 },
  { providerId: 9002, name: "Operadora Fictícia B", category: 1, kind: "online", minCents: 1500, maxCents: 10000 },
];

export const MOCK_VALUES: Record<number, ProviderValue[]> = {
  9001: [
    { productName: "Recarga 10", code: "10", minCents: 1000, maxCents: 1000, costCents: 950 },
    { productName: "Recarga 20", code: "20", minCents: 2000, maxCents: 2000, costCents: 1900 },
  ],
  9002: [{ productName: "Recarga 15 a 100", code: "range", minCents: 1500, maxCents: 10000, costCents: null }],
};

interface MockRecord {
  transactionId: string;
  request: CreateTopupRequest;
  getCalls: number;
}

export type MockCall =
  | { method: "listProviders" }
  | { method: "listProviderValues"; providerId: number }
  | { method: "createTopup"; clientRequestId: string }
  | { method: "getTopup"; clientRequestId?: string; transactionId?: string };

export class MockTopupProvider implements TopupProvider {
  readonly calls: MockCall[] = [];
  private readonly store = new Map<string, MockRecord>();
  private seq = 0;
  private opts: Required<MockOptions>;

  constructor(options: MockOptions = {}) {
    this.opts = {
      createBehavior: options.createBehavior ?? "ok",
      creates: options.creates ?? true,
      statusSequence: options.statusSequence ?? ["CONFIRMED"],
      errorCode: options.errorCode ?? null,
      errorMessage: options.errorMessage ?? null,
    };
  }

  configure(options: MockOptions): void {
    this.opts = { ...this.opts, ...options } as Required<MockOptions>;
  }

  /** Quantas recargas existem no provedor falso (para provar que não houve duplicação). */
  get createdCount(): number {
    return this.store.size;
  }

  async listProviders(): Promise<Operator[]> {
    this.calls.push({ method: "listProviders" });
    return MOCK_OPERATORS.map((o) => ({ ...o }));
  }

  async listProviderValues(q: { stateCode: number; providerId: number }): Promise<ProviderValue[]> {
    this.calls.push({ method: "listProviderValues", providerId: q.providerId });
    return (MOCK_VALUES[q.providerId] ?? []).map((v) => ({ ...v }));
  }

  private record(req: CreateTopupRequest): MockRecord {
    const rec: MockRecord = { transactionId: `mock-tx-${++this.seq}`, request: req, getCalls: 0 };
    this.store.set(req.clientRequestId, rec);
    return rec;
  }

  async createTopup(req: CreateTopupRequest): Promise<CreateTopupResult> {
    this.calls.push({ method: "createTopup", clientRequestId: req.clientRequestId });
    const behavior = this.opts.createBehavior;

    if (behavior === "not_sent") return { outcome: "not_sent", reason: "auth_unavailable" };
    if (behavior === "reject") {
      return { outcome: "rejected", kind: "validation", code: "ITBE045", message: "mock: invalid amount" };
    }
    // Mesma semântica do ITBE011: o clientRequestId já existe.
    if (this.store.has(req.clientRequestId)) return { outcome: "duplicate", code: "ITBE011" };

    if (behavior === "timeout" || behavior === "server_error") {
      if (this.opts.creates) this.record(req);
      return behavior === "timeout"
        ? { outcome: "unknown", reason: "timeout" }
        : { outcome: "unknown", reason: "http_5xx", httpStatus: 503 };
    }

    const rec = this.record(req);
    return { outcome: "created", transactionId: rec.transactionId, clientRequestId: req.clientRequestId };
  }

  async getTopup(q: { clientRequestId?: string; transactionId?: string }): Promise<GetTopupResult> {
    this.calls.push({ method: "getTopup", ...q });
    if (!q.clientRequestId && !q.transactionId) throw new Error("getTopup requires an identifier");
    const rec = q.clientRequestId
      ? this.store.get(q.clientRequestId)
      : [...this.store.values()].find((r) => r.transactionId === q.transactionId);
    if (!rec) return { outcome: "not_found", code: "ITBE029" };

    const seq = this.opts.statusSequence;
    const status = seq[Math.min(rec.getCalls, seq.length - 1)] ?? "UNKNOWN";
    rec.getCalls += 1;
    return {
      outcome: "found",
      topup: {
        transactionId: rec.transactionId,
        clientRequestId: rec.request.clientRequestId,
        status,
        amountCents: rec.request.amountCents,
        errorCode: status === "ERROR" ? this.opts.errorCode ?? "MOCK_ERROR" : null,
        errorMessage: status === "ERROR" ? this.opts.errorMessage ?? "mock: processing error" : null,
        hasReceipt: status === "CONFIRMED",
      },
    };
  }
}
