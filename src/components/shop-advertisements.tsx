import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Clock, Store } from "lucide-react";
import { listLiveAdvertisements, recordAdvertisementEvent } from "@/lib/advertising.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Ad = Awaited<ReturnType<typeof listLiveAdvertisements>>[number];
export function AdvertisementCard({ ad, preview = false }: { ad: Ad; preview?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const record = useServerFn(recordAdvertisementEvent);
  const track = async (event_type: "impression" | "click") => {
    if (preview) return;
    let session = sessionStorage.getItem("falai-ad-session");
    if (!session) { session = crypto.randomUUID(); sessionStorage.setItem("falai-ad-session", session); }
    const key = `falai-ad-${session}-${ad.id}-${event_type}-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "pending");
    try { await record({ data: { advertisement_id: ad.id, event_type, session_id: session } }); sessionStorage.setItem(key, "done"); }
    catch { sessionStorage.removeItem(key); }
  };
  useEffect(() => {
    if (!ref.current || preview) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { void track("impression"); observer.disconnect(); } }, { threshold: 0.5 });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [ad.id, preview]);
  return <Card ref={ref} className={`overflow-hidden border ${ad.is_featured ? "sm:col-span-2" : ""}`}>
    {ad.image_url && <img src={ad.image_url} alt={ad.title} loading="lazy" className="aspect-[16/7] w-full object-cover" />}
    <div className="flex h-full flex-col gap-3 p-4"><div className="flex items-center gap-3">{ad.logo_url ? <img src={ad.logo_url} alt={ad.badge_text || "Empresa"} className="size-10 rounded-lg object-contain" /> : <Store className="size-8 text-accent" />}<div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{ad.badge_text}</p>{ad.category && <p className="text-xs text-muted-foreground">{ad.category}</p>}</div>{ad.is_sponsored && <Badge variant="outline" className="shrink-0 text-[10px]">Patrocinado</Badge>}</div>
    <h3 className="break-words font-display text-lg font-semibold">{ad.title}</h3>{ad.offer_text && <p className="text-xl font-semibold text-accent">{ad.offer_text}</p>}{ad.description && <p className="break-words text-sm text-muted-foreground">{ad.description}</p>}
    {ad.end_date && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />Válida até {new Date(ad.end_date).toLocaleDateString("pt-BR")}</p>}
    <Button asChild variant="outline" className="mt-auto w-full"><a href={ad.destination_url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => void track("click")}>Ver oferta<ArrowUpRight className="size-4" /></a></Button></div>
  </Card>;
}
export function ShopAdvertisements({ placement }: { placement: string }) {
  const fetchAds = useServerFn(listLiveAdvertisements);
  const [ads, setAds] = useState<Ad[]>([]);
  useEffect(() => { let mounted = true; fetchAds().then((rows) => { if (mounted) setAds(rows.filter((a) => a.placement === placement)); }).catch(() => {}); return () => { mounted = false; }; }, [fetchAds, placement]);
  if (!ads.length) return null;
  return <section aria-label={`Publicidade ${placement}`}><h2 className="mb-3 font-display text-base font-semibold">{placement === "SHOP_OFFERS" ? "Ofertas Relâmpago — Parceiros" : "Ofertas em destaque"}</h2><div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{ads.map((ad) => <AdvertisementCard key={ad.id} ad={ad} />)}</div></section>;
}