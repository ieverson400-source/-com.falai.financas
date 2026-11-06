import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/planos/retorno")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true, statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "Voltar ao aplicativo — Falaí Finanças e Gastos" },
      { name: "description", content: "Acesse seu painel de finanças no Falaí Finanças e Gastos." },
      { property: "og:title", content: "Voltar ao aplicativo — Falaí Finanças e Gastos" },
      { property: "og:description", content: "Volte ao seu painel de finanças no Falaí Finanças e Gastos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
