import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { useEffect } from "react";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=yes, viewport-fit=cover" },
      { title: "Falaí Finanças" },
      { name: "description", content: "Falaí Finanças: registre gastos por voz, foto ou texto. A IA categoriza tudo e mostra relatórios claros das suas finanças pessoais." },
      { name: "author", content: "Falaí Finanças" },
      // PWA: cor da barra do navegador / splash screen
      { name: "theme-color", content: "#0f1b2d" },
      // PWA: iOS (Safari "Adicionar à Tela de Início")
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Falaí" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:site_name", content: "Falaí Finanças" },
      { property: "og:title", content: "Falaí Finanças" },
      { property: "og:description", content: "Registre gastos por voz, foto ou texto. A IA categoriza e gera relatórios das suas finanças em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Falaí Finanças" },
      { name: "twitter:description", content: "Registre gastos por voz, foto ou texto. A IA categoriza e gera relatórios das suas finanças em segundos." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5b55cd14-b652-409a-b3fb-d257ac495cb1" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5b55cd14-b652-409a-b3fb-d257ac495cb1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // PWA manifest — descreve nome, ícones, cores e modo standalone
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Ícone na home screen do iOS
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/icon-152.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/icon-192.png" },
      // Favicon padrão (desktop/navegadores)
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon.png" },
      { rel: "shortcut icon", href: "/favicon.png" },
      // PWA ícones
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('falai-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    import("@/integrations/supabase/server-fn-fetch-patch");
  }, []);
  return (
    <>
      <Outlet />
      <InstallPWAButton />
    </>
  );
}
