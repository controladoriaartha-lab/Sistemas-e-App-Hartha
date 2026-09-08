import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, Plus } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname.startsWith("/novo") || pathname.includes("/editar");

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-lg bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(80%_80%_at_50%_-20%,rgba(196,92,38,0.16),transparent_70%)]"
      />
      {children}
      {!hideNav && <BottomNav pathname={pathname} />}
      <Toaster />
    </div>
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
