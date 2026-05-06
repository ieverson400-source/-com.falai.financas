import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Olá! 👋 Sou seu Amigo Financeiro. Posso te ajudar a entender seus gastos, sugerir economias ou só bater um papo. Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Load history on first open
  useEffect(() => {
    if (!isOpen || historyLoaded) return;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      }
      setHistoryLoaded(true);
    })();
  }, [isOpen, historyLoaded]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: next.slice(-10) }),
      });

      if (resp.status === 429) {
        toast.error("Muitas mensagens. Tente novamente em alguns segundos.");
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Falha no chat");

      // Add empty assistant message and stream into it
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantSoFar = "";

      const flushDelta = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (copy[lastIdx]?.role === "assistant") {
            copy[lastIdx] = { ...copy[lastIdx], content: assistantSoFar };
          }
          return copy;
        });
      };

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) flushDelta(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Não consegui responder agora. Tente novamente.");
      setMessages((prev) => {
        // remove empty assistant placeholder if any
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fechar chat" : "Abrir chat"}
        className={cn(
          "fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-elevated transition-all flex items-center justify-center",
          "bg-gradient-hero text-primary-foreground hover:scale-105"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-44 right-4 z-50 w-[min(92vw,380px)] h-[60vh] max-h-[560px] rounded-2xl bg-card border border-border shadow-elevated flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-gradient-hero text-primary-foreground flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Amigo Financeiro</p>
              <p className="text-xs opacity-80">Assistente IA · seus gastos</p>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Fechar" className="opacity-80 hover:opacity-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card text-card-foreground border border-border rounded-bl-sm"
                  )}
                >
                  {m.content || (isLoading && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="p-2 border-t border-border bg-card flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre seus gastos…"
              disabled={isLoading}
              className="rounded-full"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-full">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
