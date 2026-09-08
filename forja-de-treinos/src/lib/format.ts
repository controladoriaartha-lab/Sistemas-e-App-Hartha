import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Intensity } from "./types";

export function parseDate(iso: string) {
  return parseISO(`${iso}T12:00:00`);
}

export function formatWeekday(iso: string) {
  return format(parseDate(iso), "EEEE", { locale: ptBR });
}

export function formatDayMonth(iso: string) {
  return format(parseDate(iso), "dd MMM", { locale: ptBR }).replace(".", "");
}

export function formatFullDate(iso: string) {
  return format(parseDate(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatMonthYear(iso: string) {
  const raw = format(parseDate(iso), "MMMM yyyy", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatDuration(min: number) {
  if (!Number.isFinite(min) || min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

export function formatHours(min: number) {
  const hours = min / 60;
  if (hours < 10) return hours.toFixed(1).replace(".", ",");
  return Math.round(hours).toString();
}

export function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

export function intensityTone(intensity: Intensity) {
  if (intensity === "forte") return "accent";
  if (intensity === "medio") return "warn";
  return "ok";
}
