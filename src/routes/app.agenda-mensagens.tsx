import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  Lightbulb,
  Clock,
  MessageCircle,
  Loader2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getNotificationPrefs } from "@/lib/notification-prefs.functions";
import { format, addDays, addMonths, setDate, setHours, setMinutes, setSeconds, startOfDay, nextMonday, nextFriday } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/agenda-mensagens")({
  component: AgendaMensagensPage,
  head: () => ({
    meta: [
      { title: "Agenda de mensagens — Falaí Finanças" },
      {
        name: "description",
        content:
          "Veja quando cada relatório financeiro será enviado no seu WhatsApp pelo Falaí Finanças.",
      },
      { property: "og:title", content: "Agenda de mensagens — Falaí Finanças" },
      {
        property: "og:description",
        content: "Cronograma personalizado dos seus relatórios no WhatsApp.",
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

type Prefs = Record<PrefKey, boolean> & { whatsapp_phone: string | null };

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
  const next = now.getDate() === 1 && now.getHours() < 9 ? target : setDate(addMonths(first, 1), 1);
  return setSeconds(setMinutes(setHours(next, 9), 0), 0);
}

function formatWhen(d: Date) {
  return format(d, "EEEE, dd 'de' MMMM 'às' HH'h'mm", { locale: ptBR });
}

function AgendaMensagensPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchPrefs = useServerFn(getNotificationPrefs);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPrefs();
        if (!cancelled) setPrefs(data as Prefs);
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

  const now = new Date();

  const items: Array<{
    key: PrefKey;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    frequency: string;
    when: string;
    description: string;
  }> = [
    {
      key: "notify_expense_confirmation",
      title: "Confirmação de gasto",
      icon: CheckCircle2,
      frequency: "A cada gasto",
      when: "Instantâneo, sempre que você registra um gasto",
      description: "Chega em segundos depois de qualquer novo lançamento.",
    },
    {
      key: "notify_daily_summary",
      title: "Resumo diário",
      icon: CalendarDays,
      frequency: "Diário",
      when: `Próximo: ${formatWhen(nextDaily21h(now))}`,
      description: "Todo dia às 21h com o total gasto e principais categorias.",
    },
    {
      key: "notify_weekly_summary",
      title: "Resumo semanal",
      icon: CalendarRange,
      frequency: "Semanal",
      when: `Próximo: ${formatWhen(nextMonday9h(now))}`,
      description: "Toda segunda de manhã comparando com a semana anterior.",
    },
    {
      key: "notify_monthly_summary",
      title: "Resumo mensal",
      icon: CalendarRange,
      frequency: "Mensal",
      when: `Próximo: ${formatWhen(nextFirstOfMonth9h(now))}`,
      description: "No 1º de cada mês com o fechamento do mês anterior.",
    },
    {
      key: "notify_budget_alert",
      title: "Alerta de orçamento",
      icon: AlertTriangle,
      frequency: "Sob demanda",
      when: "Quando uma categoria atinge 80% e 100% da meta",
      description: "Enviado no momento em que o limite é ultrapassado.",
    },
    {
      key: "notify_weekly_tip",
      title: "Dica financeira semanal",
      icon: Lightbulb,
      frequency: "Semanal",
      when: `Próximo: ${formatWhen(nextFriday10h(now))}`,
      description: "Toda sexta com uma dica gerada por IA com base nos seus gastos.",
    },
    {
      key: "notify_inactivity",
      title: "Lembrete de inatividade",
      icon: Clock,
      frequency: "Sob demanda",
      when: "Se você ficar 5+ dias sem registrar gastos",
      description: "Um cutuque amigável, no máximo uma vez por semana.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold">Agenda de mensagens</h1>
            <p className="text-xs text-muted-foreground">
              Quando cada relatório será enviado no seu WhatsApp
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {!prefs?.whatsapp_phone && (
              <Card className="border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 size-5 text-amber-600" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">Nenhum WhatsApp vinculado</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Vincule um número em{" "}
                      <Link to="/app/conectar-whatsapp" className="underline">
                        WhatsApp & notificações
                      </Link>{" "}
                      para começar a receber os relatórios abaixo.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {prefs?.whatsapp_phone && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageCircle className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Enviando para</p>
                    <p className="font-medium text-sm truncate">{prefs.whatsapp_phone}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/app/conectar-whatsapp" className="gap-1.5">
                      <Settings className="size-4" />
                      Ajustar
                    </Link>
                  </Button>
                </div>
              </Card>
            )}

            <div className="space-y-2.5">
              {items.map(({ key, title, icon: Icon, frequency, when, description }) => {
                const enabled = prefs?.[key] ?? false;
                return (
                  <Card
                    key={key}
                    className={`p-4 transition-opacity ${enabled ? "" : "opacity-50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                          enabled
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{title}</p>
                          <Badge variant={enabled ? "default" : "outline"} className="text-[10px]">
                            {enabled ? frequency : "Desativado"}
                          </Badge>
                        </div>
                        {enabled ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <CalendarClock className="size-3.5 text-primary" />
                            {when}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Ative em WhatsApp & notificações para receber.
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="p-4 bg-muted/40 border-dashed">
              <p className="text-xs text-muted-foreground text-center">
                Quer mudar a frequência ou desligar algum tipo?{" "}
                <Link to="/app/conectar-whatsapp" className="text-primary underline font-medium">
                  Abrir preferências
                </Link>
              </p>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
