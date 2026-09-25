export interface N8nWebhookPayload {
  user_id: string;
  email: string;
  event: string;
  timestamp: string;
}

export interface N8nWebhookResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

export async function sendN8nWebhook(payload: N8nWebhookPayload): Promise<N8nWebhookResult> {
  const webhookUrl = process.env['N8N_WEBHOOK_URL'];
  if (!webhookUrl) {
    return { ok: false, status: null, error: "Integração com n8n não configurada." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return { ok: false, status: null, error: "Endereço do n8n inválido." };
  }
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, status: null, error: "A integração com n8n exige uma conexão segura." };
  }

  try {
    const response = await fetch(parsedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.error(`n8n webhook failed with status ${response.status}`);
      return { ok: false, status: response.status, error: "O n8n recusou o envio. Verifique se o workflow de teste está escutando." };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    console.error("n8n webhook connection failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, status: null, error: "Não foi possível conectar ao n8n. Tente novamente." };
  }
}