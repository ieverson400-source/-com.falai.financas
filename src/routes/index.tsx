import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mic, BarChart3, Sparkles, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Falaí Finanças — gastos por voz, com IA" },
      {
        name: "description",
        content:
          "Fale seus gastos. A IA transcreve, categoriza e organiza tudo. Veja relatórios visuais das suas finanças pessoais em segundos.",
      },
      { property: "og:title", content: "Falaí Finanças — gastos por voz" },
      {
        property: "og:description",
        content:
          "Registre gastos falando. A IA transcreve, categoriza e gera relatórios automáticos das suas finanças.",
      },
      { property: "og:url", content: "https://falai-finan-as.lovable.app/" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://falai-finan-as.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "Falaí Finanças",
              url: "https://falai-finan-as.lovable.app/",
              description:
                "Registre gastos por voz, foto ou texto. A IA categoriza e gera relatórios das suas finanças.",
              inLanguage: "pt-BR",
            },
            {
              "@type": "Organization",
              name: "Falaí Finanças",
              url: "https://falai-finan-as.lovable.app/",
              logo: "https://falai-finan-as.lovable.app/icon-512.png",
            },
          ],
        }),
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-soft">
            <Mic className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">Falaí</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="h-10 px-4">Entrar</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main>
      <section className="px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-24 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium mb-5 sm:mb-6">
              <Sparkles className="size-3.5 text-primary" />
              Powered by Lovable AI
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-5 sm:mb-6">
              Fale seu gasto.
              <br />
              <span className="text-primary">Pronto.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-7 sm:mb-8 max-w-md leading-relaxed">
              Grave um áudio dizendo "gastei 150 reais com a conta de luz". A IA transcreve, extrai o valor, categoriza e gera relatórios.
            </p>
            <div className="flex gap-3">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="gap-2 w-full sm:w-auto h-12 sm:h-10 transition-transform hover:scale-[1.02]">
                  Começar grátis <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-warm opacity-20 blur-3xl rounded-full" />
            <div className="relative bg-card rounded-3xl p-5 sm:p-8 shadow-elevated border border-border">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-secondary">
                  <div className="size-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Mic className="size-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">"Gastei 89 reais no mercado hoje"</p>
                    <p className="text-xs text-muted-foreground mt-1">0:03 — você</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-hero text-primary-foreground shadow-soft">
                  <p className="text-xs opacity-80 mb-1">✓ Registrado</p>
                  <p className="font-semibold">R$ 89,00 · Supermercado</p>
                  <p className="text-xs opacity-80 mt-1">21 abr 2026</p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="p-3 rounded-xl bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Mês</p>
                    <p className="font-display font-semibold">R$ 1.2k</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Categorias</p>
                    <p className="font-display font-semibold">7</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Gastos</p>
                    <p className="font-display font-semibold">23</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-secondary/40">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
          {[
            { icon: Mic, title: "Áudio → texto", desc: "Grave ou faça upload. A IA transcreve em português." },
            { icon: Sparkles, title: "Categoria automática", desc: "Valor, categoria e data extraídos sem digitar." },
            { icon: BarChart3, title: "Relatórios visuais", desc: "Gráficos de gastos por categoria e mês." },
          ].map((f) => (
            <div key={f.title}>
              <div className="size-11 rounded-xl bg-card border border-border flex items-center justify-center mb-4 shadow-soft">
                <f.icon className="size-5 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
      </main>

      <footer className="px-4 sm:px-6 py-8 sm:py-10 text-center text-xs text-muted-foreground">
        © 2026 Falaí Finanças
      </footer>
    </div>
  );
}
