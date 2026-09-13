import { format, startOfMonth, startOfQuarter, startOfWeek, startOfYear } from "date-fns";

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

/** "nesta semana" / "neste mês" / … — used to caption numbers filtered by `period`. */
export const PERIOD_IN_PHRASE: Record<Period, string> = {
  tudo: "",
  semana: "nesta semana",
  quinzenal: "nesta quinzena",
  mes: "neste mês",
  trimestral: "neste trimestre",
  semestral: "neste semestre",
  anual: "neste ano",
};

/**
 * Start of the *calendar* period containing `now` (YYYY-MM-DD), or null for
 * "tudo". This is the actual month/quarter/semester/year — not a rolling
 * "últimos N dias" window — so "Mês" means "setembro inteiro", not "últimos
 * 30 dias". Since no workout is ever dated after "now", filtering by this one
 * lower bound already excludes anything past the period too.
 */
export function periodCutoffIso(period: Period, now: Date = new Date()): string | null {
  let start: Date;
  switch (period) {
    case "semana":
      start = startOfWeek(now, { weekStartsOn: 1 });
      break;
    case "quinzenal": {
      const monthStart = startOfMonth(now);
      start =
        now.getDate() <= 15
          ? monthStart
          : new Date(monthStart.getFullYear(), monthStart.getMonth(), 16);
      break;
    }
    case "mes":
      start = startOfMonth(now);
      break;
    case "trimestral":
      start = startOfQuarter(now);
      break;
    case "semestral":
      start = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
      break;
    case "anual":
      start = startOfYear(now);
      break;
    default:
      return null;
  }
  return format(start, "yyyy-MM-dd");
}
