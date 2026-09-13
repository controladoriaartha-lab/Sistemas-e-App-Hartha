import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { setPersistFailureHandler } from "@/store/workouts";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname.startsWith("/novo") || pathname.includes("/editar");

  // Mounted once for the whole app: surfaces a local-storage write failure
  // (private browsing, full quota, disabled storage) as a visible toast
  // instead of it silently swallowing the save.
  useEffect(() => {
    setPersistFailureHandler((message) => toast.error(message, { duration: 8000 }));
    return () => setPersistFailureHandler(null);
  }, []);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-lg bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(80%_80%_at_50%_-20%,rgba(196,92,38,0.16),transparent_70%)]"
      />
      <ExitAppButton />
      {children}
      {!hideNav && <BottomNav pathname={pathname} />}
      <Toaster />
    </div>
  );
}

/**
 * Always-on floating button, on every screen — not hidden behind a tap
 * gesture, so there is nothing to fail to discover. Positioned with
 * env(safe-area-inset-top) so it clears the status bar / notch on an
 * installed PWA (this app opts into edge-to-edge via viewport-fit=cover).
 */
function ExitAppButton() {
  function attemptExit() {
    window.close();
    // Browsers only let a script close a window/tab it opened itself — a PWA
    // launched from the home screen (or a tab the user opened) ignores this
    // silently. If we're still here a beat later, tell the user how to
    // actually leave instead of a button that looks broken.
    setTimeout(() => {
      toast.info("Para sair, use o botão Voltar do celular ou o gerenciador de apps.");
    }, 150);
  }

  return (
    <button
      type="button"
      onClick={attemptExit}
      aria-label="Sair do app"
      title="Sair do app"
      style={{ top: "max(0.75rem, calc(env(safe-area-inset-top) + 0.375rem))" }}
      className="fixed right-3 z-50 flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.55)] ring-1 ring-border"
    >
      <LogOut className="size-4" />
    </button>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const onHome = pathname === "/";
  const onDash = pathname.startsWith("/dashboard");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-3 items-center px-2 py-1.5">
        <NavLink to="/" active={onHome} label="Treinos" icon={<ClipboardList />} />
        <Link
          to="/novo"
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-paper text-ink shadow-[0_8px_24px_rgba(12,11,10,0.45)] transition-transform duration-150 active:scale-95"
          aria-label="Novo treino"
        >
          <Plus className="size-6" strokeWidth={2.2} />
        </Link>
        <NavLink to="/dashboard" active={onDash} label="Painel" icon={<LayoutDashboard />} />
      </div>
    </nav>
  );
}

function NavLink({
  to,
  active,
  label,
  icon,
}: {
  to: "/" | "/dashboard";
  active: boolean;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-2xs font-medium tracking-wide",
        active ? "text-paper" : "text-faint",
      )}
    >
      <span className={cn("[&>svg]:size-5", active ? "text-accent" : "text-faint")}>{icon}</span>
      {label}
    </Link>
  );
}
