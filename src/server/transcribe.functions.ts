import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  audioBase64: z.string().min(10).max(15_000_000),
  mimeType: z.string().min(3).max(100),
});

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
];

const SYSTEM_PROMPT = `Você é um assistente de finanças pessoais. O usuário envia áudios em português brasileiro descrevendo gastos.

Sua tarefa:
1. Transcrever o áudio fielmente.
2. Extrair: valor (número, em reais), categoria, descrição curta e data (formato YYYY-MM-DD; se não mencionada, use "today").

Categorias permitidas: ${CATEGORIES.join(", ")}.
Escolha a mais adequada. Use "Outros" se nenhuma servir.

Sempre chame a função register_expense exatamente uma vez.`;

export const transcribeExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const today = new Date().toISOString().slice(0, 10);

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
              {
                type: "text",
                text: `Hoje é ${today}. Transcreva o áudio e registre o gasto.`,
              },
              {
                type: "input_audio",
                input_audio: {
                  data: data.audioBase64,
                  format: data.mimeType.includes("wav")
                    ? "wav"
                    : data.mimeType.includes("mp3") || data.mimeType.includes("mpeg")
                      ? "mp3"
                      : "webm",
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "register_expense",
              description: "Registra um gasto extraído do áudio",
              parameters: {
                type: "object",
                properties: {
                  transcript: { type: "string", description: "Transcrição literal do áudio" },
                  amount: { type: "number", description: "Valor do gasto em reais" },
                  category: { type: "string", enum: CATEGORIES },
                  description: { type: "string", description: "Descrição curta do gasto" },
                  expense_date: {
                    type: "string",
                    description: "Data no formato YYYY-MM-DD",
                  },
                },
                required: ["transcript", "amount", "category", "expense_date"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "register_expense" } },
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
    if (!toolCall) throw new Error("A IA não conseguiu extrair os dados. Tente um áudio mais claro.");

    const args = JSON.parse(toolCall.function.arguments);
    const expenseDate = args.expense_date === "today" ? today : args.expense_date;

    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert({
        user_id: userId,
        amount: Number(args.amount),
        category: String(args.category),
        description: args.description ?? null,
        expense_date: expenseDate,
        source: "audio",
        raw_transcript: args.transcript,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { expense: inserted, transcript: args.transcript };
  });
