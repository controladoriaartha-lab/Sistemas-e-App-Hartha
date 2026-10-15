import { useState } from "react";
import { AREAS, minutosPorTipo, niveisCerebro, ROTULO_TIPO } from "./mente";
import type { AreaId } from "./mente";
import type { Atividade } from "./types";

const IMG = { w: 1920, h: 1200 }; // a faixa de legenda do rodape da imagem fica de fora

// Contornos de cada area sobre /cerebro.webp (coordenadas da imagem 1920x1280).
const FORMAS: Record<AreaId, [number, number][]> = {
  prefrontal: [[905, 100], [1100, 92], [1260, 140], [1450, 230], [1500, 262], [1460, 330], [1300, 350], [1150, 375], [1095, 330], [1085, 215], [1000, 135]],
  frontal: [[1150, 375], [1300, 350], [1460, 330], [1500, 262], [1620, 400], [1670, 560], [1660, 700], [1590, 770], [1470, 760], [1340, 720], [1230, 640], [1100, 600], [1110, 460]],
  motor: [[740, 120], [830, 100], [950, 130], [1090, 150], [1100, 230], [1110, 420], [1110, 560], [1100, 610], [1000, 610], [880, 540], [860, 420], [870, 300], [830, 230], [780, 160]],
  somato: [[470, 380], [540, 300], [640, 260], [760, 240], [830, 230], [870, 300], [860, 420], [880, 540], [740, 550], [600, 530], [490, 520], [440, 470]],
  parietal: [[360, 420], [420, 330], [500, 260], [600, 180], [740, 120], [790, 200], [760, 240], [640, 260], [540, 300], [470, 380], [430, 470]],
  temporal: [[540, 545], [740, 550], [830, 560], [1000, 610], [1130, 630], [1260, 670], [1340, 730], [1330, 800], [1100, 800], [900, 770], [740, 740], [640, 700], [560, 640]],
  auditivo: [[450, 880], [520, 830], [640, 790], [800, 770], [950, 790], [1100, 810], [1330, 810], [1345, 870], [1290, 930], [1150, 965], [950, 940], [760, 905], [600, 895]],
  occipital: [[290, 520], [330, 450], [380, 440], [415, 500], [480, 590], [580, 650], [600, 770], [520, 830], [450, 890], [380, 905], [300, 860], [260, 740]],
  cerebelo: [[415, 905], [500, 890], [700, 905], [860, 910], [900, 960], [880, 1060], [790, 1110], [640, 1100], [520, 1050], [430, 990]],
};

const pts = (a: [number, number][]) => a.map(([x, y]) => `${x},${y}`).join(" ");
const COR_TOPO = "#FFD36E";

export function CerebroView({ lista, meta, rotuloMeta }: { lista: Atividade[]; meta: number; rotuloMeta: string }) {
  const [foco, setFoco] = useState<AreaId | null>(null);
  const niveis = niveisCerebro(lista, meta);
  const tipos = minutosPorTipo(lista);
  const total = tipos.reduce((s, t) => s + t.min, 0);
  const ativas = AREAS.filter((a) => niveis[a.id].nivel > 0).length;
  const info = foco ? AREAS.find((a) => a.id === foco)! : null;
  const paleta = ["#6D5BF0", "#FF7AB6", "#FFD36E", "#4FD1A1", "#FF8A5B", "#5BC0F0", "#C9A8FF"];

  return (
    <div className="brain">
      <div className="brain-stage">
        <svg viewBox={`0 0 ${IMG.w} ${IMG.h}`} role="img" aria-label="Cérebro 3D com as áreas ativadas pelas atividades mentais e físicas">
          <defs>
            <filter id="br-dim" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0.12" />
              <feComponentTransfer>
                <feFuncR type="linear" slope="0.5" intercept="0" />
                <feFuncG type="linear" slope="0.5" intercept="0" />
                <feFuncB type="linear" slope="0.55" intercept="0.02" />
              </feComponentTransfer>
            </filter>
            <filter id="br-soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1280">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <filter id="br-bloom" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            {AREAS.map((a) => (
              <mask id={`br-m-${a.id}`} key={a.id} maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1280">
                <polygon points={pts(FORMAS[a.id])} fill="#fff" filter="url(#br-soft)" />
              </mask>
            ))}
          </defs>

          <image href="/cerebro.webp" width="1920" height="1280" filter="url(#br-dim)" />

          {AREAS.filter((a) => niveis[a.id].nivel > 0).map((a) => {
            const n = niveis[a.id].nivel;
            return (
              <g key={a.id}>
                {n >= 0.5 && (
                  <g filter="url(#br-bloom)" opacity={0.35 + 0.4 * n}>
                    <g mask={`url(#br-m-${a.id})`}>
                      <image href="/cerebro.webp" width="1920" height="1280" />
                    </g>
                  </g>
                )}
                <g mask={`url(#br-m-${a.id})`} opacity={0.3 + 0.7 * n}>
                  <image href="/cerebro.webp" width="1920" height="1280" />
                </g>
              </g>
            );
          })}

          {/* areas clicaveis */}
          {AREAS.map((a) => (
            <polygon
              key={a.id}
              points={pts(FORMAS[a.id])}
              fill="transparent"
              stroke={foco === a.id ? "#fff" : "none"}
              strokeWidth="5"
              strokeLinejoin="round"
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`${a.nome}: ${Math.round(niveis[a.id].nivel * 100)}%`}
              onClick={() => setFoco((f) => (f === a.id ? null : a.id))}
            />
          ))}
        </svg>

        <span className="brain-badge">
          {ativas} de {AREAS.length} áreas ativas
        </span>
        {info && (
          <div className="brain-pop" style={{ borderColor: info.cor }}>
            <b>{info.nome}</b>
            <small>{info.funcao}</small>
            <small>
              {Math.round(niveis[info.id].nivel * 100)}% da meta
              {niveis[info.id].fontes.length ? ` · ${niveis[info.id].fontes.join(", ")}` : " · sem atividade ainda"}
            </small>
          </div>
        )}
      </div>

      <div className="brain-side">
        <p className="muted brain-meta">Cada área acende conforme o preenchimento da meta do período ({rotuloMeta}). Toque numa área para ver o que a ativou.</p>
        <ul className="areas">
          {AREAS.map((a) => {
            const n = niveis[a.id];
            return (
              <li key={a.id} className={foco === a.id ? "on" : ""}>
                <button onClick={() => setFoco((f) => (f === a.id ? null : a.id))}>
                  <span className="area-name">
                    <span className="area-dot" style={{ background: a.cor, boxShadow: n.nivel > 0 ? `0 0 10px ${a.cor}` : "none", opacity: n.nivel > 0 ? 1 : 0.35 }} />
                    <span>
                      {a.nome}
                      <small>{a.funcao}</small>
                    </span>
                  </span>
                  <div className="rk-track">
                    <div className="brain-fill" style={{ width: `${Math.round(n.nivel * 100)}%`, background: `linear-gradient(90deg, #6D5BF0, ${n.nivel >= 0.75 ? COR_TOPO : a.cor})` }} />
                  </div>
                  <b>{Math.round(n.nivel * 100)}%</b>
                </button>
              </li>
            );
          })}
        </ul>

        {total > 0 && (
          <div className="mind-mix">
            <small>Onde sua mente esteve ({total} min)</small>
            <div className="mix-bar">
              {tipos.map((t, i) => (
                <span key={t.tipo} style={{ flexGrow: t.min, background: paleta[i % paleta.length] }} title={`${ROTULO_TIPO[t.tipo]}: ${t.min} min`} />
              ))}
            </div>
            <ul className="mix-leg">
              {tipos.map((t, i) => (
                <li key={t.tipo}>
                  <i style={{ background: paleta[i % paleta.length] }} />
                  {ROTULO_TIPO[t.tipo]} <b>{t.min} min</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
