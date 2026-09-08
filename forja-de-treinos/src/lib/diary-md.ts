import { formatDuration, formatWeekday } from "./format";
import {
  DEFAULT_ATHLETES,
  FOCUS_LABEL,
  type CardioSet,
  type CoreSet,
  type Focus,
  type Intensity,
  type Workout,
} from "./types";

/**
 * Import / export the diary as the Markdown shape used in the Obsidian
 * "Diário Estruturado de Treino" note — one block per session with `[[wikilinks]]`
 * for the date and the athletes.
 */

export const DIARY_HEADER = "**Diário Estruturado de Treino📅**";

const INTENSITY_MD: Record<Intensity, string> = {
  forte: "🔴 Forte",
  medio: "🟡 Médio",
  leve: "🟢 Leve",
};

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `w-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Serialize the workouts (newest first) to the diary Markdown format. */
export function workoutsToMarkdown(workouts: Workout[]): string {
  const ordered = [...workouts].sort((a, b) => b.date.localeCompare(a.date));

  const blocks = ordered.map((w) => {
    const lines: string[] = [];
    lines.push(`[[${w.date}]] — ${formatWeekday(w.date)} | ${w.focusLabel}`);
    lines.push("");
    lines.push(`Atletas: ${w.athletes.map((a) => `[[${a}]]`).join(", ")}`);
    lines.push("");
    lines.push(
      `Duração Total: ${formatDuration(w.durationMin)} | Intensidade: ${INTENSITY_MD[w.intensity]}`,
    );
    lines.push("");
    if (w.machines > 0) {
      lines.push(
        `Musculação: ${String(w.machines).padStart(2, "0")} aparelhos (${w.sets}x${w.reps})`,
      );
      lines.push("");
    }
    if (w.muscleGroups.length > 0) {
      lines.push(`Grupo Muscular: ${w.muscleGroups.join(", ")}`);
      lines.push("");
    }
    if (w.extras.trim()) {
      lines.push(`Extra: ${w.extras.trim()}`);
      lines.push("");
    }
    for (const row of w.core) {
      lines.push(
        `Core: ${row.exercise} (${row.sets}x${row.reps})${row.athlete ? ` ${row.athlete}` : ""}`,
      );
      lines.push("");
    }
    for (const row of w.cardio) {
      lines.push(`Cardio: ${row.kind} (${row.minutes} min)`);
      lines.push("");
    }
    if (w.notes.trim()) {
      lines.push(`Nota: ${w.notes.trim()}`);
      lines.push("");
    }
    return lines.join("\n").trimEnd();
  });

  return `${DIARY_HEADER}\n\n\n${blocks.join("\n\n\n")}\n`;
}

function parseDuration(text: string): number {
  const t = text.trim().toLowerCase();
  let minutes = 0;
  const h = t.match(/(\d+)\s*h/);
  if (h) minutes += Number.parseInt(h[1], 10) * 60;
  const m = t.match(/(\d+)\s*m(?:in)?\b/);
  if (m) minutes += Number.parseInt(m[1], 10);
  if (!h && !m) {
    const n = t.match(/\d+/);
    if (n) minutes = Number.parseInt(n[0], 10);
  }
  return Number.isFinite(minutes) ? minutes : 0;
}

function parseIntensity(text: string): Intensity {
  const t = text.toLowerCase();
  if (t.includes("🟢") || t.includes("leve") || t.includes("fofo")) return "leve";
  if (t.includes("🟡") || t.includes("médio") || t.includes("medio")) return "medio";
  return "forte";
}

function parseFocus(text: string): Focus {
  const t = text.toLowerCase();
  if (t.includes("perna")) return "pernas";
  if (t.includes("braço") || t.includes("braco")) return "bracos";
  return "outro";
}

type Draft = {
  date: string;
  focus: Focus;
  athletes: string[];
  durationMin: number;
  intensity: Intensity;
  machines: number;
  sets: number;
  reps: number;
  muscleGroups: string[];
  extras: string;
  core: CoreSet[];
  cardio: CardioSet[];
  notes: string;
};

function blankDraft(date: string, focus: Focus): Draft {
  return {
    date,
    focus,
    athletes: [],
    durationMin: 0,
    intensity: "forte",
    machines: 0,
    sets: 3,
    reps: 12,
    muscleGroups: [],
    extras: "",
    core: [],
    cardio: [],
    notes: "",
  };
}

function toWorkout(d: Draft): Workout {
  return {
    id: newId(),
    date: d.date,
    focus: d.focus,
    focusLabel: FOCUS_LABEL[d.focus],
    athletes: d.athletes.length ? d.athletes : [...DEFAULT_ATHLETES],
    durationMin: d.durationMin,
    intensity: d.intensity,
    machines: d.machines,
    sets: d.sets,
    reps: d.reps,
    muscleGroups: d.muscleGroups,
    extras: d.extras,
    core: d.core,
    cardio: d.cardio,
    notes: d.notes,
    createdAt: `${d.date}T12:00:00.000Z`,
  };
}

const DATE_RE = /\[\[(\d{4}-\d{2}-\d{2})\]\]\s*[—–-]\s*([^|]+?)\s*\|\s*(.+)/;
const SETS_RE = /\((\d+)\s*x\s*(\d+)\)/i;

/**
 * Parse the diary Markdown back into workouts. Unknown lines are ignored, so a
 * hand-edited or slightly irregular note still imports what it can.
 */
export function parseMarkdownDiary(text: string): Workout[] {
  const norm = text.replace(/\r\n/g, "\n").replace(/\\([[\]])/g, "$1");
  const lines = norm.split("\n");
  const workouts: Workout[] = [];
  let cur: Draft | null = null;

  const flush = () => {
    if (cur && cur.date) workouts.push(toWorkout(cur));
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const dm = line.match(DATE_RE);
    if (dm) {
      flush();
      cur = blankDraft(dm[1], parseFocus(dm[3]));
      continue;
    }
    if (!cur) continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^Atletas?:\s*(.+)/i))) {
      cur.athletes = m[1]
        .split(/[,;]/)
        .map((s) => s.replace(/\[\[|\]\]/g, "").trim())
        .filter(Boolean);
    } else if (
      (m = line.match(/Dura[çc][ãa]o\s*(?:Total)?\s*:\s*([^|]+)\|\s*Intensidade\s*:\s*(.+)/i))
    ) {
      cur.durationMin = parseDuration(m[1]);
      cur.intensity = parseIntensity(m[2]);
    } else if ((m = line.match(/Muscula[çc][ãa]o\s*:\s*(\d+)?/i))) {
      if (m[1]) cur.machines = Number.parseInt(m[1], 10);
      const sr = line.match(SETS_RE);
      if (sr) {
        cur.sets = Number.parseInt(sr[1], 10);
        cur.reps = Number.parseInt(sr[2], 10);
      }
    } else if ((m = line.match(/Grupo\s*Muscula[rs]?\s*:\s*(.+)/i))) {
      cur.muscleGroups = m[1]
        .split(/,| e /i)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if ((m = line.match(/^Extras?\s*:\s*(.+)/i))) {
      cur.extras = m[1].trim();
    } else if ((m = line.match(/^Core\s*:\s*(.+)/i))) {
      const seg = m[1].trim();
      const sr = seg.match(SETS_RE);
      const sets = sr ? Number.parseInt(sr[1], 10) : 3;
      const reps = sr ? Number.parseInt(sr[2], 10) : 12;
      let rest = seg.replace(SETS_RE, "").trim();
      let athlete: string | undefined;
      for (const known of DEFAULT_ATHLETES) {
        const rx = new RegExp(`\\b${known}\\b`, "i");
        if (rx.test(rest)) {
          athlete = known;
          rest = rest.replace(rx, "").trim();
        }
      }
      cur.core.push({ exercise: rest || "Abdominal", sets, reps, athlete });
    } else if ((m = line.match(/^Cardio\s*:\s*(.+)/i))) {
      const seg = m[1].trim();
      const mm = seg.match(/(.+?)\s*\((\d+)\s*min\)/i);
      if (mm) cur.cardio.push({ kind: mm[1].trim(), minutes: Number.parseInt(mm[2], 10) });
      else cur.cardio.push({ kind: seg, minutes: 0 });
    } else if ((m = line.match(/^(?:Notas?|Obs)\s*:\s*(.+)/i))) {
      cur.notes = m[1].trim();
    }
  }
  flush();

  return workouts;
}
