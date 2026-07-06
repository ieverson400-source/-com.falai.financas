import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { CATEGORIES, formatBRL } from "@/lib/categories";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { format, startOfMonth } from "date-fns";

export const Route = createFileRoute("/app/orcamentos")({
  component: OrcamentosPage,
  head: () => ({
    meta: [
      { title: "Orçamentos por categoria — Falaí Finanças" },
      { name: "description", content: "Defina limites mensais por categoria e receba alertas no WhatsApp quando estiver próximo de estourar." },
    ],
  }),
});

interface BudgetRow {
  id?: string;
  category: string;
  monthly_limit: number;
}

function OrcamentosPage() {
  const { user, loading: authLoading } = useAuth();
  useOnboardingGate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, BudgetRow>>({});
  const [spent, setSpent] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [{ data: budgets }, { data: expenses }] = await Promise.all([
        supabase.from("category_budgets").select("*").eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("category, amount")
          .eq("user_id", user.id)
          .gte("expense_date", monthStart),
      ]);

      if (cancelled) return;

      const exMap: Record<string, BudgetRow> = {};
      const strMap: Record<string, string> = {};
      (budgets ?? []).forEach((b) => {
        exMap[b.category] = { id: b.id, category: b.category, monthly_limit: Number(b.monthly_limit) };
        strMap[b.category] = String(Number(b.monthly_limit)).replace(".", ",");
      });
      setExisting(exMap);
      setLimits(strMap);

      const spentMap: Record<string, number> = {};
      (expenses ?? []).forEach((e) => {
        spentMap[e.category] = (spentMap[e.category] ?? 0) + Number(e.amount);
      });
      setSpent(spentMap);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const parseValue = (v: string): number | null => {
    if (!v.trim()) return 0;
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const toUpsert: Array<{ user_id: string; category: string; monthly_limit: number }> = [];
      const toDelete: string[] = [];

      for (const cat of CATEGORIES) {
        const raw = limits[cat] ?? "";
        const parsed = parseValue(raw);
        if (parsed === null) {
          toast.error(`Valor inválido em ${cat}`);
          setSaving(false);
          return;
        }
        const had = existing[cat];
        if (parsed === 0) {
          if (had?.id) toDelete.push(had.id);
        } else {
          toUpsert.push({ user_id: user.id, category: cat, monthly_limit: parsed });
        }
      }

      if (toDelete.length) {
        const { error } = await supabase.from("category_budgets").delete().in("id", toDelete);
        if (error) throw error;
      }
      if (toUpsert.length) {
        const { error } = await supabase
          .from("category_budgets")
          .upsert(toUpsert, { onConflict: "user_id,category" });
        if (error) throw error;
      }

      toast.success("Orçamentos salvos");

      // Refresh existing
      const { data: budgets } = await supabase
        .from("category_budgets")
        .select("*")
        .eq("user_id", user.id);
      const exMap: Record<string, BudgetRow> = {};
      (budgets ?? []).forEach((b) => {
        exMap[b.category] = { id: b.id, category: b.category, monthly_limit: Number(b.monthly_limit) };
      });
      setExisting(exMap);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar orçamentos");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Toaster />
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/home">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">Orçamentos por categoria</h1>
            <p className="text-xs text-muted-foreground">
              Limites mensais — alerta no WhatsApp em 80% e 100%
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Deixe em branco ou 0 para desativar o limite de uma categoria.
        </p>

        {CATEGORIES.map((cat) => {
          const used = spent[cat] ?? 0;
          const rawLimit = parseValue(limits[cat] ?? "") ?? 0;
          const pct = rawLimit > 0 ? Math.min(100, (used / rawLimit) * 100) : 0;
          const over = rawLimit > 0 && used >= rawLimit;
          const near = rawLimit > 0 && !over && used / rawLimit >= 0.8;

          return (
            <Card key={cat} className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <Label htmlFor={`limit-${cat}`} className="font-medium">
                  {cat}
                </Label>
                <span className="text-xs text-muted-foreground">
                  Gasto no mês: {formatBRL(used)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  id={`limit-${cat}`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={limits[cat] ?? ""}
                  onChange={(e) =>
                    setLimits((prev) => ({ ...prev, [cat]: e.target.value }))
                  }
                />
              </div>
              {rawLimit > 0 && (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={
                        "h-full transition-all " +
                        (over
                          ? "bg-destructive"
                          : near
                            ? "bg-yellow-500"
                            : "bg-primary")
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct.toFixed(0)}% de {formatBRL(rawLimit)}
                    {over && " — limite atingido"}
                  </p>
                </div>
              )}
            </Card>
          );
        })}

        <div className="sticky bottom-4 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 shadow-lg"
            size="lg"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar orçamentos
          </Button>
        </div>
      </main>
    </div>
  );
}
