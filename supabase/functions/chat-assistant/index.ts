// Lovable AI streaming chat assistant for personal finance
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Msg { role: "user" | "assistant"; content: string }

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

    // Build expense context
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: expenses } = await supabase
      .from("expenses")
      .select("amount, category, description, expense_date")
      .gte("expense_date", since.toISOString().slice(0, 10))
      .order("expense_date", { ascending: false })
      .limit(50);

    const total = (expenses ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    for (const e of expenses ?? []) {
      const c = (e as any).category ?? "outros";
      byCat[c] = (byCat[c] ?? 0) + Number((e as any).amount);
    }
    const catSummary = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `${c}: R$ ${v.toFixed(2)}`)
      .join(", ") || "nenhum gasto registrado";

    const recent = (expenses ?? []).slice(0, 8)
      .map((e: any) => `- ${e.expense_date}: R$ ${Number(e.amount).toFixed(2)} (${e.category})${e.description ? " — " + e.description : ""}`)
      .join("\n") || "(sem transações recentes)";

    const systemPrompt = `Você é o "Amigo Financeiro" do app Falaí Finanças. Tom amigável, positivo, breve e útil. Use emojis com moderação. Responda em português brasileiro.

Contexto financeiro do usuário (últimos 30 dias):
- Total gasto: R$ ${total.toFixed(2)}
- Por categoria: ${catSummary}
- Transações recentes:
${recent}

Use esses dados para dar conselhos personalizados quando fizer sentido. Se o usuário só quiser bater papo, seja acolhedor.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tee the stream: forward to client and collect for persistence
    const [forward, persist] = response.body!.tee();

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
          await supabase.from("chat_messages").insert({
            user_id: userId, role: "assistant", content: assistantText,
          });
        }
      } catch (e) {
        console.error("persist error:", e);
      }
    })();

    return new Response(forward, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
