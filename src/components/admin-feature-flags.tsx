import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { adminGetFeatureFlags } from "@/lib/admin-feature-flags.functions";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Data = Awaited<ReturnType<typeof adminGetFeatureFlags>>;

const ROWS: { key: FeatureFlagKey; title: string; description: string }[] = [
  { key: "subscriptions", title: "Assinaturas", description: "Vitrine de planos e atalho no perfil, ligada por padrão. Sem cobrança real nesta fase. SUBS_ENABLED=false desliga." },
  { key: "openFinance", title: "Open Finance", description: "Vitrine de conexão bancária e atalho no perfil, ligada por padrão. Sem integração real nesta fase. OF_ENABLED=false desliga." },
  { key: "assistant", title: "Assistente de ajuda (IA)", description: "Botão flutuante que orienta sobre o uso do app. Não vê os dados do usuário nem executa ações. ASSISTANT_ENABLED=false desliga." },
  { key: "recharge", title: "Recarga de celular", description: "Tela e atalho no perfil, ligados por padrão. A recarga ainda mostra \"Em breve\". RECHARGE_ENABLED=false desliga." },
];

/** Mostra o estado dos recursos em liberação. Somente leitura: o valor vem do servidor. */
export function AdminFeatureFlags() {
  const load = useServerFn(adminGetFeatureFlags);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await load());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mt-6 max-w-2xl space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="flex-1 font-display text-base font-semibold">Recursos em liberação</h3>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Atualizar
        </Button>
      </div>
      <Card className="divide-y">
        {failed && <p className="p-5 text-sm text-destructive">Não foi possível carregar o estado agora.</p>}
        {!failed &&
          ROWS.map(({ key, title, description }) => {
            const on = data?.flags[key] ?? false;
            return (
              <div className="flex items-center gap-4 p-5" key={key}>
                <div className="flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  {data && <p className="mt-1 text-xs text-muted-foreground">Variável do servidor: {data.envNames[key]}</p>}
                </div>
                <Badge variant={on ? "default" : "secondary"}>{on ? "Ligado" : "Desligado"}</Badge>
                <Switch checked={on} disabled aria-label={`${title}: definido no servidor`} />
              </div>
            );
          })}
      </Card>
      <p className="text-xs text-muted-foreground">
        Estes valores são definidos no servidor (variáveis de ambiente). A alteração por este painel ainda não está habilitada.
      </p>
    </section>
  );
}
