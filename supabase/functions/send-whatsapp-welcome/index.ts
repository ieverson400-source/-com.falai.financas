import { serve }  from  'https://deno.land/std@0.168.0/http/server.ts';
// Importa a biblioteca Twilio
import twilio from 'npm:twilio@3.75.0';

serve(async (req) => {
  try {
    // 1. Busca as chaves salvas nos "Secrets" da aba Cloud
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Configuração do Twilio não encontrada nos Secrets.');
    }

    // 2. Obtém os dados enviados pelo seu app
    const { toNumber, messageBody } = await req.json();

    // 3. Inicializa o cliente da Twilio
    const client = twilio(accountSid, authToken);

    // 4. Envia a mensagem de fato
    const message = await client.messages.create({
      body: messageBody,
      from: fromNumber,
      to: toNumber,
    });

    // 5. Retorna sucesso
    return new Response(
      JSON.stringify({ success: true, messageSid: message.sid }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
