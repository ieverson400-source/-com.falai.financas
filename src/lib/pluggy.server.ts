// Server-only helpers for the Pluggy (Open Finance) integration.
// Never import this from client-reachable module scope — use `await import()` inside handlers.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const PLUGGY_API = "https://api.pluggy.ai";

type DB = SupabaseClient<Database>;

export async function getPluggyApiKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Pluggy credentials not configured");

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { apiKey: string };
  return data.apiKey;
}

export async function pluggyFetch(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`${PLUGGY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Pluggy ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Public base URL used to build the Pluggy webhook URL. */
export function publicBaseUrl(): string {
  return (
    process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://falai-finan-as.lovable.app"
  );
}

export function pluggyWebhookUrl(): string {
  return `${publicBaseUrl()}/api/public/pluggy-webhook`;
}

/**
 * Idempotent sync of one Pluggy item: item -> accounts (incl. credit cards) -> transactions.
 * All writes are upserts keyed by the Pluggy IDs, so re-running is safe.
 */
export async function syncPluggyItem(
  supabase: DB,
  userId: string,
  pluggyItemId: string,
  triggeredBy: "manual" | "webhook" = "manual",
): Promise<{ ok: true; itemId: string; accountsCount: number }> {
  let itemRowId: string | null = null;
  try {
    const apiKey = await getPluggyApiKey();

    const item = await pluggyFetch(`/items/${pluggyItemId}`, apiKey);

    const { data: itemRow, error: itemErr } = await supabase
      .from("pluggy_items")
      .upsert(
        {
          user_id: userId,
          pluggy_item_id: pluggyItemId,
          connector_id: item?.connector?.id ?? null,
          institution_name: item?.connector?.name ?? null,
          status: item?.status ?? "UPDATED",
          status_detail: item?.statusDetail ?? null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "pluggy_item_id" },
      )
      .select()
      .single();
    if (itemErr || !itemRow) throw new Error(itemErr?.message ?? "Failed to save item");
    itemRowId = itemRow.id;

    const accountsRes = await pluggyFetch(`/accounts?itemId=${pluggyItemId}`, apiKey);
    const accounts = (accountsRes?.results ?? []) as Array<{
      id: string;
      type?: string;
      subtype?: string;
      name?: string;
      number?: string;
      balance?: number;
      currencyCode?: string;
    }>;

    for (const acc of accounts) {
      const { data: accRow, error: accErr } = await supabase
        .from("pluggy_accounts")
        .upsert(
          {
            user_id: userId,
            item_id: itemRow.id,
            pluggy_account_id: acc.id,
            type: acc.type ?? null,
            subtype: acc.subtype ?? null,
            name: acc.name ?? null,
            number: acc.number ?? null,
            balance: acc.balance ?? null,
            currency_code: acc.currencyCode ?? "BRL",
            raw: acc as never,
          },
          { onConflict: "pluggy_account_id" },
        )
        .select()
        .single();
      if (accErr || !accRow) continue;

      const txRes = await pluggyFetch(`/transactions?accountId=${acc.id}&pageSize=200`, apiKey);
      const txs = (txRes?.results ?? []) as Array<{
        id: string;
        description?: string;
        amount: number;
        currencyCode?: string;
        date: string;
        category?: string;
        type?: string;
      }>;

      if (txs.length > 0) {
        await supabase.from("pluggy_transactions").upsert(
          txs.map((t) => ({
            user_id: userId,
            account_id: accRow.id,
            pluggy_transaction_id: t.id,
            description: t.description ?? null,
            amount: t.amount,
            currency_code: t.currencyCode ?? "BRL",
            transaction_date: t.date,
            category: t.category ?? null,
            type: t.type ?? null,
            raw: t as never,
          })),
          { onConflict: "pluggy_transaction_id" },
        );
      }
    }

    await supabase.from("pluggy_sync_logs").insert({
      user_id: userId,
      item_id: itemRow.id,
      pluggy_item_id: pluggyItemId,
      status: "success",
      accounts_count: accounts.length,
      triggered_by: triggeredBy,
    });

    return { ok: true, itemId: itemRow.id, accountsCount: accounts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (itemRowId) {
      await supabase.from("pluggy_sync_logs").insert({
        user_id: userId,
        item_id: itemRowId,
        pluggy_item_id: pluggyItemId,
        status: "error",
        error_message: message,
        triggered_by: triggeredBy,
      });
    }
    throw err;
  }
}
