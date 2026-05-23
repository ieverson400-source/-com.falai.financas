import { createServerFn } from "@tanstack/react-start";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

export const sendWhatsAppMessage = createServerFn({
  method: "POST",
})
  .inputValidator((data: { toNumber: string; messageBody: string }) => {
    if (!data.toNumber || !data.messageBody) {
      throw new Error("Número e mensagem são obrigatórios");
    }
    return data;
  })
  .handler(async ({ data }) => {
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Configuração do Twilio não encontrada nos Secrets.");
    }

    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: data.messageBody,
      from: fromNumber,
      to: data.toNumber,
    });

    return { success: true, messageSid: message.sid };
  });
