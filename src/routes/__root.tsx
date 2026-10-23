import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Shield, Users, UsersRound, Globe, Flame, Wand2, Plug, Activity } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Voltar</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Esta página não carregou</h1>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Tentar novamente</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Samba AD Console" },
      { name: "description", content: "Administração e provisionamento de Samba AD DC" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

const nav = [
  { to: "/", label: "Painel", icon: Activity },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/grupos", label: "Grupos", icon: UsersRound },
  { to: "/dns", label: "DNS", icon: Globe },
  { to: "/firewall", label: "Firewall", icon: Flame },
  { to: "/provisionar", label: "Provisionar AD", icon: Wand2 },
  { to: "/conexao", label: "Conexão", icon: Plug },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar md:block">
          <div className="flex items-center gap-2 px-5 py-5">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-mono text-sm font-semibold tracking-wide">SAMBA·AD</span>
          </div>
          <nav className="space-y-1 px-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="nav-link" activeProps={{ className: "nav-link-active" }} activeOptions={{ exact: true }}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">
          <nav className="flex gap-1 overflow-x-auto border-b border-border p-2 md:hidden">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="nav-link whitespace-nowrap" activeProps={{ className: "nav-link-active" }} activeOptions={{ exact: true }}>{n.label}</Link>
            ))}
          </nav>
          <main className="mx-auto max-w-5xl p-6 md:p-10"><Outlet /></main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
