// Definição dos três planos. Fonte única: nenhum ID ou preço pode ficar escrito no JSX.

/**
 * Nome do pacote Android informado pelo responsável, para a Etapa 3 (validação de compra).
 * TODO: confirmar nome do pacote no Play Console. O assetlinks.json do repositório lista
 * com.falai.financas, que é diferente deste valor; a diferença precisa ser resolvida.
 */
export const packageName = "co.median.android.zpqlzxm";

export const PLAN_KEYS = ["pro", "premium", "familia"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

// TODO: confirmar status Ativo no Play Console
// IDs de produto informados pelo responsável. O código existente de verificação no servidor
// (play-billing.server.ts) usa outros SKUs (falai_*_monthly) e o Kotlin de android/native usa
// premium_mensal/familia_mensal. Nada disso é ligado nesta etapa.
export const PLAN_IDS: Readonly<Record<PlanKey, string>> = {
  pro: "falai_pro",
  premium: "falai_premium",
  familia: "falai_familia",
};

export interface PlanDefinition {
  key: PlanKey;
  /** ID do produto (Play Console). */
  id: string;
  name: string;
  /** Preço mensal em centavos inteiros. */
  priceCents: number;
  benefits: readonly string[];
  /** Enquanto verdadeiro, os benefícios são placeholders e a tela NÃO os exibe aos usuários. */
  benefitsPending: boolean;
}

export const PLANS: readonly PlanDefinition[] = [
  {
    key: "pro",
    id: PLAN_IDS.pro,
    name: "Pro",
    priceCents: 1990,
    // TODO: texto de benefícios pendente
    benefits: ["Benefício 1 do Pro", "Benefício 2 do Pro", "Benefício 3 do Pro"],
    benefitsPending: true,
  },
  {
    key: "premium",
    id: PLAN_IDS.premium,
    name: "Premium",
    priceCents: 3990,
    // TODO: texto de benefícios pendente
    benefits: ["Benefício 1 do Premium", "Benefício 2 do Premium", "Benefício 3 do Premium"],
    benefitsPending: true,
  },
  {
    key: "familia",
    id: PLAN_IDS.familia,
    name: "Família",
    priceCents: 6990,
    // TODO: texto de benefícios pendente
    benefits: ["Benefício 1 do Família", "Benefício 2 do Família", "Benefício 3 do Família"],
    benefitsPending: true,
  },
];

export const ALL_PLAN_IDS: readonly string[] = PLANS.map((p) => p.id);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatPlanPrice(priceCents: number): string {
  return brl.format(priceCents / 100);
}
