import { useSyncExternalStore } from "react";
import { currentUserId, supabase } from "@/lib/cloud";
import { norm } from "@/lib/athlete-view";

/**
 * Evolucao corporal: medidas e "como me sinto" por atleta e por dia. Mora na
 * tabela public.body_measurements (nuvem, so do dono) e fica em cache no
 * aparelho, entao tambem funciona sem internet. Uma linha por atleta por dia:
 * salvar de novo no mesmo dia atualiza a mesma linha.
 */
export type BodyEntry = {
  id: string;
  athlete: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  chestCm: number | null;
  calfCm: number | null;
  energy: number | null;
  sleepHours: number | null;
  feeling: string;
};

type Row = {
  id: string;
  athlete: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  chest_cm: number | null;
  calf_cm: number | null;
  energy: number | null;
  sleep_hours: number | null;
  feeling: string | null;
};

const KEY = "forja-body-v1";

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function fromRow(r: Row): BodyEntry {
  return {
    id: r.id,
    athlete: r.athlete,
    date: r.measured_on,
    weightKg: num(r.weight_kg),
    waistCm: num(r.waist_cm),
    armCm: num(r.arm_cm),
    thighCm: num(r.thigh_cm),
    chestCm: num(r.chest_cm),
    calfCm: num(r.calf_cm),
    energy: num(r.energy),
    sleepHours: num(r.sleep_hours),
    feeling: r.feeling ?? "",
  };
}

function toRow(e: BodyEntry) {
  return {
    id: e.id,
    athlete: e.athlete,
    measured_on: e.date,
    weight_kg: e.weightKg,
    waist_cm: e.waistCm,
    arm_cm: e.armCm,
    thigh_cm: e.thighCm,
    chest_cm: e.chestCm,
    calf_cm: e.calfCm,
    energy: e.energy,
    sleep_hours: e.sleepHours,
    feeling: e.feeling,
  };
}

/** Um registro por atleta e dia: o id carrega os dois. */
export function bodyEntryId(athlete: string, date: string): string {
  return `${norm(athlete).replace(/[^a-z0-9]+/g, "-")}-${date}`;
}

function readCache(): BodyEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let list: BodyEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  list = readCache();
}

function commit(next: BodyEntry[]) {
  list = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // sem espaco: segue so em memoria
  }
  listeners.forEach((l) => l());
}

/** Le da nuvem (e envia o que so existe neste aparelho). Chamado ao entrar no app. */
export async function loadBodyEntries(): Promise<void> {
  ensureLoaded();
  if (!currentUserId()) return;
  const { data, error } = await supabase.from("body_measurements").select("*").limit(5000);
  if (error) return;
  const remote = (data as Row[]).map(fromRow);
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = list.filter((e) => !remoteIds.has(e.id));
  if (localOnly.length > 0) {
    await supabase
      .from("body_measurements")
      .upsert(localOnly.map(toRow), { onConflict: "owner_id,id" });
  }
  commit([...remote, ...localOnly]);
}

export async function saveBodyEntry(entry: BodyEntry): Promise<boolean> {
  ensureLoaded();
  commit([...list.filter((e) => e.id !== entry.id), entry]);
  if (!currentUserId()) return false;
  const { error } = await supabase
    .from("body_measurements")
    .upsert(toRow(entry), { onConflict: "owner_id,id" });
  return !error;
}

export function useBodyEntries(): BodyEntry[] {
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
