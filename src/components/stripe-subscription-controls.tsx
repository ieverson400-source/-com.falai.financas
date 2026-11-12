import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { createCheckoutSession, createPortalSession, getMyStripePlans } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { subscriptionUsable } from "@/lib/billing-rules";

type PlansResult = Awaited<ReturnType<typeof getMyStripePlans>>;
export function StripeSubscriptionControls({ isActive }: { isActive: boolean }) {
  const load = useServerFn(getMyStripePlans);
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createPortalSession);
  const [result, setResult] = useState<PlansResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    try { setResult(await load({ data: { environment: getStripeEnvironment() } })); }
    catch (e) { setResult({ error: e instanceof Error ? e.message : "Planos indisponíveis." }); }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const onFocus = () => { void refresh(); }; window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus); }, [refresh]);
  const buy = async (priceId: string) => {
    setBusy(true);
    try {
      const r = await checkout({ data: { priceId, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/app?tab=perfil` } });
      if ("error" in r) throw new Error(r.error);
      if (!r.clientSecret) throw new Error("Pagamento indisponível.");
      setSecret(r.clientSecret); setOpen(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no pagamento."); }
    finally { setBusy(false); }
  };
  const manage = async () => {
    const popup = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      if (!popup) throw new Error("Permita abrir uma nova janela para gerenciar a assinatura.");
      const r = await portal({ data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/app?tab=perfil` } });
      if ("error" in r) throw new Error(r.error);
      popup.opener = null; popup.location.href = r.url;
    } catch (e) { popup?.close(); toast.error(e instanceof Error ? e.message : "Falha ao abrir assinatura."); }
    finally { setBusy(false); }
  };
  const hasRecord = result && "records" in result && result.records.length > 0;
  const activeStripe = result && "records" in result && result.records.some((r) => subscriptionUsable(r.status, r.current_period_end));
  return <div className="space-y-3 px-4 py-3.5">
    <div className="flex items-center gap-3"><CreditCard className="size-4 text-primary" /><span className="text-sm font-medium">Assinatura por cartão</span></div>
    <PaymentTestModeBanner />
    {!result && <Loader2 className="size-4 animate-spin" />}
    {result && "error" in result && <><p role="alert" className="text-xs text-destructive">{result.error}</p><Button size="sm" variant="outline" onClick={refresh}>Tentar novamente</Button></>}
    {result && "plans" in result && <div className="grid gap-2 sm:grid-cols-2">
      {result.plans.map((p) => <Button key={p.id} disabled={busy || isActive || Boolean(activeStripe)} onClick={() => buy(p.id)}>{busy ? <Loader2 className="size-4 animate-spin" /> : <>Assinar {p.name} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: p.currency }).format(p.amount / 100)}/{p.interval === "month" ? "mês" : "ano"}</>}</Button>)}
      {hasRecord && <Button variant="outline" disabled={busy} onClick={manage}>Gerenciar assinatura</Button>}
    </div>}
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setSecret(null); void refresh(); } }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Assinatura por cartão</DialogTitle><DialogDescription>Falaí Finanças</DialogDescription></DialogHeader>{secret && <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: secret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider>}</DialogContent></Dialog>
  </div>;
}