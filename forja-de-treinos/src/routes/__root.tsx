import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/app-shell";
import appCss from "../styles.css?url";

const APP_NAME = "Forja de Treinos";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0c0b0a" },
      {
        name: "description",
        content: "Diário de treino de Geovanil e Vânia — sessões, volume e comparativos.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Outfit:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="pt-BR" suppressHydrationWarning className="antialiased">
      <head>
        <HeadContent />
        {/*
          Roda antes do body pintar (script sincrono, sem defer/type=module,
          no fim do <head>) — le o tema salvo e aplica no <html> e no meta
          theme-color ANTES do primeiro paint. Sem isso a pagina sempre nasce
          escura (o servidor nao sabe a preferencia do navegador) e so fica
          clara depois que o bundle React carrega e corrige — um pisca
          escuro->claro visivel em quem usa tema claro.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("forja-theme-v1")==="light"){document.documentElement.dataset.theme="light";var m=document.querySelector(\'meta[name="theme-color"]\');if(m)m.setAttribute("content","#f4efe8");}}catch(e){}',
          }}
        />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
