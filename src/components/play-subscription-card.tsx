import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyMyPlayPurchase } from "@/lib/play-billing.functions";
import { buyPlayPlan, loadPlayPlans, restorePlayPurchase, type PlayPlan } from "@/lib/play-purchase";

const PLAN_LABEL: Record<string, string> = { premium: "Premium", familia: "Família", pro: "Pro" };

export function PlaySubscriptionCard({ plan, isActive, refresh }: { plan: string; isActive: boolean; refresh: () => Promise<void> }) {
  const verify = useServerFn(verifyMyPlayPurchase);
  const [plans, setPlans] = useState<PlayPlan[] | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { loadPlayPlans().then(setPlans).catch(() => setPlans(null)); }, []);

  const confirm = async (purchaseToken: string, productId: string) => {
    const r = await verify({ data: { purchaseToken, productId } });
    await refresh();
    if (r.status === "active" || r.status === "in_grace_period") toast.success(`Plano ${PLAN_LABEL[r.plan] ?? r.plan} ativado!`);
    else toast.message("Compra recebida. O plano será ativado assim que a Play Store confirmar.");
  };

  const buy = async (p: PlayPlan) => {
    setBusy(p.sku);
    try {
      const r = await buyPlayPlan(p.sku);
      if (r.status === "success") await confirm(r.purchaseToken, r.sku);
      else if (r.status === "error") toast.error(r.message);
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes("não pertence") ? "Esta compra pertence a outra conta." : "Não foi possível confirmar a compra. Tente Restaurar compra.");
    }
    setBusy(null);
  };

  const restore = async () => {
    setBusy("restore");
    try {
      const p = await restorePlayPurchase();
      if (!p) toast.message("Nenhuma assinatura encontrada nesta conta da Play Store.");
      else await confirm(p.purchaseToken, p.productId);
    } catch {
      toast.error("Não foi possível restaurar a compra.");
    }
    setBusy(null);
  };

  return (
    <div className="px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-3">
        <Crown className="size-4 text-primary" />
        <span className="text-sm font-medium flex-1">Assinatura</span>
        <span className="text-xs text-muted-foreground">{isActive ? `Plano ${PLAN_LABEL[plan] ?? plan} ativo` : "Plano gratuito"}</span>
      </div>
      {plans === undefined && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Carregando planos…</p>}
      {plans === null && <p className="text-xs text-muted-foreground">Para assinar, abra o app Falaí instalado pela Play Store.</p>}
      {plans && plans.length === 0 && <p className="text-xs text-muted-foreground">Planos indisponíveis na Play Store no momento.</p>}
      {plans && plans.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {plans.map((p) => (
            <Button key={p.sku} onClick={() => buy(p)} disabled={!!busy || (isActive && plan === p.plan)} className="rounded-xl">
              {busy === p.sku ? <Loader2 className="size-4 animate-spin" /> : isActive && plan === p.plan ? `${p.title} ativo` : `Assinar ${p.title} · ${p.price}/mês`}
            </Button>
          ))}
          <Button variant="outline" onClick={restore} disabled={!!busy} className="rounded-xl sm:col-span-2">
            {busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <><RotateCcw className="size-4" /> Restaurar compra</>}
          </Button>
        </div>
      )}
    </div>
  );
}
