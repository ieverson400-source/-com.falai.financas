import { useNavigate } from "@tanstack/react-router";
import {
  Home,
  Wallet,
  Calendar as CalendarIcon,
  ShoppingBag,
  BarChart3,
  User as UserIcon,
} from "lucide-react";

export type NavTabKey = "inicio" | "contas" | "agendas" | "shop" | "relatorios" | "perfil";

const tabs: { key: NavTabKey; label: string; icon: typeof Home }[] = [
  { key: "inicio", label: "Início", icon: Home },
  { key: "contas", label: "Contas", icon: Wallet },
  { key: "agendas", label: "Agendas", icon: CalendarIcon },
  { key: "shop", label: "Shop", icon: ShoppingBag },
  { key: "relatorios", label: "Relatórios", icon: BarChart3 },
  { key: "perfil", label: "Perfil", icon: UserIcon },
];

/**
 * Menu inferior compartilhado entre o painel e as telas internas
 * (Contas, Agendas e Shop), para que o rodapé fique sempre visível.
 * Em telas que não são o painel, as abas internas voltam para /app?tab=…
 */
export function BottomNav({
  current,
  onSelectLocal,
}: {
  current: NavTabKey;
  onSelectLocal?: (key: NavTabKey) => void;
}) {
  const navigate = useNavigate();

  const go = (key: NavTabKey) => {
    if (key === "shop") return void navigate({ to: "/app/shop" });
    if (key === "contas") return void navigate({ to: "/app/bancos" });
    if (key === "agendas") return void navigate({ to: "/app/agendas" });
    if (onSelectLocal) return onSelectLocal(key);
    void navigate({ to: "/app", search: { tab: key } });
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      aria-label="Navegação principal"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-6">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go(key)}
              aria-current={active ? "page" : undefined}
              className={`min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`size-5 ${active ? "scale-110" : ""} transition-transform`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
