import { useEffect, useState } from "react";
import { calcularIndice, doDia } from "./metrics";
import type { Atividade } from "./types";

export function useContagem(alvo: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const ini = performance.now();
    const de = v;
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - ini) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(de + (alvo - de) * e));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, ms]);
  return v;
}

interface Anel {
  nome: string;
  valor: number;
  cor: [string, string];
}

const R = [92, 72, 52];

/** Tres aneis concentricos (Corpo, Mente, Casa) com brilho e numero central. */
export function Aneis({ corpo, mente, casa, jari }: { corpo: number; mente: number; casa: number; jari: number }) {
  const aneis: Anel[] = [
    { nome: "Corpo", valor: corpo, cor: ["#FF8A5B", "#FF4D6D"] },
    { nome: "Mente", valor: mente, cor: ["#A78BFA", "#6D5BF0"] },
    { nome: "Casa", valor: casa, cor: ["#FFD36E", "#F0A93A"] },
  ];
  const n = useContagem(jari);
  return (
    <div className="rings">
      <svg viewBox="0 0 220 220" role="img" aria-label={`Índice NEUROCORP9 ${jari}. Corpo ${corpo}%, Mente ${mente}%, Casa ${casa}%`}>
        <defs>
          {aneis.map((a, i) => (
            <linearGradient id={`ring-g${i}`} key={a.nome} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={a.cor[0]} />
              <stop offset="1" stopColor={a.cor[1]} />
            </linearGradient>
          ))}
          <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {aneis.map((a, i) => {
          const c = 2 * Math.PI * R[i];
          const pct = Math.max(0.015, Math.min(1, a.valor / 100));
          return (
            <g key={a.nome} transform="rotate(-90 110 110)">
              <circle cx="110" cy="110" r={R[i]} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
              <circle
                cx="110"
                cy="110"
                r={R[i]}
                fill="none"
                stroke={`url(#ring-g${i})`}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${c * pct} ${c}`}
                filter="url(#ring-glow)"
                style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)" }}
              />
            </g>
          );
        })}
      </svg>
      <div className="rings-center">
        <strong>{n}</strong>
        <small>Índice geral</small>
      </div>
      <ul className="rings-legend">
        {aneis.map((a) => (
          <li key={a.nome}>
            <i style={{ background: `linear-gradient(135deg, ${a.cor[0]}, ${a.cor[1]})` }} />
            <span>{a.nome}</span>
            <b>{a.valor}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Calendario de 12 semanas colorido pelo Indice NEUROCORP9 de cada dia. */
export function CalendarioCalor({ lista, semanas = 12 }: { lista: Atividade[]; semanas?: number }) {
  const hoje = new Date();
  const dow = hoje.getDay(); // 0 = domingo
  const dias: { key: string; jari: number | null; label: string; futuro: boolean }[] = [];
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - dow - (semanas - 1) * 7);
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const futuro = d > hoje;
    const l = futuro ? [] : doDia(lista, key);
    dias.push({
      key,
      jari: l.length ? calcularIndice(l).jari : null,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      futuro,
    });
  }
  const nivel = (j: number | null) => (j === null ? 0 : j < 25 ? 1 : j < 50 ? 2 : j < 75 ? 3 : 4);
  return (
    <div className="cal" aria-label="Calendário de constância">
      {dias.map((d) => (
        <div
          key={d.key}
          className={`cal-d n${nivel(d.jari)} ${d.futuro ? "fut" : ""}`}
          title={d.futuro ? d.label : `${d.label}: ${d.jari === null ? "sem registro" : `NEUROCORP9 ${d.jari}`}`}
        />
      ))}
    </div>
  );
}
