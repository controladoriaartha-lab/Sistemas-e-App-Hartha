import { useSyncExternalStore } from "react";
import { currentUserId, supabase } from "@/lib/cloud";
import { setCustomExercises, type Weights } from "@/lib/exercise-dictionary";

/**
 * Aparelhos que o usuario ensina ao app ("banco de memoria"): nome, palavras
 * que o identificam nas notas e quais musculos trabalha. Moram na tabela
 * public.custom_exercises (nuvem, so do dono) e ficam em cache no aparelho,
 * entao tambem funcionam sem internet. O dicionario padrao fica no codigo.
 */
export type CustomExercise = {
  id: string;
  name: string;
  keywords: string[];
  weights: Weights;
};

type Row = { id: string; name: string; keywords: string[]; weights: Weights };

const KEY = "forja-custom-exercises-v1";

function readCache(): CustomExercise[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let list: CustomExercise[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function commit(next: CustomExercise[]) {
  list = next;
  setCustomExercises(list);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // sem espaco: segue so em memoria
  }
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  list = readCache();
  setCustomExercises(list);
}

// Carrega o cache logo na abertura do app, antes de qualquer tela usar o dicionario.
if (typeof window !== "undefined") ensureLoaded();

const rowOf = (item: CustomExercise): Row => ({
  id: item.id,
  name: item.name,
  keywords: item.keywords,
  weights: item.weights,
});

/** Le da nuvem (e envia o que so existe neste aparelho). Chamado ao entrar no app. */
export async function loadCustomExercises(): Promise<void> {
  ensureLoaded();
  if (!currentUserId()) return;
  const { data, error } = await supabase.from("custom_exercises").select("id,name,keywords,weights");
  if (error) return;
  const remote = (data as Row[]).map((r) => ({ ...r, keywords: r.keywords ?? [], weights: r.weights ?? {} }));
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = list.filter((item) => !remoteIds.has(item.id));
  if (localOnly.length > 0) {
    await supabase.from("custom_exercises").upsert(localOnly.map(rowOf), { onConflict: "owner_id,id" });
  }
  commit([...remote, ...localOnly]);
}

export async function saveCustomExercise(item: CustomExercise): Promise<boolean> {
  ensureLoaded();
  commit([...list.filter((x) => x.id !== item.id), item]);
  if (!currentUserId()) return false;
  const { error } = await supabase.from("custom_exercises").upsert(rowOf(item), { onConflict: "owner_id,id" });
  return !error;
}

export async function removeCustomExercise(id: string): Promise<boolean> {
  ensureLoaded();
  commit(list.filter((x) => x.id !== id));
  if (!currentUserId()) return false;
  const { error } = await supabase.from("custom_exercises").delete().eq("id", id);
  return !error;
}

export function useCustomExercises(): CustomExercise[] {
  return useSyncExternalStore(
    (cb) => {
      ensureLoaded();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      ensureLoaded();
      return list;
    },
    () => [],
  );
}
