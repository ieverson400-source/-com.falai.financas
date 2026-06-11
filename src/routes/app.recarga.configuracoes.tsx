import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  PlugZap,
} from "lucide-react";
import {
  getRecargaSettings,
  saveRecargaSettings,
  testRecargaConnection,
} from "@/lib/recarga-settings.functions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/recarga/configuracoes")({
  component: RecargaSettingsPage,
  head: () => ({
    meta: [
      { title: "Configurações de recarga — Falaí Finanças" },
      {
        name: "description",
        content:
          "Escolha o provedor de recarga, configure suas credenciais e teste a conexão antes de recarregar celulares pelo Falaí Finanças.",
      },
      { property: "og:title", content: "Configurações de recarga — Falaí Finanças" },
      { property: "og:description", content: "Configure provedor, credenciais e teste a conexão do serviço de recarga no Falaí Finanças." },
    ],
  }),
});

const PROVIDERS = [
  { id: "simulado", label: "Simulado (testes)" },
  { id: "api3", label: "API3 (Brasil)" },
  { id: "generico_http", label: "HTTP genérico" },
] as const;

type Provider = (typeof PROVIDERS)[number]["id"];

function RecargaSettingsPage() {
  const [provider, setProvider] = useState<Provider>("simulado");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [realMode, setRealMode] = useState(false);
  const [lastTest, setLastTest] = useState<{
    at: string | null;
    ok: boolean | null;
    message: string | null;
  }>({ at: null, ok: null, message: null });

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const callGet = useServerFn(getRecargaSettings);
  const callSave = useServerFn(saveRecargaSettings);
  const callTest = useServerFn(testRecargaConnection);

  useEffect(() => {
    callGet()
      .then(({ settings }) => {
        setProvider((settings.provider as Provider) ?? "simulado");
        setApiUrl(settings.api_url ?? "");
        setApiKey(settings.api_key ?? "");
        setRealMode(Boolean(settings.real_mode));
        setLastTest({
          at: settings.last_test_at ?? null,
          ok: settings.last_test_ok ?? null,
          message: settings.last_test_message ?? null,
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await callTest({
        data: {
          provider,
          api_url: apiUrl || null,
          api_key: apiKey || null,
        },
      });
      setLastTest({
        at: new Date().toISOString(),
        ok: r.ok,
        message: r.message,
      });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao testar");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await callSave({
        data: {
          provider,
          api_url: apiUrl || null,
          api_key: apiKey || null,
          real_mode: realMode,
        },
      });
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const needsCreds = provider !== "simulado";

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/recarga">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Configurações de recarga</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="p-6 space-y-5">
              <div className="space-y-2">
                <Label>Provedor</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={provider === p.id ? "default" : "outline"}
                      onClick={() => {
                        setProvider(p.id);
                        if (p.id === "simulado") setRealMode(false);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              {needsCreds && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="api_url">URL da API</Label>
                    <Input
                      id="api_url"
                      type="url"
                      placeholder="https://api.provedor.com/recharge"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api_key">Chave de API</Label>
                    <Input
                      id="api_key"
                      type="password"
                      placeholder="sk_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Modo real ativo</div>
                  <div className="text-xs text-muted-foreground">
                    {provider === "simulado"
                      ? "Indisponível no modo simulado."
                      : "Requer teste de conexão bem-sucedido."}
                  </div>
                </div>
                <Switch
                  checked={realMode}
                  onCheckedChange={setRealMode}
                  disabled={provider === "simulado" || !lastTest.ok}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...
                    </>
                  ) : (
                    <>
                      <PlugZap className="h-4 w-4 mr-2" /> Testar conexão
                    </>
                  )}
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </Card>

            {lastTest.at && (
              <Card className="p-4 flex items-start gap-3">
                {lastTest.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div className="text-sm">
                  <div className="font-medium">
                    Último teste:{" "}
                    {format(parseISO(lastTest.at), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                  <div className="text-muted-foreground">{lastTest.message}</div>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
