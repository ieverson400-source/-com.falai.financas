import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bot, Loader2, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import { askAssistant } from "@/lib/assistant/ask-assistant.functions";
import { ASSISTANT_NAME, MAX_MESSAGE_CHARS, SUGGESTED_QUESTIONS, type ChatMessage } from "@/lib/assistant/knowledge";

// Assistente de ajuda flutuante. Só orienta sobre o uso do app: não vê os dados do usuário e não executa
// ações. A conversa fica apenas na memória desta tela (some ao recarregar; nada é salvo no banco).
// A chave de IA fica no servidor; este componente só chama a função de servidor.

export function AssistantWidget() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Falha fechada: se a consulta da flag falhar, o assistente não aparece.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getFeatureFlags()
      .then((f) => alive && setEnabled(f.assistant))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Só dentro do app, para usuário logado, e fora do painel administrativo.
  const visible = Boolean(user) && enabled && pathname.startsWith("/app") && !pathname.startsWith("/app/admin");
  if (!visible) return null;

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setNotice(null);
    setSending(true);
    try {
      const r = await askAssistant({ data: { messages: next } });
      if (r.status === "ok") setMessages([...next, { role: "assistant", content: r.reply }]);
      else setNotice(r.message);
    } catch {
      setNotice("Não consegui responder agora. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <>
      {!open && (
        <Button
          type="button"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label={`Abrir ${ASSISTANT_NAME}`}
          className="fixed right-4 bottom-[8.25rem] z-40 size-12 rounded-full shadow-lg md:bottom-16"
        >
          <Bot className="size-6" />
        </Button>
      )}

      {open && (
        <Card
          role="dialog"
          aria-label={ASSISTANT_NAME}
          className="fixed inset-x-3 bottom-24 z-50 flex max-h-[70vh] flex-col overflow-hidden shadow-xl sm:left-auto sm:right-4 sm:w-96"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <Bot className="size-5 text-primary" aria-hidden="true" />
            <p className="flex-1 font-display text-sm font-semibold">{ASSISTANT_NAME}</p>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" aria-label="Limpar conversa" onClick={() => { setMessages([]); setNotice(null); }}>
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Fechar assistente" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground">Oi! Posso te ajudar a usar o Falaí. Pergunte o que quiser sobre o app.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void send(q)}
                      className="rounded-full border px-3 py-1.5 text-left text-xs hover:bg-muted"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {sending && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Digitando…
              </p>
            )}
            {notice && <p className="text-xs text-destructive">{notice}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t px-3 py-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
              placeholder="Digite sua dúvida"
              aria-label="Sua pergunta"
              autoComplete="off"
              disabled={sending}
            />
            <Button type="submit" size="icon" aria-label="Enviar" disabled={sending || !draft.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
          <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground">
            Respostas geradas por IA podem conter erros e não substituem orientação financeira profissional. Não envie senhas nem dados de cartão.
          </p>
        </Card>
      )}
    </>
  );
}
