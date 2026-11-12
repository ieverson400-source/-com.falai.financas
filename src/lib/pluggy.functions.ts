import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertBankOwner } from "@/lib/billing-rules";

const itemInput = z.object({ itemId: z.string().uuid() });
type Item = { id: string; clientUserId?: string; status: string; connector?: { id: number; name: string } };
type Account = { id: string; name: string; type: string; subtype: string; balance: number; currencyCode: string; number?: string };

export const listMyBanks = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [items, accounts] = await Promise.all([
    context.supabase.from("pluggy_items").select("id,pluggy_item_id,institution_name,status,last_synced_at").eq("user_id", context.userId),
    context.supabase.from("pluggy_accounts").select("id,item_id,name,type,balance,currency_code").eq("user_id", context.userId),
  ]);
  if (items.error || accounts.error) throw new Error(items.error?.message ?? accounts.error?.message);
  return { items: items.data ?? [], accounts: accounts.data ?? [] };
});
export const startBankConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId?: string }) => z.object({ itemId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    try {
      const { data: profile } = await context.supabase.from("profiles").select("is_active").eq("user_id", context.userId).maybeSingle();
      if (!profile?.is_active) throw new Error("Conta indisponível para conexão bancária.");
      const { pluggyKey, pluggyRequest } = await import("./pluggy.server");
      const key = await pluggyKey();
      if (data.itemId) {
        const { data: own } = await context.supabase.from("pluggy_items").select("id").eq("pluggy_item_id", data.itemId).eq("user_id", context.userId).maybeSingle();
        if (!own) throw new Error("Conexão não encontrada nesta conta.");
      }
      const result = await pluggyRequest<{ accessToken: string }>(key, "/connect_token", { method: "POST", body: JSON.stringify({ ...(data.itemId ? { itemId: data.itemId } : {}), options: { clientUserId: context.userId } }) });
      return { accessToken: result.accessToken };
    } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao conectar banco." }; }
  });

export const syncMyBank = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => itemInput.parse(input))
  .handler(async ({ context, data }) => {
    try {
      const { data: profile } = await context.supabase.from("profiles").select("is_active").eq("user_id", context.userId).maybeSingle();
      if (!profile?.is_active) throw new Error("Conta indisponível.");
      const { pluggyKey, pluggyRequest } = await import("./pluggy.server");
      const key = await pluggyKey();
      const item = await pluggyRequest<Item>(key, `/items/${data.itemId}`);
      assertBankOwner(item.clientUserId, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin.from("pluggy_items").select("user_id").eq("pluggy_item_id", item.id).maybeSingle();
      if (existing) assertBankOwner(existing.user_id, context.userId);
      const saved = await supabaseAdmin.from("pluggy_items").upsert({ user_id: context.userId, pluggy_item_id: item.id, status: item.status, institution_name: item.connector?.name, connector_id: item.connector?.id, last_synced_at: new Date().toISOString() }, { onConflict: "pluggy_item_id" }).select("id").single();
      if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Falha ao salvar conexão.");
      const accounts = await pluggyRequest<{ results: Account[] }>(key, `/accounts?itemId=${item.id}`);
      for (const account of accounts.results) {
        const result = await supabaseAdmin.from("pluggy_accounts").upsert({ user_id: context.userId, item_id: saved.data.id, pluggy_account_id: account.id, name: account.name, type: account.type, subtype: account.subtype, balance: account.balance, currency_code: account.currencyCode, number: null }, { onConflict: "pluggy_account_id" });
        if (result.error) throw new Error(result.error.message);
      }
      return { ok: true };
    } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao atualizar banco." }; }
  });
export const disconnectMyBank = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => itemInput.parse(input))
  .handler(async ({ context, data }) => {
    try {
      const own = await context.supabase.from("pluggy_items").select("id").eq("pluggy_item_id", data.itemId).eq("user_id", context.userId).maybeSingle();
      if (!own.data) throw new Error("Conexão não encontrada nesta conta.");
      const { pluggyKey, pluggyRequest } = await import("./pluggy.server");
      await pluggyRequest(await pluggyKey(), `/items/${data.itemId}`, { method: "DELETE" });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const result = await supabaseAdmin.from("pluggy_items").delete().eq("id", own.data.id).eq("user_id", context.userId);
      if (result.error) throw new Error(result.error.message);
      return { ok: true };
    } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao desconectar." }; }
  });