import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, useAuth } from "@/lib/cloud";
import { requestSync, useSyncStatus } from "@/lib/sync";

function Splash({ text }: { text: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 pb-28">
      <p className="text-[24px] text-muted-foreground">{text}</p>
    </main>
  );
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("not confirmed")) return "Confirme seu e-mail (link enviado por mensagem) antes de entrar.";
  if (m.includes("already registered")) return "Esse e-mail já tem conta — use Entrar.";
  if (m.includes("password") && m.includes("6")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com a internet.";
  return message;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(mode: "in" | "up", event?: FormEvent) {
    event?.preventDefault();
    if (!email.trim() || !password) {
      setMessage("Preencha e-mail e senha.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const creds = { email: email.trim(), password };
      const { data, error } =
        mode === "in"
          ? await supabase.auth.signInWithPassword(creds)
          : await supabase.auth.signUp(creds);
      if (error) setMessage(friendlyError(error.message));
      else if (mode === "up" && !data.session) {
        setMessage("Conta criada. Confirme o e-mail enviado para você e depois toque em Entrar.");
      }
    } catch (err) {
      setMessage(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pb-16 pt-24">
      <p className="text-[24px] font-medium uppercase tracking-widest text-accent">Diário</p>
      <h1 className="mt-1 font-display text-4xl font-medium tracking-tight">Forja de Treinos</h1>
      <p className="mt-2 text-[24px] text-muted-foreground">
        Entre para guardar seu diário na nuvem, sem risco de perder os treinos.
      </p>
      <form onSubmit={(e) => void submit("in", e)} className="mt-8 flex flex-col gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {message && <p className="text-[24px] text-warn">{message}</p>}
        <Button type="submit" disabled={busy} className="h-14 text-[24px]">
          Entrar
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          className="h-14 text-[24px]"
          onClick={() => void submit("up")}
        >
          Criar conta
        </Button>
      </form>
    </main>
  );
}

/** Exige login e so libera o app depois da primeira sincronizacao com a nuvem. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, userId } = useAuth();
  const sync = useSyncStatus();

  useEffect(() => {
    if (userId) requestSync(0);
  }, [userId]);

  if (!ready) return <Splash text="Carregando…" />;
  if (!userId) return <LoginForm />;
  if (!sync.firstDone && sync.state !== "error") return <Splash text="Sincronizando seu diário…" />;

  return (
    <>
      {sync.state === "error" && (
        <p className="relative z-10 bg-warn/10 px-5 py-2 pr-40 text-[24px] text-warn">
          Sem conexão com a nuvem — o que você registrar fica guardado e é enviado depois.
        </p>
      )}
      {children}
    </>
  );
}
