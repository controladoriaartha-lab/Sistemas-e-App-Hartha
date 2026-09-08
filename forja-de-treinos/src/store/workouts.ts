import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_WORKOUTS } from "@/lib/seed";
import { DEFAULT_ATHLETES, type Workout } from "@/lib/types";
import { todayIso } from "@/lib/format";

type WorkoutState = {
  workouts: Workout[];
  customAthletes: string[];
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  duplicateWorkout: (id: string) => string | null;
  addAthlete: (name: string) => void;
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
      importWorkouts: (workouts) => set({ workouts }),
      restoreSeed: () => set({ workouts: SEED_WORKOUTS }),
    }),
    { name: "forja-workouts-v1", version: 1 },
  ),
);

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
