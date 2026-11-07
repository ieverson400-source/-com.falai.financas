// Interface do provedor de assinaturas. SOMENTE TIPOS: não há implementação concreta nesta etapa e
// nada aqui importa SDK de billing algum.
//
// Provedor-alvo ("google_play_pwa"): Google Play Billing via Digital Goods API em uma TWA gerada pelo
// PWABuilder. Na etapa de integração, o cliente usaria window.getDigitalGoodsService(
// "https://play.google.com/billing") e a PaymentRequest API, e o servidor (Worker) validaria o recibo
// na Google Play Developer API com GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, somente em process.env.
// Nada disso existe ainda. A Digital Goods API só funciona em TWA verificada (ver assetlinks.json).

import type { PlanKey } from "./plans.ts";

export interface Plan {
  key: PlanKey;
  /** ID do produto no provedor. */
  id: string;
  name: string;
  priceCents: number;
}

export type PurchaseStatus = "success" | "cancelled" | "pending" | "error" | "not_configured";
export interface PurchaseResult {
  status: PurchaseStatus;
}

export type RestoreStatus = "success" | "not_found" | "error" | "not_configured";
export interface RestoreResult {
  status: RestoreStatus;
}

export type SubscriptionState = "free" | "pro" | "premium" | "familia" | "expired" | "pending" | "error";

export interface SubscriptionProvider {
  listPlans(): Promise<Plan[]>;
  purchase(planId: string): Promise<PurchaseResult>;
  restore(): Promise<RestoreResult>;
  getCurrent(): Promise<SubscriptionState>;
}
