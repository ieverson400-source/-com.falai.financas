// Definição dos três planos. Fonte única: nenhum ID ou preço pode ficar escrito no JSX.
//
// TODO: confirmar nome do pacote e status no Play Console.
// Pacote informado pelo responsável: co.median.android.zpqlzxm (NÃO confirmado: o assetlinks.json do
// repositório lista com.falai.financas).
// Os IDs e preços abaixo são os informados pelo responsável do produto. O código existente de
// verificação no servidor (play-billing.server.ts) usa outros SKUs (falai_*_monthly) e o Kotlin de
// android/native usa premium_mensal/familia_mensal. Nada disso é ligado nesta etapa.

export const PLAN_KEYS = ["pro", "premium", "familia"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

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
}

export const PLANS: readonly PlanDefinition[] = [
  {
    key: "pro",
    id: PLAN_IDS.pro,
    name: "Pro",
    priceCents: 1990,
    // TODO: texto de benefícios pendente
    benefits: ["Benefício 1 do Pro", "Benefício 2 do Pro", "Benefício 3 do Pro"],
  },
  {
    key: "premium",
    id: PLAN_IDS.premium,
    name: "Premium",
    priceCents: 3990,
    // TODO: texto de benefícios pendente
    benefits: ["Benefício 1 do Premium", "Benefício 2 do Premium", "Benefício 3 do Premium"],
  },
  {
    key: "familia",
    id: PLAN_IDS.familia,
    name: "Família",
    priceCents: 6990,
    // TODO: texto de benefícios pendente
    benefits: ["Benefício 1 do Família", "Benefício 2 do Família", "Benefício 3 do Família"],
  },
];

export const ALL_PLAN_IDS: readonly string[] = PLANS.map((p) => p.id);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatPlanPrice(priceCents: number): string {
  return brl.format(priceCents / 100);
}
