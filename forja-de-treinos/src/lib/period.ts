import {
  endOfMonth,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayIso } from "./format";

export type Period =
  | "tudo"
  | "dia"
  | "semana"
  | "quinzenal"
  | "mes"
  | "trimestral"
  | "semestral"
  | "anual";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "tudo", label: "Tudo" },
  { value: "dia", label: "Dia" },
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
  dia: "nesse dia",
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

/**
 * First/last date (YYYY-MM-DD) of a specific month, `offset` months back from
 * `now` (0 = the current month, 1 = last month, …). Used by the "Mês" period
 * picker so choosing a past month doesn't also pull in every month after it —
 * `periodCutoffIso` has no upper bound because it only ever means "since X",
 * which only works for the *current* month (nothing is dated after today).
 */
export function monthRangeIso(
  offset: number,
  now: Date = new Date(),
): { start: string; end: string } {
  const anchor = startOfMonth(subMonths(now, offset));
  return { start: format(anchor, "yyyy-MM-dd"), end: format(endOfMonth(anchor), "yyyy-MM-dd") };
}

/** "Setembro 2026", "Agosto 2026", … for the last `count` months (0 = current). */
export function recentMonths(
  count: number,
  now: Date = new Date(),
): { offset: number; label: string }[] {
  return Array.from({ length: count }, (_, offset) => ({
    offset,
    label: capitalize(format(startOfMonth(subMonths(now, offset)), "MMMM yyyy", { locale: ptBR })),
  }));
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Períodos que têm um menuzinho para escolher qual ocorrência ver (mês, quinzena, …). */
export const PICKABLE_PERIODS: readonly Period[] = [
  "quinzenal",
  "mes",
  "trimestral",
  "semestral",
  "anual",
];

export function isPickablePeriod(period: Period): boolean {
  return PICKABLE_PERIODS.includes(period);
}

/** Quantas ocorrências passadas cada menuzinho oferece (o anual depende dos dados). */
export const PICKER_COUNT: Record<string, number> = {
  quinzenal: 24,
  mes: 12,
  trimestral: 8,
  semestral: 6,
  anual: 5,
};

/**
 * Primeiro e último dia de uma ocorrência do período, `offset` ocorrências
 * para trás (0 = a atual, 1 = a anterior, …). Quinzena = dia 1-15 e 16-fim;
 * trimestre/semestre seguem o calendário (jan-mar…, jan-jun e jul-dez).
 */
export function periodRangeIso(
  period: Period,
  offset: number,
  now: Date = new Date(),
): { start: string; end: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  let end: Date;
  switch (period) {
    case "mes":
      return monthRangeIso(offset, now);
    case "quinzenal": {
      const idx = y * 24 + m * 2 + (now.getDate() <= 15 ? 0 : 1) - offset;
      const ty = Math.floor(idx / 24);
      const tm = Math.floor((idx % 24) / 2);
      const second = idx % 2 === 1;
      start = new Date(ty, tm, second ? 16 : 1);
      end = second ? endOfMonth(new Date(ty, tm, 1)) : new Date(ty, tm, 15);
      break;
    }
    case "trimestral": {
      const idx = y * 4 + Math.floor(m / 3) - offset;
      const tq = idx % 4;
      start = new Date(Math.floor(idx / 4), tq * 3, 1);
      end = endOfMonth(new Date(Math.floor(idx / 4), tq * 3 + 2, 1));
      break;
    }
    case "semestral": {
      const idx = y * 2 + Math.floor(m / 6) - offset;
      const th = idx % 2;
      start = new Date(Math.floor(idx / 2), th * 6, 1);
      end = endOfMonth(new Date(Math.floor(idx / 2), th * 6 + 5, 1));
      break;
    }
    case "anual":
      start = new Date(y - offset, 0, 1);
      end = new Date(y - offset, 11, 31);
      break;
    default:
      return null;
  }
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

/** Opções do menuzinho: "2ª quinzena · Setembro 2026", "1º trimestre · 2026", "2026", … */
export function periodOptions(
  period: Period,
  count: number,
  now: Date = new Date(),
): { offset: number; label: string }[] {
  if (period === "mes") return recentMonths(count, now);
  return Array.from({ length: count }, (_, offset) => {
    const range = periodRangeIso(period, offset, now);
    if (!range) return { offset, label: "" };
    const [yy, mm, dd] = range.start.split("-").map(Number);
    // Mês abreviado ("Out 2026"): o nome inteiro estoura a largura do botão no celular.
    const monthName = capitalize(
      format(new Date(yy, mm - 1, 1), "MMM yyyy", { locale: ptBR }).replace(".", ""),
    );
    switch (period) {
      case "quinzenal":
        return { offset, label: `${dd === 1 ? "1ª" : "2ª"} quinzena · ${monthName}` };
      case "trimestral":
        return { offset, label: `${Math.floor((mm - 1) / 3) + 1}º trimestre · ${yy}` };
      case "semestral":
        return { offset, label: `${mm === 1 ? "1º" : "2º"} semestre · ${yy}` };
      default:
        return { offset, label: String(yy) };
    }
  });
}

/** Rótulo de uma ocorrência específica (para legendas e para o relatório). */
export function periodOffsetLabel(period: Period, offset: number, now: Date = new Date()): string {
  return periodOptions(period, offset + 1, now).at(-1)?.label ?? "";
}

/**
 * Aplica o filtro de periodo do Painel/Diario a uma lista de treinos —
 * inclusive a ocorrencia escolhida (refOffset: mes, quinzena, trimestre,
 * semestre ou ano passado) ou o dia escolhido (dayIso). "Dia" e as ocorrencias
 * passadas sao fechadas dos dois lados; a ocorrencia atual so tem piso
 * ("desde X"), porque nenhum treino e datado depois de hoje.
 */
export function filterByPeriod<T extends { date: string }>(
  list: T[],
  period: Period,
  refOffset = 0,
  dayIso?: string,
): T[] {
  if (period === "dia") {
    const day = dayIso || todayIso();
    return list.filter((w) => w.date === day);
  }
  if (refOffset > 0) {
    const range = periodRangeIso(period, refOffset);
    if (range) return list.filter((w) => w.date >= range.start && w.date <= range.end);
  }
  const cutoff = periodCutoffIso(period);
  return cutoff ? list.filter((w) => w.date >= cutoff) : list;
}
