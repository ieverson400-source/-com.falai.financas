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
const templateSchema = z.object({
  id: z.string().uuid().nullable(), templateKey: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(80), messageType: z.string().trim().min(2).max(60),
  content: z.string().trim().min(2).max(4000), isActive: z.boolean(),
});
const settingsSchema = z.object({
  maintenanceMode: z.boolean(), registrationsEnabled: z.boolean(),
  automaticWhatsAppEnabled: z.boolean(), homeBannerText: z.string().trim().max(500).nullable(),
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
const logSchema = z.object({ id: z.string().uuid() });

async function authorizedAdmin(context: { supabase: Parameters<typeof assertAdmin>[0]; userId: string }) {
  await assertAdmin(context.supabase, context.userId);
  return import("@/integrations/supabase/client.server");
}

export const adminDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const [{ data: authUsers }, profilesRes, rolesRes, accountsRes, offersRes, logsRes, inboxRes, itemsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("user_id,display_name,whatsapp_phone,created_at,is_active,blocked_reason"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("pluggy_accounts").select("user_id,balance"),
      supabaseAdmin.from("shop_offers").select("id,is_active"),
      supabaseAdmin.from("notification_logs").select("id,status"),
      supabaseAdmin.from("whatsapp_inbox").select("id,processing_status"),
      supabaseAdmin.from("pluggy_items").select("id,status,last_synced_at"),
    ]);
    const usersRaw = authUsers?.users ?? [];
    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const balances = new Map<string, number>();
    for (const account of accountsRes.data ?? []) balances.set(account.user_id, (balances.get(account.user_id) ?? 0) + Number(account.balance ?? 0));
    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const roleMap = new Map<string, "user" | "admin">();
    for (const role of roles) if (role.role === "admin") roleMap.set(role.user_id, "admin");
    const users = usersRaw.map((user) => ({
      id: user.id, email: user.email ?? null, createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null, name: profileMap.get(user.id)?.display_name ?? null,
      phone: profileMap.get(user.id)?.whatsapp_phone ?? null,
      isActive: profileMap.get(user.id)?.is_active ?? true,
      blockedReason: profileMap.get(user.id)?.blocked_reason ?? null,
      role: roleMap.get(user.id) ?? "user", balance: balances.get(user.id) ?? 0,
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
        messages: (logsRes.data?.length ?? 0) + (inboxRes.data?.length ?? 0),
        volume: Array.from(balances.values()).reduce((sum, value) => sum + value, 0),
      }, users, growth,
      health: {
        openFinance: (itemsRes.data ?? []).filter((item) => item.status === "UPDATED").length,
        openFinanceTotal: itemsRes.data?.length ?? 0,
        notificationErrors: (logsRes.data ?? []).filter((log) => log.status === "error" || log.status === "failed").length,
      },
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
    const [expenses, transactions] = await Promise.all([
      supabaseAdmin.from("expenses").select("id,amount,description,category,expense_date,source").eq("user_id", data.userId).order("expense_date", { ascending: false }).limit(100),
      supabaseAdmin.from("pluggy_transactions").select("id,amount,description,category,transaction_date,type").eq("user_id", data.userId).order("transaction_date", { ascending: false }).limit(100),
    ]);
    return {
      entries: [
        ...(expenses.data ?? []).map((row) => ({ id: row.id, amount: Number(row.amount), description: row.description, category: row.category, date: row.expense_date, source: row.source })),
        ...(transactions.data ?? []).map((row) => ({ id: row.id, amount: Number(row.amount), description: row.description, category: row.category, date: row.transaction_date, source: row.type ?? "Open Finance" })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100),
    };
  });

export const adminNotificationData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const [logs, templates, profiles] = await Promise.all([
      supabaseAdmin.from("notification_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabaseAdmin.from("whatsapp_templates").select("*").order("name"),
      supabaseAdmin.from("profiles").select("user_id,display_name"),
    ]);
    const names = new Map((profiles.data ?? []).map((p) => [p.user_id, p.display_name]));
    return { logs: (logs.data ?? []).map((log) => ({ ...log, userName: log.user_id ? names.get(log.user_id) ?? null : null })), templates: templates.data ?? [] };
  });

export const adminSaveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => templateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const payload = { template_key: data.templateKey, name: data.name, message_type: data.messageType, content: data.content, is_active: data.isActive, updated_by: context.userId };
    const result = data.id ? await supabaseAdmin.from("whatsapp_templates").update(payload).eq("id", data.id) : await supabaseAdmin.from("whatsapp_templates").insert(payload);
    if (result.error) throw result.error;
    return { ok: true };
  });

export const adminRetryNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => logSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
    const { data: log, error } = await supabaseAdmin.from("notification_logs").select("*").eq("id", data.id).single();
    if (error || !log) throw error ?? new Error("Registro não encontrado.");
    if (!log.recipient || !log.message_content) throw new Error("Este registro não possui destino ou mensagem para reenvio.");
    if (log.provider === "n8n") {
      await supabaseAdmin.from("notification_logs").update({ status: "pending", error_message: null }).eq("id", data.id);
      return { queued: true };
    }
    const accountSid = process.env['TWILIO_ACCOUNT_SID']; const authToken = process.env['TWILIO_AUTH_TOKEN']; const from = process.env['TWILIO_WHATSAPP_FROM'];
    if (!accountSid || !authToken || !from) throw new Error("Envio Twilio não está configurado.");
    const params = new URLSearchParams({ To: log.recipient.startsWith("whatsapp:") ? log.recipient : `whatsapp:${log.recipient}`, From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`, Body: log.message_content });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const payload = await response.json() as { sid?: string; message?: string };
    await supabaseAdmin.from("notification_logs").update({ status: response.ok ? "success" : "error", sent_at: response.ok ? new Date().toISOString() : null, provider_message_id: payload.sid ?? null, error_message: response.ok ? null : payload.message ?? "Falha no reenvio" }).eq("id", data.id);
    if (!response.ok) throw new Error(payload.message ?? "Falha no reenvio.");
    return { queued: false };
  });

export const adminTestN8nWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await authorizedAdmin(context);
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
    const { error: logError } = await supabaseAdmin.from("notification_logs").insert({
      user_id: context.userId,
      notification_type: "teste",
      provider: "n8n",
      recipient: email,
      status: result.ok ? "success" : "error",
      message_content: "teste",
      error_message: result.error,
      sent_at: result.ok ? timestamp : null,
      metadata: { event: "teste", http_status: result.status },
    });
    if (logError) console.error("Failed to record n8n webhook attempt", logError.message);
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
    const { error } = await supabaseAdmin.from("app_settings").upsert({ setting_key: "global", maintenance_mode: data.maintenanceMode, registrations_enabled: data.registrationsEnabled, automatic_whatsapp_enabled: data.automaticWhatsAppEnabled, home_banner_text: data.homeBannerText, updated_by: context.userId }, { onConflict: "setting_key" });
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
