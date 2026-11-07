import { useEffect, useMemo, useState } from "react";
import { TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/categories";
import { priceIncreaseAlerts } from "@/lib/insights/alerts";
import { detectRecurring, type ExpenseLike } from "@/lib/insights/recurring";

// Avisos de reajuste de assinaturas. Calculados no aparelho a cada abertura; as dispensas ficam só
// neste navegador (localStorage). Não é notificação push.

const STORAGE_KEY = "falai-price-alerts-dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(-100) : []);
  } catch {
    return new Set();
  }
}

export function PriceChangeAlerts({ expenses }: { expenses: readonly ExpenseLike[] }) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  useEffect(() => setDismissed(loadDismissed()), []);

  const alerts = useMemo(() => {
    if (!dismissed) return []; // só depois de ler as dispensas, para não piscar avisos já dispensados
    const now = new Date();
    return priceIncreaseAlerts(detectRecurring(expenses, now), now, dismissed);
  }, [expenses, dismissed]);

  if (alerts.length === 0) return null;

  function dismiss(id: string) {
    const next = new Set(dismissed ?? []);
    next.add(id);
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next].slice(-100)));
    } catch {
      /* armazenamento indisponível */
    }
  }

  return (
    <div className="space-y-3" role="region" aria-label="Avisos de reajuste">
      {alerts.map((a) => (
        <Card key={a.id} className="flex items-start gap-3 border-amber-500/40 bg-amber-500/10 p-4">
          <TrendingUp className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {a.label} ficou {a.pct}% mais cara
            </p>
            <p className="text-xs text-muted-foreground">
              De {formatBRL(a.fromAmount)} para {formatBRL(a.toAmount)} (última cobrança em {a.lastDate.slice(8, 10)}/
              {a.lastDate.slice(5, 7)}). Vale conferir se ainda compensa.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Dispensar aviso de ${a.label}`} onClick={() => dismiss(a.id)}>
            <X className="size-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}
