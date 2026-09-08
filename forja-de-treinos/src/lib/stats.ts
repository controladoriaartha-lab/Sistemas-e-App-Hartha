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
    coreReps: list.reduce(
      (s, w) => s + w.core.reduce((c, x) => c + x.sets * x.reps, 0),
      0,
    ),
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

  const weeks: { key: string; label: string; minutes: number; count: number }[] = [];
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
    });
  }

  const recent = [...sorted].reverse().slice(-16).map((w) => ({
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
    recent,
    athletes,
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
