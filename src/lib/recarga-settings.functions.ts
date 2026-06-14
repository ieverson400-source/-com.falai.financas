import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSafeOutboundUrl } from "@/lib/safe-url";

const PROVIDERS = ["simulado", "generico_http", "api3"] as const;

const safeUrl = z
  .string()
  .url()
  .max(500)
  .refine((v) => {
    try {
      assertSafeOutboundUrl(v);
      return true;
    } catch {
      return false;
    }
  }, { message: "URL deve ser HTTPS pública (sem IPs internos/loopback)." });

const settingsSchema = z.object({
  provider: z.enum(PROVIDERS),
  api_url: safeUrl.nullable().optional(),
  api_key: z.string().min(1).max(500).nullable().optional(),
  real_mode: z.boolean(),
});

export const getRecargaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("recarga_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      settings:
        data ?? {
          provider: "simulado",
          api_url: null,
          api_key: null,
          real_mode: false,
          last_test_at: null,
          last_test_ok: null,
          last_test_message: null,
        },
    };
  });

export const saveRecargaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Não permitir ativar modo real sem teste de conexão OK
    if (data.real_mode && data.provider !== "simulado") {
      const { data: existing } = await supabase
        .from("recarga_settings")
        .select("last_test_ok, api_url, api_key")
        .eq("user_id", userId)
        .maybeSingle();
      const sameCreds =
        existing?.api_url === (data.api_url ?? null) &&
        existing?.api_key === (data.api_key ?? null);
      if (!sameCreds || !existing?.last_test_ok) {
        throw new Error(
          "Faça um teste de conexão bem-sucedido com essas credenciais antes de ativar o modo real.",
        );
      }
    }

    const payload = {
      user_id: userId,
      provider: data.provider,
      api_url: data.api_url ?? null,
      api_key: data.api_key ?? null,
      real_mode: data.real_mode,
    };

    const { error } = await supabase
      .from("recarga_settings")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const testSchema = z.object({
  provider: z.enum(PROVIDERS),
  api_url: z.string().url().max(500).nullable().optional(),
  api_key: z.string().min(1).max(500).nullable().optional(),
});

export const testRecargaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => testSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let ok = false;
    let message = "";
    let statusCode: number | null = null;

    if (data.provider === "simulado") {
      ok = true;
      message = "Modo simulado pronto para uso.";
    } else {
      if (!data.api_url || !data.api_key) {
        message = "URL e chave de API são obrigatórias.";
      } else {
        try {
          const res = await fetch(data.api_url, {
            method: "GET",
            headers: { Authorization: `Bearer ${data.api_key}` },
            signal: AbortSignal.timeout(10_000),
          });
          statusCode = res.status;
          ok = res.status < 500 && res.status !== 401 && res.status !== 403;
          message = ok
            ? `Conexão OK (HTTP ${res.status}).`
            : `Provedor respondeu HTTP ${res.status}.`;
        } catch (e) {
          ok = false;
          message =
            e instanceof Error
              ? `Falha ao conectar: ${e.message}`
              : "Falha desconhecida ao conectar.";
        }
      }
    }

    await supabase
      .from("recarga_settings")
      .upsert(
        {
          user_id: userId,
          provider: data.provider,
          api_url: data.api_url ?? null,
          api_key: data.api_key ?? null,
          last_test_at: new Date().toISOString(),
          last_test_ok: ok,
          last_test_message: message,
        },
        { onConflict: "user_id" },
      );

    return { ok, message, statusCode };
  });
