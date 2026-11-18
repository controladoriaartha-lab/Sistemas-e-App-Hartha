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

// ───────────────────────── series para o grafico ─────────────────────────

export type BodyMetric = "weightKg" | "waistCm" | "armCm" | "thighCm" | "chestCm" | "calfCm";

export const BODY_METRICS: { key: BodyMetric; label: string; unit: string }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "armCm", label: "Braço", unit: "cm" },
  { key: "thighCm", label: "Coxa", unit: "cm" },
  { key: "chestCm", label: "Peito", unit: "cm" },
  { key: "calfCm", label: "Panturrilha", unit: "cm" },
];

/** Quantos registros cada medida tem (para mostrar so as que ja formam uma linha). */
export function metricsWithLine(entries: BodyEntry[]): BodyMetric[] {
  return BODY_METRICS.filter(({ key }) => {
    const perAthlete = new Map<string, number>();
    for (const e of entries) {
      if (e[key] === null || e[key] === undefined) continue;
      const k = norm(e.athlete);
      perAthlete.set(k, (perAthlete.get(k) ?? 0) + 1);
    }
    return [...perAthlete.values()].some((n) => n >= 2);
  }).map((m) => m.key);
}

export type BodyRow = { date: string; label: string } & Record<string, number | string | null>;

/** Uma linha por data, uma coluna por atleta, para a medida escolhida. */
export function bodySeries(entries: BodyEntry[], metric: BodyMetric): { rows: BodyRow[]; athletes: string[] } {
  const names = new Map<string, string>();
  const byDate = new Map<string, Map<string, number>>();
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const value = e[metric];
    if (value === null || value === undefined) continue;
    const key = norm(e.athlete);
    if (!names.has(key)) names.set(key, e.athlete.trim());
    const day = byDate.get(e.date) ?? new Map<string, number>();
    day.set(key, value);
    byDate.set(e.date, day);
  }
  const athletes = [...names.values()];
  const rows: BodyRow[] = [...byDate.entries()].map(([date, day]) => {
    const row: BodyRow = { date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}` };
    for (const [key, name] of names) row[name] = day.get(key) ?? null;
    return row;
  });
  return { rows, athletes };
}

/** Ultimo valor de cada campo e o anterior a ele (a evolucao), considerando todos os registros do atleta. */
export function latestFields(entries: BodyEntry[]) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const fields = [...BODY_METRICS.map((m) => m.key), "energy", "sleepHours"] as const;
  const out = {} as Record<(typeof fields)[number], { value: number; previous: number | null; date: string } | null>;
  for (const key of fields) {
    const withValue = sorted.filter((e) => e[key] !== null && e[key] !== undefined);
    out[key] = withValue.length
      ? {
          value: withValue[0][key] as number,
          previous: withValue[1] ? (withValue[1][key] as number) : null,
          date: withValue[0].date,
        }
      : null;
  }
  const feeling = sorted.find((e) => e.feeling.trim());
  return { fields: out, feeling: feeling ? { text: feeling.feeling.trim(), date: feeling.date } : null };
}
