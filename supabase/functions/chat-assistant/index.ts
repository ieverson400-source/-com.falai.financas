// Lovable AI streaming chat assistant for personal finance
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Msg { role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string; tool_calls?: any[] }

const CATEGORIES = [
  "Conta de luz","Internet","Água","Aluguel","Supermercado","Restaurante",
  "Transporte","Combustível","Saúde","Educação","Lazer","Assinaturas","Outros",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const { messages } = (await req.json()) as { messages: Msg[] };
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user") {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist user message
    await supabase.from("chat_messages").insert({
      user_id: userId, role: "user", content: userMessage.content,
    });

    // Build expense context (last 30 days + current month)
    const now = new Date();
    const since30 = new Date(); since30.setDate(since30.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: expenses } = await supabase
      .from("expenses")
      .select("amount, category, description, expense_date")
      .gte("expense_date", since30.toISOString().slice(0, 10))
      .order("expense_date", { ascending: false })
      .limit(200);

    const all = expenses ?? [];
    const monthExp = all.filter((e: any) => new Date(e.expense_date) >= monthStart);
    const total30 = all.reduce((s, e: any) => s + Number(e.amount), 0);
    const totalMonth = monthExp.reduce((s, e: any) => s + Number(e.amount), 0);

    const byCat = (arr: any[]) => {
      const m: Record<string, number> = {};
      for (const e of arr) m[e.category ?? "Outros"] = (m[e.category ?? "Outros"] ?? 0) + Number(e.amount);
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    const catMonthList = byCat(monthExp);
    const catSummary = catMonthList.map(([c, v]) => `${c}: R$ ${v.toFixed(2)}`).join(", ") || "nenhum gasto no mês";
    const topCat = catMonthList[0];

    const recent = all.slice(0, 8)
      .map((e: any) => `- ${e.expense_date}: R$ ${Number(e.amount).toFixed(2)} (${e.category})${e.description ? " — " + e.description : ""}`)
      .join("\n") || "(sem transações recentes)";

    const todayISO = now.toISOString().slice(0, 10);

    const systemPrompt = `Você é o "Amigo Financeiro" do app Falaí Finanças. Tom amigável, positivo, breve e útil. Use emojis com moderação. Responda em português brasileiro com formatação markdown (use **negrito**, listas e títulos curtos quando ajudar).

Hoje é ${todayISO}.

CONTEXTO FINANCEIRO DO USUÁRIO:
- Total no mês atual: R$ ${totalMonth.toFixed(2)} (${monthExp.length} lançamentos)
- Total nos últimos 30 dias: R$ ${total30.toFixed(2)}
- Gastos por categoria no mês: ${catSummary}
- Maior categoria do mês: ${topCat ? `${topCat[0]} (R$ ${topCat[1].toFixed(2)})` : "—"}
- Transações recentes:
${recent}

CAPACIDADES:
1. **Registrar gastos**: quando o usuário disser algo como "gastei 30 no almoço" ou "anota 50 reais de uber hoje", chame a função register_expense para criar a despesa. Categorias permitidas: ${CATEGORIES.join(", ")}.
2. **Análise & insights**: identifique categorias acima do normal, padrões de gasto e sugira economias concretas (com valor estimado em reais).
3. **Resumo mensal/semanal**: quando pedido, gere um resumo estruturado (total, top 3 categorias, comparações, 1-2 dicas).
4. **Sugestões para metas**: se o usuário falar de uma meta (viagem, carro, moto, celular), sugira um valor mensal viável com base nos gastos atuais.

Seja direto, sem repetir os números brutos sem agregar valor. Quando registrar um gasto via tool, confirme em uma frase curta.`;

    const tools = [{
      type: "function",
      function: {
        name: "register_expense",
        description: "Registra um gasto novo do usuário a partir da conversa.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Valor em reais" },
            category: { type: "string", enum: CATEGORIES },
            description: { type: "string", description: "Descrição curta (opcional)" },
            expense_date: { type: "string", description: "Data YYYY-MM-DD; use a data de hoje se não mencionado" },
          },
          required: ["amount", "category", "expense_date"],
          additionalProperties: false,
        },
      },
    }];

    // First call: non-streaming to detect tool calls
    const initial = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    });

    if (!initial.ok) {
      if (initial.status === 429) return new Response(JSON.stringify({ error: "Muitas requisições, tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (initial.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await initial.text();
      console.error("AI gateway error:", initial.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const initialJson = await initial.json();
    const choice = initialJson.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls;

    let finalMessages = [{ role: "system", content: systemPrompt }, ...messages] as any[];

    if (toolCalls && toolCalls.length > 0) {
      finalMessages.push(choice);
      for (const tc of toolCalls) {
        let result: any;
        try {
          if (tc.function?.name === "register_expense") {
            const args = JSON.parse(tc.function.arguments || "{}");
            const dateStr = args.expense_date && args.expense_date !== "today" ? args.expense_date : todayISO;
            const { data: ins, error: insErr } = await supabase.from("expenses").insert({
              user_id: userId,
              amount: Number(args.amount),
              category: String(args.category),
              description: args.description ?? null,
              expense_date: dateStr,
              source: "chat",
            }).select().single();
            if (insErr) throw new Error(insErr.message);
            result = { ok: true, expense: { id: ins.id, amount: ins.amount, category: ins.category, date: ins.expense_date } };
          } else {
            result = { error: "Tool desconhecida" };
          }
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "Erro" };
        }
        finalMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    } else if (choice?.content) {
      // No tool call — return content as a streaming-style response directly
      await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: choice.content });
      const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: choice.content } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sse, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Streamed follow-up (after tool execution, or first call had no content but had tool calls)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", stream: true, messages: finalMessages }),
    });

    if (!response.ok || !response.body) {
      const t = await response.text();
      console.error("AI follow-up error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [forward, persist] = response.body.tee();

    (async () => {
      try {
        const reader = persist.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) assistantText += c;
            } catch { /* partial */ }
          }
        }
        if (assistantText.trim()) {
          await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: assistantText });
        }
      } catch (e) { console.error("persist error:", e); }
    })();

    return new Response(forward, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
