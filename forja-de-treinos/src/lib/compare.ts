import { addMonths, endOfMonth, format, getDaysInMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { norm, sameAthlete } from "./athlete-view";
import { parseDate } from "./format";
import { DEFAULT_ATHLETES, type Workout } from "./types";

/**
 * Dados dos graficos de comparacao de evolucao: Geovanil x Vania por mes,
 * evolucao de carga (kg) por atleta e mes atual x mes anterior. Tudo puro e
 * sem React, para o Painel e o PDF usarem exatamente os mesmos numeros.
 */

export type CompareMetric = "sessoes" | "minutos" | "core";

export const COMPARE_METRICS: { value: CompareMetric; label: string; unit: string }[] = [
  { value: "sessoes", label: "Sessões", unit: "sessões" },
  { value: "minutos", label: "Minutos", unit: "min" },
  { value: "core", label: "Core", unit: "reps" },
];

const MAX_ATHLETES = 4;

function monthLabel(date: Date) {
  return format(date, "MMM", { locale: ptBR }).replace(".", "");
}

/** Data de referencia: o treino mais recente (assim um recorte no passado compara os meses dele). */
export function referenceDate(workouts: Workout[]): Date {
  const last = workouts.reduce((max, w) => (w.date > max ? w.date : max), "");
  return last ? parseDate(last) : new Date();
}

/** Atletas que aparecem nos treinos, do que mais treinou para o que menos treinou. */
export function athletesIn(workouts: Workout[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const w of workouts) {
    for (const raw of w.athletes) {
      const name = raw.trim();
      if (!name) continue;
      const key = norm(name);
      const cur = counts.get(key);
      if (cur) cur.count += 1;
      else counts.set(key, { name, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, MAX_ATHLETES)
    .map((a) => a.name);
}

function coreRepsOf(w: Workout, athlete: string) {
  return w.core.reduce((sum, row) => {
    if (row.athlete && !sameAthlete(row.athlete.trim(), athlete)) return sum;
    return sum + row.sets * row.reps;
  }, 0);
}

function valueFor(w: Workout, athlete: string, metric: CompareMetric) {
  if (metric === "sessoes") return 1;
  if (metric === "minutos") return w.durationMin;
  return coreRepsOf(w, athlete);
}

export type MonthlyRow = { key: string; label: string } & Record<string, number | string>;

/** Ultimos `months` meses (ate o mes de `ref`), uma coluna por atleta. */
export function athleteMonthly(
  workouts: Workout[],
  metric: CompareMetric,
  ref: Date,
  months = 6,
): { rows: MonthlyRow[]; athletes: string[] } {
  const athletes = athletesIn(workouts);
  const rows: MonthlyRow[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = startOfMonth(addMonths(ref, -i));
    const key = format(start, "yyyy-MM");
    const row: MonthlyRow = { key, label: monthLabel(start) };
    for (const athlete of athletes) {
      row[athlete] = workouts
        .filter((w) => w.date.startsWith(key) && w.athletes.some((a) => sameAthlete(a.trim(), athlete)))
        .reduce((sum, w) => sum + valueFor(w, athlete, metric), 0);
    }
    rows.push(row);
  }
  return { rows, athletes };
}

// ───────────────────────── evolucao de carga (kg) ─────────────────────────

/** Atleta citado num trecho de texto (nome inteiro, sem acento/caixa). */
function athleteInText(text: string, known: string[]): string | undefined {
  const hay = norm(text);
  for (const name of known) {
    const needle = norm(name.trim());
    if (!needle) continue;
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;
    const before = hay[idx - 1];
    const after = hay[idx + needle.length];
    if ((before && /[a-z0-9]/.test(before)) || (after && /[a-z0-9]/.test(after))) continue;
    return name;
  }
  return undefined;
}

/**
 * Carga em kg por atleta lida das Notas e dos Grupos do treino
 * ("Pesos: Vânia 5kg, Geovanil 12kg"). Vale a maior carga citada por atleta;
 * um "12kg" sem nome so conta quando o treino e de um atleta so.
 */
export function workoutLoads(w: Workout): Map<string, number> {
  const known = [...new Set([...w.athletes.map((a) => a.trim()), ...DEFAULT_ATHLETES])].filter(Boolean);
  const out = new Map<string, number>();
  const text = [w.notes, ...w.muscleGroups].join("\n");
  for (const segment of text.split(/[\n,;]+/)) {
    const values = [...segment.matchAll(/(\d+(?:[.,]\d+)?)\s*kg\b/gi)].map((m) =>
      Number(m[1].replace(",", ".")),
    );
    if (values.length === 0) continue;
    const kg = Math.max(...values);
    const named = athleteInText(segment, known);
    const owner = named ?? (w.athletes.length === 1 ? w.athletes[0].trim() : undefined);
    if (!owner) continue;
    out.set(owner, Math.max(out.get(owner) ?? 0, kg));
  }
  return out;
}

export type LoadRow = { date: string; label: string } & Record<string, number | string | null>;

export function loadProgress(workouts: Workout[]): { rows: LoadRow[]; athletes: string[] } {
  const asc = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map<string, Map<string, number>>();
  const canonical = new Map<string, string>();
  for (const w of asc) {
    for (const [owner, kg] of workoutLoads(w)) {
      const key = norm(owner);
      if (!canonical.has(key)) canonical.set(key, owner);
      const day = byDate.get(w.date) ?? new Map<string, number>();
      day.set(key, Math.max(day.get(key) ?? 0, kg));
      byDate.set(w.date, day);
    }
  }
  const order = athletesIn(workouts).filter((name) => canonical.has(norm(name)));
  const athletes = order.length > 0 ? order : [...canonical.values()].slice(0, MAX_ATHLETES);
  const rows: LoadRow[] = [...byDate.entries()].map(([date, day]) => {
    const row: LoadRow = { date, label: format(parseDate(date), "d/M") };
    for (const athlete of athletes) row[athlete] = day.get(norm(athlete)) ?? null;
    return row;
  });
  return { rows, athletes };
}

// ───────────────────────── mes atual x mes anterior ─────────────────────────

export type MonthCompareRow = {
  key: string;
  label: string;
  unit: string;
  current: number;
  previous: number;
};

export function monthVsPrevious(workouts: Workout[], ref: Date) {
  const curStart = startOfMonth(ref);
  const prevStart = startOfMonth(addMonths(ref, -1));
  const curKey = format(curStart, "yyyy-MM");
  const prevKey = format(prevStart, "yyyy-MM");
  const inMonth = (key: string) => workouts.filter((w) => w.date.startsWith(key));
  const cur = inMonth(curKey);
  const prev = inMonth(prevKey);
  const totals = (list: Workout[]) => ({
    sessoes: list.length,
    minutos: list.reduce((s, w) => s + w.durationMin, 0),
    cardio: list.reduce((s, w) => s + w.cardio.reduce((c, r) => c + r.minutes, 0), 0),
    core: list.reduce((s, w) => s + w.core.reduce((c, r) => c + r.sets * r.reps, 0), 0),
  });
  const a = totals(cur);
  const b = totals(prev);
  const rows: MonthCompareRow[] = [
    { key: "sessoes", label: "Sessões", unit: "", current: a.sessoes, previous: b.sessoes },
    { key: "minutos", label: "Minutos", unit: "min", current: a.minutos, previous: b.minutos },
    { key: "cardio", label: "Cardio", unit: "min", current: a.cardio, previous: b.cardio },
    { key: "core", label: "Core", unit: "reps", current: a.core, previous: b.core },
  ];

  // Minutos acumulados dia a dia: o mes atual so ate o dia de referencia.
  const daysCur = getDaysInMonth(curStart);
  const daysPrev = getDaysInMonth(prevStart);
  const refDay = ref.getDate();
  const perDay = (list: Workout[], days: number) => {
    const arr = Array.from({ length: days + 1 }, () => 0);
    for (const w of list) arr[Number(w.date.slice(8, 10))] += w.durationMin;
    return arr;
  };
  const curDay = perDay(cur, daysCur);
  const prevDay = perDay(prev, daysPrev);
  const cumulative: { day: number; current: number | null; previous: number | null }[] = [];
  let accCur = 0;
  let accPrev = 0;
  for (let d = 1; d <= Math.max(daysCur, daysPrev); d += 1) {
    if (d <= daysCur && d <= refDay) accCur += curDay[d];
    if (d <= daysPrev) accPrev += prevDay[d];
    cumulative.push({
      day: d,
      current: d <= daysCur && d <= refDay ? accCur : null,
      previous: d <= daysPrev ? accPrev : null,
    });
  }

  return {
    currentLabel: format(curStart, "MMMM", { locale: ptBR }),
    previousLabel: format(prevStart, "MMMM", { locale: ptBR }),
    hasPrevious: prev.length > 0,
    rows,
    cumulative,
    endOfCurrent: format(endOfMonth(curStart), "d"),
  };
}
