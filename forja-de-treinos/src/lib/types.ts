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

export const INTENSITY_LABEL: Record<Intensity, string> = {
  forte: "Forte",
  medio: "Médio",
  leve: "Leve",
};

export const DEFAULT_ATHLETES = ["Geovanil", "Vânia"] as const;
