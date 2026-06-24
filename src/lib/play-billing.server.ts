/**
 * Google Play Developer API — verificação de assinaturas no backend.
 *
 * Usa uma Service Account (JSON) para minar um OAuth2 access token via JWT
 * bearer (RFC 7523) e consultar `purchases.subscriptionsv2.get`.
 *
 * Variáveis de ambiente esperadas:
 *  - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  → JSON completo da service account
 *  - GOOGLE_PLAY_PACKAGE_NAME           → opcional, default br.com.falaifinancas.app
 */

import { SignJWT, importPKCS8 } from "jose";

const DEFAULT_PACKAGE = "br.com.falaifinancas.app";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANDROID_PUBLISHER = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export type PlayPlanKey = "pro" | "premium" | "familia";
export type AppStatus =
  | "active"
  | "inactive"
  | "in_grace_period"
  | "on_hold"
  | "paused"
  | "canceled"
  | "expired";

export interface VerifiedSubscription {
  status: AppStatus;
  plan: PlayPlanKey;
  productId: string;
  purchaseToken: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  raw: unknown;
}

/** SKUs configurados no Play Console → plano interno do app. */
const SKU_TO_PLAN: Record<string, PlayPlanKey> = {
  falai_pro_monthly: "pro",
  falai_premium_monthly: "premium",
  falai_familia_monthly: "familia",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured");
  }
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }
  // O `private_key` vindo de env costuma ter `\n` escapado.
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const sa = loadServiceAccount();
  const tokenUri = sa.token_uri ?? TOKEN_URL;

  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google OAuth token failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

/**
 * Mapeia o estado retornado por `subscriptionsv2.get` para o nosso enum interno.
 *
 * Estados possíveis (Google):
 *  SUBSCRIPTION_STATE_PENDING / UNSPECIFIED / ACTIVE / PAUSED /
 *  IN_GRACE_PERIOD / ON_HOLD / CANCELED / EXPIRED
 */
function mapState(state: string | undefined): AppStatus {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "in_grace_period";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "on_hold";
    case "SUBSCRIPTION_STATE_PAUSED":
    case "SUBSCRIPTION_STATE_PAUSE_DEFERRED":
      return "paused";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "canceled";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    case "SUBSCRIPTION_STATE_PENDING":
      return "inactive";
    default:
      return "inactive";
  }
}

interface SubV2Response {
  kind?: string;
  subscriptionState?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  acknowledgementState?: string;
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }>;
  canceledStateContext?: unknown;
  pausedStateContext?: unknown;
}

export interface VerifyParams {
  purchaseToken: string;
  /** Opcional — usado como fallback se a resposta não trouxer productId. */
  productId?: string;
  packageName?: string;
}

/** Consulta o status da assinatura no Google Play. */
export async function verifyPlaySubscription(
  params: VerifyParams,
): Promise<VerifiedSubscription> {
  const packageName = params.packageName ?? process.env.GOOGLE_PLAY_PACKAGE_NAME ?? DEFAULT_PACKAGE;
  const token = await getAccessToken();

  const url = `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(
    packageName,
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(params.purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Play API ${res.status}: ${txt}`);
  }

  const data = (await res.json()) as SubV2Response;
  const line = data.lineItems?.[0];
  const productId = line?.productId ?? params.productId ?? "";
  const plan: PlayPlanKey = SKU_TO_PLAN[productId] ?? "pro";
  const status = mapState(data.subscriptionState);
  const autoRenew = line?.autoRenewingPlan?.autoRenewEnabled ?? false;

  return {
    status,
    plan,
    productId,
    purchaseToken: params.purchaseToken,
    currentPeriodEnd: line?.expiryTime ?? null,
    cancelAtPeriodEnd: !autoRenew,
    raw: data,
  };
}

/** Faz upsert na tabela `subscriptions` para o usuário. */
export async function persistVerifiedSubscription(
  userId: string,
  v: VerifiedSubscription,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    [
      {
        user_id: userId,
        plan: v.plan,
        status: v.status,
        provider: "play",
        purchase_token: v.purchaseToken,
        provider_product_id: v.productId,
        current_period_end: v.currentPeriodEnd,
        cancel_at_period_end: v.cancelAtPeriodEnd,
        raw: JSON.parse(JSON.stringify(v.raw)),
      },
    ],
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}
