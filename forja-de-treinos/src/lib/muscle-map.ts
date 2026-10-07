import { workoutCategories } from "./stats";
import type { Workout } from "./types";

/**
 * Liga tudo o que cada treino registra (grupos do gráfico "Grupo muscular",
 * foco do dia, core, cardio e notas) às regiões do corpo que cada coisa
 * trabalha, pra pintar a figura humana. É uma estimativa por palavra-chave:
 * um exercício pesa mais na região principal e menos nas que ajudam.
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
  {
    test: /perna|anterior|posterior|coxa|panturrilha|agacha|afundo|quadriceps|gluteo|leg/,
    weights: LEGS,
  },
  { test: /abdom|core|prancha|\babs\b/, weights: { abdomen: 1, lombar: 0.2 } },
  { test: /halter|peso/, weights: { biceps: 0.6, triceps: 0.6, ombros: 0.6 } },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Regiões (e pesos) trabalhadas por um grupo, ou {} se o nome não for reconhecido. */
export function weightsFor(groupName: string): Weights {
  const name = normalize(groupName);
  return RULES.find((rule) => rule.test.test(name))?.weights ?? {};
}

// Cardio: o que cada tipo trabalha (a primeira regra que casar vence).
const CARDIO_RULES: { test: RegExp; weights: Weights }[] = [
  {
    test: /bike|bicicleta|spinning|ciclis/,
    weights: { quadriceps: 1, posteriores: 0.6, gluteos: 0.6, panturrilha: 0.6 },
  },
  {
    test: /escada|stair|step/,
    weights: { quadriceps: 0.9, gluteos: 0.9, panturrilha: 0.7, posteriores: 0.6 },
  },
  {
    test: /corrida|correr|esteira|run|trote/,
    weights: { quadriceps: 0.8, posteriores: 0.8, gluteos: 0.7, panturrilha: 0.9 },
  },
  {
    test: /caminhada|andar|walk/,
    weights: { quadriceps: 0.6, posteriores: 0.6, gluteos: 0.5, panturrilha: 0.7 },
  },
  {
    test: /eliptico|transport/,
    weights: {
      quadriceps: 0.7,
      gluteos: 0.6,
      posteriores: 0.5,
      panturrilha: 0.5,
      biceps: 0.3,
      triceps: 0.3,
    },
  },
  {
    test: /remo|remada|canoa/,
    weights: { dorsais: 0.8, biceps: 0.5, trapezio: 0.4, quadriceps: 0.4, posteriores: 0.3 },
  },
  {
    test: /natacao|nado|piscina|hidro/,
    weights: { ombros: 0.7, dorsais: 0.7, peitoral: 0.5, triceps: 0.4, abdomen: 0.3 },
  },
  { test: /pular|corda|jump|salto/, weights: { panturrilha: 0.9, quadriceps: 0.6, ombros: 0.3 } },
];
const CARDIO_DEFAULT: Weights = {
  quadriceps: 0.5,
  posteriores: 0.4,
  gluteos: 0.4,
  panturrilha: 0.5,
};

// Core: abdominal é o padrão; alguns exercícios puxam também a lombar.
const CORE_RULES: { test: RegExp; weights: Weights }[] = [
  { test: /lombar|hiperextens|superman/, weights: { lombar: 1, gluteos: 0.3 } },
  { test: /prancha|plank/, weights: { abdomen: 1, lombar: 0.4, ombros: 0.3 } },
  { test: /agacha/, weights: LEGS },
];
const CORE_DEFAULT: Weights = { abdomen: 1, lombar: 0.2 };

// Foco do treino (campo "Foco"): indica o dia mesmo sem grupos digitados.
const FOCUS_WEIGHTS: Record<string, Weights> = {
  pernas: Object.fromEntries(Object.entries(LEGS).map(([id, w]) => [id, (w as number) * 0.8])),
  bracos: { biceps: 0.8, triceps: 0.8, antebraco: 0.5, ombros: 0.35 },
};

type Signal = { weights: Weights; scale: number };

/** Regiões que o texto livre das notas cita (sem as regras genéricas "peso"/"halter", que dão falso positivo). */
function weightsInText(text: string): Signal[] {
  const normalized = normalize(text);
  if (!normalized) return [];
  return RULES.slice(0, -1)
    .filter((rule) => rule.test.test(normalized))
    .map((rule) => ({ weights: rule.weights, scale: 0.5 }));
}

function ruleWeights(rules: { test: RegExp; weights: Weights }[], text: string, fallback: Weights) {
  const name = normalize(text);
  return rules.find((rule) => rule.test.test(name))?.weights ?? fallback;
}

/** Tudo o que um treino diz sobre músculos trabalhados, cada coisa com seu peso (0–1). */
function workoutSignals(w: Workout): Signal[] {
  const signals: Signal[] = workoutCategories(w).map((name) => ({
    weights: weightsFor(name),
    scale: 1,
  }));

  const focus = FOCUS_WEIGHTS[w.focus];
  if (focus) signals.push({ weights: focus, scale: 1 });

  for (const row of w.core.filter((r) => r.exercise.trim())) {
    // 3 séries de 12 (36 repetições) já contam como um treino de core cheio.
    const volume = Math.min(1, (row.sets * row.reps || 12) / 36);
    signals.push({
      weights: ruleWeights(CORE_RULES, row.exercise, CORE_DEFAULT),
      scale: 0.9 * (0.5 + 0.5 * volume),
    });
  }

  for (const row of w.cardio.filter((r) => r.kind.trim())) {
    // 30 minutos de cardio já contam como cheio, e cardio pesa menos que musculação.
    const volume = Math.min(1, (row.minutes || 15) / 30);
    signals.push({
      weights: ruleWeights(CARDIO_RULES, row.kind, CARDIO_DEFAULT),
      scale: 0.7 * volume,
    });
  }

  signals.push(...weightsInText(w.notes));
  return signals;
}

/**
 * Para cada treino, junta os sinais (grupos, foco, core, cardio, notas) sem
 * contar duas vezes: dois sinais na mesma região se reforçam, mas nunca passam
 * de 1 por treino. Soma os treinos e normaliza pelo mais trabalhado (1 = o
 * mais ressaltado). Só devolve regiões com algum trabalho, da mais para a
 * menos trabalhada.
 */
export function regionRatios(
  workouts: Workout[],
): { id: RegionId; label: string; ratio: number }[] {
  const totals = new Map<RegionId, number>();
  for (const w of workouts) {
    const untouched = new Map<RegionId, number>();
    for (const { weights, scale } of workoutSignals(w)) {
      for (const [id, weight] of Object.entries(weights) as [RegionId, number][]) {
        const miss = untouched.get(id) ?? 1;
        untouched.set(id, miss * (1 - Math.min(1, weight * scale)));
      }
    }
    for (const [id, miss] of untouched) totals.set(id, (totals.get(id) ?? 0) + (1 - miss));
  }
  const max = Math.max(0, ...totals.values());
  if (max === 0) return [];
  return [...totals.entries()]
    .filter(([, value]) => value > 0)
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
