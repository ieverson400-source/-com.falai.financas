import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { assertAdmin } from "@/lib/assert-admin";

const InputSchema = z.object({
  phone: z.string().min(8).max(30),
  name: z.string().trim().max(80).optional(),
});

// Sandbox number do Twilio. Quando o `From` é igual a este, ainda estamos no
// ambiente de testes do Twilio, onde o destinatário precisa enviar `join <palavra>`
// para o sandbox antes de receber qualquer mensagem.
const TWILIO_SANDBOX_NUMBER = "+14155238886";

export type SendWhatsAppResult = {
  sid: string | null;
  to: string;
  from: string;
  mode: "template" | "freeform";
  sandbox: boolean;
};

/**
 * Envia mensagem de boas-vindas via Twilio WhatsApp.
 *
 * Estratégia:
 * - Se `TWILIO_WELCOME_CONTENT_SID` estiver configurado (template HSM aprovado),
 *   usa ContentSid + ContentVariables — necessário para produção fora da janela 24h.
 * - Caso contrário, envia como texto livre (válido no sandbox e dentro da janela 24h).
 *
 * Erros conhecidos do Twilio são traduzidos para mensagens acionáveis,
 * incluindo o opt-in do sandbox (códigos 63015/63016/21408/21211).
 */
export const sendWhatsAppWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<SendWhatsAppResult> => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM;
    const contentSid = process.env.TWILIO_WELCOME_CONTENT_SID?.trim();
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

    if (!accountSid || !authToken) {
      throw new Error("Credenciais do Twilio não configuradas no servidor.");
    }
    if (!fromRaw && !messagingServiceSid) {
      throw new Error(
        "Configure TWILIO_WHATSAPP_FROM (ex: +14155238886) ou TWILIO_MESSAGING_SERVICE_SID.",
      );
    }

    const to = normalizeWhatsAppPhone(data.phone);
    if (!to) {
      throw new Error("Número inválido. Use formato internacional, ex: +5519996020358.");
    }

    // Normaliza o número de origem (caso esteja sem prefixo whatsapp:).
    const fromNormalized = fromRaw
      ? fromRaw.startsWith("whatsapp:")
        ? fromRaw
        : `whatsapp:${fromRaw.startsWith("+") ? fromRaw : `+${fromRaw.replace(/\D/g, "")}`}`
      : null;

    const fromDigits = fromNormalized?.replace(/^whatsapp:/, "") ?? "";
    const isSandbox = fromDigits === TWILIO_SANDBOX_NUMBER;

    const greetingName = data.name?.trim() || "cliente";

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.set("To", `whatsapp:${to}`);

    if (messagingServiceSid) {
      params.set("MessagingServiceSid", messagingServiceSid);
    } else if (fromNormalized) {
      params.set("From", fromNormalized);
    }

    const useTemplate = Boolean(contentSid) && !isSandbox;

    if (useTemplate) {
      // Template HSM aprovado. {{1}} = nome do cliente.
      params.set("ContentSid", contentSid!);
      params.set("ContentVariables", JSON.stringify({ "1": greetingName }));
    } else {
      // Sandbox ou janela 24h: texto livre.
      params.set(
        "Body",
        `Olá, ${greetingName}! Seja bem-vindo ao nosso serviço da Falai Finance. 💙`,
      );
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const payload = (await res.json()) as {
      sid?: string;
      message?: string;
      code?: number;
      more_info?: string;
    };

    if (!res.ok) {
      const code = payload?.code;
      const baseMessage = payload?.message ?? `HTTP ${res.status}`;

      // Erros relacionados a opt-in / janela 24h / template não aprovado.
      // Referências: https://www.twilio.com/docs/api/errors
      if (code === 63015 || code === 63016) {
        throw new Error(
          isSandbox
            ? `Destinatário ainda não fez opt-in no sandbox do Twilio. Peça que envie a mensagem "join <sua-palavra>" para ${TWILIO_SANDBOX_NUMBER} no WhatsApp e tente novamente. (Twilio ${code})`
            : `A janela de 24h com este destinatário expirou. Para reabrir o contato, é necessário enviar usando um template HSM aprovado (ContentSid). (Twilio ${code})`,
        );
      }
      if (code === 21408 || code === 21211) {
        throw new Error(
          `Número de destino inválido ou não permitido pelo Twilio (${code}): ${baseMessage}`,
        );
      }
      if (code === 63007) {
        throw new Error(
          `O número remetente do WhatsApp não está habilitado no Twilio (63007). Verifique TWILIO_WHATSAPP_FROM.`,
        );
      }
      if (code === 63018 || code === 63003) {
        throw new Error(
          `O template informado em TWILIO_WELCOME_CONTENT_SID não foi aprovado ou não existe (${code}). Crie um template UTILITY chamado "bem_vindo" com variável {{1}} no console do Twilio.`,
        );
      }

      throw new Error(`Falha ao enviar WhatsApp via Twilio (${code ?? res.status}): ${baseMessage}`);
    }

    return {
      sid: payload.sid ?? null,
      to,
      from: fromNormalized ?? messagingServiceSid ?? "",
      mode: useTemplate ? "template" : "freeform",
      sandbox: isSandbox,
    };
  });
