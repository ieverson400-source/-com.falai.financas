import { Link } from "@tanstack/react-router";
import { Landmark, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FeatureFlags } from "@/lib/feature-flags";

// Atalhos no início do app. Cada um só aparece se o recurso estiver ligado no servidor.
// As duas telas ainda são vitrines "Em breve": não fazem recarga nem conexão bancária de verdade.

export function HomeShortcuts({ flags }: { flags: Pick<FeatureFlags, "recharge" | "openFinance"> }) {
  if (!flags.recharge && !flags.openFinance) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {flags.recharge && (
        <Link to="/app/recarga" className="block">
          <Card className="press flex h-full items-center gap-3 p-4 shadow-soft transition-colors hover:bg-muted/40">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12">
              <Smartphone className="size-5 text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">Recarga de celular</span>
              <span className="block text-[11px] text-muted-foreground">Em breve</span>
            </span>
          </Card>
        </Link>
      )}
      {flags.openFinance && (
        <Link to="/app/open-finance" className="block">
          <Card className="press flex h-full items-center gap-3 p-4 shadow-soft transition-colors hover:bg-muted/40">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12">
              <Landmark className="size-5 text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">Conectar conta bancária</span>
              <span className="block text-[11px] text-muted-foreground">Em breve</span>
            </span>
          </Card>
        </Link>
      )}
    </div>
  );
}
