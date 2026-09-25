import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Focus, Intensity, Workout } from "./types";
import { parseDate } from "./format";

const WEEK_OPTS = { weekStartsOn: 1 as const };

function inRange(iso: string, start: Date, end: Date) {
  const d = parseDate(iso);
  return d >= start && d <= end;
}

function coreRepsFor(workout: Workout, athlete: string) {
  return workout.core.reduce((sum, row) => {
    if (row.athlete && row.athlete !== athlete) return sum;
    return sum + row.sets * row.reps;
  }, 0);
}

/**
 * "Grupo muscular" is free text typed into the form (see seed.ts: "peito" vs
 * "peitoral", "anteriores", "coxas" …), not a fixed enum — so a raw tally
 * would fragment into near-duplicate slices. Classify each tag into the small
 * set of categories the panel actually reports on, by keyword.
 */
const MUSCLE_CATEGORIES: { name: string; test: RegExp }[] = [
  { name: "Peitoral", test: /peito/ },
  { name: "Costas", test: /costa/ },
  { name: "Braços", test: /braco/ },
  { name: "Ombros", test: /ombro/ },
  // Anteriores, posteriores, coxas e panturrilhas sao todos "Pernas": uma sessao
  // de pernas conta uma vez so; o detalhe digitado aparece na descricao.
  { name: "Pernas", test: /anterior|posterior|coxa|panturrilha|perna/ },
];

/**
 * Free text that doesn't fit a known category keeps its own name in the
 * chart instead of vanishing into a generic "Outro" — strip sets/reps and
 * counts ("Alteres 3x12" -> "Alteres", "3 halteres" -> "Halteres").
 */
function labelFromFreeText(raw: string): string {
  const cleaned = raw
    .replace(/\(.*?\)/g, " ")
    .replace(/\d+\s*[x×]\s*\d+/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

export function classifyMuscleGroup(raw: string): string {
  const normalized = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!normalized) return "Outro";
  const known = MUSCLE_CATEGORIES.find((cat) => cat.test.test(normalized))?.name;
  return known ?? (labelFromFreeText(raw) || "Outro");
}

/** Every item typed in "Extra" gets its own entry, named as typed. */
export function extraCategories(extras: string): string[] {
  return extras
    .split(/[,;+]|\s+e\s+/i)
    .map((part) => classifyMuscleGroup(part))
    .filter((name) => name !== "Outro");
}

/** Grupos digitados no formulario, separando tambem por ponto/ponto e virgula ("costas. peitoral"). */
function groupTags(w: Workout): string[] {
  return w.muscleGroups
    .flatMap((g) => g.split(/[.;/]+/))
    .map((g) => g.trim())
    .filter(Boolean);
}

export function computeStats(workouts: Workout[], now = new Date(), extraAthletes: string[] = []) {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  const thisWeekStart = startOfWeek(now, WEEK_OPTS);
  const thisWeekEnd = endOfWeek(now, WEEK_OPTS);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekEnd, -7);
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(addMonths(now, -1));
  const lastMonthEnd = endOfMonth(addMonths(now, -1));

  const sum = (list: Workout[]) => ({
    count: list.length,
    minutes: list.reduce((s, w) => s + w.durationMin, 0),
    machines: list.reduce((s, w) => s + w.machines, 0),
    cardio: list.reduce((s, w) => s + w.cardio.reduce((c, x) => c + x.minutes, 0), 0),
    coreReps: list.reduce((s, w) => s + w.core.reduce((c, x) => c + x.sets * x.reps, 0), 0),
  });

  const week = sum(sorted.filter((w) => inRange(w.date, thisWeekStart, thisWeekEnd)));
  const lastWeek = sum(sorted.filter((w) => inRange(w.date, lastWeekStart, lastWeekEnd)));
  const month = sum(sorted.filter((w) => inRange(w.date, thisMonthStart, thisMonthEnd)));
  const lastMonth = sum(sorted.filter((w) => inRange(w.date, lastMonthStart, lastMonthEnd)));
  const all = sum(sorted);

  const byFocus: Record<Focus, ReturnType<typeof sum>> = {
    pernas: sum(sorted.filter((w) => w.focus === "pernas")),
    bracos: sum(sorted.filter((w) => w.focus === "bracos")),
    outro: sum(sorted.filter((w) => w.focus === "outro")),
  };

  const byIntensity: Record<Intensity, number> = {
    forte: sorted.filter((w) => w.intensity === "forte").length,
    medio: sorted.filter((w) => w.intensity === "medio").length,
    leve: sorted.filter((w) => w.intensity === "leve").length,
  };

  const weeks: { key: string; label: string; minutes: number; count: number; coreReps: number }[] =
    [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = addDays(thisWeekStart, -7 * i);
    const end = addDays(start, 6);
    const list = sorted.filter((w) => inRange(w.date, start, end));
    const totals = sum(list);
    weeks.push({
      key: format(start, "yyyy-MM-dd"),
      label: format(start, "d MMM", { locale: ptBR }).replace(".", ""),
      minutes: totals.minutes,
      count: totals.count,
      coreReps: totals.coreReps,
    });
  }

  const months: { key: string; label: string; minutes: number; count: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const start = startOfMonth(addMonths(now, -i));
    const end = endOfMonth(start);
    const list = sorted.filter((w) => inRange(w.date, start, end));
    const totals = sum(list);
    months.push({
      key: format(start, "yyyy-MM"),
      label: format(start, "MMM", { locale: ptBR }).replace(".", ""),
      minutes: totals.minutes,
      count: totals.count,
    });
  }

  const recent = [...sorted]
    .reverse()
    .slice(-16)
    .map((w) => ({
      date: format(parseDate(w.date), "d/M"),
      minutes: w.durationMin,
      machines: w.machines,
      focus: w.focus,
      intensity: w.intensity,
    }));

  const athleteNames = new Set<string>(["Geovanil", "Vânia"]);
  for (const w of sorted) for (const name of w.athletes) athleteNames.add(name);
  for (const name of extraAthletes) if (name.trim()) athleteNames.add(name.trim());

  const athletes = [...athleteNames].map((name) => {
    const own = sorted.filter((w) => w.athletes.includes(name));
    return {
      name,
      sessions: own.length,
      coreReps: own.reduce((s, w) => s + coreRepsFor(w, name), 0),
      minutes: own.reduce((s, w) => s + w.durationMin, 0),
    };
  });

  const cardioMinutes = new Map<string, { label: string; minutes: number }>();
  for (const w of sorted) {
    for (const c of w.cardio) {
      const label = c.kind.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const cur = cardioMinutes.get(key) ?? {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        minutes: 0,
      };
      cur.minutes += c.minutes;
      cardioMinutes.set(key, cur);
    }
  }
  const cardioKinds = [...cardioMinutes.values()]
    .sort((a, b) => b.minutes - a.minutes)
    .map((c) => c.label);

  const muscleGroupSessions = new Map<string, Set<string>>();
  const muscleGroupDetails = new Map<string, Map<string, string>>();
  const dateById = new Map(sorted.map((w) => [w.id, w.date]));
  for (const w of sorted) {
    const categories = new Set([
      ...groupTags(w).map(classifyMuscleGroup),
      ...extraCategories(w.extras),
    ]);
    for (const category of categories) {
      const ids = muscleGroupSessions.get(category) ?? new Set<string>();
      ids.add(w.id);
      muscleGroupSessions.set(category, ids);
    }
    // descricao como foi digitada (ex.: "Posteriores, anteriores, panturrilhas")
    for (const tag of groupTags(w)) {
      const category = classifyMuscleGroup(tag);
      const label = labelFromFreeText(tag);
      const lower = label.toLowerCase();
      const cat = category.toLowerCase();
      if (!label || cat.startsWith(lower) || lower.startsWith(cat)) continue;
      const map = muscleGroupDetails.get(category) ?? new Map<string, string>();
      if (!map.has(label.toLowerCase())) map.set(label.toLowerCase(), label);
      muscleGroupDetails.set(category, map);
    }
  }
  const byMuscleGroup = [...muscleGroupSessions.entries()]
    .map(([name, ids]) => ({
      name,
      sessions: ids.size,
      details: [...(muscleGroupDetails.get(name)?.values() ?? [])],
      // datas dos treinos que originam o grupo (ajuda a achar o registro para editar)
      dates: [...ids]
        .map((id) => dateById.get(id) ?? "")
        .sort()
        .reverse(),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const uniqueDays = new Set(sorted.map((w) => w.date));
  let streak = 0;
  let cursor = now;
  for (let i = 0; i < 180; i += 1) {
    const iso = format(cursor, "yyyy-MM-dd");
    if (uniqueDays.has(iso)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (i === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }

  const first = sorted.at(-1);
  const spanDays = first
    ? Math.max(1, differenceInCalendarDays(now, parseDate(first.date)) + 1)
    : 1;

  return {
    all,
    week,
    lastWeek,
    month,
    lastMonth,
    byFocus,
    byIntensity,
    weeks,
    months,
    recent,
    athletes,
    byMuscleGroup,
    cardioKinds,
    streak,
    avgDuration: all.count ? Math.round(all.minutes / all.count) : 0,
    sessionsPerWeek: all.count / (spanDays / 7),
    firstDate: first?.date ?? null,
  };
}

export function deltaPct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}
