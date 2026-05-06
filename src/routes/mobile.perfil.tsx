import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Mail, User } from "lucide-react";

export const Route = createFileRoute("/mobile/perfil")({
  component: PerfilTab,
});

function PerfilTab() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Sua conta e preferências.</p>
      </header>

      <Card className="p-5 shadow-soft flex items-center gap-3">
        <div className="size-12 rounded-full bg-gradient-hero text-primary-foreground flex items-center justify-center shrink-0">
          <User className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {user?.email?.split("@")[0] ?? "Usuário"}
          </p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <Mail className="size-3" /> {user?.email}
          </p>
        </div>
      </Card>

      <Card className="p-4 shadow-soft flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">Tema</p>
          <p className="text-xs text-muted-foreground">Alterne entre claro e escuro.</p>
        </div>
        <ThemeToggle />
      </Card>

      <Button
        variant="outline"
        className="w-full h-11 gap-2 text-destructive hover:text-destructive"
        onClick={signOut}
      >
        <LogOut className="size-4" /> Sair da conta
      </Button>
    </div>
  );
}
