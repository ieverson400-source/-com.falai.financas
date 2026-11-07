import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, ShieldCheck, Sparkles, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { getMyGuardian, generateMyGuardian } from '@/lib/guardian-user.functions';
import { formatBRL } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/bottom-nav';

const guardianQuery = queryOptions({ queryKey: ['my-guardian'], queryFn: () => getMyGuardian(), staleTime: 0 });

export const Route = createFileRoute('/_authenticated/app/guardiao')({
  loader: ({ context }) => context.queryClient.ensureQueryData(guardianQuery),
  component: GuardianPage,
  pendingComponent: () => <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" aria-label="Carregando Guardião" /></div>,
  errorComponent: ({ error, reset }) => <main className="min-h-screen grid place-items-center bg-background p-6"><div className="max-w-md space-y-4"><h1 className="text-xl font-semibold">Guardião Financeiro</h1><p role="alert">{error.message}</p><Button onClick={reset}><RefreshCw className="size-4" />Tentar novamente</Button><Button asChild variant="outline"><Link to="/app">Voltar ao app</Link></Button></div></main>,
  head: () => ({ meta: [
    { title: 'Guardião Financeiro — Falaí Finanças' },
    { name: 'description', content: 'Suas recomendações pessoais de gastos e alertas de orçamento no Falaí Finanças.' },
    { property: 'og:title', content: 'Guardião Financeiro — Falaí Finanças' },
    { property: 'og:description', content: 'Acompanhe seus gastos por categoria e recomendações pessoais.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex' },
  ] }),
});

function GuardianPage() {
  const { data } = useSuspenseQuery(guardianQuery);
  const client = useQueryClient();
  const generate = useServerFn(generateMyGuardian);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthName = new Date(`${data.month}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const latest = data.history[0];
  const disabled = working || !data.enabled || Boolean(data.blockedMessage) || !data.summary.count || data.used >= data.limit;
  const analyze = async () => {
    setWorking(true); setError(null);
    try {
      const result = await generate();
      if (!result.ok) setError(result.message);
      await client.invalidateQueries({ queryKey: ['my-guardian'] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a análise.'); }
    finally { setWorking(false); }
  };

  return <div className="min-h-screen bg-background pb-28">
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/app" aria-label="Voltar ao app"><ArrowLeft className="size-5" /></Link></Button>
        <ShieldCheck className="size-6 text-primary shrink-0" /><h1 className="font-display font-semibold text-lg">Guardião Financeiro</h1>
      </div>
    </header>
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-7 space-y-8">
      <section className="space-y-5">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div><p className="text-sm text-muted-foreground capitalize">{monthName}</p><h2 className="font-display text-2xl font-semibold mt-1">Seu mês, com mais clareza</h2></div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Análise pessoal e privada</div>
        </div>
        <div className="grid grid-cols-2 gap-5 border-y border-border py-5">
          <div><p className="text-sm text-muted-foreground">Gastos do mês</p><p className="font-display text-2xl font-semibold break-words mt-1">{formatBRL(data.summary.total)}</p></div>
          <div><p className="text-sm text-muted-foreground">Registros</p><p className="font-display text-2xl font-semibold mt-1">{data.summary.count}</p></div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center"><h2 className="font-display text-lg font-semibold flex items-center gap-2"><Sparkles className="size-5 text-primary" />Recomendações para você</h2><span className="text-xs text-muted-foreground">{data.used} de {data.limit} análises neste mês</span></div>
        {!data.enabled && <p role="status" className="text-muted-foreground">O Guardião está indisponível no momento. Seus gastos e recomendações anteriores continuam disponíveis.</p>}
        {data.blockedMessage && <p role="alert" className="text-destructive break-words">{data.blockedMessage}</p>}
        {!data.summary.count && <div className="border-l-2 border-primary pl-4 space-y-3"><p className="text-muted-foreground">Você ainda não registrou gastos neste mês.</p><Button asChild variant="outline"><Link to="/app">Registrar gasto</Link></Button></div>}
        {latest ? <article className="space-y-3 border-l-2 border-primary pl-4"><p className="text-xs text-muted-foreground">Última análise · {new Date(latest.created_at).toLocaleDateString('pt-BR')} · {new Date(`${latest.month}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long' })}</p><p className="whitespace-pre-wrap text-sm leading-7 break-words">{latest.recommendation}</p></article> : data.summary.count > 0 && <p className="text-sm text-muted-foreground">Nenhuma recomendação gerada ainda.</p>}
        <Button onClick={analyze} disabled={disabled} className="w-full sm:w-auto"><span className="flex items-center gap-2">{working ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{working ? 'Analisando seus gastos…' : latest ? 'Atualizar recomendações' : 'Analisar meus gastos'}</span></Button>
        {data.used >= data.limit && <p className="text-sm text-muted-foreground">Limite mensal atingido. Novas análises estarão disponíveis no próximo mês.</p>}
        {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
        <p className="text-xs text-muted-foreground leading-5">A IA recebe somente totais por categoria e limites de orçamento. Não recebe extratos, descrições, saldos ou dados de identificação. Recomendações não substituem orientação financeira profissional.</p>
      </section>

      {data.summary.categories.length > 0 && <section className="space-y-4"><div className="flex flex-wrap gap-3 justify-between items-center"><h2 className="font-display text-lg font-semibold">Gastos por categoria</h2><Button asChild size="sm" variant="outline"><Link to="/app/orcamentos">Orçamentos</Link></Button></div>
        <div className="grid sm:grid-cols-2 gap-3">{data.summary.categories.map(c => <Card key={c.category} className="p-4 rounded-lg space-y-3"><div className="flex justify-between items-start gap-3"><h3 className="font-medium break-words">{c.category}</h3><span className="font-semibold shrink-0">{formatBRL(c.total)}</span></div><p className="text-xs text-muted-foreground">{data.summary.total > 0 ? `${Math.round(c.total / data.summary.total * 100)}% dos gastos` : 'Sem gastos'}{c.limit > 0 ? ` · Limite ${formatBRL(c.limit)}` : ''}</p>{data.includeBudgetAlerts && c.alert !== 'ok' && <p className={`flex gap-2 text-xs ${c.alert === 'over' ? 'text-destructive' : 'text-warning'}`}><AlertTriangle className="size-4 shrink-0" />{c.alert === 'over' ? 'Limite de orçamento atingido' : 'Próximo do limite de orçamento'}</p>}</Card>)}</div>
      </section>}
      {data.history.length > 1 && <section className="space-y-4"><h2 className="font-display text-lg font-semibold">Análises anteriores</h2>{data.history.slice(1).map(item => <details key={item.id} className="border-b border-border py-3"><summary className="cursor-pointer text-sm font-medium">{new Date(item.created_at).toLocaleString('pt-BR')}</summary><p className="whitespace-pre-wrap text-sm leading-7 mt-3 break-words">{item.recommendation}</p></details>)}</section>}
    </main><BottomNav current="inicio" />
  </div>;
}