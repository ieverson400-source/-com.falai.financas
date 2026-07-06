import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Redireciona o usuário para /app/onboarding-whatsapp
 * se ainda não vinculou um número. Deve ser usado em todas as
 * rotas dentro de /app exceto a própria rota de onboarding.
 */
export function useOnboardingGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancel = false;
    supabase
      .from("profiles")
      .select("whatsapp_phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        if (!data?.whatsapp_phone) {
          navigate({ to: "/app/onboarding-whatsapp" });
        } else {
          setChecked(true);
        }
      });
    return () => {
      cancel = true;
    };
  }, [user, loading, navigate]);

  return { ready: checked && !!user, loading: loading || !checked };
}
