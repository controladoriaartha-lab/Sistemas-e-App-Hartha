import { createClient, type Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import type { Workout } from "@/lib/types";

// Chave publicavel (anon): feita para ir no navegador; quem protege os dados
// e a politica RLS da tabela public.workouts (so o dono le/escreve).
const SUPABASE_URL = "https://sdaruttbshbnzesjnyqa.supabase.co";
const SUPABASE_KEY = "sb_publishable_8UK78gb2yCKPdQXzSJabVw_xSdowX_m";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

type Row = {
  id: string;
  workout_date: string;
  focus: Workout["focus"];
  focus_label: string;
  athletes: string[];
  duration_min: number;
  intensity: Workout["intensity"];
  machines: number;
  sets: number;
  reps: number;
  muscle_groups: string[];
  extras: string;
  core: Workout["core"];
  cardio: Workout["cardio"];
  notes: string;
  created_at: string;
};

function toRow(w: Workout, ownerId: string) {
  return {
    id: w.id,
    owner_id: ownerId,
    workout_date: w.date,
    focus: w.focus,
    focus_label: w.focusLabel,
    athletes: w.athletes,
    duration_min: w.durationMin,
    intensity: w.intensity,
    machines: w.machines,
    sets: w.sets,
    reps: w.reps,
    muscle_groups: w.muscleGroups,
    extras: w.extras,
    core: w.core,
    cardio: w.cardio,
    notes: w.notes,
    created_at: w.createdAt,
  };
}

function fromRow(r: Row): Workout {
  return {
    id: r.id,
    date: r.workout_date,
    focus: r.focus,
    focusLabel: r.focus_label,
    athletes: r.athletes,
    durationMin: r.duration_min,
    intensity: r.intensity,
    machines: r.machines,
    sets: r.sets,
    reps: r.reps,
    muscleGroups: r.muscle_groups,
    extras: r.extras,
    core: r.core,
    cardio: r.cardio,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export async function fetchRemote(): Promise<Workout[]> {
  const { data, error } = await supabase.from("workouts").select("*").limit(5000);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function upsertMany(ownerId: string, list: Workout[], ignoreDuplicates = false) {
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200).map((w) => toRow(w, ownerId));
    const { error } = await supabase
      .from("workouts")
      .upsert(chunk, { onConflict: "owner_id,id", ignoreDuplicates });
    if (error) throw error;
  }
}

export async function deleteIds(ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase
      .from("workouts")
      .delete()
      .in("id", ids.slice(i, i + 100));
    if (error) throw error;
  }
}

// ---- sessao (para a UI) ------------------------------------------------

let session: Session | null = null;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  void supabase.auth.getSession().then(({ data }) => {
    session = data.session;
    ready = true;
    emit();
  });
  supabase.auth.onAuthStateChange((_event, next) => {
    session = next;
    ready = true;
    emit();
  });
}

export function currentUserId(): string | null {
  return session?.user.id ?? null;
}

type AuthSnapshot = { ready: boolean; userId: string | null };
let snapshot: AuthSnapshot = { ready: false, userId: null };
const serverSnapshot: AuthSnapshot = { ready: false, userId: null };

function getSnapshot(): AuthSnapshot {
  const userId = session?.user.id ?? null;
  if (snapshot.ready !== ready || snapshot.userId !== userId) snapshot = { ready, userId };
  return snapshot;
}

export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot,
    () => serverSnapshot,
  );
}
