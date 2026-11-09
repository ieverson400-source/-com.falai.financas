import { z } from "zod";

export const stripePlanKeys = ["pro_monthly", "premium_monthly", "familia_monthly"] as const;
export const stripeEnvironment = z.enum(["sandbox", "live"]);
export function subscriptionUsable(status: string, end: string | null, now = Date.now()) {
  return ["active", "trialing", "past_due", "in_grace_period", "canceled"].includes(status)
    && (end ? new Date(end).getTime() > now : status !== "canceled");
}
export function assertBankOwner(owner: string | null | undefined, userId: string) {
  if (owner !== userId) throw new Error("Esta conexão bancária não pertence à sua conta.");
}