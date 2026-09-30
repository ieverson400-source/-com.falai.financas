import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      throw redirect({ to: "/app", replace: true });
    }
    throw redirect({ to: "/auth", search: { mode: "signup" }, replace: true });
  },
  head: () => ({
    meta: [
      { title: "Criar conta — Falaí Finanças" },
      {
        name: "description",
        content: "Crie sua conta no Falaí Finanças e comece a organizar suas finanças.",
      },
      { property: "og:title", content: "Criar conta — Falaí Finanças" },
      {
        property: "og:description",
        content: "Cadastre-se no Falaí Finanças para organizar seus gastos e acompanhar seus resultados.",
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
