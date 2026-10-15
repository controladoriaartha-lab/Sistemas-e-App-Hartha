import type { Atividade, Regiao, Sub } from "./types";

export type RegionId =
  | "ombros"
  | "peitoral"
  | "biceps"
  | "triceps"
  | "antebraco"
  | "abdomen"
  | "quadriceps"
  | "gluteos"
  | "posteriores"
  | "panturrilha"
  | "trapezio"
  | "dorsais"
  | "lombar";

export const REGION_LABEL: Record<RegionId, string> = {
  ombros: "Ombros",
  peitoral: "Peitoral",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebraco: "Antebraço",
  abdomen: "Abdômen",
  quadriceps: "Quadríceps",
  gluteos: "Glúteos",
  posteriores: "Posteriores de coxa",
  panturrilha: "Panturrilha",
  trapezio: "Trapézio",
  dorsais: "Dorsais",
  lombar: "Lombar",
};

type Pesos = Partial<Record<RegionId, number>>;

// O que cada região falada ativa (peso 0-1 por músculo).
const POR_REGIAO: Record<Regiao, Pesos> = {
  cabeca: {},
  bracos: { ombros: 0.7, biceps: 0.8, triceps: 0.8, antebraco: 0.6 },
  core: { abdomen: 1, lombar: 0.6 },
  pernas: { quadriceps: 1, gluteos: 0.7, posteriores: 0.6, panturrilha: 0.5 },
  corpo_inteiro: {
    ombros: 0.4, peitoral: 0.4, biceps: 0.3, triceps: 0.3, abdomen: 0.5, lombar: 0.3,
    quadriceps: 0.5, gluteos: 0.4, dorsais: 0.4, trapezio: 0.3,
  },
};

// O que cada tipo de movimento refina.
const POR_SUB: Record<Sub, Pesos> = {
  força: { peitoral: 0.5, dorsais: 0.5, ombros: 0.4, abdomen: 0.3 },
  abaixar: { quadriceps: 0.9, gluteos: 0.9, lombar: 0.6, posteriores: 0.5 },
  equilíbrio: { panturrilha: 0.7, abdomen: 0.5, gluteos: 0.4 },
  empurrar: { peitoral: 0.9, triceps: 0.8, ombros: 0.7 },
  puxar: { dorsais: 0.9, biceps: 0.8, trapezio: 0.7, antebraco: 0.5 },
  torção: { abdomen: 0.8, lombar: 0.7, dorsais: 0.3 },
  caminhar: { quadriceps: 0.6, panturrilha: 0.8, gluteos: 0.5 },
};

/** Nivel 0-1 de cada musculo trabalhado, normalizado pelo mais trabalhado do periodo. */
export function niveisMusculares(lista: Atividade[]): Partial<Record<RegionId, number>> {
  const soma: Pesos = {};
  const somar = (p: Pesos, k: number) => {
    for (const [id, w] of Object.entries(p) as [RegionId, number][]) {
      soma[id] = (soma[id] ?? 0) + w * k;
    }
  };
  for (const a of lista) {
    const base = a.score; // (duracao x intensidade) / 2
    const regioes = a.regiao_corporal.length ? a.regiao_corporal : [];
    for (const r of regioes) somar(POR_REGIAO[r] ?? {}, base);
    for (const s of a.sub_movimento) somar(POR_SUB[s] ?? {}, base * 0.7);
  }
  const max = Math.max(0, ...Object.values(soma));
  if (max === 0) return {};
  const out: Partial<Record<RegionId, number>> = {};
  for (const [id, v] of Object.entries(soma) as [RegionId, number][]) {
    if (v > 0) out[id] = v / max;
  }
  return out;
}

/** Quanto a mente (cabeca) foi usada, 0-1, para o halo sobre a figura. */
export function auraMental(lista: Atividade[]): number {
  const pts = lista
    .filter((a) => a.categorias.includes("mental") || a.categorias.includes("intelectual"))
    .reduce((s, a) => s + a.score, 0);
  return Math.min(1, pts / 60);
}
