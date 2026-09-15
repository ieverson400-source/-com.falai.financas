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
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70"
      aria-label="Navegação principal"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-6 px-1 pt-1.5">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go(key)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`press relative min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10.5px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                  active ? "bg-primary/12" : "bg-transparent"
                }`}
              >
                <Icon className={`size-[19px] transition-transform ${active ? "scale-110" : ""}`} />
              </span>
              <span className="truncate max-w-full leading-none">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

