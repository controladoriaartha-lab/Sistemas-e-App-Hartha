/**
 * Liga os grupos do gráfico "Grupo muscular" (Peitoral, Costas, Braços,
 * Pernas, Pesos, Flexão, Banco…) às regiões do corpo que cada um trabalha, pra
 * pintar a figura humana. É uma estimativa por palavra-chave: um exercício
 * pesa mais na região principal e menos nas que ajudam.
 */
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

type Weights = Partial<Record<RegionId, number>>;

const LEGS: Weights = { quadriceps: 1, posteriores: 1, gluteos: 0.8, panturrilha: 0.7 };

// A primeira regra que casar com o nome do grupo vence (ordem importa).
const RULES: { test: RegExp; weights: Weights }[] = [
  { test: /flexao/, weights: { peitoral: 1, triceps: 0.7, ombros: 0.5, abdomen: 0.3 } },
  { test: /banco|supino/, weights: { peitoral: 1, triceps: 0.6, ombros: 0.4 } },
  { test: /peito/, weights: { peitoral: 1, triceps: 0.35, ombros: 0.25 } },
  {
    test: /costa|dorsal|remada|puxada|barra fixa/,
    weights: { dorsais: 1, trapezio: 0.7, lombar: 0.4, biceps: 0.35 },
  },
  { test: /biceps|rosca/, weights: { biceps: 1, antebraco: 0.4 } },
  { test: /triceps/, weights: { triceps: 1 } },
  { test: /braco/, weights: { biceps: 1, triceps: 1, antebraco: 0.6 } },
  { test: /ombro|deltoide/, weights: { ombros: 1, trapezio: 0.4 } },
  { test: /perna|anterior|posterior|coxa|panturrilha|agacha|afundo|quadriceps|gluteo|leg/, weights: LEGS },
  { test: /abdom|core|prancha|\babs\b/, weights: { abdomen: 1, lombar: 0.2 } },
  { test: /halter|peso/, weights: { biceps: 0.6, triceps: 0.6, ombros: 0.6 } },
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Regiões (e pesos) trabalhadas por um grupo, ou {} se o nome não for reconhecido. */
export function weightsFor(groupName: string): Weights {
  const name = normalize(groupName);
  return RULES.find((rule) => rule.test.test(name))?.weights ?? {};
}

/**
 * Soma, por região, as sessões de cada grupo × peso, e normaliza pelo mais
 * trabalhado (1 = o mais ressaltado). Só devolve regiões com algum trabalho,
 * da mais para a menos trabalhada.
 */
export function regionRatios(
  groups: { name: string; sessions: number }[],
): { id: RegionId; label: string; ratio: number }[] {
  const totals = new Map<RegionId, number>();
  for (const group of groups) {
    for (const [id, weight] of Object.entries(weightsFor(group.name)) as [RegionId, number][]) {
      totals.set(id, (totals.get(id) ?? 0) + group.sessions * weight);
    }
  }
  const max = Math.max(0, ...totals.values());
  if (max === 0) return [];
  return [...totals.entries()]
    .map(([id, value]) => ({ id, label: REGION_LABEL[id], ratio: value / max }))
    .sort((a, b) => b.ratio - a.ratio);
}

const PALE = [207, 214, 226];
const RED = [168, 28, 32];

/** O quanto o vermelho cobre o tom claro: o menos trabalhado já aparece, o mais trabalhado é vermelho cheio. */
export function overlayOpacity(ratio: number): number {
  return 0.45 + 0.55 * ratio;
}

/** Cor (tom claro -> vermelho escuro) que representa o nível de trabalho, para legenda e chips. */
export function levelColor(ratio: number): { fill: string } {
  const a = ratio < 0 ? 0 : overlayOpacity(ratio);
  const [r, g, b] = PALE.map((p, i) => Math.round(p + (RED[i] - p) * a));
  return { fill: `rgb(${r} ${g} ${b})` };
}

/** Tom claro dos músculos que não foram trabalhados. */
export const IDLE_COLOR = `rgb(${PALE.join(" ")})`;
