import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, Tag, Clock, Percent } from "lucide-react";
import { listShopOffers } from "@/lib/shop.functions";
import { AdSenseBanner } from "@/components/adsense-banner";

export const Route = createFileRoute("/app/shop")({
  component: ShopPage,
  loader: () => listShopOffers(),
  errorComponent: () => (
    <main className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">
      Não foi possível carregar as ofertas agora. Tente novamente em instantes.
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Página não encontrada.</main>
  ),
  head: () => ({
    meta: [
      { title: "Shop — ofertas e cashback | Falaí Finanças" },
      {
        name: "description",
        content:
          "Ofertas em destaque, cupons e cashback de parceiros dentro do Falaí Finanças. Economize nas suas compras do dia a dia.",
      },
      { property: "og:title", content: "Shop — ofertas e cashback | Falaí Finanças" },
      {
        property: "og:description",
        content: "Ofertas em destaque, cupons e cashback de parceiros no Falaí Finanças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

// Tamanho do anúncio no carrossel, ajustável pelo administrador.
const cardSizeClass: Record<string, string> = {
  sm: "min-w-[220px] max-w-[240px]",
  md: "min-w-[280px] max-w-[320px]",
  lg: "min-w-[340px] max-w-[420px]",
  full: "min-w-[calc(100vw-2rem)] max-w-[100%] sm:min-w-[640px]",
};

function expiresLabel(endsAt: string | null) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Encerrada";
  const days = Math.ceil(diff / 86_400_000);
  return days <= 1 ? "Último dia" : `${days} dias restantes`;
}

function ShopPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { offers, adsense } = Route.useLoaderData();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const highlights = offers.filter((o) => o.kind === "highlight");
  const partnerOffers = offers.filter((o) => o.kind === "offer");
  const coupons = offers.filter((o) => o.kind === "coupon");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar para o início">
            <Link to="/app">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Shop</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-28">
        {adsense?.position === "SHOP_TOP" && adsense.publisher_id && adsense.ad_slot_id && (
          <AdSenseBanner settings={{ ...adsense, publisher_id: adsense.publisher_id, ad_slot_id: adsense.ad_slot_id }} />
        )}
        {offers.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhuma oferta publicada no momento. Volte em breve.
          </Card>
        )}

        {highlights.length > 0 && (
          <section aria-labelledby="destaques">
            <h2 id="destaques" className="mb-3 font-display text-base font-semibold">
              Destaques
            </h2>
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {highlights.map((h) => (
                <Card
                  key={h.id}
                  className={`${cardSizeClass[h.card_size ?? "md"] ?? cardSizeClass.md} snap-start rounded-2xl border bg-gradient-to-br ${
                    h.accent ?? "from-primary/20 to-primary/5"
                  } p-5 shadow-sm`}
                >
                  {h.image_url && (
                    <img
                      src={h.image_url}
                      alt={h.title}
                      loading="lazy"
                      className={`mb-3 w-full rounded-xl object-cover ${h.card_size === "lg" || h.card_size === "full" ? "h-44" : "h-32"}`}
                    />
                  )}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(h.badges ?? []).map((b) => (
                      <Badge key={b} variant="secondary" className="rounded-full text-[11px]">
                        {b}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug">{h.title}</h3>
                  {h.subtitle && <p className="mt-1 text-sm text-muted-foreground">{h.subtitle}</p>}
                  {h.price && <p className="mt-2 font-display text-lg font-semibold">{h.price}</p>}
                  {h.installments && (
                    <p className="text-xs text-muted-foreground">{h.installments}</p>
                  )}
                  {h.link_url ? (
                    <Button className="mt-4 w-full rounded-full" asChild>
                      <a href={h.link_url} target="_blank" rel="noopener noreferrer">
                        {h.cta_label ?? "Ver oferta"}
                      </a>
                    </Button>
                  ) : (
                    <Button className="mt-4 w-full rounded-full" disabled>
                      {h.cta_label ?? "Em breve"}
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {adsense?.position === "SHOP_MIDDLE" && adsense.publisher_id && adsense.ad_slot_id && (
          <AdSenseBanner settings={{ ...adsense, publisher_id: adsense.publisher_id, ad_slot_id: adsense.ad_slot_id }} />
        )}

        {partnerOffers.length > 0 && (
          <section aria-labelledby="ofertas">
            <h2 id="ofertas" className="mb-3 font-display text-base font-semibold">
              Ofertas de parceiros
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {partnerOffers.map((o) => {
                const expires = expiresLabel(o.ends_at);
                return (
                  <Card key={o.id} className="rounded-2xl border p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      {o.image_url ? (
                        <img
                          src={o.image_url}
                          alt={o.brand ?? o.title}
                          loading="lazy"
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full bg-muted text-xs font-semibold">
                          {(o.brand ?? o.title).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="text-sm font-medium">{o.brand ?? "Parceiro"}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{o.title}</p>
                    {o.price && <p className="mt-2 font-display text-lg font-semibold">{o.price}</p>}
                    {o.installments && (
                      <p className="text-xs text-muted-foreground">{o.installments}</p>
                    )}
                    {o.cashback && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary">
                        <Percent className="size-4" />
                        {o.cashback}
                      </div>
                    )}
                    {expires && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {expires}
                      </div>
                    )}
                    {o.link_url ? (
                      <Button variant="outline" className="mt-4 w-full rounded-full" asChild>
                        <a href={o.link_url} target="_blank" rel="noopener noreferrer">
                          {o.cta_label ?? "Ver oferta"}
                        </a>
                      </Button>
                    ) : (
                      <Button variant="outline" className="mt-4 w-full rounded-full" disabled>
                        {o.cta_label ?? "Em breve"}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {adsense?.position === "SHOP_OFFERS" && adsense.publisher_id && adsense.ad_slot_id && (
          <AdSenseBanner settings={{ ...adsense, publisher_id: adsense.publisher_id, ad_slot_id: adsense.ad_slot_id }} />
        )}

        {coupons.length > 0 && (
          <section aria-labelledby="cupons">
            <h2 id="cupons" className="mb-3 font-display text-base font-semibold">
              Cupons
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {coupons.map((c) => (
                <Card key={c.id} className="rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-dashed pb-3">
                    <Tag className="size-4 text-primary" />
                    <span className="text-sm font-medium">{c.brand ?? "Parceiro"}</span>
                  </div>
                  <p className="mt-3 font-display text-base font-semibold">
                    {c.cashback ?? c.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.subtitle ?? c.title}</p>
                  {c.link_url && (
                    <Button variant="outline" className="mt-4 w-full rounded-full" asChild>
                      <a href={c.link_url} target="_blank" rel="noopener noreferrer">
                        {c.cta_label ?? "Usar cupom"}
                      </a>
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {adsense?.position === "SHOP_BOTTOM" && adsense.publisher_id && adsense.ad_slot_id && (
          <AdSenseBanner settings={{ ...adsense, publisher_id: adsense.publisher_id, ad_slot_id: adsense.ad_slot_id }} />
        )}
      </main>

      <footer className="border-t bg-background px-4 py-6 pb-24 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-4">
          <span>© 2026 Falaí Finanças</span>
          <Link to="/privacy" className="hover:underline underline-offset-2">
            Política de Privacidade
          </Link>
        </div>
      </footer>
      <BottomNav current="shop" />
    </div>
  );
}
