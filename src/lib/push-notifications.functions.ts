import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";

const tokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(["web", "android", "ios"]).default("web"),
});

const pushSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(180),
  link: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((value) => !value || value.startsWith("/") || value.startsWith("https://"), {
      message: "Use uma rota interna ou um endereço HTTPS.",
    }),
});

export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error("Não foi possível registrar este dispositivo.");
    return { ok: true };
  });

export const getPushAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("push_tokens").select("user_id");
    if (error) throw new Error("Não foi possível contar os destinatários.");
    return {
      users: new Set((data ?? []).map((row) => row.user_id)).size,
      devices: data?.length ?? 0,
    };
  });

type FcmFailure = { error?: { status?: string; message?: string; details?: Array<{ errorCode?: string }> } };

export const sendPushToAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => pushSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from("push_tokens")
      .select("id,token,user_id");
    if (tokenError) throw new Error("Não foi possível carregar os dispositivos.");

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
    if (!lovableKey || !connectionKey) throw new Error("O envio push ainda não está configurado.");

    let sent = 0;
    let failed = 0;
    const invalidIds: string[] = [];
    const rows = tokens ?? [];

    for (let index = 0; index < rows.length; index += 50) {
      const batch = rows.slice(index, index + 50);
      const results = await Promise.all(
        batch.map(async (row) => {
          try {
            const response = await fetch(
              "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${lovableKey}`,
                  "X-Connection-Api-Key": connectionKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: {
                    token: row.token,
                    notification: { title: data.title, body: data.body },
                    data: { link: data.link || "/app" },
                    webpush: { fcm_options: { link: data.link || "/app" } },
                  },
                }),
              },
            );
            if (response.ok) return { ok: true, id: row.id };
            const payload = (await response.json().catch(() => ({}))) as FcmFailure;
            const code = payload.error?.details?.[0]?.errorCode ?? payload.error?.status;
            return { ok: false, id: row.id, invalid: code === "UNREGISTERED" || code === "INVALID_ARGUMENT" };
          } catch {
            return { ok: false, id: row.id, invalid: false };
          }
        }),
      );
      for (const result of results) {
        if (result.ok) sent += 1;
        else {
          failed += 1;
          if (result.invalid) invalidIds.push(result.id);
        }
      }
    }

    if (invalidIds.length) await supabaseAdmin.from("push_tokens").delete().in("id", invalidIds);
    const now = new Date().toISOString();
    const { error: logError } = await supabaseAdmin.from("notification_logs").insert({
      notification_type: "push_broadcast",
      provider: "firebase",
      recipient: "all",
      status: failed === 0 ? "success" : sent > 0 ? "partial" : "error",
      title: data.title,
      body: data.body,
      message_content: data.body,
      sent_by: context.userId,
      total_sent: sent,
      total_failed: failed,
      sent_at: sent > 0 ? now : null,
      error_message: failed > 0 ? `${failed} dispositivo(s) não receberam.` : null,
      metadata: { link: data.link || "/app", target_users: new Set(rows.map((row) => row.user_id)).size },
    });
    if (logError) console.error("Failed to save push notification log", logError.message);
    return { sent, failed, users: new Set(rows.map((row) => row.user_id)).size };
  });