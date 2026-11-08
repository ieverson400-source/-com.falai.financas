import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";
import { sendN8nWebhook } from "@/lib/n8n-webhook.server";

const userActionSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
  isActive: z.boolean(),
  reason: z.string().trim().max(300).nullable().optional(),
});
const userIdSchema = z.object({ userId: z.string().uuid() });
const settingsSchema = z.object({
  maintenanceMode: z.boolean(), registrationsEnabled: z.boolean(),
  homeBannerText: z.string().trim().max(500).nullable(),
});
const adsenseSchema = z.object({
  enabled: z.boolean(),
  publisherId: z.string().trim().max(40).nullable(),
  adSlotId: z.string().trim().max(40).nullable(),
  adFormat: z.enum(["auto", "rectangle", "horizontal", "vertical", "fluid"]),
  position: z.enum(["SHOP_TOP", "SHOP_MIDDLE", "SHOP_OFFERS", "SHOP_BOTTOM"]),
  maxWidth: z.number().int().min(280).max(1600),
  marginTop: z.number().int().min(0).max(120),
  marginBottom: z.number().int().min(0).max(120),
  showInShop: z.boolean(),
  showInOtherScreens: z.boolean(),
  testMode: z.boolean(),
}).superRefine((value, context) => {
  if (!value.enabled) return;
  if (!value.publisherId || !/^ca-pub-\d+$/.test(value.publisherId)) context.addIssue({ code: "custom", path: ["publisherId"], message: "Publisher ID inválido." });
  if (!value.adSlotId || !/^\d+$/.test(value.adSlotId)) context.addIssue({ code: "custom", path: ["adSlotId"], message: "ID do bloco inválido." });
});

async function authorizedAdmin(context: { supabase: Parameters<typeof assertAdmin>[0]; userId: string }) {
  await assertAdmin(context.supabase, context.userId);
  return import("@/integrations/supabase/client.server");
}

export const adminDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const [authRes, profilesRes, rolesRes, expensesRes, offersRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("user_id,display_name,created_at,is_active,blocked_reason"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("expenses").select("user_id,amount"),
      supabaseAdmin.from("shop_offers").select("id,is_active"),
    ]);
    for (const result of [authRes, profilesRes, rolesRes, expensesRes, offersRes]) { if (result.error) throw result.error; }
    const usersRaw = authRes.data?.users ?? [];
    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const balances = new Map<string, number>();
    for (const expense of expensesRes.data ?? []) balances.set(expense.user_id, (balances.get(expense.user_id) ?? 0) + Number(expense.amount));
    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const roleMap = new Map<string, "user" | "admin">();
    for (const role of roles) if (role.role === "admin") roleMap.set(role.user_id, "admin");
    const users = usersRaw.map((user) => ({
      id: user.id, email: user.email ?? null, createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null, name: profileMap.get(user.id)?.display_name ?? null,
      isActive: profileMap.get(user.id)?.is_active ?? true,
      blockedReason: profileMap.get(user.id)?.blocked_reason ?? null,
      role: roleMap.get(user.id) ?? "user", expenseTotal: balances.get(user.id) ?? 0,
    }));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const growth = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(); day.setHours(23, 59, 59, 999); day.setDate(day.getDate() - (29 - index));
      return { date: day.toISOString().slice(5, 10), users: users.filter((u) => new Date(u.createdAt) <= day).length };
    });
    return {
      metrics: {
        totalUsers: users.length,
        activeToday: users.filter((u) => u.lastSignInAt && new Date(u.lastSignInAt) >= today).length,
        activeOffers: (offersRes.data ?? []).filter((o) => o.is_active).length,
        volume: Array.from(balances.values()).reduce((sum, value) => sum + value, 0),
      }, users, growth,
    };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => userActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    if (data.userId === context.userId && (data.role !== "admin" || !data.isActive)) throw new Error("Você não pode remover ou bloquear seu próprio acesso administrativo.");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("user_id", data.userId).maybeSingle();
    const access = { is_active: data.isActive, blocked_reason: data.isActive ? null : data.reason ?? "Bloqueado pela administração", blocked_at: data.isActive ? null : new Date().toISOString() };
    const profileResult = profile
      ? await supabaseAdmin.from("profiles").update(access).eq("user_id", data.userId)
      : await supabaseAdmin.from("profiles").insert({ user_id: data.userId, ...access });
    if (profileResult.error) throw profileResult.error;
    if (data.role === "admin") {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminUserHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => userIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const expenses = await supabaseAdmin.from("expenses").select("id,amount,description,category,expense_date,source").eq("user_id", data.userId).order("expense_date", { ascending: false }).limit(100);
    if (expenses.error) throw expenses.error;
    return { entries: (expenses.data ?? []).map((row) => ({ id: row.id, amount: Number(row.amount), description: row.description, category: row.category, date: row.expense_date, source: row.source })) };
  });

export const adminTestN8nWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: identity, error: identityError } = await context.supabase.auth.getUser();
    const email = identity.user?.email;
    if (identityError || !email) throw new Error("Não foi possível confirmar o e-mail do usuário.");

    const timestamp = new Date().toISOString();
    const result = await sendN8nWebhook({
      user_id: context.userId,
      email,
      event: "teste",
      timestamp,
    });
    if (!result.ok) {
      return {
        ok: false as const,
        error: result.error ?? "Não foi possível enviar o teste ao n8n.",
        status: result.status,
      };
    }
    return { ok: true as const, error: null, status: result.status };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const { data, error } = await supabaseAdmin.from("app_settings").select("*").eq("setting_key", "global").single();
    if (error) throw error; return { settings: data };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const { error } = await supabaseAdmin.from("app_settings").upsert({ setting_key: "global", maintenance_mode: data.maintenanceMode, registrations_enabled: data.registrationsEnabled, home_banner_text: data.homeBannerText, updated_by: context.userId }, { onConflict: "setting_key" });
    if (error) throw error; return { ok: true };
  });

export const adminGetAdSenseSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const { data, error } = await supabaseAdmin.from("adsense_settings").select("*").eq("setting_key", "shop").single();
    if (error) throw error;
    return { settings: data };
  });

export const adminSaveAdSenseSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => adsenseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const { error } = await supabaseAdmin.from("adsense_settings").upsert({
      setting_key: "shop",
      enabled: data.enabled,
      publisher_id: data.publisherId || null,
      ad_slot_id: data.adSlotId || null,
      ad_format: data.adFormat,
      position: data.position,
      max_width: data.maxWidth,
      margin_top: data.marginTop,
      margin_bottom: data.marginBottom,
      show_in_shop: data.showInShop,
      show_in_other_screens: data.showInOtherScreens,
      test_mode: data.testMode,
      updated_by: context.userId,
    }, { onConflict: "setting_key" });
    if (error) throw error;
    return { ok: true };
  });

export const adminListPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const [subsRes, authRes] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("id,user_id,plan,status,provider,provider_product_id,current_period_end,cancel_at_period_end,created_at,updated_at").order("updated_at", { ascending: false }).limit(1000),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (subsRes.error) throw subsRes.error;
    if (authRes.error) throw authRes.error;
    const emails = new Map((authRes.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
    return (subsRes.data ?? []).map((s) => ({
      id: s.id, email: emails.get(s.user_id) ?? null, plan: s.plan, status: s.status,
      provider: s.provider, productId: s.provider_product_id, periodEnd: s.current_period_end,
      cancelAtPeriodEnd: s.cancel_at_period_end, createdAt: s.created_at, updatedAt: s.updated_at,
    }));
  });
