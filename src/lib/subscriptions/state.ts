// Converte a linha da tabela `subscriptions` no estado exibido ao usuário. Código puro.
// Regras conservadoras e alinhadas ao hook existente (use-subscription.ts), que considera
// ativos os status "active" e "in_grace_period".

import { PLAN_KEYS, type PlanKey } from "./plans.ts";
import type { SubscriptionState } from "./provider.ts";

export interface SubscriptionRowLike {
  plan: string;
  status: string;
  current_period_end: string | null;
}

export function mapSubscriptionRow(row: SubscriptionRowLike | null, now: Date): SubscriptionState {
  if (!row) return "free";
  const plan = (PLAN_KEYS as readonly string[]).includes(row.plan) ? (row.plan as PlanKey) : null;
  if (!plan) return "free";

  switch (row.status) {
    case "active":
    case "in_grace_period":
      return plan;
    case "canceled": {
      // Cancelada, mas o acesso vale até o fim do período já pago.
      const end = row.current_period_end ? new Date(row.current_period_end).getTime() : NaN;
      return Number.isFinite(end) && end > now.getTime() ? plan : "expired";
    }
    case "expired":
      return "expired";
    case "on_hold":
    case "paused":
      return "pending"; // conservador: mostra "em processamento" e desabilita ações
    case "inactive":
      return "free";
    default:
      return "pending"; // status desconhecido nunca vira plano ativo
  }
}
