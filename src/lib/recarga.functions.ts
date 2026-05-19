import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // 2. Chama provedor (real ou simulado)
    const apiUrl = process.env.RECHARGE_API_URL;
    const apiKey = process.env.RECHARGE_API_KEY;

    let providerResponse: Record<string, unknown>;
    let success: boolean;
    let errorMsg: string | null = null;

    if (apiUrl && apiKey) {
      // TODO: ajustar payload/headers conforme contrato do provedor real
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            phone: data.telefone,
            carrier: data.operadora.toLowerCase(),
            amount: data.valor,
            reference: recarga.id,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        providerResponse = { httpStatus: res.status, body: json };
        success = res.ok;
        if (!success) errorMsg = `Provedor retornou status ${res.status}`;
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

    // 3. Atualiza status
    await supabase
      .from("recargas")
      .update({
        status: success ? "success" : "failed",
        provider_response: providerResponse,
        error_message: errorMsg,
      })
      .eq("id", recarga.id);

    return {
      ok: success,
      recargaId: recarga.id,
      message: success ? "Recarga concluída!" : errorMsg ?? "Falha na recarga",
      simulated: !apiUrl || !apiKey,
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
