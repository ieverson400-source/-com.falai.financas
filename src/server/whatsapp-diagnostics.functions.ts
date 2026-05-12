import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TWILIO_SANDBOX_NUMBER = "+14155238886";

export type WhatsAppDiagnostics = {
  hasAccountSid: boolean;
  hasAuthToken: boolean;
  hasFrom: boolean;
  fromNumber: string | null;
  isSandbox: boolean;
  hasContentSid: boolean;
  contentSidPreview: string | null;
  hasMessagingService: boolean;
  messagingServicePreview: string | null;
  // Validação contra a API do Twilio (quando credenciais existem).
  senderVerified: boolean;
  senderError: string | null;
  // Validação do template HSM (Content API).
  templateExists: boolean;
  templateApproved: boolean;
  templateName: string | null;
  templateStatus: string | null;
  templateError: string | null;
  // Sumário acionável.
  mode: "sandbox-freeform" | "production-template" | "production-freeform" | "incomplete";
  recommendations: string[];
};

function maskSid(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function normalizeFrom(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^whatsapp:/i, "").trim();
  return cleaned.startsWith("+")
    ? cleaned
    : `+${cleaned.replace(/\D/g, "")}`;
}

export const getWhatsAppDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WhatsAppDiagnostics> => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM;
    const contentSid = process.env.TWILIO_WELCOME_CONTENT_SID?.trim() || null;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null;

    const fromNumber = normalizeFrom(fromRaw);
    const isSandbox = fromNumber === TWILIO_SANDBOX_NUMBER;

    let senderVerified = false;
    let senderError: string | null = null;

    let templateExists = false;
    let templateApproved = false;
    let templateName: string | null = null;
    let templateStatus: string | null = null;
    let templateError: string | null = null;

    const auth =
      accountSid && authToken
        ? Buffer.from(`${accountSid}:${authToken}`).toString("base64")
        : null;

    // Valida o remetente.
    if (auth && (fromNumber || messagingServiceSid)) {
      try {
        if (messagingServiceSid) {
          const res = await fetch(
            `https://messaging.twilio.com/v1/Services/${messagingServiceSid}`,
            { headers: { Authorization: `Basic ${auth}` } },
          );
          if (res.ok) {
            senderVerified = true;
          } else {
            const body = (await res.json().catch(() => ({}))) as { message?: string };
            senderError = `Messaging Service inválido (${res.status}): ${body.message ?? "verifique o SID"}`;
          }
        } else if (fromNumber) {
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(fromNumber)}`,
            { headers: { Authorization: `Basic ${auth}` } },
          );
          if (res.ok) {
            const body = (await res.json()) as { incoming_phone_numbers?: unknown[] };
            if (isSandbox) {
              senderVerified = true;
            } else if ((body.incoming_phone_numbers ?? []).length > 0) {
              senderVerified = true;
            } else {
              senderError =
                "Número não encontrado na conta Twilio. Verifique se TWILIO_WHATSAPP_FROM corresponde a um número WhatsApp habilitado.";
            }
          } else {
            senderError = `Falha ao validar número remetente (${res.status}).`;
          }
        }
      } catch (err) {
        senderError = err instanceof Error ? err.message : "Falha ao consultar Twilio";
      }
    }

    // Valida o template HSM via Content API.
    if (auth && contentSid) {
      try {
        const res = await fetch(`https://content.twilio.com/v1/Content/${contentSid}`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (res.ok) {
          templateExists = true;
          const body = (await res.json()) as {
            friendly_name?: string;
            sid?: string;
          };
          templateName = body.friendly_name ?? null;

          // Consulta status de aprovação para WhatsApp.
          const aprRes = await fetch(
            `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests`,
            { headers: { Authorization: `Basic ${auth}` } },
          );
          if (aprRes.ok) {
            const aprBody = (await aprRes.json()) as {
              whatsapp?: { status?: string; rejection_reason?: string };
            };
            const status = aprBody.whatsapp?.status ?? null;
            templateStatus = status;
            if (status === "approved") {
              templateApproved = true;
            } else if (status) {
              templateError = `Template existe mas o status no WhatsApp é "${status}"${
                aprBody.whatsapp?.rejection_reason
                  ? ` — ${aprBody.whatsapp.rejection_reason}`
                  : ""
              }.`;
            } else {
              templateError =
                "Template existe mas ainda não foi submetido para aprovação no WhatsApp.";
            }
          } else {
            templateError = `Não foi possível consultar o status de aprovação (${aprRes.status}).`;
          }
        } else if (res.status === 404) {
          templateError = `ContentSid "${maskSid(contentSid)}" não existe nesta conta Twilio.`;
        } else {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          templateError = `Falha ao consultar template (${res.status}): ${body.message ?? "desconhecido"}`;
        }
      } catch (err) {
        templateError = err instanceof Error ? err.message : "Falha ao consultar Content API";
      }
    }

    const credentialsOk = Boolean(accountSid && authToken);
    const senderOk = Boolean(fromNumber || messagingServiceSid);

    let mode: WhatsAppDiagnostics["mode"] = "incomplete";
    if (credentialsOk && senderOk) {
      if (isSandbox) mode = "sandbox-freeform";
      else if (contentSid) mode = "production-template";
      else mode = "production-freeform";
    }

    const recommendations: string[] = [];
    if (!accountSid) recommendations.push("Adicione o secret TWILIO_ACCOUNT_SID.");
    if (!authToken) recommendations.push("Adicione o secret TWILIO_AUTH_TOKEN.");
    if (!fromNumber && !messagingServiceSid) {
      recommendations.push(
        "Configure TWILIO_WHATSAPP_FROM (número WhatsApp aprovado) ou TWILIO_MESSAGING_SERVICE_SID.",
      );
    }
    if (isSandbox) {
      recommendations.push(
        'Você está usando o sandbox (+14155238886). O destinatário precisa enviar "join <palavra>" antes de receber mensagens.',
      );
    }
    if (!isSandbox && !contentSid) {
      recommendations.push(
        "Sem ContentSid: fora da janela de 24h o envio falhará. Crie o template HSM 'bem_vindo' com {{1}} e salve em TWILIO_WELCOME_CONTENT_SID.",
      );
    }
    if (contentSid && !templateExists && templateError) {
      recommendations.push(templateError);
    }
    if (contentSid && templateExists && !templateApproved) {
      recommendations.push(
        templateError ??
          "Template ainda não está aprovado para WhatsApp — aguarde aprovação ou submeta novamente.",
      );
    }
    if (senderError) recommendations.push(senderError);

    return {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
      hasFrom: Boolean(fromNumber),
      fromNumber,
      isSandbox,
      hasContentSid: Boolean(contentSid),
      contentSidPreview: maskSid(contentSid),
      hasMessagingService: Boolean(messagingServiceSid),
      messagingServicePreview: maskSid(messagingServiceSid),
      senderVerified,
      senderError,
      templateExists,
      templateApproved,
      templateName,
      templateStatus,
      templateError,
      mode,
      recommendations,
    };
  });
