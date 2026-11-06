// Interface da cobrança PIX imediata. SOMENTE TIPOS: não há implementação nesta etapa.
//
// O produto PIX ainda NÃO foi escolhido. Candidato visto na documentação (não aprovado):
// POST /pix/v1/brcode/dynamic. BolePix (POST /baas/v2/charge) NÃO serve como PIX imediato
// e não deve ser implementado como tal. Ver docs/recharge/ quando o produto for confirmado.

import type { PixChargeStatus } from "../recharge/types.ts";

export interface CreatePixChargeRequest {
  /** Id do pedido; chave de idempotência da cobrança. */
  orderId: string;
  amountCents: number;
  expiresInSeconds: number;
}

export interface PixCharge {
  providerChargeId: string;
  txid: string | null;
  /** Copia e cola retornado pelo provedor. */
  emv: string;
  expiresAt: Date;
}

export interface PixChargeObservation {
  status: PixChargeStatus;
  paidAmountCents?: number;
  receiverKey?: string;
  endToEndId?: string;
  paidAt?: Date;
}

export interface PixChargeProvider {
  createCharge(req: CreatePixChargeRequest): Promise<PixCharge>;
  /** Consulta o estado OFICIAL no provedor (nunca dados enviados pelo frontend). */
  getCharge(providerChargeId: string): Promise<PixChargeObservation | null>;
}
