import { format, subDays, subMonths } from "date-fns";

export type Period =
  | "tudo"
  | "semana"
  | "quinzenal"
  | "mes"
  | "trimestral"
  | "semestral"
  | "anual";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "tudo", label: "Tudo" },
  { value: "semana", label: "Semana" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mes", label: "Mês" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

/** Earliest date (YYYY-MM-DD) still inside `period`, or null for "tudo". */
export function periodCutoffIso(period: Period, now: Date = new Date()): string | null {
  const cutoff =
    period === "semana"
      ? subDays(now, 7)
      : period === "quinzenal"
        ? subDays(now, 15)
        : period === "mes"
          ? subMonths(now, 1)
          : period === "trimestral"
            ? subMonths(now, 3)
            : period === "semestral"
              ? subMonths(now, 6)
              : period === "anual"
                ? subMonths(now, 12)
                : null;
  return cutoff ? format(cutoff, "yyyy-MM-dd") : null;
}
