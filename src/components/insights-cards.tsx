import { useMemo } from "react";
import { Repeat, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/categories";
import { detectRecurring, type ExpenseLike } from "@/lib/insights/recurring";
import { projectMonthEnd } from "@/lib/insights/projection";

// Resumos automáticos calculados NO NAVEGADOR a partir dos gastos que o usuário já registrou.
// Nada sai do aparelho e nada é gravado: são estimativas por heurística e podem errar.

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function InsightsCards({ expenses }: { expenses: readonly ExpenseLike[] }) {
  const { projection, recurring } = useMemo(() => {
    const now = new Date();
    const rec = detectRecurring(expenses, now);
    return { projection: projectMonthEnd(expenses, now, rec), recurring: rec };
  }, [expenses]);

  if (expenses.length === 0) return null;

  const active = recurring.filter((r) => r.status === "active");
  const subs = active.filter((r) => r.likelySubscription);
  const subsMonthly = subs.reduce((s, r) => s + r.monthlyCost, 0);
  const fixedMonthly = active.reduce((s, r) => s + r.monthlyCost, 0);
  const shown = active.slice(0, 6);

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
      {projection && (
        <Card className="bg-card p-5 shadow-soft sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15">
              <TrendingUp className="size-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold sm:text-lg">Projeção do fim do mês</h2>
              <p className="text-xs text-muted-foreground">
                Dia {projection.daysElapsed} de {projection.daysInMonth}
              </p>
            </div>
            {projection.confidence === "low" && <Badge variant="secondary">Estimativa preliminar</Badge>}
          </div>

          <p className="mt-4 break-words font-display text-3xl font-bold">{formatBRL(projection.projectedTotal)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Já gasto neste mês: {formatBRL(projection.spentSoFar)}</p>

          {projection.vsHistoricalPct !== null && projection.historicalAvg !== null && (
            <p className="mt-3 text-sm">
              {projection.vsHistoricalPct === 0
                ? "Na média dos seus últimos meses"
                : `${Math.abs(projection.vsHistoricalPct)}% ${projection.vsHistoricalPct > 0 ? "acima" : "abaixo"} da média dos seus últimos meses`}{" "}
              <span className="text-muted-foreground">({formatBRL(projection.historicalAvg)})</span>
            </p>
          )}

          {projection.pendingCharges.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Inclui {formatBRL(projection.pendingFixed)} de cobranças fixas previstas:{" "}
              {projection.pendingCharges
                .slice(0, 3)
                .map((c) => `${c.label} (${shortDate(c.date)})`)
                .join(", ")}
            </p>
          )}

          <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
            Estimativa com base nos gastos que você registrou. O valor real pode variar.
          </p>
        </Card>
      )}

      <Card className="bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15">
            <Repeat className="size-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold sm:text-lg">Assinaturas e cobranças recorrentes</h2>
            <p className="text-xs text-muted-foreground">Detectadas nos seus lançamentos</p>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ainda não encontramos cobranças que se repetem todo mês. Com alguns meses de gastos registrados, mostramos
            aqui as assinaturas que você pode ter esquecido.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm">
              {subs.length > 0 ? (
                <>
                  Assinaturas: cerca de <strong>{formatBRL(subsMonthly)}</strong> por mês ({formatBRL(subsMonthly * 12)} por ano).
                </>
              ) : (
                <>
                  Cobranças fixas: cerca de <strong>{formatBRL(fixedMonthly)}</strong> por mês.
                </>
              )}
            </p>
            <ul className="mt-3 divide-y divide-border">
              {shown.map((r) => (
                <li key={r.key} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(r.monthlyCost)}/mês · há {r.monthsActive} {r.monthsActive === 1 ? "mês" : "meses"}
                      {r.priceChangePct !== null && r.priceChangePct > 0 && ` · reajuste de ${r.priceChangePct}%`}
                    </p>
                  </div>
                  {r.review && <Badge variant="secondary">Vale revisar</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Identificado automaticamente (mesmo nome e valor parecido a cada mês) e pode conter erros. “Vale revisar” é só um
              lembrete para você conferir se ainda usa o serviço.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
