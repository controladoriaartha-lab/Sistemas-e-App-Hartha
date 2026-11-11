export type Intensity = "forte" | "medio" | "leve";
export type Focus = "pernas" | "bracos" | "outro";

export type CoreSet = {
  exercise: string;
  sets: number;
  reps: number;
  athlete?: string;
};

export type CardioSet = {
  kind: string;
  minutes: number;
  athlete?: string;
};

export type Workout = {
  id: string;
  date: string;
  focus: Focus;
  focusLabel: string;
  athletes: string[];
  durationMin: number;
  intensity: Intensity;
  machines: number;
  sets: number;
  reps: number;
  muscleGroups: string[];
  extras: string;
  core: CoreSet[];
  cardio: CardioSet[];
  notes: string;
  createdAt: string;
};

export const FOCUS_LABEL: Record<Focus, string> = {
  pernas: "Pernas",
  bracos: "Braços",
  outro: "Outro",
};

export const FOCUS_ORDER: Focus[] = ["pernas", "bracos", "outro"];

/**
 * Focos de um treino. O primeiro fica em `focus` (e e o que a nuvem guarda como
 * foco principal); com "Mais um foco" o rotulo vira "Pernas + Braços". Treino
 * antigo ou com rotulo que nao bate so tem o foco principal.
 */
export function workoutFoci(w: { focus: Focus; focusLabel: string }): Focus[] {
  const list = w.focusLabel
    .split(" + ")
    .map((label) => FOCUS_ORDER.find((f) => FOCUS_LABEL[f] === label.trim()))
    .filter((f): f is Focus => Boolean(f));
  return list.length > 0 && list[0] === w.focus ? [...new Set(list)] : [w.focus];
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  forte: "Forte",
  medio: "Médio",
  leve: "Leve",
};

export const DEFAULT_ATHLETES = ["Geovanil", "Vânia"] as const;

/** Menu fixo de "Outros treinos" (campo Extra), antes de custom types. */
export const EXTRA_BASE_OPTIONS = ["Pesos", "Flexão", "Outros"] as const;
