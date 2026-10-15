import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AuthPanel, NovaSenha } from "./AuthPanel";
import { classificar } from "./classifier";
import { exemploAtividades, gerarDemo } from "./demo";
import { conquistas, insights, maiorSequencia, nivel, paraCsv, xpTotal } from "./gamification";
import { calcularIndice, chaveDia, doDia, naoFeitos, nudge, porSubMovimento, radar, streak, ultimosDias } from "./metrics";
import { MuscleFigure } from "./MuscleFigure";
import { CerebroView } from "./CerebroView";
import { AREAS, minutosMentais, niveisCerebro } from "./mente";
import { auraMental, niveisMusculares, REGION_LABEL } from "./muscles";
import { useAtividades, useSessao } from "./store";
import { ROTULO_CATEGORIA } from "./types";
import type { Atividade, Categoria, Classificacao } from "./types";
import { useVoz } from "./useVoz";
import { Aneis, CalendarioCalor } from "./Visuals";

type Aba = "hoje" | "corpo" | "evolucao" | "conquistas";
type Periodo = "hoje" | "7" | "30";

const EXEMPLOS = [
  "Lavei a louça agachada, 10 minutos",
  "Meditei 10 minutos e alonguei 5 minutos",
  "Estudei 1 hora e planejei a agenda",
  "Caminhei 30 minutos",
];

const ABAS: { id: Aba; nome: string; d: string }[] = [
  { id: "hoje", nome: "Hoje", d: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" },
  { id: "corpo", nome: "Corpo", d: "M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 9h12l-2 5-1 6h-2l-1-5-1 5H9l-1-6z" },
  { id: "evolucao", nome: "Evolução", d: "M3 17l6-6 4 4 8-9M15 6h6v6" },
  { id: "conquistas", nome: "Conquistas", d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" },
];

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Cartao de vidro com leve inclinacao 3D acompanhando o ponteiro. */
function Vidro({ children, className = "", forte = false }: { children: ReactNode; className?: string; forte?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateX(${py * -4}deg) rotateY(${px * 5}deg) translateZ(0)`;
    el.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(py + 0.5) * 100}%`);
  };
  const sair = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div ref={ref} className={`glass ${forte ? "glass-strong" : ""} ${className}`} onPointerMove={mover} onPointerLeave={sair}>
      {children}
    </div>
  );
}

function TooltipEscuro({ active, payload, label, sufixo = "" }: { active?: boolean; payload?: { value: number }[]; label?: string; sufixo?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      {label && <small>{label}</small>}
      <b>
        {payload[0].value}
        {sufixo}
      </b>
    </div>
  );
}

export function App() {
  const { sessao, nuvem, recuperando, fimRecuperacao } = useSessao();
  const reais = useAtividades(sessao?.user.id ?? null);
  const erroNuvem = reais.erro;
  // Sem login (com nuvem configurada) so da para olhar: as telas mostram exemplos.
  const exemplo = nuvem && !sessao;
  const exemploLista = useMemo(() => exemploAtividades(), []);
  const lista = exemplo ? exemploLista : reais.lista;
  const [aba, setAba] = useState<Aba>("hoje");
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [desafio, setDesafio] = useState<{ cat: Categoria; nome: string; fim: number } | null>(null);
  const [restante, setRestante] = useState(0);
  const [instalar, setInstalar] = useState<Event | null>(null);
  const [ultimo, setUltimo] = useState<{ texto: string; itens: Classificacao[]; quando: number; origem: "ia" | "local" } | null>(null);

  const hojeKey = chaveDia(new Date());
  const hoje = useMemo(() => doDia(lista, hojeKey), [lista, hojeKey]);
  const indice = useMemo(() => calcularIndice(hoje), [hoje]);
  const faltantes = useMemo(() => naoFeitos(hoje), [hoje]);
  const subs = useMemo(() => porSubMovimento(hoje), [hoje]);
  const radarDados = useMemo(
    () => radar(hoje).map((r) => ({ nome: ROTULO_CATEGORIA[r.categoria], pct: r.pct })),
    [hoje],
  );
  const xp = useMemo(() => xpTotal(lista), [lista]);
  const nv = nivel(xp);
  const seq = streak(lista);
  const medalhas = useMemo(() => conquistas(lista), [lista]);
  const desbloqueadas = medalhas.filter((m) => m.atual >= m.meta);

  const ultimos7 = useMemo(() => {
    const dias = new Set(ultimosDias(7));
    return lista.filter((a) => dias.has(chaveDia(a.created_at)));
  }, [lista]);

  const periodoLista = useMemo(() => {
    if (periodo === "hoje") return hoje;
    const dias = new Set(ultimosDias(periodo === "7" ? 7 : 30));
    return lista.filter((a) => dias.has(chaveDia(a.created_at)));
  }, [periodo, hoje, lista]);
  const niveis = useMemo(() => niveisMusculares(periodoLista), [periodoLista]);
  const aura = useMemo(() => auraMental(periodoLista), [periodoLista]);

  const quatorze = useMemo(
    () =>
      ultimosDias(14).map((d) => ({
        dia: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit" }),
        jari: calcularIndice(doDia(lista, d)).jari,
      })),
    [lista],
  );
  const mente14 = useMemo(
    () =>
      ultimosDias(14).map((d) => ({
        dia: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit" }),
        min: minutosMentais(doDia(lista, d)),
      })),
    [lista],
  );
  const metaMente = periodo === "hoje" ? 60 : periodo === "7" ? 300 : 1000;
  const porHora = useMemo(() => {
    const h = Array.from({ length: 18 }, (_, i) => ({ h: `${String(i + 6).padStart(2, "0")}h`, min: 0 }));
    for (const a of ultimos7) {
      const i = new Date(a.created_at).getHours() - 6;
      if (i >= 0 && i < 18) h[i].min += a.duracao_min;
    }
    return h;
  }, [ultimos7]);

  const avisar = useCallback((m: string) => {
    setAviso(m);
    window.setTimeout(() => setAviso(null), 3000);
  }, []);

  const pedirLogin = useCallback(() => {
    avisar("Entre ou crie sua conta para registrar.");
    window.dispatchEvent(new Event("neurocorp9:login"));
  }, [avisar]);

  const adicionar = useCallback(
    (...args: Parameters<typeof reais.adicionar>) => (exemplo ? pedirLogin() : reais.adicionar(...args)),
    [exemplo, pedirLogin, reais.adicionar],
  );
  const remover = useCallback((id: string) => (exemplo ? pedirLogin() : reais.remover(id)), [exemplo, pedirLogin, reais.remover]);
  const atualizar = useCallback(
    (...args: Parameters<typeof reais.atualizar>) => (exemplo ? pedirLogin() : reais.atualizar(...args)),
    [exemplo, pedirLogin, reais.atualizar],
  );
  const limpar = useCallback(() => (exemplo ? pedirLogin() : reais.limpar()), [exemplo, pedirLogin, reais.limpar]);

  // aviso de conquista nova
  const vistas = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(desbloqueadas.map((m) => m.id));
    if (vistas.current) {
      const nova = desbloqueadas.find((m) => !vistas.current!.has(m.id));
      if (nova) avisar(`Conquista desbloqueada: ${nova.titulo}`);
    }
    vistas.current = ids;
  }, [desbloqueadas, avisar]);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstalar(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  useEffect(() => {
    if (!desafio) return;
    const t = window.setInterval(() => {
      const r = Math.max(0, Math.ceil((desafio.fim - Date.now()) / 1000));
      setRestante(r);
      if (r === 0) {
        window.clearInterval(t);
        const item: Classificacao = {
          texto_original: `Desafio relâmpago: ${desafio.nome}`,
          atividade: desafio.nome.toLowerCase(),
          categorias: [desafio.cat],
          sub_movimento: desafio.cat === "movimento corporal" ? ["abaixar"] : [],
          duracao_min: 2,
          regiao_corporal: desafio.cat === "mental" || desafio.cat === "intelectual" ? ["cabeca"] : ["corpo_inteiro"],
          intensidade: 3,
          score: 3,
        };
        adicionar([item]);
        setDesafio(null);
        avisar("Desafio concluído! +3 de XP");
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [desafio, adicionar, avisar]);

  const registrar = useCallback(
    async (t: string) => {
      if (exemplo) return pedirLogin();
      const limpo = t.trim();
      if (limpo.length < 3) return;
      setProcessando(true);
      const { itens, origem } = await classificar(limpo);
      adicionar(itens);
      setUltimo({ texto: limpo, itens, quando: Date.now(), origem });
      setProcessando(false);
      setTexto("");
      avisar(`${itens.length} atividade${itens.length > 1 ? "s" : ""} classificada${itens.length > 1 ? "s" : ""} (${origem === "ia" ? "IA" : "local"})`);
    },
    [adicionar, avisar, exemplo, pedirLogin],
  );

  const voz = useVoz(registrar);
  const iniciarVoz = () => (exemplo ? pedirLogin() : voz.iniciar());

  const carregarDemo = () => {
    gerarDemo().forEach((d) => adicionar(d.itens, d.quando));
    avisar("Histórico de exemplo carregado");
  };

  const exportar = () => {
    const blob = new Blob(["﻿" + paraCsv(lista)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `neurocorp9-${hojeKey}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fazerAgora = (cat: Categoria, atividade: string) => {
    adicionar([
      {
        texto_original: atividade,
        atividade,
        categorias: [cat],
        sub_movimento: cat === "movimento corporal" ? ["abaixar"] : [],
        duracao_min: 5,
        regiao_corporal: cat === "mental" || cat === "intelectual" ? ["cabeca"] : ["corpo_inteiro"],
        intensidade: 2,
        score: 5,
      },
    ]);
    avisar("Registrado");
  };

  const ultimoItem = lista.length ? lista[lista.length - 1] : null;
  const ultimoMostrar = ultimo
    ? ultimo
    : ultimoItem
      ? { texto: ultimoItem.texto_original, itens: [ultimoItem] as Classificacao[], quando: Date.parse(ultimoItem.created_at), origem: "local" as const }
      : null;
  const ultimoAtivou = ultimoMostrar
    ? ultimoMostrar.itens.map((c) => {
        const a: Atividade = { ...c, id: "u", created_at: new Date(ultimoMostrar.quando).toISOString() };
        const cerebro = AREAS.map((ar) => ({ ar, n: niveisCerebro([a], 30)[ar.id].nivel }))
          .filter((x) => x.n > 0.15)
          .sort((x, y) => y.n - x.n)
          .slice(0, 3);
        const musc = Object.entries(niveisMusculares([a]))
          .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))
          .slice(0, 3)
          .map(([id]) => REGION_LABEL[id as keyof typeof REGION_LABEL]);
        return { c, cerebro, musc };
      })
    : [];

  const dica = nudge(faltantes);
  const proximoDesafio = faltantes[0];
  const status = indice.jari >= 70 ? "Em fluxo" : indice.jari >= 40 ? "Pegando ritmo" : "Vamos começar";
  const vazio = lista.length === 0;
  const textosInsight = insights(hoje, ultimos7);

  return (
    <div className="app">
      <div className="aurora" aria-hidden />
      {recuperando && <NovaSenha aoConcluir={fimRecuperacao} />}

      <header className="top">
        <div className="brand">
          <img className="logo-img" src="/logo.png" alt="" width={46} height={46} />
          <div>
            <h1>NEUROCORP9</h1>
            <small>Diário corporal por voz</small>
          </div>
        </div>
        <div className="top-r">
          {instalar && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                const ev = instalar as Event & { prompt: () => Promise<void> };
                await ev.prompt();
                setInstalar(null);
              }}
            >
              Instalar app
            </button>
          )}
          <AuthPanel sessao={sessao} />
        </div>
      </header>

      <nav className="tabs" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.id} className={aba === a.id ? "on" : ""} onClick={() => setAba(a.id)} aria-current={aba === a.id}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={a.d} />
            </svg>
            <span>{a.nome}</span>
          </button>
        ))}
      </nav>

      {erroNuvem && <p className="erro">Erro na nuvem: {erroNuvem}</p>}

      {exemplo && (
        <div className="demo-banner" role="status">
          <div>
            <b>Você está vendo um exemplo.</b>
            <span>Explore as telas. Para registrar por voz ou digitando, entre ou crie sua conta.</span>
          </div>
          <button className="btn btn-sm" onClick={() => window.dispatchEvent(new Event("neurocorp9:login"))}>
            Entrar ou criar conta
          </button>
        </div>
      )}

      <main className="page" key={aba}>
        {aba === "hoje" && (
          <>
            <section className="hero">
              <div className="hero-txt">
                <small className="eyebrow">
                  {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                </small>
                <h2>
                  {saudacao()}. <span>{status}.</span>
                </h2>
                <p>
                  {hoje.length === 0
                    ? "Fale ou digite o que você fez. O NEUROCORP9 mostra onde seu corpo e sua mente estiveram hoje."
                    : `${hoje.length} registro${hoje.length > 1 ? "s" : ""} hoje. ${faltantes.length ? `Faltam ${faltantes.length} itens da rotina ideal.` : "Rotina ideal completa."}`}
                </p>
                <div className="pills">
                  <span className="pill">
                    <b>{seq}</b> dia{seq === 1 ? "" : "s"} seguidos
                  </span>
                  <span className="pill">
                    Nível {nv.indice} · {nv.nome}
                  </span>
                  <span className="pill">
                    <b>{xp}</b> XP
                  </span>
                </div>
                {vazio && !sessao && !nuvem && (
                  <button className="btn btn-ghost" onClick={carregarDemo}>
                    Ver com dados de exemplo
                  </button>
                )}
              </div>
              <Vidro forte className="hero-rings">
                <Aneis corpo={indice.corpo} mente={indice.mente} casa={indice.casa} jari={indice.jari} />
              </Vidro>
            </section>

            <div className="cols">
              <Vidro className="capture">
                <h3>Registro por voz</h3>
                <div className="mic-wrap">
                  <button
                    className={`orb ${voz.estado === "ouvindo" ? "orb-on" : ""}`}
                    onClick={voz.estado === "ouvindo" ? voz.parar : iniciarVoz}
                    disabled={processando}
                    aria-label={voz.estado === "ouvindo" ? "Parar gravação" : "Começar a falar"}
                  >
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="9" y="3" width="6" height="12" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </button>
                </div>
                <p className="mic-state">
                  {voz.estado === "ouvindo" ? "Ouvindo..." : processando ? "Classificando..." : voz.suportado ? "Toque e fale o que fez" : "Voz indisponível aqui, digite abaixo"}
                </p>
                {voz.parcial && <p className="parcial">"{voz.parcial}"</p>}
                {voz.erro && <p className="erro">{voz.erro}</p>}
                <div className="row">
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && registrar(texto)}
                    placeholder={exemplo ? "Entre na sua conta para registrar" : "Ou digite: lavei a louça agachada, 10 min"}
                    aria-label="Descreva a atividade"
                  />
                  <button className="btn" onClick={() => registrar(texto)} disabled={processando}>
                    Registrar
                  </button>
                </div>
                <div className="chips">
                  {EXEMPLOS.map((e) => (
                    <button key={e} className="chip" onClick={() => registrar(e)}>
                      {e}
                    </button>
                  ))}
                </div>
                {ultimoMostrar && (
                  <div className="last" role="status">
                    <div className="last-head">
                      <span className="last-dot" />
                      <b>Último registro</b>
                      <small>
                        {new Date(ultimoMostrar.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </small>
                    </div>
                    <p className="last-text">
                      <mark>{ultimoMostrar.texto}</mark>
                    </p>
                    {ultimoAtivou.map(({ c, cerebro, musc }, i) => (
                      <div className="last-item" key={i}>
                        <div className="last-main">
                          <b>{c.atividade}</b>
                          <small>
                            {c.categorias.map((x) => ROTULO_CATEGORIA[x]).join(" · ")} · {c.duracao_min} min · {c.score} XP
                          </small>
                        </div>
                        <div className="last-pins">
                          {cerebro.map(({ ar }) => (
                            <span key={ar.id} className="pin">
                              <i style={{ background: ar.cor, boxShadow: `0 0 8px ${ar.cor}` }} />
                              {ar.nome}
                            </span>
                          ))}
                          {musc.map((m) => (
                            <span key={m} className="pin pin-body">
                              <i />
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button className="link" onClick={() => setAba("corpo")}>
                      Ver no cérebro e no corpo
                    </button>
                  </div>
                )}
              </Vidro>

              <div className="stack">
                <Vidro>
                  <div className="head">
                    <h3>Desafio relâmpago</h3>
                    <span className="tag">2 min</span>
                  </div>
                  {desafio ? (
                    <div className="challenge">
                      <div className="countdown">
                        <svg viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="44" className="cd-bg" />
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            className="cd-fg"
                            strokeDasharray={`${(restante / 120) * 276} 276`}
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <b>
                          {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")}
                        </b>
                      </div>
                      <div>
                        <b>{desafio.nome}</b>
                        <small>Termine o tempo para ganhar XP.</small>
                        <button className="link" onClick={() => setDesafio(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : proximoDesafio ? (
                    <div className="challenge">
                      <div>
                        <b>{dica ? dica.charAt(0).toUpperCase() + dica.slice(1) : proximoDesafio.rotina.atividade_ideal}</b>
                        <small>Um passo curto para fechar o dia: {ROTULO_CATEGORIA[proximoDesafio.rotina.categoria]}.</small>
                      </div>
                      <button
                        className="btn"
                        onClick={() => {
                          if (exemplo) return pedirLogin();
                          setRestante(120);
                          setDesafio({
                            cat: proximoDesafio.rotina.categoria,
                            nome: dica ?? proximoDesafio.rotina.atividade_ideal,
                            fim: Date.now() + 120000,
                          });
                        }}
                      >
                        Começar
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Rotina completa por hoje. Nada a desafiar.</p>
                  )}
                </Vidro>

                <Vidro className="todo-card">
                  <div className="head">
                    <h3>O que ainda não foi feito</h3>
                    <span className="tag">{faltantes.length}</span>
                  </div>
                  {faltantes.length === 0 ? (
                    <p className="muted">Tudo em fluxo. Você cobriu a rotina ideal de hoje.</p>
                  ) : (
                    <ul className="todo">
                      {faltantes.map((f) => (
                        <li key={f.rotina.categoria}>
                          <div>
                            <b>{f.rotina.atividade_ideal}</b>
                            <small>
                              {ROTULO_CATEGORIA[f.rotina.categoria]} · falta{f.faltam > 1 ? `m ${f.faltam}` : " 1"}
                            </small>
                          </div>
                          <button className="btn btn-sm" onClick={() => fazerAgora(f.rotina.categoria, f.rotina.atividade_ideal)}>
                            Fazer agora
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Vidro>
              </div>
            </div>

            <Vidro>
              <div className="head">
                <h3>Linha do dia</h3>
                {lista.length > 0 && !exemplo && (
                  <button className="link" onClick={() => window.confirm("Apagar todos os registros?") && limpar()}>
                    Limpar tudo
                  </button>
                )}
              </div>
              {hoje.length === 0 ? (
                <p className="muted">Nada registrado ainda. Seu primeiro registro acende o mapa corporal.</p>
              ) : (
                <ul className="log">
                  {hoje
                    .slice()
                    .reverse()
                    .map((a) => (
                      <li key={a.id}>
                        <span className="hora">{hora(a.created_at)}</span>
                        <div className="log-main">
                          <b>{a.atividade}</b>
                          <small>
                            {a.categorias.map((c) => ROTULO_CATEGORIA[c]).join(" · ")} · {a.duracao_min} min · {a.score} XP
                          </small>
                        </div>
                        <label className="inten" title="Intensidade">
                          <input
                            type="range"
                            min={1}
                            max={5}
                            value={a.intensidade}
                            onChange={(e) => atualizar(a.id, { intensidade: Number(e.target.value) })}
                            aria-label={`Intensidade de ${a.atividade}`}
                          />
                          <span>{a.intensidade}</span>
                        </label>
                        <button className="x" onClick={() => remover(a.id)} aria-label={`Remover ${a.atividade}`}>
                          ×
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </Vidro>
          </>
        )}

        {aba === "corpo" && (
          <>
            <div className="seg seg-wide" role="tablist" aria-label="Período">
              {(
                [
                  ["hoje", "Hoje"],
                  ["7", "7 dias"],
                  ["30", "30 dias"],
                ] as [Periodo, string][]
              ).map(([id, nome]) => (
                <button key={id} role="tab" aria-selected={periodo === id} className={periodo === id ? "on" : ""} onClick={() => setPeriodo(id)}>
                  {nome}
                </button>
              ))}
            </div>
            <div className="cols cols-body">
              <Vidro forte>
                <div className="head">
                  <h3>Músculos trabalhados</h3>
                  <span className="tag">{periodoLista.length} registros</span>
                </div>
                <MuscleFigure levels={niveis} aura={aura} />
              </Vidro>
              <div className="stack">
                <Vidro>
                  <h3>Movimentos de hoje</h3>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subs} margin={{ left: -22, right: 6, top: 14 }}>
                        <defs>
                          <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#FFD36E" />
                            <stop offset="1" stopColor="#F0805A" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "#9AA39E" }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9AA39E" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<TooltipEscuro sufixo="x" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="valor" fill="url(#gSub)" radius={[10, 10, 4, 4]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Vidro>
                <Vidro>
                  <h3>Equilíbrio das 6 dimensões</h3>
                  <div className="chart chart-radar">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarDados} outerRadius="72%">
                        <defs>
                          <linearGradient id="gRadar" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#4FD1A1" stopOpacity={0.85} />
                            <stop offset="1" stopColor="#8B7CF6" stopOpacity={0.55} />
                          </linearGradient>
                        </defs>
                        <PolarGrid stroke="rgba(255,255,255,0.12)" />
                        <PolarAngleAxis dataKey="nome" tick={{ fontSize: 11, fill: "#C9D1CC" }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="pct" stroke="#4FD1A1" strokeWidth={2} fill="url(#gRadar)" fillOpacity={1} />
                        <Tooltip content={<TooltipEscuro sufixo="% da rotina" />} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Vidro>
              </div>
            </div>

            <Vidro forte className="mind-card">
              <div className="head">
                <div>
                  <h3>Cérebro em ação</h3>
                  <small>Estudo, meditação, leitura, escrita, jogos e escuta acendem cada área</small>
                </div>
                <span className="tag">{minutosMentais(periodoLista)} min</span>
              </div>
              <CerebroView
                lista={periodoLista}
                meta={metaMente}
                rotuloMeta={periodo === "hoje" ? "1 h no dia" : periodo === "7" ? "5 h na semana" : "17 h no mês"}
              />
              <div className="mind-evo">
                <h4>Evolução da mente · 14 dias</h4>
                <div className="chart chart-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mente14} margin={{ left: -22, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="gMente" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#A78BFA" stopOpacity={0.7} />
                          <stop offset="1" stopColor="#A78BFA" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9AA39E" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9AA39E" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<TooltipEscuro sufixo=" min" />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
                      <Area type="monotone" dataKey="min" stroke="#A78BFA" strokeWidth={2.5} fill="url(#gMente)" dot={{ r: 2.5, fill: "#0E1412", stroke: "#A78BFA", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Vidro>
          </>
        )}

        {aba === "evolucao" && (
          <>
            <div className="kpis">
              {[
                ["Índice de hoje", indice.jari, ""],
                ["Média 14 dias", Math.round(quatorze.reduce((s, d) => s + d.jari, 0) / 14), ""],
                ["Maior sequência", maiorSequencia(lista), " dias"],
                ["Minutos na semana", ultimos7.reduce((s, a) => s + a.duracao_min, 0), ""],
              ].map(([nome, v, suf]) => (
                <Vidro key={String(nome)} className="kpi">
                  <small>{nome}</small>
                  <strong>
                    {v}
                    <em>{suf}</em>
                  </strong>
                </Vidro>
              ))}
            </div>

            <Vidro>
              <div className="head">
                <h3>Índice NEUROCORP9 · últimos 14 dias</h3>
              </div>
              <div className="chart chart-lg">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={quatorze} margin={{ left: -18, right: 8, top: 10 }}>
                    <defs>
                      <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#4FD1A1" stopOpacity={0.55} />
                        <stop offset="1" stopColor="#4FD1A1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#9AA39E" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9AA39E" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipEscuro />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
                    <Area type="monotone" dataKey="jari" stroke="#4FD1A1" strokeWidth={3} fill="url(#gArea)" dot={{ r: 3, fill: "#0E1412", stroke: "#4FD1A1", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Vidro>

            <div className="cols">
              <Vidro>
                <h3>Quando você se move</h3>
                <small className="sub">Minutos por hora, últimos 7 dias</small>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porHora} margin={{ left: -22, right: 6, top: 10 }}>
                      <defs>
                        <linearGradient id="gHora" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#A78BFA" />
                          <stop offset="1" stopColor="#6D5BF0" />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="h" tick={{ fontSize: 10, fill: "#9AA39E" }} axisLine={false} tickLine={false} interval={2} />
                      <YAxis tick={{ fontSize: 11, fill: "#9AA39E" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<TooltipEscuro sufixo=" min" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="min" fill="url(#gHora)" radius={[6, 6, 2, 2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Vidro>
              <Vidro>
                <h3>Constância · 12 semanas</h3>
                <small className="sub">Cada quadrado é um dia; mais claro, mais equilíbrio</small>
                <CalendarioCalor lista={lista} />
                <div className="cal-leg">
                  <span>menos</span>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <i key={n} className={`cal-d n${n}`} />
                  ))}
                  <span>mais</span>
                </div>
              </Vidro>
            </div>

            <Vidro>
              <h3>O que o NEUROCORP9 percebeu</h3>
              <ul className="insights">
                {textosInsight.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Vidro>
          </>
        )}

        {aba === "conquistas" && (
          <>
            <Vidro forte className="level">
              <div>
                <small className="eyebrow">Seu nível</small>
                <h2>
                  {nv.indice}. {nv.nome}
                </h2>
                <p>{nv.proximo ? `Faltam ${nv.faltam} XP para ${nv.proximo}.` : "Nível máximo alcançado."}</p>
              </div>
              <div className="xpbar">
                <div style={{ width: `${nv.pct}%` }} />
                <span>{xp} XP</span>
              </div>
            </Vidro>

            <div className="medals">
              {medalhas.map((m) => {
                const ok = m.atual >= m.meta;
                return (
                  <Vidro key={m.id} className={`medal ${ok ? "ok" : ""}`}>
                    <div className="seal">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {ok ? <path d="M5 13l4 4L19 7" /> : <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />}
                      </svg>
                    </div>
                    <b>{m.titulo}</b>
                    <small>{m.descricao}</small>
                    <div className="mini-track">
                      <div style={{ width: `${Math.min(100, (m.atual / m.meta) * 100)}%` }} />
                    </div>
                  </Vidro>
                );
              })}
            </div>

            <Vidro>
              <h3>Seus dados</h3>
              <p className="muted">
                {sessao ? "Sincronizados na sua conta." : nuvem ? "Neste aparelho. Entre para sincronizar entre dispositivos." : "Guardados neste aparelho."} Nenhum áudio é salvo, só o texto.
              </p>
              <div className="row-btns">
                <button className="btn btn-ghost" onClick={exportar} disabled={vazio || exemplo}>
                  Exportar CSV
                </button>
                {!sessao && !nuvem && (
                  <button className="btn btn-ghost" onClick={carregarDemo}>
                    Carregar dados de exemplo
                  </button>
                )}
              </div>
            </Vidro>
          </>
        )}
      </main>

      <button
        className={`fab ${voz.estado === "ouvindo" ? "fab-on" : ""}`}
        onClick={voz.estado === "ouvindo" ? voz.parar : iniciarVoz}
        aria-label={voz.estado === "ouvindo" ? "Parar gravação" : "Registrar por voz"}
        disabled={processando}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>

      {aviso && (
        <div className="toast" role="status">
          {aviso}
        </div>
      )}
    </div>
  );
}
