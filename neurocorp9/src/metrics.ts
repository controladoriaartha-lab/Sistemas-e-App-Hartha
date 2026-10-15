import { CATEGORIAS, ROTINA_PADRAO, SUBS } from "./types";
import type { Atividade, Categoria, Rotina } from "./types";

export const META_CORPO_PTS = 60; // pontos de Força/Movimento que fecham 100% do eixo Corpo no dia

export function chaveDia(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dia = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${dia}`;
}

export function doDia(todas: Atividade[], dia: string): Atividade[] {
  return todas.filter((a) => chaveDia(a.created_at) === dia);
}

export function contagemPorCategoria(lista: Atividade[]): Record<Categoria, number> {
  const out = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<Categoria, number>;
  for (const a of lista) for (const c of a.categorias) out[c] += 1;
  return out;
}

function pctRotina(lista: Atividade[], rotina: Rotina[], cats: Categoria[]): number {
  const alvo = rotina.filter((r) => cats.includes(r.categoria));
  if (!alvo.length) return 0;
  const cont = contagemPorCategoria(lista);
  const soma = alvo.reduce((s, r) => s + Math.min(1, cont[r.categoria] / r.frequencia_diaria), 0);
  return (soma / alvo.length) * 100;
}

export interface Indice {
  corpo: number;
  mente: number;
  casa: number;
  jari: number;
}

// Indice NEUROCORP9 = 0.4 Corpo + 0.3 Mente + 0.3 Casa (PRD, secao 07)
export function calcularIndice(lista: Atividade[], rotina: Rotina[] = ROTINA_PADRAO): Indice {
  const pontosCorpo = lista
    .filter((a) => a.categorias.includes("física") || a.categorias.includes("movimento corporal"))
    .reduce((s, a) => s + a.score, 0);
  const corpo = Math.min(100, (pontosCorpo / META_CORPO_PTS) * 100);
  const mente = pctRotina(lista, rotina, ["mental", "intelectual"]);
  const casa = pctRotina(lista, rotina, ["organização", "limpeza casa"]);
  const jari = 0.4 * corpo + 0.3 * mente + 0.3 * casa;
  return { corpo: Math.round(corpo), mente: Math.round(mente), casa: Math.round(casa), jari: Math.round(jari) };
}

export interface NaoFeito {
  rotina: Rotina;
  faltam: number;
}

// NAO_FEITOS(d) = rotina ideal - categorias registradas no dia
export function naoFeitos(lista: Atividade[], rotina: Rotina[] = ROTINA_PADRAO): NaoFeito[] {
  const cont = contagemPorCategoria(lista);
  return rotina
    .map((r) => ({ rotina: r, faltam: Math.max(0, r.frequencia_diaria - cont[r.categoria]) }))
    .filter((n) => n.faltam > 0);
}

// Minutos de referencia por dimensao (12x esse valor enche o eixo).
const ALVO_MIN: Record<Categoria, number> = {
  mental: 15,
  intelectual: 40,
  física: 30,
  organização: 15,
  "limpeza casa": 20,
  "movimento corporal": 20,
};

/**
 * Preenchimento de cada dimensao em raiz quadrada: repetir o mesmo registro
 * continua somando, mas devagar, para o grafico nao estourar em 100%.
 */
export function radar(lista: Atividade[], rotina: Rotina[] = ROTINA_PADRAO) {
  const cont = contagemPorCategoria(lista);
  return rotina.map((r) => {
    const min = lista.filter((a) => a.categorias.includes(r.categoria)).reduce((s, a) => s + a.duracao_min, 0);
    const x = min / ALVO_MIN[r.categoria];
    const pct = min === 0 ? 0 : Math.max(8, Math.min(100, Math.round(100 * Math.sqrt(x / 12))));
    return { categoria: r.categoria, valor: cont[r.categoria], minutos: min, pct };
  });
}

export function porSubMovimento(lista: Atividade[]) {
  return SUBS.map((s) => ({
    nome: s,
    valor: lista.filter((a) => a.sub_movimento.includes(s)).length,
  }));
}

// Regioes do mapa corporal (ids do PRD: head, shoulders, arms, core, legs, feet)
export type ZonaId = "head" | "shoulders" | "arms" | "core" | "legs" | "feet";
export const ZONAS: ZonaId[] = ["head", "shoulders", "arms", "core", "legs", "feet"];

export function intensidadePorZona(lista: Atividade[]): Record<ZonaId, number> {
  const pts: Record<ZonaId, number> = { head: 0, shoulders: 0, arms: 0, core: 0, legs: 0, feet: 0 };
  for (const a of lista) {
    const p = a.score;
    for (const r of a.regiao_corporal) {
      if (r === "cabeca") pts.head += p;
      if (r === "bracos") {
        pts.arms += p;
        pts.shoulders += p * 0.6;
      }
      if (r === "core") pts.core += p;
      if (r === "pernas") {
        pts.legs += p;
        pts.feet += p * 0.5;
      }
      if (r === "corpo_inteiro") {
        pts.arms += p * 0.6;
        pts.shoulders += p * 0.4;
        pts.core += p * 0.6;
        pts.legs += p * 0.6;
        pts.feet += p * 0.3;
      }
    }
    if (a.categorias.includes("mental") || a.categorias.includes("intelectual")) pts.head += p * 0.5;
  }
  const max = Math.max(1, ...Object.values(pts));
  const out = { ...pts };
  for (const z of ZONAS) out[z] = pts[z] / max;
  return out;
}

export function ultimosDias(n: number): string[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - (n - 1 - i));
    return chaveDia(d);
  });
}

export function streak(todas: Atividade[]): number {
  const dias = new Set(todas.map((a) => chaveDia(a.created_at)));
  let n = 0;
  const d = new Date();
  // se hoje ainda nao tem registro, a sequencia conta a partir de ontem
  if (!dias.has(chaveDia(d))) d.setDate(d.getDate() - 1);
  while (dias.has(chaveDia(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function nudge(naoFeitosHoje: NaoFeito[]): string | null {
  const alvo = naoFeitosHoje.find((n) => n.rotina.categoria === "movimento corporal") ?? naoFeitosHoje[0];
  if (!alvo) return null;
  const dicas: Record<Categoria, string> = {
    "movimento corporal": "2 min de agachamento na pia",
    mental: "3 respirações profundas agora",
    intelectual: "10 minutos de leitura",
    "física": "uma caminhada curta",
    "organização": "anote as 3 prioridades de amanhã",
    "limpeza casa": "lave a louça do café",
  };
  return dicas[alvo.rotina.categoria];
}
