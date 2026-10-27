import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeDollarSign, Eye, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { adminGetAdSenseSettings, adminSaveAdSenseSettings } from "@/lib/admin-panel.functions";
import { AdminSectionTitle } from "@/components/admin-shell";
import { AdSenseBanner } from "@/components/adsense-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Settings = Awaited<ReturnType<typeof adminGetAdSenseSettings>>["settings"];
type SaveInput = Parameters<typeof adminSaveAdSenseSettings>[0]["data"];

export function AdminAdSenseSettings() {
  const getSettings = useServerFn(adminGetAdSenseSettings);
  const saveSettings = useServerFn(adminSaveAdSenseSettings);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [test, setTest] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettings().then((result) => { if (!cancelled) setSettings(result.settings); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar as configurações do AdSense."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getSettings, retry]);

  const configured = settings && /^ca-pub-\d+$/.test(settings.publisher_id ?? "") && /^\d+$/.test(settings.ad_slot_id ?? "");
  const update = (changes: Partial<Settings>) => { setTest(null); setSettings((current) => current ? { ...current, ...changes } : current); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    if (settings.enabled && !configured) { toast.error("Informe um Publisher ID ca-pub-… e um ID de bloco numérico válidos."); return; }
    setSaving(true);
    try {
      await saveSettings({ data: {
        enabled: settings.enabled, publisherId: settings.publisher_id?.trim() || null,
        adSlotId: settings.ad_slot_id?.trim() || null, adFormat: settings.ad_format as SaveInput["adFormat"],
        position: settings.position as SaveInput["position"], maxWidth: settings.max_width,
        marginTop: settings.margin_top, marginBottom: settings.margin_bottom,
        showInShop: settings.show_in_shop, showInOtherScreens: settings.show_in_other_screens,
        testMode: settings.test_mode,
      } });
      toast.success("Configurações do AdSense salvas.");
    } catch { toast.error("Não foi possível salvar. Confira os campos e tente novamente."); }
    finally { setSaving(false); }
  };

  return <section>
    <AdminSectionTitle icon={BadgeDollarSign} title="AdSense" description="Monetização · Google AdSense" />
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando configurações…</p> : error ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}><RefreshCw className="size-4" />Tentar novamente</Button></div> : settings && <form onSubmit={(event) => void save(event)} className="max-w-3xl space-y-6">
      <div className="divide-y rounded-lg border">
        {([
          ["enabled", "Ativar AdSense"], ["show_in_shop", "Mostrar no Shop"],
          ["show_in_other_screens", "Outras telas (uso futuro)"], ["test_mode", "Modo teste / desenvolvimento"],
        ] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 p-4"><Label htmlFor={`adsense-${key}`}>{label}</Label><Switch id={`adsense-${key}`} checked={settings[key]} onCheckedChange={(checked) => update({ [key]: checked })} /></div>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="adsense-publisher">Publisher ID</Label><Input id="adsense-publisher" placeholder="ca-pub-…" maxLength={40} value={settings.publisher_id ?? ""} onChange={(event) => update({ publisher_id: event.target.value.trim() })} /></div>
        <div className="space-y-2"><Label htmlFor="adsense-slot">ID do bloco de anúncio</Label><Input id="adsense-slot" inputMode="numeric" placeholder="ID numérico do bloco" maxLength={40} value={settings.ad_slot_id ?? ""} onChange={(event) => update({ ad_slot_id: event.target.value.trim() })} /></div>
        <div className="space-y-2"><Label htmlFor="adsense-format">Formato</Label><Select value={settings.ad_format} onValueChange={(value) => update({ ad_format: value })}><SelectTrigger id="adsense-format" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[["auto", "Responsivo"], ["rectangle", "Retângulo"], ["horizontal", "Horizontal"], ["vertical", "Vertical"], ["fluid", "Fluido"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="adsense-position">Posição no Shop</Label><Select value={settings.position} onValueChange={(value) => update({ position: value })}><SelectTrigger id="adsense-position" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[["SHOP_TOP", "Topo"], ["SHOP_MIDDLE", "Entre destaques e ofertas"], ["SHOP_OFFERS", "Após ofertas de parceiros"], ["SHOP_BOTTOM", "Final do Shop"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {([
          ["max_width", "Largura máxima (px)", 280, 1600], ["margin_top", "Margem superior (px)", 0, 120], ["margin_bottom", "Margem inferior (px)", 0, 120],
        ] as const).map(([key, label, min, max]) => <div key={key} className="space-y-2"><Label htmlFor={`adsense-${key}`}>{label}</Label><Input id={`adsense-${key}`} type="number" required min={min} max={max} step={1} value={settings[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} /></div>)}
      </div>
      <p className="text-sm text-muted-foreground">Cadastre e aprove este site no Google AdSense e copie os IDs de um bloco responsivo. Esses IDs são públicos. A exibição depende da aprovação do Google, da disponibilidade de anúncios e de bloqueadores. Outras telas ainda não exibem anúncios.</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={saving}><Save className="size-4" />{saving ? "Salvando…" : "Salvar"}</Button><Button type="button" variant="outline" disabled={!configured || saving} onClick={() => setTest({ ...settings, test_mode: true })}><Eye className="size-4" />Testar anúncio</Button></div>
      {test && test.publisher_id && test.ad_slot_id ? <div className="border-t pt-4"><p role="status" className="mb-3 text-sm text-muted-foreground">Solicitação de teste ao Google; nenhum anúncio fictício é exibido.</p><AdSenseBanner key={`${test.publisher_id}-${test.ad_slot_id}-${test.ad_format}`} settings={{ ...test, publisher_id: test.publisher_id, ad_slot_id: test.ad_slot_id }} /></div> : null}
    </form>}
  </section>;
}