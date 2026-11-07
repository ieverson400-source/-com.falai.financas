import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readFeatureFlags } from "../feature-flags.ts";
import { buildSystemPrompt, cleanReply, sanitizeMessages } from "./knowledge.ts";
import { createRateLimiter } from "./rate-limit.ts";

/**
 * Assistente de ajuda do app. Roda SOMENTE no servidor: a chave de IA nunca chega ao navegador.
 *
 * - Só ORIENTA sobre o uso do app: não lê gastos, saldos nem contas do usuário e não executa ações.
 * - Envia ao provedor apenas o histórico curto da conversa (até 10 mensagens) e o prompt de regras.
 * - Não grava mensagens no banco e não escreve o conteúdo das conversas em log.
 * - Limite de 20 perguntas por hora por usuário (melhor esforço, em memória).
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // mesmo modelo já usado em expense-ai.ts
const TIMEOUT_MS = 25_000;

const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

const inputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(60),
});

export type AssistantResult =
  | { status: "ok"; reply: string }
  | { status: "unavailable" | "rate_limited" | "error"; message: string };

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    if (!readFeatureFlags(process.env).assistant) {
      return { status: "unavailable", message: "O assistente está indisponível no momento." };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { status: "unavailable", message: "O assistente está indisponível no momento." };

    const messages = sanitizeMessages(data.messages);
    if (!messages) return { status: "error", message: "Não entendi a mensagem. Tente reescrever." };

    const rate = limiter.check(context.userId);
    if (!rate.allowed) {
      const minutes = Math.max(1, Math.ceil(rate.retryAfterMs / 60_000));
      return { status: "rate_limited", message: `Você fez muitas perguntas. Tente de novo em ${minutes} min.` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          max_tokens: 400,
          messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // 402/429 do provedor (créditos ou limite): mensagem neutra, sem detalhes internos.
        return { status: "unavailable", message: "O assistente está indisponível no momento. Tente mais tarde." };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const reply = cleanReply(json.choices?.[0]?.message?.content);
      if (!reply) return { status: "error", message: "Não consegui responder agora. Tente de novo." };
      return { status: "ok", reply };
    } catch {
      return { status: "error", message: "Não consegui responder agora. Tente de novo." };
    } finally {
      clearTimeout(timer);
    }
  });
