const CATEGORIES = [
  "Conta de luz",
  "Internet",
  "Água",
  "Aluguel",
  "Supermercado",
  "Restaurante",
  "Transporte",
  "Combustível",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Outros",
] as const;

const SYSTEM_PROMPT = `Você é um extrator de dados de notas fiscais e cupons brasileiros.
Analise a imagem e extraia: valor total (número decimal em reais), data da compra (YYYY-MM-DD; se ilegível use "today"),
nome do estabelecimento e uma categoria adequada.

Categorias permitidas: ${CATEGORIES.join(", ")}. Use "Outros" se nenhuma servir.

Sempre chame a função register_receipt exatamente uma vez. Se a imagem não for legível, retorne valor 0 e store vazio.`;

export interface ExtractedReceipt {
  amount: number;
  expense_date: string;
  store: string | null;
  category: string;
  items?: string | null;
}

export async function extractReceiptFromImage({
  imageBase64,
  mimeType,
  today,
}: {
  imageBase64: string;
  mimeType: string;
  today: string;
}): Promise<ExtractedReceipt> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Hoje é ${today}. Extraia os dados desta nota fiscal.` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "register_receipt",
            description: "Registra um gasto extraído da nota fiscal",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Valor total em reais" },
                expense_date: { type: "string", description: "Data YYYY-MM-DD ou 'today'" },
                store: { type: "string", description: "Nome do estabelecimento" },
                category: { type: "string", enum: CATEGORIES },
                items: { type: "string", description: "Lista curta de itens (opcional)" },
              },
              required: ["amount", "expense_date", "category"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "register_receipt" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de uso atingido. Tente novamente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos esgotados. Adicione créditos em Settings → Workspace → Usage.");
    throw new Error(`Erro IA [${res.status}]: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("Não consegui ler esta nota. Tente uma foto mais nítida.");

  const args = JSON.parse(toolCall.function.arguments);
  return {
    amount: Number(args.amount) || 0,
    expense_date: args.expense_date === "today" || !args.expense_date ? today : args.expense_date,
    store: args.store ?? null,
    category: String(args.category || "Outros"),
    items: args.items ?? null,
  };
}
