import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Falaí Finanças — Finanças simples" },
      {
        name: "description",
        content: "Gerencie suas finanças de forma simples com o Falaí Finanças.",
      },
      { property: "og:title", content: "Falaí Finanças — Finanças simples" },
      {
        property: "og:description",
        content: "Gerencie suas finanças de forma simples com o Falaí Finanças.",
      },
      { property: "og:url", content: "https://falai-finan-as.lovable.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-lg flex-col items-center text-center animate-rise">
        <img
          src="/icon-192.png"
          alt=""
          width={96}
          height={96}
          className="mb-6 h-24 w-24 rounded-3xl shadow-elevated"
        />
        <p className="font-display text-xl font-bold text-primary">Falaifinancas</p>
        <h1 className="mt-5 max-w-md font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Gerencie suas finanças de forma simples
        </h1>
        <Button asChild size="lg" className="mt-9 h-12 px-7 text-base shadow-soft press">
          <Link to="/auth">Acessar Minha Conta</Link>
        </Button>
      </div>
    </main>
  );
}
