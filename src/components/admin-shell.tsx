import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bell, ExternalLink, LayoutDashboard, Settings, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const items = [
  { hash: "overview", label: "Visão geral", icon: LayoutDashboard },
  { hash: "users", label: "Usuários", icon: Users },
  { hash: "offers", label: "Anúncios", icon: ShoppingBag },
  { hash: "notifications", label: "Notificações", icon: Bell },
  { hash: "settings", label: "Configurações", icon: Settings },
];

export function AdminShell({ active, onNavigate, children }: { active: string; onNavigate: (section: string) => void; children: ReactNode }) {
  useRouterState();
  return <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="hidden border-r bg-card/60 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-5"><span className="grid size-10 place-items-center rounded-lg bg-primary/15"><ShieldCheck className="size-5 text-primary" /></span><div><p className="font-display font-semibold">Falaí Admin</p><p className="text-xs text-muted-foreground">Central de controle</p></div></div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Navegação administrativa">{items.map(({ hash, label, icon: Icon }) => <button key={hash} type="button" onClick={() => onNavigate(hash)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors", active === hash ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" />{label}</button>)}</nav>
      <Link to="/app" className="m-3 flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" />Voltar ao aplicativo</Link>
    </aside>
    <div className="min-w-0"><header className="sticky top-0 z-30 border-b bg-background/90 px-4 py-3 backdrop-blur lg:px-8"><div className="mx-auto flex max-w-7xl items-center gap-3"><ShieldCheck className="size-5 text-primary" /><div><h1 className="font-display text-lg font-semibold">Painel administrativo</h1><p className="hidden text-xs text-muted-foreground sm:block">Gestão segura do Falaí Finanças</p></div><Link to="/app" className="ml-auto text-sm text-muted-foreground hover:text-primary lg:hidden">Sair</Link></div></header><main className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-8 lg:pb-10">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegação administrativa móvel">{items.map(({ hash, label, icon: Icon }) => <button key={hash} type="button" onClick={() => onNavigate(hash)} aria-current={active === hash ? "page" : undefined} className={cn("flex min-h-[62px] flex-col items-center justify-center gap-1 text-[10px]", active === hash ? "text-primary" : "text-muted-foreground")}><Icon className={cn("size-5", active === hash && "scale-110")} />{label}</button>)}</nav>
  </div>;
}

export function AdminSectionTitle({ icon: Icon = BarChart3, title, description }: { icon?: typeof BarChart3; title: string; description: string }) {
  return <div className="mb-5 flex items-start gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12"><Icon className="size-4 text-primary" /></span><div><h2 className="font-display text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}
