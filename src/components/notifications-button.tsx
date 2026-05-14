import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type NotificationItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  status: string;
};

export function NotificationsButton({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_inbox")
      .select("id, transcript, processing_status, error_message, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    setItems(
      (data ?? []).map((d) => ({
        id: d.id,
        title:
          d.processing_status === "error"
            ? "Falha ao processar mensagem"
            : d.processing_status === "processed"
              ? "Mensagem processada"
              : "Nova mensagem recebida",
        description: d.error_message || d.transcript,
        created_at: d.created_at,
        status: d.processing_status,
      })),
    );
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_inbox", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unread = items.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative inline-flex items-center justify-center size-9 rounded-full hover:bg-muted/40 transition-colors"
        >
          <Bell className="size-5 text-foreground" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-display font-semibold text-sm">Notificações</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Atualizações recentes da sua conta
          </p>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhuma notificação por enquanto.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 size-2 rounded-full shrink-0 ${
                      it.status === "error"
                        ? "bg-destructive"
                        : it.status === "processed"
                          ? "bg-emerald-500"
                          : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{it.title}</p>
                    {it.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {it.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(parseISO(it.created_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
