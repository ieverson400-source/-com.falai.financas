import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, Wallet, ArrowLeftRight, Link2, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
  head: () => ({
    meta: [
      { title: "Falaí — App financeiro" },
      { name: "description", content: "Acompanhe saldo, contas e transações no celular." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
});

const tabs = [
  { to: "/mobile", label: "Início", icon: Home, exact: true },
  { to: "/mobile/contas", label: "Contas", icon: Wallet, exact: false },
  { to: "/mobile/transacoes", label: "Transações", icon: ArrowLeftRight, exact: false },
  { to: "/mobile/conectar", label: "Conectar", icon: Link2, exact: false },
  { to: "/mobile/perfil", label: "Perfil", icon: User, exact: false },
] as const;

function MobileLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <Toaster richColors />
      <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto w-full max-w-md px-4 pt-5">
        <Outlet />
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto max-w-md grid grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact }}
                className="group flex flex-col items-center justify-center gap-1 h-16 min-h-[44px] text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
              >
                <Icon className="size-5 transition-transform group-data-[status=active]:scale-110" strokeWidth={2} />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
