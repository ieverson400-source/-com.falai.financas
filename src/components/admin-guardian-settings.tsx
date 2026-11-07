import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { adminGetGuardianSettings, adminSaveGuardianSettings, GUARDIAN_MODELS } from "@/lib/guardian.functions";
import { AdminSectionTitle } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Settings = Awaited<ReturnType<typeof adminGetGuardianSettings>>["settings"];

const MODEL_LABELS: Record<string, string> = {
  "google/gemini-2.5-flash": "Gemini 2.5 Flash (rápido)",
  "google/gemini-2.5-pro": "Gemini 2.5 Pro (avançado)",
  "openai/gpt-5-mini": "GPT-5 Mini",
};

export function AdminGuardianSettings() {
  const getSettings = useServerFn(adminGetGuardianSettings);
  const saveSettings = useServerFn(adminSaveGuardianSettings);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettings().then((result) => { if (!cancelled) setSettings(result.settings); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar as configurações do Guardião Financeiro."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getSettings, retry]);

  const update = (changes: Partial<Settings>) => setSettings((current) => current ? { ...current, ...changes } : current);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    if (settings.system_prompt.trim().length < 20) { toast.error("O prompt do sistema precisa de pelo menos 20 caracteres."); return; }
    setSaving(true);
    try {
      await saveSettings({ data: {
        enabled: settings.enabled,
        model: settings.model as (typeof GUARDIAN_MODELS)[number],
        systemPrompt: settings.system_prompt,
        monthlyInsightLimit: settings.monthly_insight_limit,
        shareCategoryTotalsOnly: settings.share_category_totals_only,
        includeBudgetAlerts: settings.include_budget_alerts,
      } });
      toast.success("Configurações do Guardião Financeiro salvas.");
    } catch { toast.error("Não foi possível salvar. Confira os campos e tente novamente."); }
    finally { setSaving(false); }
  };

  return <section>
    <AdminSectionTitle icon={ShieldCheck} title="Guardião Financeiro (IA)" description="Inteligência artificial que analisa gastos e gera recomendações." />
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando configurações…</p> : error ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}><RefreshCw className="size-4" />Tentar novamente</Button></div> : settings && <form onSubmit={(event) => void save(event)} className="max-w-3xl space-y-6">
      <div className="divide-y rounded-lg border">
        {([
          ["enabled", "Ativar Guardião Financeiro", "Liga a análise por IA para os usuários."],
          ["share_category_totals_only", "Enviar apenas totais por categoria", "Protege a privacidade: a IA nunca recebe extratos completos, saldos ou descrições individuais."],
          ["include_budget_alerts", "Alertas de orçamento", "Inclui avisos quando uma categoria se aproxima do limite definido."],
        ] as const).map(([key, label, description]) => <div key={key} className="flex items-center justify-between gap-4 p-4"><div><Label htmlFor={`guardian-${key}`}>{label}</Label><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch id={`guardian-${key}`} checked={settings[key]} onCheckedChange={(checked) => update({ [key]: checked })} /></div>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="guardian-model">Modelo de IA</Label><Select value={settings.model} onValueChange={(value) => update({ model: value })}><SelectTrigger id="guardian-model" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{GUARDIAN_MODELS.map((value) => <SelectItem key={value} value={value}>{MODEL_LABELS[value] ?? value}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="guardian-limit">Limite mensal de análises</Label><Input id="guardian-limit" type="number" required min={1} max={500} step={1} value={settings.monthly_insight_limit} onChange={(event) => update({ monthly_insight_limit: Number(event.target.value) })} /></div>
      </div>
      <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="guardian-prompt">Prompt do sistema</Label><span className="text-xs text-muted-foreground">{settings.system_prompt.length}/4000</span></div><Textarea id="guardian-prompt" className="min-h-36" maxLength={4000} value={settings.system_prompt} onChange={(event) => update({ system_prompt: event.target.value })} /></div>
      <p className="text-sm text-muted-foreground">Por segurança, o Guardião analisa somente totais por categoria — nunca senhas, tokens, saldos completos ou extratos. Bloqueios de operações não autorizadas são determinísticos e não dependem da IA. A configuração fica restrita a administradores.</p>
      <Button type="submit" disabled={saving}><Save className="size-4" />{saving ? "Salvando…" : "Salvar"}</Button>
    </form>}
  </section>;
}
