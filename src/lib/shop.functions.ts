import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";
import type { Database } from "@/integrations/supabase/types";

const SELECT =
  "id, kind, brand, title, subtitle, price, installments, cashback, badges, cta_label, link_url, image_url, accent, sort_order, is_active, starts_at, ends_at, created_at";

const offerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  kind: z.enum(["highlight", "offer", "coupon"]),
  brand: z.string().max(80).optional().nullable(),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(240).optional().nullable(),
  price: z.string().max(40).optional().nullable(),
  installments: z.string().max(80).optional().nullable(),
  cashback: z.string().max(80).optional().nullable(),
  badges: z.array(z.string().max(40)).max(6).optional(),
  cta_label: z.string().max(40).optional().nullable(),
  link_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  image_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  accent: z.string().max(120).optional().nullable(),
  sort_order: z.number().int().min(0).max(999).optional(),
  is_active: z.boolean().optional(),
  starts_at: z.string().max(40).optional().nullable(),
  ends_at: z.string().max(40).optional().nullable(),
});

// Ofertas reais publicadas para a tela Shop (leitura pública via política TO anon)
export const listShopOffers = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data } = await supabasePublic
    .from("shop_offers")
    .select(SELECT)
    .order("sort_order", { ascending: true })
    .limit(60);

  return { offers: data ?? [] };
});

export const adminListOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from: z.string().max(30).optional().nullable(),
        to: z.string().max(30).optional().nullable(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("shop_offers")
      .select(SELECT)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .limit(300);
    // Período: ofertas cujo intervalo de vigência cruza o filtro.
    if (data.from) q = q.or(`ends_at.is.null,ends_at.gte.${data.from}`);
    if (data.to) {
      const end = `${data.to.slice(0, 10)}T23:59:59.999Z`;
      q = q.or(`starts_at.is.null,starts_at.lte.${end}`);
    }
    const { data: offers, error } = await q;
    if (error) throw new Error(error.message);
    return { offers: offers ?? [] };
  });

export const adminSaveOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => offerSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      kind: data.kind,
      brand: data.brand || null,
      title: data.title,
      subtitle: data.subtitle || null,
      price: data.price || null,
      installments: data.installments || null,
      cashback: data.cashback || null,
      badges: data.badges ?? [],
      cta_label: data.cta_label || null,
      link_url: data.link_url || null,
      image_url: data.image_url || null,
      accent: data.accent || null,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
      starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : null,
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("shop_offers")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("shop_offers")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

export const adminDeleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("shop_offers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
