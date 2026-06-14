import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSafeOutboundUrl } from "@/lib/safe-url";

const OPERADORAS = ["Claro", "Vivo", "Tim", "Oi"] as const;
const VALORES = [10, 15, 20, 30] as const;

const schema = z.object({
  telefone: z
    .string()
    .regex(/^\d{10,11}$/, "Telefone deve ter DDD + número (10 ou 11 dígitos)"),
  operadora: z.enum(OPERADORAS),
  valor: z.number().refine((v) => (VALORES as readonly number[]).includes(v), {
    message: "Valor inválido",
  }),
});

export const fazerRecarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Cria registro pending
    const { data: recarga, error: insertErr } = await supabase
      .from("recargas")
      .insert({
        user_id: userId,
        telefone: data.telefone,
        operadora: data.operadora,
        valor: data.valor,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr || !recarga) {
      throw new Error(insertErr?.message ?? "Falha ao criar recarga");
    }

    // 2. Carrega configurações do usuário
    const { data: settings } = await supabase
      .from("recarga_settings")
      .select("provider, api_url, api_key, real_mode")
      .eq("user_id", userId)
      .maybeSingle();

    const useReal =
      settings?.real_mode &&
      settings.provider !== "simulado" &&
      settings.api_url &&
      settings.api_key;

    let providerResponse: Record<string, unknown>;
    let success: boolean;
    let errorMsg: string | null = null;

    if (useReal) {
      const apiUrl = settings!.api_url as string;
      const apiKey = settings!.api_key as string;
      const provider = settings!.provider as string;

      try {
        // SSRF guard: validate the stored URL even though settings save also validates,
        // in case a row predates the validator.
        assertSafeOutboundUrl(apiUrl);
        let url: string;
        let headers: Record<string, string>;
        let body: string;

        if (provider === "api3") {
          // API3 (api3.com.br) — contrato REST padrão
          // Docs: https://api3.com.br/documentacao
          // POST {base}/recarga  (ou /v1/recharge conforme conta)
          // Header: Authorization: Bearer <api_key>
          // Body: { numero, operadora, valor, id_externo }
          const base = apiUrl.replace(/\/$/, "");
          url = base.endsWith("/recarga") ? base : `${base}/recarga`;
          headers = {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          };
          body = JSON.stringify({
            numero: data.telefone,
            operadora: data.operadora.toUpperCase(),
            valor: data.valor,
            id_externo: recarga.id,
          });
        } else {
          // generico_http — contrato neutro
          url = apiUrl;
          headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          };
          body = JSON.stringify({
            phone: data.telefone,
            carrier: data.operadora.toLowerCase(),
            amount: data.valor,
            reference: recarga.id,
          });
        }

        const res = await fetch(url, { method: "POST", headers, body });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        providerResponse = { provider, httpStatus: res.status, body: json };

        // API3 retorna { status: "sucesso" | "erro", mensagem, transacao_id }
        if (provider === "api3") {
          const status = String(json.status ?? "").toLowerCase();
          success = res.ok && (status === "sucesso" || status === "success" || status === "ok");
          if (!success) {
            errorMsg =
              (typeof json.mensagem === "string" && json.mensagem) ||
              (typeof json.message === "string" && json.message) ||
              `API3 retornou HTTP ${res.status}`;
          }
        } else {
          success = res.ok;
          if (!success) errorMsg = `Provedor retornou status ${res.status}`;
        }
      } catch (e) {
        providerResponse = { error: String(e) };
        success = false;
        errorMsg = "Falha de comunicação com o provedor";
      }
    } else {
      // Modo simulado — 85% de sucesso
      await new Promise((r) => setTimeout(r, 800));
      success = Math.random() > 0.15;
      providerResponse = {
        simulated: true,
        transactionId: crypto.randomUUID(),
      };
      if (!success) errorMsg = "Recarga rejeitada pela operadora (simulado)";
    }

    // 3. Atualiza status (via service_role — clientes não têm UPDATE em recargas)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("recargas")
      .update({
        status: success ? "success" : "failed",
        provider_response: providerResponse as never,
        error_message: errorMsg,
      })
      .eq("id", recarga.id);


    return {
      ok: success,
      recargaId: recarga.id,
      message: success ? "Recarga concluída!" : errorMsg ?? "Falha na recarga",
      simulated: !useReal,
    };
  });

export const listarRecargas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("recargas")
      .select("id, telefone, operadora, valor, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { recargas: data ?? [] };
  });
