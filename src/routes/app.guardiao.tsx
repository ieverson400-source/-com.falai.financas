import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/categories";
import { useAuth } from "@/hooks/use-auth";
import { getMyGuardianAnalysis } from "@/lib/guardian-user.functions";

export const Route = createFileRoute("/app/guardiao")({
  component: GuardiaoPage,
  head: () => ({
    meta: [
      { title: "Guardião Financeiro — Falaí Finanças" },
      { name: "description", content: "Recomendações de gastos e avisos de orçamento feitos pela IA." },
      { property: "og:title", content: "Guardião Financeiro — Falaí Finanças" },
      { property: "og:description", content: "Recomendações de gastos e avisos de orçamento feitos pela IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Result = Awaited<ReturnType<typeof getMyGuardianAnalysis>>;

function GuardiaoPage() {
  const { user } = useAuth();
  const analyze = useServerFn(getMyGuardianAnalysis);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await analyze()); } catch { setData({ enabled: true, categories: [], recommendations: [], error: "Não foi possível analisar agora." }); }
    setLoading(false);
  };
  useEffect(() => { if (user) void run(); }, [user]);

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/app"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Guardião Financeiro</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analisar novamente"}</Button>
          <Link to="/app/orcamentos"><Button variant="outline">Ajustar orçamentos</Button></Link>
        </div>
        {data && !data.enabled && <Card className="p-4">O Guardião está desligado no momento.</Card>}
        {data?.error && <Card className="p-4 text-destructive">{data.error}</Card>}
        {data?.enabled && data.categories.length === 0 && <Card className="p-4">Ainda não há gastos neste mês para analisar.</Card>}
        {data && data.recommendations.length > 0 && (
          <Card className="p-4 space-y-2 rounded-2xl">
            <h2 className="font-semibold">Recomendações</h2>
            <ul className="space-y-2">{data.recommendations.map((r, i) => <li key={i} className="text-sm">• {r}</li>)}</ul>
          </Card>
        )}
        {data?.categories.map((c) => (
          <Card key={c.category} className="p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-medium">{c.category}</p>
              <p className="text-sm text-muted-foreground">{formatBRL(c.spent)}{c.limit ? ` de ${formatBRL(c.limit)}` : " · sem limite"}</p>
            </div>
            {c.alert === "over" && <span className="flex items-center gap-1 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> Estourou</span>}
            {c.alert === "near" && <span className="flex items-center gap-1 text-sm text-accent-foreground"><AlertTriangle className="h-4 w-4" /> Perto do limite</span>}
            {c.alert === "ok" && <span className="flex items-center gap-1 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Dentro</span>}
          </Card>
        ))}
      </div>
    </div>
  );
}
