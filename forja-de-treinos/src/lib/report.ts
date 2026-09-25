import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDate, formatDuration } from "./format";
import { computeStats } from "./stats";
import type { Workout } from "./types";

const WEEK = { weekStartsOn: 1 as const };
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export type HeatCell = { iso: string; minutes: number; count: number; col: number; row: number };

/** Numbers and series for the printable report — always over the WHOLE diary. */
export function buildReport(workouts: Workout[], now = new Date()) {
  const asc = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const stats = computeStats(workouts, now);
  const first = asc[0]?.date ?? null;
  const last = asc.at(-1)?.date ?? null;
  const firstD = first ? parseDate(first) : now;
  const lastD = last ? parseDate(last) : now;

  const weekMap = new Map<string, { minutes: number; count: number; coreReps: number }>();
  for (const w of asc) {
    const key = format(startOfWeek(parseDate(w.date), WEEK), "yyyy-MM-dd");
    const cur = weekMap.get(key) ?? { minutes: 0, count: 0, coreReps: 0 };
    cur.minutes += w.durationMin;
    cur.count += 1;
    cur.coreReps += w.core.reduce((s, r) => s + r.sets * r.reps, 0);
    weekMap.set(key, cur);
  }
  const weeks: { label: string; minutes: number; count: number; coreReps: number }[] = [];
  for (
    let d = startOfWeek(firstD, WEEK);
    d <= startOfWeek(lastD, WEEK);
    d = addDays(d, 7)
  ) {
    const key = format(d, "yyyy-MM-dd");
    const v = weekMap.get(key) ?? { minutes: 0, count: 0, coreReps: 0 };
    weeks.push({ label: format(d, "d/M"), ...v });
  }
  const weeksShown = weeks.slice(-20);

  const monthMap = new Map<string, { minutes: number; count: number }>();
  for (const w of asc) {
    const key = format(startOfMonth(parseDate(w.date)), "yyyy-MM");
    const cur = monthMap.get(key) ?? { minutes: 0, count: 0 };
    cur.minutes += w.durationMin;
    cur.count += 1;
    monthMap.set(key, cur);
  }
  const months = [...monthMap.entries()].map(([key, v]) => ({
    label: format(parseDate(`${key}-01`), "MMM/yy", { locale: ptBR }).replace(".", ""),
    ...v,
  }));

  const weekday = WEEKDAYS.map((label) => ({ label, count: 0, minutes: 0 }));
  for (const w of asc) {
    const idx = (parseDate(w.date).getDay() + 6) % 7;
    weekday[idx].count += 1;
    weekday[idx].minutes += w.durationMin;
  }

  const days = [...new Set(asc.map((w) => w.date))];
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of days) {
    const d = parseDate(iso);
    run = prev && differenceInCalendarDays(d, prev) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }

  const activeWeeks = weeks.filter((w) => w.count > 0).length;
  const consistency = weeks.length ? Math.round((activeWeeks / weeks.length) * 100) : 0;
  const strongWeeks = weeks.filter((w) => w.count >= 3).length;
  const bestWeek = weeks.reduce((best, w) => (w.count > best.count ? w : best), weeks[0] ?? { label: "-", count: 0, minutes: 0, coreReps: 0 });

  const cardioMap = new Map<string, { minutes: number; sessions: number }>();
  const coreMap = new Map<string, number>();
  for (const w of asc) {
    for (const c of w.cardio) {
      const k = c.kind.trim() || "Cardio";
      const cur = cardioMap.get(k) ?? { minutes: 0, sessions: 0 };
      cur.minutes += c.minutes;
      cur.sessions += 1;
      cardioMap.set(k, cur);
    }
    for (const r of w.core) {
      const k = r.exercise.trim() || "Core";
      coreMap.set(k, (coreMap.get(k) ?? 0) + r.sets * r.reps);
    }
  }
  const cardioByKind = [...cardioMap.entries()]
    .map(([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => b.minutes - a.minutes);
  const coreByExercise = [...coreMap.entries()]
    .map(([exercise, reps]) => ({ exercise, reps }))
    .sort((a, b) => b.reps - a.reps);

  const durations = asc.map((w) => w.durationMin);
  const longest = asc.reduce((b, w) => (w.durationMin > (b?.durationMin ?? -1) ? w : b), asc[0]);
  const durationSeries = asc.map((w) => ({
    label: format(parseDate(w.date), "d/M"),
    minutes: w.durationMin,
  }));

  const avgByFocus = (focus: Workout["focus"]) => {
    const list = asc.filter((w) => w.focus === focus);
    return list.length ? Math.round(list.reduce((s, w) => s + w.durationMin, 0) / list.length) : 0;
  };

  // Calendar heatmap: up to the last 26 weeks, Monday-first columns.
  const heatStart = startOfWeek(addDays(lastD, -7 * 25), WEEK);
  const gridStart = heatStart < startOfWeek(firstD, WEEK) ? startOfWeek(firstD, WEEK) : heatStart;
  const dayMap = new Map<string, { minutes: number; count: number }>();
  for (const w of asc) {
    const cur = dayMap.get(w.date) ?? { minutes: 0, count: 0 };
    cur.minutes += w.durationMin;
    cur.count += 1;
    dayMap.set(w.date, cur);
  }
  const heat: HeatCell[] = [];
  const heatEnd = endOfWeek(lastD, WEEK);
  for (let d = gridStart, i = 0; d <= heatEnd; d = addDays(d, 1), i += 1) {
    const iso = format(d, "yyyy-MM-dd");
    const v = dayMap.get(iso) ?? { minutes: 0, count: 0 };
    heat.push({ iso, ...v, col: Math.floor(i / 7), row: i % 7 });
  }
  const heatMonths: { col: number; label: string }[] = [];
  let lastMonthKey = "";
  for (const cell of heat.filter((c) => c.row === 0)) {
    const key = cell.iso.slice(0, 7);
    if (key !== lastMonthKey) {
      heatMonths.push({ col: cell.col, label: format(parseDate(cell.iso), "MMM", { locale: ptBR }).replace(".", "") });
      lastMonthKey = key;
    }
  }

  const topGroup = stats.byMuscleGroup[0];
  const bestWeekday = [...weekday].sort((a, b) => b.count - a.count)[0];
  const insights: string[] = [];
  if (asc.length) {
    insights.push(
      `${asc.length} treinos em ${weeks.length} semanas: em ${consistency}% delas houve pelo menos uma sessão, e ${strongWeeks} semanas tiveram 3 ou mais.`,
    );
    insights.push(
      `Duração média de ${formatDuration(stats.avgDuration)} por sessão; a mais longa foi de ${formatDuration(longest.durationMin)} (${format(parseDate(longest.date), "dd/MM/yyyy")}).`,
    );
    if (bestWeekday.count) {
      insights.push(`O dia mais frequente é ${bestWeekday.label.toLowerCase()}, com ${bestWeekday.count} treinos.`);
    }
    if (topGroup) {
      insights.push(`O grupo mais trabalhado é ${topGroup.name.toLowerCase()}, presente em ${topGroup.sessions} sessões.`);
    }
    insights.push(
      `Maior sequência de dias seguidos: ${longestStreak}. Melhor semana: ${bestWeek.count} treinos (semana de ${bestWeek.label}).`,
    );
  }

  return {
    stats,
    first,
    last,
    weeks,
    weeksShown,
    months,
    weekday,
    heat,
    heatMonths,
    heatCols: heat.length ? heat[heat.length - 1].col + 1 : 0,
    heatMax: Math.max(1, ...heat.map((c) => c.minutes)),
    durationSeries,
    cardioByKind,
    coreByExercise,
    longestStreak,
    activeWeeks,
    consistency,
    strongWeeks,
    bestWeek,
    longest,
    minDuration: durations.length ? Math.min(...durations) : 0,
    totalMachines: stats.all.machines,
    avgByFocus: { pernas: avgByFocus("pernas"), bracos: avgByFocus("bracos") },
    insights,
  };
}
