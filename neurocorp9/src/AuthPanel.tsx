import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ativarBiometria, biometriaAtiva, biometriaDisponivel, desativarBiometria, verificarBiometria } from "./biometria";

function traduzir(msg: string, code?: string) {
  if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) return "E-mail ainda não confirmado. Abra o último e-mail recebido e toque no link, ou use \"Reenviar e-mail\".";
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  const seg = msg.match(/after (\d+) seconds/i);
  if (seg) return `Aguarde ${seg[1]} segundos antes de pedir outro e-mail.`;
  if (code === "over_email_send_rate_limit" || /rate limit/i.test(msg))
    return "O serviço de e-mail atingiu o limite por hora (plano gratuito). Não é erro seu: tente de novo em cerca de 1 hora.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Use \"Entrar\".";
  return msg;
}

export function AuthPanel({ sessao }: { sessao: Session | null }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const [trocando, setTrocando] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const userId = sessao?.user.id ?? null;

  useEffect(() => {
    biometriaDisponivel().then(setBioOk);
  }, []);
  useEffect(() => {
    setBioOn(userId ? biometriaAtiva(userId) : false);
  }, [userId]);

  useEffect(() => {
    const abrir = () => {
      setAberto(true);
      setCriando(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("neurocorp9:login", abrir);
    return () => window.removeEventListener("neurocorp9:login", abrir);
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  if (!supabase) return null;
  const sb = supabase;

  if (sessao) {
    return (
      <div className="auth">
        <span className="auth-mail" title={sessao.user.email}>
          <i className="auth-ok" /> {sessao.user.email}
        </span>
        <div className="auth-links">
          <button className="link" onClick={() => setTrocando(true)}>Alterar senha</button>
          {bioOk && (
            <button
              className="link"
              onClick={async () => {
                if (bioOn) {
                  desativarBiometria(sessao.user.id);
                  setBioOn(false);
                  return;
                }
                try {
                  await ativarBiometria(sessao.user.id, sessao.user.email ?? "");
                  setBioOn(true);
                } catch {
                  /* cancelado pela pessoa */
                }
              }}
            >
              {bioOn ? "Desativar digital" : "Ativar digital"}
            </button>
          )}
          <button className="link" onClick={() => sb.auth.signOut()}>Sair</button>
        </div>
        {trocando && <NovaSenha aoConcluir={() => setTrocando(false)} />}
      </div>
    );
  }

  const enviar = async (criar: boolean) => {
    if (!email || senha.length < 6) {
      setMsg("Informe e-mail e senha (mínimo 6 caracteres).");
      return;
    }
    if (criar && senha !== senha2) {
      setMsg("As senhas não conferem. Digite a mesma senha nos dois campos.");
      return;
    }
    setOcupado(true);
    setMsg(null);
    if (criar) {
      // Cadastro por funcao do servidor: conta ja confirmada, sem enviar e-mail.
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      try {
        const res = await fetch(`${base}/functions/v1/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
          body: JSON.stringify({ email, password: senha }),
        });
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) {
          setOcupado(false);
          const mapa: Record<string, string> = {
            email_exists: "Este e-mail já tem conta. Use \"Não tenho conta\" para voltar e toque em Entrar.",
            invalid_email: "E-mail inválido. Confira o endereço.",
            weak_password: "A senha precisa ter de 6 a 72 caracteres.",
            rate_limited: "Muitas tentativas seguidas. Aguarde alguns minutos.",
          };
          setMsg(mapa[corpo.code as string] ?? "Não foi possível criar a conta agora. Tente de novo.");
          return;
        }
      } catch {
        setOcupado(false);
        setMsg("Sem conexão com o servidor. Verifique a internet e tente de novo.");
        return;
      }
    }
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    setOcupado(false);
    if (error) {
      setMsg(traduzir(error.message, (error as { code?: string }).code));
      if ((error as { code?: string }).code === "email_not_confirmed") setPendente(true);
    } else {
      setAberto(false);
    }
  };

  const esqueci = async () => {
    if (!email) {
      setMsg("Digite seu e-mail acima e toque em \"Esqueci minha senha\" de novo.");
      return;
    }
    setOcupado(true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setOcupado(false);
    setEspera(60);
    setMsg(
      error
        ? traduzir(error.message, (error as { code?: string }).code)
        : `Enviamos um link para ${email}. Abra o e-mail mais recente e toque no link para criar uma nova senha.`,
    );
  };

  const reenviar = async () => {
    if (!email) {
      setMsg("Informe o e-mail para reenviar.");
      return;
    }
    setOcupado(true);
    const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin } });
    setOcupado(false);
    setEspera(60);
    setMsg(error ? traduzir(error.message, (error as { code?: string }).code) : "E-mail reenviado. Use apenas o link do e-mail mais novo.");
  };

  return (
    <div className="auth">
      <button className="btn btn-ghost btn-sm" onClick={() => setAberto((a) => !a)}>
        {aberto ? "Fechar" : "Entrar"}
      </button>
      {aberto && (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(criando);
          }}
        >
          <strong className="auth-title">{criando ? "Criar conta" : "Entrar"}</strong>
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input
            type="password"
            placeholder="Senha (mínimo 6 caracteres)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={criando ? "new-password" : "current-password"}
          />
          {criando && (
            <input type="password" placeholder="Confirmar senha" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" />
          )}
          <button type="submit" className="send" disabled={ocupado}>
            {criando ? "Criar conta" : "Entrar"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setCriando((c) => !c);
              setMsg(null);
            }}
          >
            {criando ? "Já tenho conta: entrar" : "Não tenho conta: criar"}
          </button>
          {!criando && (
            <button type="button" className="link" disabled={ocupado || espera > 0} onClick={esqueci}>
              {espera > 0 ? `Esqueci minha senha (aguarde ${espera}s)` : "Esqueci minha senha"}
            </button>
          )}
          {pendente && (
            <button type="button" className="link" disabled={ocupado || espera > 0} onClick={reenviar}>
              {espera > 0 ? `Reenviar e-mail (aguarde ${espera}s)` : "Reenviar e-mail de confirmação"}
            </button>
          )}
          {msg && <small className="auth-msg">{msg}</small>}
        </form>
      )}
    </div>
  );
}

/** Tela exibida quando a pessoa chega pelo link "esqueci minha senha". */
export function NovaSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);

  const salvar = async () => {
    if (!supabase) return;
    if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== senha2) return setMsg("As senhas não conferem.");
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) setMsg(traduzir(error.message, (error as { code?: string }).code));
    else setFeito(true);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Criar nova senha">
      <form
        className="modal-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (feito) aoConcluir();
          else salvar();
        }}
      >
        <h3>{feito ? "Senha alterada" : "Criar nova senha"}</h3>
        {feito ? (
          <p className="muted">Pronto. Você já está dentro da sua conta com a nova senha.</p>
        ) : (
          <>
            <input type="password" placeholder="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" autoFocus />
            <input type="password" placeholder="Confirmar nova senha" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" />
          </>
        )}
        <button type="submit" className="btn" disabled={ocupado}>
          {feito ? "Continuar" : "Salvar nova senha"}
        </button>
        {msg && !feito && <small className="auth-msg">{msg}</small>}
      </form>
    </div>
  );
}

/** Tela de bloqueio: pede a digital antes de mostrar os dados. */
export function BloqueioDigital({ userId, aoDesbloquear }: { userId: string; aoDesbloquear: () => void }) {
  const [tentando, setTentando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const tentar = async () => {
    setTentando(true);
    setFalhou(false);
    const ok = await verificarBiometria(userId);
    setTentando(false);
    if (ok) aoDesbloquear();
    else setFalhou(true);
  };

  useEffect(() => {
    tentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal lock" role="dialog" aria-modal="true" aria-label="Desbloquear com a digital">
      <div className="modal-card lock-card">
        <img src="/logo.png" alt="" width={72} height={72} />
        <h3>NEUROCORP9 bloqueado</h3>
        <p className="muted">Use a digital, o rosto ou o PIN do aparelho para abrir.</p>
        <button className="btn" onClick={tentar} disabled={tentando}>
          {tentando ? "Aguardando..." : "Desbloquear com a digital"}
        </button>
        {falhou && <small className="auth-msg">Não foi possível confirmar. Tente de novo ou entre com a senha.</small>}
        <button
          className="link"
          onClick={() => {
            desativarBiometria(userId);
            supabase?.auth.signOut();
          }}
        >
          Entrar com e-mail e senha
        </button>
      </div>
    </div>
  );
}
