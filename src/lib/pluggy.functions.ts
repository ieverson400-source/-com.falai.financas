import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLUGGY_API = "https://api.pluggy.ai";

async function getPluggyApiKey(): Promise<string> {
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

async function pluggyFetch(path: string, apiKey: string, init?: RequestInit) {
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

// Create a connect token used by the Pluggy Connect widget on the client
export const createPluggyConnectToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const apiKey = await getPluggyApiKey();
    const body: Record<string, unknown> = {
      clientUserId: context.userId,
    };
    if (data?.itemId) body.itemId = data.itemId;
    const res = await pluggyFetch("/connect_token", apiKey, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { accessToken: res.accessToken as string };
  });

// Save an item (bank connection) returned by the widget and sync its data
export const saveAndSyncItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ itemId: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let itemRowId: string | null = null;
    try {
    const apiKey = await getPluggyApiKey();

    // Fetch item details
    const item = await pluggyFetch(`/items/${data.itemId}`, apiKey);
    const connectorName = item?.connector?.name ?? null;
    const connectorId = item?.connector?.id ?? null;

    // Upsert item
    const { data: itemRow, error: itemErr } = await supabase
      .from("pluggy_items")
      .upsert(
        {
          user_id: userId,
          pluggy_item_id: data.itemId,
          connector_id: connectorId,
          institution_name: connectorName,
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

    // Fetch accounts
    const accountsRes = await pluggyFetch(`/accounts?itemId=${data.itemId}`, apiKey);
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

      // Fetch latest transactions (page 1, default ~500)
      const txRes = await pluggyFetch(
        `/transactions?accountId=${acc.id}&pageSize=200`,
        apiKey,
      );
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

    return { ok: true, itemId: itemRow.id, accountsCount: accounts.length };
  });

export const listBankData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [items, accounts, transactions] = await Promise.all([
      supabase.from("pluggy_items").select("*").order("created_at", { ascending: false }),
      supabase.from("pluggy_accounts").select("*").order("created_at", { ascending: false }),
      supabase
        .from("pluggy_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(50),
    ]);
    return {
      items: items.data ?? [],
      accounts: accounts.data ?? [],
      transactions: transactions.data ?? [],
    };
  });

export const deletePluggyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("pluggy_items")
      .select("pluggy_item_id")
      .eq("id", data.itemId)
      .single();
    if (row?.pluggy_item_id) {
      try {
        const apiKey = await getPluggyApiKey();
        await fetch(`${PLUGGY_API}/items/${row.pluggy_item_id}`, {
          method: "DELETE",
          headers: { "X-API-KEY": apiKey },
        });
      } catch (e) {
        console.error("Failed to delete on Pluggy:", e);
      }
    }
    await supabase.from("pluggy_items").delete().eq("id", data.itemId);
    return { ok: true };
  });
