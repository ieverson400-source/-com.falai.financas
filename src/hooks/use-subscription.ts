import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type PlanKey = "free" | "pro" | "premium";

export interface SubscriptionState {
  subscription: SubscriptionRow | null;
  plan: PlanKey;
  isActive: boolean;
  isPro: boolean;
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ACTIVE_STATUSES = new Set(["active", "in_grace_period"]);

export function useSubscription(userId: string | undefined): SubscriptionState {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setSubscription(data ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime: reflete imediatamente quando o webhook ativa a assinatura.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sub-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setSubscription((payload.new as SubscriptionRow) ?? null);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const isActive = !!subscription && ACTIVE_STATUSES.has(subscription.status);
  const plan: PlanKey = isActive ? (subscription!.plan as PlanKey) : "free";

  return {
    subscription,
    plan,
    isActive,
    isPro: isActive && (plan === "pro" || plan === "premium"),
    isPremium: isActive && plan === "premium",
    loading,
    refresh,
  };
}
