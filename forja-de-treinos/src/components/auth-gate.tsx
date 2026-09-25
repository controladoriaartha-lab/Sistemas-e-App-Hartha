import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, useAuth } from "@/lib/cloud";
import { requestSync, useSyncStatus } from "@/lib/sync";
import { cn } from "@/lib/utils";

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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const creating = mode === "up";

  function switchMode(next: "in" | "up") {
    setMode(next);
    setMessage(null);
    setRepeat("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage({ kind: "error", text: "Preencha o e-mail e a senha." });
      return;
    }
    if (creating && password.length < 6) {
      setMessage({ kind: "error", text: "A senha precisa ter pelo menos 6 caracteres." });
      return;
    }
    if (creating && password !== repeat) {
      setMessage({ kind: "error", text: "As duas senhas não são iguais. Digite de novo." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const creds = { email: email.trim(), password };
      const { data, error } = creating
        ? await supabase.auth.signUp(creds)
        : await supabase.auth.signInWithPassword(creds);
      if (error) setMessage({ kind: "error", text: friendlyError(error.message) });
      else if (creating && !data.session) {
        setMode("in");
        setRepeat("");
        setMessage({
          kind: "ok",
          text: "Conta criada! Abra o e-mail que enviamos e toque no link de confirmação. A página que abrir pode mostrar um erro — é normal. Depois volte aqui e toque em Entrar.",
        });
      }
    } catch (err) {
      setMessage({ kind: "error", text: friendlyError(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pb-16 pt-24">
      <div className="flex flex-col items-center text-center">
        <img
          src="/artha-logo.png"
          alt="ARTHA"
          className="h-28 w-auto drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
        />
        <p className="mt-5 text-[24px] font-medium uppercase tracking-widest text-accent">Diário</p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight">Forja de Treinos</h1>
        <p className="mt-3 max-w-sm text-[24px] leading-snug text-muted-foreground">
          Seus treinos guardados na nuvem, com acesso só seu.
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-card p-5 shadow-[0_0_0_1px_rgba(244,239,232,0.08)]">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: "in", label: "Entrar" },
              { value: "up", label: "Cadastro" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => switchMode(opt.value)}
              className={cn(
                "min-h-14 rounded-md text-[24px] font-medium transition-colors duration-150",
                mode === opt.value ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[24px] leading-snug text-muted-foreground">
          {creating
            ? "Primeiro acesso: crie seu usuário e uma senha. Geovanil e Vânia usam o mesmo e-mail para dividir o mesmo diário."
            : "Digite o e-mail e a senha que você criou no cadastro (primeiro acesso)."}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-5 flex flex-col gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail (seu usuário)</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type={show ? "text" : "password"}
                autoComplete={creating ? "new-password" : "current-password"}
                placeholder={creating ? "Mínimo 6 caracteres" : "Sua senha"}
                className="pr-14"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Esconder senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-muted-foreground"
              >
                {show ? <EyeOff className="size-6" /> : <Eye className="size-6" />}
              </button>
            </div>
          </div>

          {creating && (
            <div className="space-y-1.5">
              <Label htmlFor="repetir">Repita a senha</Label>
              <Input
                id="repetir"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Digite a senha de novo"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </div>
          )}

          {message && (
            <p
              role="alert"
              className={cn(
                "rounded-lg px-4 py-3 text-[24px] leading-snug",
                message.kind === "error" ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok",
              )}
            >
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={busy} className="h-14 text-[24px]">
            {busy ? "Aguarde…" : creating ? "Criar minha conta" : "Entrar"}
          </Button>
        </form>
      </div>
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
