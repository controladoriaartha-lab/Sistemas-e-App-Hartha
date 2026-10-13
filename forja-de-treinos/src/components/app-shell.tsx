import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut, Moon, Plus, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthGate, useSplashActive } from "@/components/auth-gate";
import { Toaster } from "@/components/ui/sonner";
import { hasNovoDraft } from "@/lib/novo-draft";
import { toggleTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { setPersistFailureHandler } from "@/store/workouts";

// Uma vez por abertura do app (carga da página), nunca mais depois.
let draftRestoreChecked = false;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname.startsWith("/novo") || pathname.includes("/editar");
  const splashActive = useSplashActive();
  const navigate = useNavigate();

  // App aberto de novo (celular fechou o app em segundo plano) caindo no
  // início com um treino novo em andamento: volta direto pra essa tela, pra
  // não perder campos nem cronômetros. Só na abertura — dentro do app o
  // caminho segue livre.
  useEffect(() => {
    if (draftRestoreChecked) return;
    draftRestoreChecked = true;
    if (window.location.pathname === "/" && hasNovoDraft()) {
      void navigate({ to: "/novo", replace: true });
    }
  }, [navigate]);

  // Mounted once for the whole app: surfaces a local-storage write failure
  // (private browsing, full quota, disabled storage) as a visible toast
  // instead of it silently swallowing the save.
  useEffect(() => {
    setPersistFailureHandler((message) => toast.error(message, { duration: 8000 }));
    return () => setPersistFailureHandler(null);
  }, []);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-lg text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(75%_80%_at_50%_-25%,rgba(240,151,95,0.26),transparent_72%)]"
      />
      {!splashActive && <TopControls />}
      <AuthGate>
        {children}
        {!hideNav && <BottomNav pathname={pathname} />}
      </AuthGate>
      <Toaster />
    </div>
  );
}

/**
 * Always-on floating controls, on every screen — not hidden behind a tap
 * gesture, so there is nothing to fail to discover. Positioned with
 * env(safe-area-inset-top) so it clears the status bar / notch on an
 * installed PWA (this app opts into edge-to-edge via viewport-fit=cover).
 * Logo, then theme toggle, then the exit button, which stays the
 * outermost/rightmost control.
 */
function TopControls() {
  return (
    <div
      className="fixed right-3 z-50 flex items-center gap-2"
      style={{ top: "max(0.75rem, calc(env(safe-area-inset-top) + 0.375rem))" }}
    >
      <img
        src="/artha-logo.png"
        alt="ARTHA"
        className="h-9 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
      />
      <ThemeToggleButton />
      <ExitAppButton />
    </div>
  );
}

function ThemeToggleButton() {
  const theme = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className="btn-3d flex size-9 items-center justify-center rounded-full"
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

/**
 * No browser lets a script close a window/tab it did not open itself — an
 * installed PWA or a tab the user opened ignores window.close() outright, on
 * every phone, in every browser. That's not a bug to work around here; it's
 * the same OS-level protection stopping any app from quitting itself. So
 * this doesn't pretend to try — it explains, once and clearly, how to
 * actually leave, via a dialog instead of a toast that can be missed.
 */
function ExitAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sair do app"
        title="Sair do app"
        className="btn-3d flex size-9 items-center justify-center rounded-full"
      >
        <LogOut className="size-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Como sair do app"
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-xl">Como sair do app</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum app — de nenhuma marca — consegue se fechar sozinho por um botão interno.
              É uma proteção do próprio celular, não uma limitação deste app.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Para sair: use o botão Voltar do celular, ou deslize o app para cima na lista de
              recentes.
            </p>
            <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const onHome = pathname === "/";
  const onDash = pathname.startsWith("/dashboard");

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-4"
      style={{ paddingBottom: "max(0.875rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
      aria-label="Navegação principal"
    >
      <div className="nav-float pointer-events-auto relative grid grid-cols-[1fr_5.5rem_1fr] items-center px-3 py-2">
        <NavLink to="/" active={onHome} label="Treinos" icon={<ClipboardList />} />
        <Link
          to="/novo"
          className="fab-3d mx-auto -mt-9 flex size-[4.25rem] items-center justify-center rounded-full transition-transform duration-150 active:translate-y-1 active:scale-95"
          aria-label="Novo treino"
        >
          <Plus className="size-8" strokeWidth={2.4} />
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
        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-2xs font-medium tracking-wide",
        active ? "text-foreground" : "text-faint",
      )}
    >
      <span
        className={cn(
          "[&>svg]:size-5",
          active ? "text-accent drop-shadow-[0_0_8px_var(--halo)]" : "text-faint",
        )}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}
