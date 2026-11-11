import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { sameAthlete } from "./athlete-view";
import {
  LEGS,
  matchCardio,
  matchExercises,
  type ExerciseHit,
  type Weights,
} from "./exercise-dictionary";
import { parseExtras } from "./extras";
import { groupTags } from "./stats";
import { workoutFoci, type Workout } from "./types";

/**
 * Liga tudo o que cada treino registra (grupos digitados, Outros treinos,
 * foco do dia, core, cardio e notas) às regiões do corpo que cada coisa
 * trabalha, pra pintar a figura humana. O que cada exercício trabalha vem do
 * dicionário (lib/exercise-dictionary.ts): é uma estimativa por palavra-chave,
 * em que um exercício pesa mais na região principal e menos nas que ajudam.
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

// Core sem nome reconhecido: abdominal é o padrão.
const CORE_DEFAULT: Weights = { abdomen: 1, lombar: 0.2 };

// Foco do treino (campo "Foco"): indica o dia mesmo sem grupos digitados.
const FOCUS_WEIGHTS: Record<string, Weights> = {
  pernas: Object.fromEntries(Object.entries(LEGS).map(([id, w]) => [id, (w as number) * 0.8])),
  bracos: { biceps: 0.8, triceps: 0.8, antebraco: 0.5, ombros: 0.35 },
};

type Signal = { weights: Weights; scale: number };

// Core conta pelo que foi feito (séries × repetições), não por ter treinado no dia:
// 72 repetições (ex.: 3×24) valem uma sessão cheia; 3×12 (36) vale meia sessão.
const CORE_REPS_PER_SESSION = 72;
const CORE_SESSION_CAP = 1.5;

/** Junta vários pesos num só, ficando com o maior de cada região. */
function mergeWeights(list: Weights[]): Weights {
  const out: Weights = {};
  for (const weights of list) {
    for (const [id, weight] of Object.entries(weights) as [RegionId, number][]) {
      out[id] = Math.max(out[id] ?? 0, weight);
    }
  }
  return out;
}

/**
 * "Sessões equivalentes" de core de um treino, por região, ou null se não
 * houve core com séries e repetições. Cada atleta soma as suas linhas mais as
 * compartilhadas; com mais de um atleta, vale a média deles.
 */
function coreLoad(w: Workout): Partial<Record<RegionId, number>> | null {
  const rows = w.core.filter((row) => row.exercise.trim() && row.sets * row.reps > 0);
  if (rows.length === 0) return null;
  const people = w.athletes.length > 0 ? w.athletes : [""];
  const sums = new Map<RegionId, number>();
  for (const person of people) {
    for (const row of rows) {
      if (row.athlete && person && !sameAthlete(row.athlete, person)) continue;
      const sessions = (row.sets * row.reps) / CORE_REPS_PER_SESSION;
      const hits = matchExercises(row.exercise);
      const weights = hits.length > 0 ? mergeWeights(hits.map((h) => h.weights)) : CORE_DEFAULT;
      for (const [id, weight] of Object.entries(weights) as [RegionId, number][]) {
        sums.set(id, (sums.get(id) ?? 0) + (sessions * weight) / people.length);
      }
    }
  }
  return Object.fromEntries(
    [...sums].map(([id, value]) => [id, Math.min(CORE_SESSION_CAP, value)]),
  );
}

/** Tudo o que um treino diz sobre músculos trabalhados, cada coisa com seu peso (0–1). */
function workoutSignals(w: Workout): Signal[] {
  const signals: Signal[] = [];
  const hasCoreLoad = coreLoad(w) !== null;
  const foci = workoutFoci(w);

  // Nomes digitados em Grupo muscular e em Outros treinos, lidos pelo dicionário.
  const names = [...groupTags(w), ...parseExtras(w.extras, w.athletes).map((item) => item.name)];
  for (const name of names) {
    for (const hit of matchExercises(name) as ExerciseHit[]) {
      // Abdominal digitado nos grupos: se o core tem séries e repetições, vale o que foi feito.
      if (hasCoreLoad && hit.core) continue;
      // "Pesos"/"halteres" soltos não dizem qual músculo: em dia de pernas não
      // viram braços (o foco do dia já cobre o que foi trabalhado).
      if (hit.generic && foci.includes("pernas") && !foci.includes("bracos")) continue;
      signals.push({ weights: hit.weights, scale: 1 });
    }
  }

  for (const f of foci) {
    const focus = FOCUS_WEIGHTS[f];
    if (focus) signals.push({ weights: focus, scale: 1 });
  }

  for (const row of w.cardio.filter((r) => r.kind.trim())) {
    // 30 minutos de cardio já contam como cheio, e cardio pesa menos que musculação.
    const volume = Math.min(1, (row.minutes || 15) / 30);
    signals.push({ weights: matchCardio(row.kind), scale: 0.7 * volume });
  }

  // Notas: exercícios citados no texto livre (vale metade; sem "halter"/"peso" soltos).
  for (const hit of matchExercises(w.notes, { forNotes: true })) {
    if (hasCoreLoad && hit.core) continue;
    signals.push({ weights: hit.weights, scale: 0.5 });
  }
  return signals;
}

/**
 * Para cada treino, junta os sinais (grupos, foco, core, cardio, notas) sem
 * contar duas vezes: dois sinais na mesma região se reforçam, mas nunca passam
 * de 1 por treino. O core entra à parte, pelas séries × repetições. Soma os
 * treinos e normaliza pelo mais trabalhado (1 = o mais ressaltado). Só devolve
 * regiões com algum trabalho, da mais para a menos trabalhada.
 */
function regionTotals(workouts: Workout[]): Map<RegionId, number> {
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
    const core = coreLoad(w);
    if (core) {
      for (const [id, value] of Object.entries(core) as [RegionId, number][]) {
        totals.set(id, (totals.get(id) ?? 0) + value);
      }
    }
  }
  return totals;
}

export function regionRatios(
  workouts: Workout[],
): { id: RegionId; label: string; ratio: number }[] {
  const totals = regionTotals(workouts);
  const max = Math.max(0, ...totals.values());
  if (max === 0) return [];
  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .map(([id, value]) => ({ id, label: REGION_LABEL[id], ratio: value / max }))
    .sort((a, b) => b.ratio - a.ratio);
}

/** Ordem das linhas do mapa de calor (de cima para baixo no corpo). */
export const HEATMAP_REGIONS: RegionId[] = [
  "ombros",
  "peitoral",
  "dorsais",
  "trapezio",
  "biceps",
  "triceps",
  "antebraco",
  "abdomen",
  "lombar",
  "gluteos",
  "quadriceps",
  "posteriores",
  "panturrilha",
];

export type WeeklyHeat = {
  /** segunda-feira de cada semana (yyyy-MM-dd), da mais antiga para a mais nova */
  weeks: { start: string; label: string }[];
  /** por regiao, o quanto foi trabalhada em cada semana (0 a 1, na mesma escala de todas) */
  rows: { id: RegionId; label: string; cells: number[] }[];
};

/**
 * Mapa de calor semanal: quanto cada musculo foi trabalhado em cada uma das
 * ultimas `weeksCount` semanas (ate a semana de `ref`). Todas as celulas usam a
 * mesma escala (a maior de todas = 1), entao da para comparar semana a semana.
 */
export function regionWeekly(workouts: Workout[], ref: Date, weeksCount = 8): WeeklyHeat {
  const monday = startOfWeek(ref, { weekStartsOn: 1 });
  const weeks = Array.from({ length: weeksCount }, (_, i) => {
    const start = addDays(monday, -7 * (weeksCount - 1 - i));
    return { start: format(start, "yyyy-MM-dd"), label: format(start, "d/M") };
  });
  const perWeek = weeks.map(({ start }) => {
    const end = format(addDays(parseISO(start), 6), "yyyy-MM-dd");
    return regionTotals(workouts.filter((w) => w.date >= start && w.date <= end));
  });
  // Escala do menor ao maior valor que aparece (o menor ja fica visivel, o maior e o mais escuro).
  const positives = perWeek.flatMap((m) => [...m.values()]).filter((v) => v > 0);
  const max = Math.max(0, ...positives);
  const min = positives.length ? Math.min(...positives) : 0;
  const scale = (v: number) => {
    if (v <= 0) return 0;
    if (max === min) return 1;
    return 0.04 + 0.96 * ((v - min) / (max - min));
  };
  const rows = HEATMAP_REGIONS.map((id) => ({
    id,
    label: REGION_LABEL[id],
    cells: perWeek.map((m) => scale(m.get(id) ?? 0)),
  })).filter((row) => row.cells.some((v) => v > 0));
  return { weeks, rows };
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

// Escala do mapa de calor semanal: parte de um rosa bem clarinho (pouco) e vai
// ate um vermelho escuro (muito), em degraus bem distintos para ler no celular.
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [252, 232, 226]],
  [0.25, [247, 190, 178]],
  [0.5, [235, 130, 118]],
  [0.75, [202, 64, 60]],
  [1, [138, 26, 30]],
];

export function heatColor(ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio));
  let i = 1;
  while (i < HEAT_STOPS.length - 1 && t > HEAT_STOPS[i][0]) i += 1;
  const [t0, c0] = HEAT_STOPS[i - 1];
  const [t1, c1] = HEAT_STOPS[i];
  const k = (t - t0) / (t1 - t0);
  const [r, g, b] = c0.map((v, n) => Math.round(v + (c1[n] - v) * k));
  return `rgb(${r} ${g} ${b})`;
}

/** Degrade da legenda do mapa de calor (do menos ao mais). */
export const HEAT_GRADIENT = `linear-gradient(90deg, ${HEAT_STOPS.map(
  ([t, c]) => `rgb(${c.join(" ")}) ${t * 100}%`,
).join(", ")})`;

/** Tom claro dos músculos que não foram trabalhados. */
export const IDLE_COLOR = `rgb(${PALE.join(" ")})`;
