import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { SEED_WORKOUTS } from "@/lib/seed";
import { DEFAULT_ATHLETES, type Workout } from "@/lib/types";
import { todayIso } from "@/lib/format";

const STORAGE_KEY = "forja-workouts-v1";

let notifyPersistFailure: ((message: string) => void) | null = null;

/** Mounted once (AppShell) to route storage failures into a visible toast. */
export function setPersistFailureHandler(handler: ((message: string) => void) | null) {
  notifyPersistFailure = handler;
}

/**
 * zustand's persist middleware calls `storage.setItem` right after updating
 * in-memory state, still inside the same synchronous call the UI triggered
 * (e.g. `addWorkout`). `localStorage.setItem` throws in Safari private
 * browsing, when the device's storage quota is full, or when a browser
 * disables storage outright — all realistic on a phone. Left unguarded, that
 * throw aborts whatever the caller does next (the success toast, the
 * navigation to the new workout) even though the edit itself "worked" for
 * this session — it just never reached disk, so it is gone on next launch.
 * This wrapper swallows that failure and reports it instead of losing it.
 */
function resilientStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch (err) {
        console.error("[forja] leitura do armazenamento local falhou:", err);
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value);
        // Some restricted modes accept the call without an error but never
        // actually persist the write — verify it landed.
        if (localStorage.getItem(name) !== value) {
          throw new Error("gravação não persistida");
        }
      } catch (err) {
        console.error("[forja] gravação no armazenamento local falhou:", err);
        notifyPersistFailure?.(
          "Não foi possível salvar no aparelho (armazenamento cheio ou navegação privada). O treino fica só nesta sessão — saia da navegação privada ou libere espaço e tente de novo.",
        );
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch (err) {
        console.error("[forja] remoção no armazenamento local falhou:", err);
      }
    },
  };
}

type WorkoutState = {
  workouts: Workout[];
  customAthletes: string[];
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  duplicateWorkout: (id: string) => string | null;
  addAthlete: (name: string) => void;
  /** Drops any custom athlete no workout actually references. */
  pruneUnusedAthletes: () => void;
  importWorkouts: (workouts: Workout[]) => void;
  restoreSeed: () => void;
};

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `w-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      workouts: SEED_WORKOUTS,
      customAthletes: [],
      addWorkout: (workout) =>
        set({ workouts: [workout, ...get().workouts.filter((w) => w.id !== workout.id)] }),
      updateWorkout: (id, patch) =>
        set({
          workouts: get().workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        }),
      deleteWorkout: (id) => set({ workouts: get().workouts.filter((w) => w.id !== id) }),
      duplicateWorkout: (id) => {
        const src = get().workouts.find((w) => w.id === id);
        if (!src) return null;
        const copy: Workout = {
          ...src,
          id: newId(),
          date: todayIso(),
          createdAt: new Date().toISOString(),
          core: src.core.map((row) => ({ ...row })),
          cardio: src.cardio.map((row) => ({ ...row })),
          athletes: [...src.athletes],
          muscleGroups: [...src.muscleGroups],
        };
        set({ workouts: [copy, ...get().workouts] });
        return copy.id;
      },
      addAthlete: (name) => {
        const clean = name.trim();
        if (!clean) return;
        const known = (DEFAULT_ATHLETES as readonly string[]).includes(clean);
        if (known || get().customAthletes.includes(clean)) return;
        set({ customAthletes: [...get().customAthletes, clean] });
      },
      pruneUnusedAthletes: () => {
        const { workouts, customAthletes } = get();
        if (customAthletes.length === 0) return;
        const referenced = new Set<string>();
        for (const w of workouts) for (const a of w.athletes) referenced.add(a);
        const kept = customAthletes.filter((name) => referenced.has(name));
        if (kept.length !== customAthletes.length) set({ customAthletes: kept });
      },
      importWorkouts: (workouts) => set({ workouts }),
      restoreSeed: () => set({ workouts: SEED_WORKOUTS }),
    }),
    { name: STORAGE_KEY, version: 1, storage: createJSONStorage(resilientStorage) },
  ),
);

// A custom athlete only exists to be picked in the form that created them;
// one you add and never actually log a workout for is clutter in every
// filter and in the Painel's Atletas grid. Sweep it on each app start — this
// runs once persisted state is loaded (synchronously for localStorage, but
// registering the callback covers any storage that hydrates asynchronously).
useWorkoutStore.getState().pruneUnusedAthletes();
useWorkoutStore.persist.onFinishHydration(() => {
  useWorkoutStore.getState().pruneUnusedAthletes();
});

export function createBlankWorkout(): Workout {
  return {
    id: newId(),
    date: todayIso(),
    focus: "pernas",
    focusLabel: "Pernas",
    athletes: ["Geovanil", "Vânia"],
    durationMin: 80,
    intensity: "forte",
    machines: 6,
    sets: 3,
    reps: 12,
    muscleGroups: [],
    extras: "",
    core: [{ exercise: "Abdominal", sets: 3, reps: 12 }],
    cardio: [],
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

export function sortedWorkouts(workouts: Workout[]) {
  return [...workouts].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
}
