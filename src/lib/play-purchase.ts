// Google Play Billing inside the Android app (TWA) via Digital Goods API + Payment Request.
// Works only in the Play Store install; on the web it reports "unavailable".

const PLAY_METHOD = "https://play.google.com/billing";
export const PLAY_STORAGE_KEY = "falai.play.purchase";

// Every product code the Play Console may use; the first one found per plan is shown.
export const PLAY_CANDIDATES: Record<"premium" | "familia", string[]> = {
  premium: ["premium_mensal", "falai_premium_monthly", "falai_premium"],
  familia: ["familia_mensal", "falai_familia_monthly", "falai_familia"],
};

type ItemDetails = { itemId: string; title: string; price: { currency: string; value: string } };
type DGService = {
  getDetails(ids: string[]): Promise<ItemDetails[]>;
  listPurchases(): Promise<{ itemId: string; purchaseToken: string }[]>;
};

async function service(): Promise<DGService | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { getDigitalGoodsService?: (m: string) => Promise<DGService> };
  if (!w.getDigitalGoodsService || !("PaymentRequest" in window)) return null;
  try {
    return await w.getDigitalGoodsService(PLAY_METHOD);
  } catch {
    return null;
  }
}

export type PlayPlan = { plan: "premium" | "familia"; sku: string; title: string; price: string };

export async function loadPlayPlans(): Promise<PlayPlan[] | null> {
  const s = await service();
  if (!s) return null;
  const all = [...PLAY_CANDIDATES.premium, ...PLAY_CANDIDATES.familia];
  const details = await s.getDetails(all).catch(() => [] as ItemDetails[]);
  const out: PlayPlan[] = [];
  for (const plan of ["premium", "familia"] as const) {
    const d = PLAY_CANDIDATES[plan].map((id) => details.find((x) => x.itemId === id)).find(Boolean);
    if (d) {
      const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: d.price.currency }).format(Number(d.price.value));
      out.push({ plan, sku: d.itemId, title: plan === "premium" ? "Premium" : "Família", price });
    }
  }
  return out;
}

export type BuyResult = { status: "success"; purchaseToken: string; sku: string } | { status: "cancelled" } | { status: "error"; message: string };

export async function buyPlayPlan(sku: string): Promise<BuyResult> {
  const s = await service();
  if (!s) return { status: "error", message: "Compre pelo app instalado da Play Store." };
  try {
    const req = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku } }], {
      total: { label: "Total", amount: { currency: "BRL", value: "0" } },
    });
    const res = await req.show();
    const token = (res.details as { purchaseToken?: string })?.purchaseToken;
    await res.complete("success");
    if (!token) return { status: "error", message: "A Play Store não confirmou a compra." };
    window.localStorage.setItem(PLAY_STORAGE_KEY, JSON.stringify({ purchaseToken: token, productId: sku }));
    return { status: "success", purchaseToken: token, sku };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "AbortError") return { status: "cancelled" };
    return { status: "error", message: "Não foi possível concluir a compra." };
  }
}

export async function restorePlayPurchase(): Promise<{ purchaseToken: string; productId: string } | null> {
  const s = await service();
  if (!s) return null;
  const list = await s.listPurchases().catch(() => []);
  const p = list[0];
  return p ? { purchaseToken: p.purchaseToken, productId: p.itemId } : null;
}
