import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";
import { advertiserSchema, advertisementSchema, isLiveAd } from "@/lib/advertising-rules";

export const adminAdvertisingData = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase, context.userId);
  const [companies, ads, positions] = await Promise.all([
    context.supabase.from("advertisers").select("*").order("created_at", { ascending: false }),
    context.supabase.from("advertisements").select("*").order("created_at", { ascending: false }),
    context.supabase.from("advertisement_placement_settings").select("*"),
  ]);
  for (const result of [companies, ads, positions]) if (result.error) throw new Error(result.error.message);
  const events: Array<{ advertisement_id: string; event_type: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await context.supabase.from("advertisement_events").select("advertisement_id,event_type").order("id").range(offset, offset + 999);
    if (result.error) throw new Error(result.error.message);
    events.push(...(result.data ?? [])); if ((result.data?.length ?? 0) < 1000) break;
  }
  return { companies: companies.data ?? [], ads: ads.data ?? [], positions: positions.data ?? [], events };
});
export const adminSaveAdvertiser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => advertiserSchema.parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  const { id, ...row } = data;
  const result = id ? await context.supabase.from("advertisers").update(row).eq("id", id) : await context.supabase.from("advertisers").insert(row);
  if (result.error) throw new Error(result.error.message); return { ok: true };
});
export const adminSaveAdvertisement = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => advertisementSchema.parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  const { data: company, error } = await context.supabase.from("advertisers").select("company_name,logo_url,status").eq("id", data.advertiser_id).single();
  if (error) throw new Error(error.message);
  if (data.status === "active" && company.status !== "active") throw new Error("Ative a empresa antes de aprovar o anúncio.");
  const { id, ...fields } = data;
  const row = { ...fields, badge_text: fields.badge_text || company.company_name, logo_url: fields.logo_url || company.logo_url, image_url: fields.image_url || null };
  const result = id ? await context.supabase.from("advertisements").update(row).eq("id", id) : await context.supabase.from("advertisements").insert(row);
  if (result.error) throw new Error(result.error.message); return { ok: true };
});
export const adminDeleteAdvertising = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: z.string().uuid(), kind: z.enum(["company", "ad"]) }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  const result = await context.supabase.from(data.kind === "company" ? "advertisers" : "advertisements").delete().eq("id", data.id);
  if (result.error) throw new Error(result.error.message); return { ok: true };
});
export const listLiveAdvertisements = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [ads, positions] = await Promise.all([
    context.supabase.from("advertisements").select("id,title,description,image_url,logo_url,destination_url,category,offer_text,badge_text,placement,start_date,end_date,status,is_sponsored,is_featured,priority,sort_order").eq("status", "active").order("priority", { ascending: false }).order("sort_order").order("id"),
    context.supabase.from("advertisement_placement_settings").select("placement,max_ads").eq("is_enabled", true),
  ]);
  if (ads.error || positions.error) throw new Error("Não foi possível carregar a publicidade.");
  return (positions.data ?? []).flatMap((p) => (ads.data ?? []).filter((a) => a.placement === p.placement && isLiveAd(a)).slice(0, p.max_ads));
});
export const recordAdvertisementEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ advertisement_id: z.string().uuid(), event_type: z.enum(["impression", "click"]), session_id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const { data: ad } = await context.supabase.from("advertisements").select("status,start_date,end_date").eq("id", data.advertisement_id).single();
  if (!ad || !isLiveAd(ad)) return { ok: false };
  const { error } = await context.supabase.from("advertisement_events").insert({ ...data, user_id: context.userId });
  if (error && error.code !== "23505") throw new Error("Não foi possível registrar o evento."); return { ok: true };
});
export const adminSaveAdPlacement = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ id: z.string().uuid(), max_ads: z.number().int().min(1).max(30), is_enabled: z.boolean() }).parse(d)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  const { error } = await context.supabase.from("advertisement_placement_settings").update({ max_ads: data.max_ads, is_enabled: data.is_enabled, updated_by: context.userId }).eq("id", data.id);
  if (error) throw new Error(error.message); return { ok: true };
});