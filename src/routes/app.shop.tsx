import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, Tag, Clock, Percent } from "lucide-react";

export const Route = createFileRoute("/app/shop")({
  component: ShopPage,
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

type Highlight = {
  id: string;
  title: string;
  subtitle: string;
  badges: string[];
  cta: string;
  accent: string;
};

type Offer = {
  id: string;
  brand: string;
  title: string;
  price?: string;
  installments?: string;
  cashback: string;
  expires?: string;
};

// Conteúdo de exemplo do Shop. Substitua pelos parceiros reais quando as
// campanhas estiverem cadastradas.
const highlights: Highlight[] = [
  {
    id: "h1",
    title: "iPhone 16 em 21x sem juros",
    subtitle: "Feito para Apple Intelligence",
    badges: ["21x sem juros", "Frete grátis", "5G"],
    cta: "Comprar agora",
    accent: "from-primary/20 to-primary/5",
  },
  {
    id: "h2",
    title: "Gift Cards com desconto",
    subtitle: "Economize nas suas marcas favoritas comprando créditos",
    badges: ["Até 15% off", "Entrega imediata"],
    cta: "Comprar com desconto",
    accent: "from-accent/25 to-accent/5",
  },
  {
    id: "h3",
    title: "Ofertas relâmpago",
    subtitle: "Cashback extra por tempo limitado",
    badges: ["Cashback 12%", "2 dias restantes"],
    cta: "Ver oferta",
    accent: "from-secondary/30 to-secondary/5",
  },
];

const offers: Offer[] = [
  { id: "o1", brand: "Netshoes", title: "Tênis e artigos esportivos", cashback: "Até 12%", expires: "2 dias restantes" },
  { id: "o2", brand: "LEGO", title: "Brinquedos e colecionáveis", cashback: "Até 10%", expires: "2 dias restantes" },
  {
    id: "o3",
    brand: "Nike",
    title: "Tênis Air Force 1 '07",
    price: "R$ 599,99",
    installments: "ou 10x de R$ 59,99",
    cashback: "Até R$ 12,00",
  },
  {
    id: "o4",
    brand: "Shell Box",
    title: "Combustível com desconto",
    cashback: "Até 5%",
    expires: "Todo mês",
  },
];

const coupons = [
  { id: "c1", brand: "Falaí Shop", value: "R$ 100,00 de cashback", detail: "Ar condicionado com frete grátis" },
  { id: "c2", brand: "Falaí Shop", value: "R$ 120,00 de cashback", detail: "Geladeiras selecionadas" },
];

function ShopPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

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
        {/* Carrossel de anúncios */}
        <section aria-labelledby="destaques">
          <h2 id="destaques" className="mb-3 font-display text-base font-semibold">
            Destaques
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {highlights.map((h) => (
              <Card
                key={h.id}
                className={`min-w-[280px] max-w-[320px] snap-start rounded-2xl border bg-gradient-to-br ${h.accent} p-5 shadow-sm`}
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  {h.badges.map((b) => (
                    <Badge key={b} variant="secondary" className="rounded-full text-[11px]">
                      {b}
                    </Badge>
                  ))}
                </div>
                <h3 className="font-display text-lg font-semibold leading-snug">{h.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.subtitle}</p>
                <Button className="mt-4 w-full rounded-full">{h.cta}</Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Ofertas de parceiros */}
        <section aria-labelledby="ofertas">
          <h2 id="ofertas" className="mb-3 font-display text-base font-semibold">
            Ofertas relâmpago — parceiros
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {offers.map((o) => (
              <Card key={o.id} className="rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {o.brand.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium">{o.brand}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{o.title}</p>
                {o.price && <p className="mt-2 font-display text-lg font-semibold">{o.price}</p>}
                {o.installments && (
                  <p className="text-xs text-muted-foreground">{o.installments}</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Percent className="size-4" />
                  {o.cashback}
                </div>
                {o.expires && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {o.expires}
                  </div>
                )}
                <Button variant="outline" className="mt-4 w-full rounded-full">
                  Ver oferta
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Cupons */}
        <section aria-labelledby="cupons">
          <h2 id="cupons" className="mb-3 font-display text-base font-semibold">
            Cupons
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {coupons.map((c) => (
              <Card key={c.id} className="rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-dashed pb-3">
                  <Tag className="size-4 text-primary" />
                  <span className="text-sm font-medium">{c.brand}</span>
                </div>
                <p className="mt-3 font-display text-base font-semibold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t bg-background px-4 py-6 pb-24 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-4">
          <span>© 2026 Falaí Finanças</span>
          <Link to="/privacy" className="hover:underline underline-offset-2">
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
