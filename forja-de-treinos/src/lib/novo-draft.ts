import { createBlankWorkout } from "@/store/workouts";
import type { Workout } from "./types";

const STORAGE_KEY = "forja-novo-draft-v1";

export type NovoTimers = {
  timerRunning: boolean;
  timerStart: number | null;
  timerFinalMs: number | null;
  restSeconds: number;
  restRunning: boolean;
  restEndAt: number | null;
};

export type NovoSnapshot = { workout: Workout; timers: NovoTimers };

function isSnapshot(value: unknown): value is NovoSnapshot {
  const s = value as NovoSnapshot | null;
  return Boolean(
    s &&
      typeof s === "object" &&
      s.workout &&
      typeof s.workout.id === "string" &&
      typeof s.workout.date === "string" &&
      Array.isArray(s.workout.athletes) &&
      Array.isArray(s.workout.core) &&
      Array.isArray(s.workout.cardio) &&
      s.timers &&
      typeof s.timers === "object",
  );
}

/** Rascunho da tela "Novo treino" salvo no aparelho, ou null se não houver. */
export function loadNovoDraft(): NovoSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return null;
    // Descanso que terminou enquanto o app estava fechado: volta parado, sem apitar atrasado.
    const { restRunning, restEndAt } = parsed.timers;
    if (restRunning && (!restEndAt || restEndAt <= Date.now())) {
      parsed.timers.restRunning = false;
      parsed.timers.restEndAt = null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasNovoDraft(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveNovoDraft(snapshot: NovoSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Sem espaço / navegação privada: o rascunho só não sobrevive a fechar o app.
  }
}

export function clearNovoDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada a limpar
  }
}

/** Nada foi digitado nem cronometrado: não há o que proteger. */
export function isPristineNovo(snapshot: NovoSnapshot): boolean {
  const blank = createBlankWorkout();
  const strip = (w: Workout) => JSON.stringify({ ...w, id: "", date: "", createdAt: "" });
  const { timerRunning, timerFinalMs, restRunning } = snapshot.timers;
  return (
    strip(snapshot.workout) === strip(blank) && !timerRunning && timerFinalMs === null && !restRunning
  );
}
