import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageCircle,
  Save,
  Bell,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  Lightbulb,
  Clock,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/notification-prefs.functions";
import {
  format,
  addDays,
  addMonths,
  setDate,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
  nextMonday,
  nextFriday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/agendas")({
  component: AgendasPage,
  head: () => ({
    meta: [
      { title: "Agendas & WhatsApp — Falaí Finanças" },
      {
        name: "description",
        content:
          "Vincule seu WhatsApp, escolha suas notificações e veja a agenda dos seus relatórios financeiros no Falaí Finanças.",
      },
      { property: "og:title", content: "Agendas & WhatsApp — Falaí Finanças" },
      {
        property: "og:description",
        content: "WhatsApp, preferências e cronograma de relatórios em um só lugar.",
      },
    ],
  }),
});

type PrefKey =
  | "notify_expense_confirmation"
  | "notify_daily_summary"
  | "notify_weekly_summary"
  | "notify_monthly_summary"
  | "notify_budget_alert"
  | "notify_weekly_tip"
  | "notify_inactivity";

type Prefs = Record<PrefKey, boolean>;

const DEFAULT_PREFS: Prefs = {
  notify_expense_confirmation: true,
  notify_daily_summary: true,
  notify_weekly_summary: true,
  notify_monthly_summary: true,
  notify_budget_alert: true,
  notify_weekly_tip: true,
  notify_inactivity: true,
};

function nextDaily21h(now: Date) {
  let d = setSeconds(setMinutes(setHours(now, 21), 0), 0);
  if (d.getTime() <= now.getTime()) d = addDays(d, 1);
  return d;
}
function nextMonday9h(now: Date) {
  const base = now.getDay() === 1 && now.getHours() < 9 ? now : nextMonday(now);
  return setSeconds(setMinutes(setHours(base, 9), 0), 0);
}
function nextFriday10h(now: Date) {
  const base = now.getDay() === 5 && now.getHours() < 10 ? now : nextFriday(now);
  return setSeconds(setMinutes(setHours(base, 10), 0), 0);
}
function nextFirstOfMonth9h(now: Date) {
  const first = setDate(startOfDay(now), 1);
  const target = setHours(first, 9);
  const next =
    now.getDate() === 1 && now.getHours() < 9 ? target : setDate(addMonths(first, 1), 1);
  return setSeconds(setMinutes(setHours(next, 9), 0), 0);
}
function formatWhen(d: Date) {
  return format(d, "EEEE, dd 'de' MMMM 'às' HH'h'mm", { locale: ptBR });
}

const PREF_ITEMS: Array<{
  key: PrefKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  frequency: string;
  computeWhen: (now: Date) => string;
}> = [
  {
    key: "notify_expense_confirmation",
    title: "Confirmação de gasto",
    description: "Mensagem instantânea sempre que um novo gasto é registrado.",
    icon: CheckCircle2,
    frequency: "A cada gasto",
    computeWhen: () => "Instantâneo, sempre que você registra um gasto",
  },
  {
    key: "notify_daily_summary",
    title: "Resumo diário",
    description: "Todo dia às 21h com o total gasto e principais categorias.",
    icon: CalendarDays,
    frequency: "Diário",
    computeWhen: (now) => `Próximo: ${formatWhen(nextDaily21h(now))}`,
  },
  {
    key: "notify_weekly_summary",
    title: "Resumo semanal",
    description: "Toda segunda de manhã, comparando com a semana anterior.",
    icon: CalendarRange,
    frequency: "Semanal",
    computeWhen: (now) => `Próximo: ${formatWhen(nextMonday9h(now))}`,
  },
  {
    key: "notify_monthly_summary",
    title: "Resumo mensal",
    description: "No 1º de cada mês com o fechamento do mês anterior.",
    icon: CalendarRange,
    frequency: "Mensal",
    computeWhen: (now) => `Próximo: ${formatWhen(nextFirstOfMonth9h(now))}`,
  },
  {
    key: "notify_budget_alert",
    title: "Alerta de orçamento",
    description: "Aviso quando uma categoria atinge 80% e 100% da meta.",
    icon: AlertTriangle,
    frequency: "Sob demanda",
    computeWhen: () => "Quando uma categoria atinge 80% e 100% da meta",
  },
  {
    key: "notify_weekly_tip",
    title: "Dica financeira semanal",
    description: "Toda sexta com uma dica personalizada com base nos seus gastos.",
    icon: Lightbulb,
    frequency: "Semanal",
    computeWhen: (now) => `Próximo: ${formatWhen(nextFriday10h(now))}`,
  },
  {
    key: "notify_inactivity",
    title: "Lembrete de inatividade",
    description: "Um cutuque amigável se você ficar 5+ dias sem registrar gastos.",
    icon: Clock,
    frequency: "Sob demanda",
    computeWhen: () => "Se você ficar 5+ dias sem registrar gastos",
  },
];

function AgendasPage() {
  const [phone, setPhone] = useState("");
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savingPref, setSavingPref] = useState<PrefKey | null>(null);

  const fetchPrefs = useServerFn(getNotificationPrefs);
  const savePref = useServerFn(updateNotificationPrefs);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPrefs();
        if (cancelled) return;
        setPrefs({
          notify_expense_confirmation: data.notify_expense_confirmation,
          notify_daily_summary: data.notify_daily_summary,
          notify_weekly_summary: data.notify_weekly_summary,
          notify_monthly_summary: data.notify_monthly_summary,
          notify_budget_alert: data.notify_budget_alert,
          notify_weekly_tip: data.notify_weekly_tip,
          notify_inactivity: data.notify_inactivity,
        });
        if (data.whatsapp_phone) {
          setLinkedPhone(data.whatsapp_phone);
          setPhone(data.whatsapp_phone);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPrefs]);

  const handleConectar = async () => {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      toast.error("Informe um número válido com DDI, ex: +5511999999999.");
      return;
    }

    setSaving(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        throw new Error("Sessão não encontrada. Faça login novamente.");
      }

      const { data: conflict, error: conflictErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("whatsapp_phone", normalized)
        .maybeSingle();
      if (conflictErr) throw new Error(conflictErr.message);
      if (conflict && conflict.user_id !== userRes.user.id) {
        throw new Error("Esse número já está vinculado a outro usuário.");
      }

      const { data: updated, error: updateErr } = await supabase
        .from("profiles")
        .update({ whatsapp_phone: normalized })
        .eq("user_id", userRes.user.id)
        .select("whatsapp_phone")
        .maybeSingle();
      if (updateErr) throw new Error(updateErr.message);

      if (!updated) {
        const { error: insertErr } = await supabase.from("profiles").insert({
          user_id: userRes.user.id,
          display_name:
            userRes.user.user_metadata?.display_name ?? userRes.user.email ?? null,
          whatsapp_phone: normalized,
        });
        if (insertErr) throw new Error(insertErr.message);
      }

      toast.success(`WhatsApp ${normalized} conectado!`);
      setLinkedPhone(normalized);
      setPhone(normalized);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (key: PrefKey, value: boolean) => {
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSavingPref(key);
    try {
      await savePref({ data: { [key]: value } });
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: prev }));
      toast.error(e instanceof Error ? e.message : "Erro ao salvar preferência.");
    } finally {
      setSavingPref(null);
    }
  };

  const now = new Date();

  return (
    <div className="min-h-screen bg-background pb-24">
      <Toaster />
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold">Agendas & WhatsApp</h1>
            <p className="text-xs text-muted-foreground">
              Vincule seu número, escolha as notificações e veja o cronograma
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {/* Vincular WhatsApp */}
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <MessageCircle className="size-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {linkedPhone ? "Número vinculado" : "Vincule seu WhatsApp"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {linkedPhone
                    ? "Você pode alterar o número a qualquer momento."
                    : "Informe seu número no formato internacional (DDI + DDD + número)."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">Número do WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+5511999999999"
                  inputMode="tel"
                />
              </div>
              <Button
                onClick={handleConectar}
                disabled={saving || phone.trim().length === 0}
                className="gap-2"
              >
                <Save className="size-4" />
                {saving
                  ? "Salvando..."
                  : linkedPhone
                    ? "Atualizar número"
                    : "Conectar"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Notificações + agenda combinadas */}
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <Bell className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">
                Notificações e agenda
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ative o que quer receber e veja quando cada mensagem chega.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y">
              {PREF_ITEMS.map(
                ({ key, title, description, icon: Icon, frequency, computeWhen }) => {
                  const enabled = prefs[key];
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div
                        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${
                          enabled
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label
                            htmlFor={`pref-${key}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {title}
                          </Label>
                          <Badge
                            variant={enabled ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {enabled ? frequency : "Desativado"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {description}
                        </p>
                        {enabled && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <CalendarClock className="size-3.5 text-primary" />
                            {computeWhen(now)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {savingPref === key && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          id={`pref-${key}`}
                          checked={enabled}
                          disabled={savingPref === key}
                          onCheckedChange={(v) => togglePref(key, v)}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {!linkedPhone && !loading && (
            <p className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Vincule um número acima para começar a receber as mensagens.
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}
