import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Falaí Finanças e Gastos — Finanças simples" },
      {
        name: "description",
        content: "Gerencie suas finanças de forma simples com o Falaí Finanças e Gastos.",
      },
      { property: "og:title", content: "Falaí Finanças e Gastos — Finanças simples" },
      {
        property: "og:description",
        content: "Gerencie suas finanças de forma simples com o Falaí Finanças e Gastos.",
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
              name: "Falaí Finanças e Gastos",
              url: "https://falai-finan-as.lovable.app/",
              description:
                "Registre gastos por voz, foto ou texto. A IA categoriza e gera relatórios das suas finanças.",
              inLanguage: "pt-BR",
            },
            {
              "@type": "Organization",
              name: "Falaí Finanças e Gastos",
              url: "https://falai-finan-as.lovable.app/",
              logo: "https://falai-finan-as.lovable.app/icon-512.png",
            },
          ],
        }),
      },
    ],
  }),
});

