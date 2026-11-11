import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, History, List, Play, Plus, Square, Trash2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ATHLETES,
  EXTRA_BASE_OPTIONS,
  FOCUS_LABEL,
  FOCUS_ORDER,
  INTENSITY_LABEL,
  type Focus,
  type Intensity,
  type Workout,
  workoutFoci,
} from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { formatExtras, parseExtras, type ExtraItem } from "@/lib/extras";
import type { NovoSnapshot, NovoTimers } from "@/lib/novo-draft";
import { SuggestionSheet } from "@/components/suggestion-sheet";
import { useWorkoutStore } from "@/store/workouts";

const DEFAULT_MUSCLE_GROUPS = [
  "peito",
  "costas",
  "ombros",
  "braços",
  "coxas",
  "posteriores",
  "anteriores",
  "panturrilhas",
  "glúteos",
  "abdômen",
];

const NOTE_LABEL_RE = /^aparelhos?\s*:\s*/i;

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Itens individuais de uma nota (aparelhos, exercicios...): separa por
 * virgula, ponto e virgula ou quebra de linha, sem repetir. "Aparelhos:" vira
 * um item so (o que vem depois dele e outro item); tudo em minusculas e o nome dos atletas, solto
 * ou entre parenteses/colchetes, sai de cada item.
 */
function noteLines(text: string, athleteNames: string[] = []): string[] {
  const names = athleteNames
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const nameRe = names.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "giu")
    : null;
  const clean = (value: string) => {
    let item = value;
    if (nameRe) {
      item = item.replace(new RegExp(`[(\\[]\\s*${nameRe.source}\\s*[)\\]]`, "giu"), " ");
      item = item.replace(nameRe, " ");
    }
    return item
      .replace(/\(\s*\)|\[\s*\]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—:]+|[\s\-–—]+$/g, "")
      .replace(/\.+$/, "")
      .trim();
  };

  const seen = new Set<string>();
  const items: string[] = [];
  const push = (item: string) => {
    const lower = item.toLocaleLowerCase("pt-BR");
    if (!lower || seen.has(lower)) return;
    seen.add(lower);
    // so "Aparelhos:" leva maiuscula; todo o resto fica em minusculas
    items.push(lower === "aparelhos:" ? "Aparelhos:" : lower);
  };
  for (const raw of text.split(/[\n,;]+/)) {
    const labelled = NOTE_LABEL_RE.exec(raw.trim());
    if (labelled) {
      push("Aparelhos:");
      push(clean(raw.trim().slice(labelled[0].length)));
    } else {
      push(clean(raw));
    }
  }
  return items;
}

/** Junta os itens da nota; depois de "Aparelhos:" segue so um espaco. */
function joinNotes(items: string[]): string {
  return items.reduce((acc, item, i) => {
    if (i === 0) return item;
    return acc.endsWith(":") ? `${acc} ${item}` : `${acc}, ${item}`;
  }, "");
}

/** Timer de treino esquecido ligado para sozinho depois disso. */
const TIMER_MAX_MS = 3 * 60 * 60 * 1000;

function formatStopwatch(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const REST_VOLUME_KEY = "forja-rest-volume-v1";

function readRestVolume(): number {
  try {
    const raw = localStorage.getItem(REST_VOLUME_KEY);
    const n = raw !== null ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  } catch {
    return 0;
  }
}

/**
 * Três bipes curtos quando o timer de descanso termina — sem depender de
 * nenhum arquivo de áudio. `volume` vai de 0 (nível já reforçado de fábrica)
 * a 1 (o dobro disso); passa por um compressor pra ganho acima de 1 nao
 * estourar/distorcer feio, só ficar mais alto mesmo.
 */
function playRestBeep(volume = 0) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, ctx.currentTime);
    compressor.ratio.setValueAtTime(14, ctx.currentTime);
    compressor.connect(ctx.destination);
    const peak = 1 + Math.min(1, Math.max(0, volume));
    const tone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(compressor);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };
    // Mais agudo (onda quadrada, mais harmonicos, frequencias altas).
    tone(1760, 0, 0.16);
    tone(1760, 0.2, 0.16);
    tone(2349, 0.4, 0.3);
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // aparelho sem suporte a Web Audio — segue sem som, nao quebra o timer
  }
}

/**
 * Campo numerico com botõezinhos de mais (verde) e menos (vermelho) dentro
 * da caixa, alem de poder digitar direto. Espelha o Input padrao (mesmo
 * texto 24px), so acrescenta os steppers.
 */
const NumberField = forwardRef<
  HTMLInputElement,
  {
    value: number;
    onChange: (next: number) => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
  }
>(function NumberField(
  { value, onChange, min = 0, max = 999, step = 1, placeholder = "0", className, ...rest },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-16 pr-[3.75rem] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...rest}
      />
      <div className="absolute inset-y-1 right-1 flex w-[2.6rem] flex-col gap-0.5">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Aumentar"
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex flex-1 items-center justify-center rounded bg-ok text-background active:brightness-90"
        >
          <ChevronUp className="size-5" strokeWidth={3} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Diminuir"
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex flex-1 items-center justify-center rounded bg-danger text-background active:brightness-90"
        >
          <ChevronDown className="size-5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
});

export function WorkoutForm({
  initial,
  initialTimers,
  onSnapshot,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Workout;
  /** Cronômetros de um rascunho salvo, para retomar de onde pararam. */
  initialTimers?: NovoTimers;
  /** Chamado a cada mudança de campo/cronômetro (a tela Novo usa para guardar o rascunho). */
  onSnapshot?: (snapshot: NovoSnapshot) => void;
  submitLabel: string;
  onSubmit: (workout: Workout) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Workout>(initial);
  const [durationError, setDurationError] = useState("");
  const durationRef = useRef<HTMLInputElement>(null);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);
  const addAthlete = useWorkoutStore((s) => s.addAthlete);
  const customExtras = useWorkoutStore((s) => s.customExtras);
  const addExtraType = useWorkoutStore((s) => s.addExtraType);
  const allWorkouts = useWorkoutStore((s) => s.workouts);
  const [groupSheet, setGroupSheet] = useState(false);
  const [notesSheet, setNotesSheet] = useState(false);

  // Historico: grupos e notas ja usados em treinos anteriores (mais usados
  // primeiro), alem dos grupos de sempre.
  const groupOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    const add = (raw: string, n: number) => {
      const label = raw.trim().toLocaleLowerCase("pt-BR");
      if (!label) return;
      const key = label.toLowerCase();
      const cur = counts.get(key);
      if (cur) cur.count += n;
      else counts.set(key, { label, count: n });
    };
    for (const g of DEFAULT_MUSCLE_GROUPS) add(g, 0);
    for (const w of allWorkouts) for (const g of w.muscleGroups) add(g, 1);
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [allWorkouts]);

  const noteAthletes = useMemo(
    () => Array.from(new Set([...DEFAULT_ATHLETES, ...customAthletes, ...allWorkouts.flatMap((w) => w.athletes)])),
    [customAthletes, allWorkouts],
  );

  const noteOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    counts.set("aparelhos:", { label: "Aparelhos:", count: 0 });
    for (const w of allWorkouts) {
      for (const line of noteLines(w.notes, noteAthletes)) {
        const cur = counts.get(line.toLowerCase());
        if (cur) cur.count += 1;
        else counts.set(line.toLowerCase(), { label: line, count: 1 });
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
      .slice(0, 150);
  }, [allWorkouts, noteAthletes]);

  const athleteOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_ATHLETES, ...customAthletes, ...initial.athletes])),
    [customAthletes, initial.athletes],
  );

  // Itens de "Outros treinos" ja marcados neste treino, cada um com suas
  // proprias series/repeticoes — guardados no mesmo campo de texto livre
  // (extras) como "Pesos (3x12), Flexão (4x20)", pelo formato ja usado antes
  // ("Alteres 3x12") continuar reconhecido nos graficos (stats.ts). Um item
  // sem numero digitado ainda fica sem o "(SxR)".
  const extraOptions = useMemo(
    () => Array.from(new Set([...EXTRA_BASE_OPTIONS, ...customExtras])),
    [customExtras],
  );
  const extraItems = useMemo(
    () => parseExtras(draft.extras, draft.athletes),
    [draft.extras, draft.athletes],
  );
  // Agrupa as linhas por nome (uma ou mais por item, uma por atleta quando
  // "+ Atleta" foi usado), preservando o indice real de cada uma no array
  // plano usado para gravar (extras e so uma string).
  const extraGroups = useMemo(() => {
    const map = new Map<string, { item: ExtraItem; index: number }[]>();
    extraItems.forEach((item, index) => {
      const key = item.name.toLowerCase();
      const rows = map.get(key) ?? [];
      rows.push({ item, index });
      map.set(key, rows);
    });
    return [...map.values()];
  }, [extraItems]);

  function patch(partial: Partial<Workout>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function toggleExtra(name: string) {
    const has = extraItems.some((p) => p.name.toLowerCase() === name.toLowerCase());
    const next = has
      ? extraItems.filter((p) => p.name.toLowerCase() !== name.toLowerCase())
      : [...extraItems, { name, sets: 0, reps: 0 }];
    patch({ extras: formatExtras(next) });
  }

  function updateExtraAt(index: number, patchItem: Partial<ExtraItem>) {
    const next = extraItems.map((p, i) => (i === index ? { ...p, ...patchItem } : p));
    patch({ extras: formatExtras(next) });
  }

  function removeExtraAt(index: number) {
    patch({ extras: formatExtras(extraItems.filter((_, i) => i !== index)) });
  }

  /**
   * Uma segunda (ou terceira…) linha para o mesmo item, cada uma com seu
   * proprio atleta — igual ao "+ Linha" do Core, so que aqui já nasce ligada
   * a um atleta especifico (nao faz sentido "Ambos" quando ja tem duas
   * linhas separadas).
   */
  function addExtraAthleteRow(name: string) {
    const rows = extraItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.name.toLowerCase() === name.toLowerCase());
    const next = [...extraItems];
    const used = new Set(rows.map(({ item }) => item.athlete).filter((a): a is string => !!a));
    if (rows.length === 1 && !rows[0].item.athlete) {
      const first = draft.athletes[0];
      next[rows[0].index] = { ...rows[0].item, athlete: first };
      used.add(first);
    }
    next.push({ name, sets: 0, reps: 0, athlete: draft.athletes.find((a) => !used.has(a)) });
    patch({ extras: formatExtras(next) });
  }

  function handleNewExtraType() {
    const name = window.prompt("Nome do novo tipo de treino (ex.: Elástico, Escalada…)")?.trim();
    if (!name) return;
    addExtraType(name);
    if (!extraItems.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      patch({ extras: formatExtras([...extraItems, { name, sets: 0, reps: 0 }]) });
    }
  }

  function handleNewAthlete() {
    const name = window.prompt("Nome do novo atleta")?.trim();
    if (!name) return;
    addAthlete(name);
    setDraft((prev) =>
      prev.athletes.includes(name) ? prev : { ...prev, athletes: [...prev.athletes, name] },
    );
  }

  function toggleAthlete(name: string) {
    patch({
      athletes: draft.athletes.includes(name)
        ? draft.athletes.filter((a) => a !== name)
        : [...draft.athletes, name],
    });
  }

  // Mais de um foco no mesmo treino: o primeiro segue em `focus` (estatisticas
  // e filtros) e todos ficam no rotulo "Pernas + Braços", que ja e salvo.
  const foci: Focus[] = workoutFoci(draft);

  function toggleGroup(label: string) {
    const key = label.toLowerCase();
    const current = draft.muscleGroups.map((g) => g.trim()).filter(Boolean);
    const has = current.some((g) => g.toLowerCase() === key);
    patch({
      muscleGroups: has ? current.filter((g) => g.toLowerCase() !== key) : [...current, label],
    });
  }

  function toggleNote(label: string) {
    const key = label.toLowerCase();
    const lines = noteLines(draft.notes, noteAthletes);
    if (lines.some((l) => l.toLowerCase() === key)) {
      patch({ notes: joinNotes(lines.filter((l) => l.toLowerCase() !== key)) });
    } else {
      patch({ notes: joinNotes([...lines, label]) });
    }
  }

  function setFoci(list: Focus[]) {
    patch({ focus: list[0], focusLabel: list.map((f) => FOCUS_LABEL[f]).join(" + ") });
  }

  function changeFocusAt(index: number, focus: Focus) {
    setFoci(foci.map((f, i) => (i === index ? focus : f)));
  }

  function addFocus() {
    const next = FOCUS_ORDER.find((f) => !foci.includes(f));
    if (next) setFoci([...foci, next]);
  }

  function removeFocusAt(index: number) {
    setFoci(foci.filter((_, i) => i !== index));
  }

  // Timer do treino: aperta pra começar, aperta de novo pra terminar — o
  // tempo contado vai direto pra Duração (sobrescrevendo o que estava la).
  // Ao parar, o mostrador fica parado no tempo final (nao volta pra 00:00)
  // ate a proxima vez que o timer for iniciado. So conta enquanto esta tela
  // fica aberta, como o resto do rascunho.
  const [timerRunning, setTimerRunning] = useState(initialTimers?.timerRunning ?? false);
  const [timerStart, setTimerStart] = useState<number | null>(initialTimers?.timerStart ?? null);
  const [timerFinalMs, setTimerFinalMs] = useState<number | null>(
    initialTimers?.timerFinalMs ?? null,
  );
  const [, setTimerTick] = useState(0);

  // Esqueceu o timer ligado: passou de 3h, ele para sozinho em 3h exatas e
  // deixa esse tempo na Duração. Vale também ao reabrir um rascunho salvo
  // (a conferência roda na hora). A tela segue aberta até Cancelar/Salvar.
  useEffect(() => {
    if (!timerRunning || !timerStart) return;
    const finishIfDue = () => {
      if (Date.now() - timerStart < TIMER_MAX_MS) return false;
      setTimerRunning(false);
      setTimerStart(null);
      setTimerFinalMs(TIMER_MAX_MS);
      setDurationError("");
      setDraft((prev) => ({ ...prev, durationMin: TIMER_MAX_MS / 60000 }));
      toast.info("O timer de treino parou em 3h e a duração ficou em 3h.");
      return true;
    };
    if (finishIfDue()) return;
    const id = setInterval(() => {
      if (!finishIfDue()) setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerStart]);

  const timerElapsedMs =
    timerRunning && timerStart
      ? Math.min(Date.now() - timerStart, TIMER_MAX_MS)
      : (timerFinalMs ?? 0);

  function handleTimerToggle() {
    if (timerRunning) {
      const elapsedMs = timerStart ? Math.min(Date.now() - timerStart, TIMER_MAX_MS) : 0;
      const minutes = Math.max(0, Math.round(elapsedMs / 60000));
      setTimerRunning(false);
      setTimerStart(null);
      setTimerFinalMs(elapsedMs);
      setDurationError("");
      patch({ durationMin: minutes });
    } else {
      setTimerStart(Date.now());
      setTimerFinalMs(null);
      setTimerRunning(true);
    }
  }

  // Timer de descanso: uma contagem regressiva entre series. Ajusta de 15 em
  // 15s com os botõezinhos (verde aumenta, vermelho diminui — ajustam o
  // tempo configurado parado, ou a contagem ao vivo se ja estiver rodando),
  // avisa com um som quando chega a zero, e o "excluir" cancela e volta pro
  // padrao de 1 minuto. Nao e salvo no treino, e so uma ferramenta de apoio
  // enquanto essa tela fica aberta.
  const REST_DEFAULT_SECONDS = 60;
  const REST_STEP_SECONDS = 15;
  const REST_MIN_SECONDS = 15;
  const REST_MAX_SECONDS = 600;
  const [restSeconds, setRestSeconds] = useState(initialTimers?.restSeconds ?? REST_DEFAULT_SECONDS);
  const [restRunning, setRestRunning] = useState(initialTimers?.restRunning ?? false);
  const [restEndAt, setRestEndAt] = useState<number | null>(initialTimers?.restEndAt ?? null);
  const [, setRestTick] = useState(0);
  const [restVolume, setRestVolume] = useState(readRestVolume);
  const restPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onSnapshot?.({
      workout: draft,
      timers: { timerRunning, timerStart, timerFinalMs, restSeconds, restRunning, restEndAt },
    });
  }, [
    onSnapshot,
    draft,
    timerRunning,
    timerStart,
    timerFinalMs,
    restSeconds,
    restRunning,
    restEndAt,
  ]);

  useEffect(() => {
    if (!restRunning || !restEndAt) return;
    const id = setInterval(() => {
      if (Date.now() >= restEndAt) {
        setRestRunning(false);
        setRestEndAt(null);
        playRestBeep(restVolume);
      } else {
        setRestTick((t) => t + 1);
      }
    }, 250);
    return () => clearInterval(id);
  }, [restRunning, restEndAt, restVolume]);

  function handleRestVolumeChange(next: number) {
    const clamped = Math.min(1, Math.max(0, next));
    setRestVolume(clamped);
    try {
      localStorage.setItem(REST_VOLUME_KEY, String(clamped));
    } catch {
      // Privado/sem espaco: so nao salva a preferencia pra proxima vez.
    }
    if (restPreviewTimeout.current) clearTimeout(restPreviewTimeout.current);
    restPreviewTimeout.current = setTimeout(() => playRestBeep(clamped), 150);
  }

  const restRemainingMs =
    restRunning && restEndAt ? Math.max(0, restEndAt - Date.now()) : restSeconds * 1000;

  function handleRestToggle() {
    if (restRunning) {
      setRestRunning(false);
      setRestEndAt(null);
    } else {
      setRestEndAt(Date.now() + restSeconds * 1000);
      setRestRunning(true);
    }
  }

  function adjustRest(deltaSeconds: number) {
    if (restRunning) {
      setRestEndAt((prev) =>
        Math.max(Date.now() + 1000, (prev ?? Date.now()) + deltaSeconds * 1000),
      );
    } else {
      setRestSeconds((s) =>
        Math.max(REST_MIN_SECONDS, Math.min(REST_MAX_SECONDS, s + deltaSeconds)),
      );
    }
  }

  function handleRestReset() {
    setRestRunning(false);
    setRestEndAt(null);
    setRestSeconds(REST_DEFAULT_SECONDS);
  }

  const cardioRows = draft.cardio.filter((row) => row.kind.trim() && row.minutes > 0);
  const cardioTotal = cardioRows.reduce((sum, row) => sum + row.minutes, 0);
  const coreRows = draft.core.filter((row) => row.exercise.trim());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.date) return;

    // Duracao so e exigida quando nao ha outra referencia de tempo: o cardio
    // ja traz os proprios minutos; musculacao e core nao.
    let durationMin = draft.durationMin;
    if (durationMin <= 0) {
      if (cardioTotal > 0) {
        durationMin = cardioTotal;
      } else {
        const what =
          draft.machines > 0 ? "da musculação" : coreRows.length > 0 ? "do core" : "do treino";
        setDurationError(
          `Por favor, informe o tempo de duração ${what} (em minutos).`,
        );
        durationRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        durationRef.current?.focus({ preventScroll: true });
        return;
      }
    }
    setDurationError("");
    onSubmit({
      ...draft,
      durationMin,
      muscleGroups: draft.muscleGroups.map((g) => g.trim()).filter(Boolean),
      extras: draft.extras.trim(),
      notes: draft.notes.trim(),
      core: coreRows,
      cardio: cardioRows,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Data">
        <Input
          type="date"
          required
          value={draft.date}
          onChange={(e) => patch({ date: e.target.value })}
        />
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label>Foco</Label>
          {foci.length < FOCUS_ORDER.length && (
            <button
              type="button"
              onClick={addFocus}
              className="flex min-h-9 items-center gap-1 rounded-full px-3 text-[18px] font-medium text-accent ring-1 ring-accent/50"
            >
              <Plus className="size-4" />
              Mais um foco
            </button>
          )}
        </div>
        {foci.map((focus, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Segmented
                value={focus}
                onChange={(next: Focus) => changeFocusAt(index, next)}
                isDisabled={(v) => v !== focus && foci.includes(v)}
                options={FOCUS_ORDER.map((f) => ({ value: f, label: FOCUS_LABEL[f] }))}
              />
            </div>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeFocusAt(index)}
                aria-label="Remover foco"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Field label="Intensidade">
        <Segmented
          value={draft.intensity}
          onChange={(intensity: Intensity) => patch({ intensity })}
          options={(Object.keys(INTENSITY_LABEL) as Intensity[]).map((value) => ({
            value,
            label: INTENSITY_LABEL[value],
          }))}
        />
      </Field>

      <Field label="Atletas">
        <div className="flex flex-wrap gap-2">
          {athleteOptions.map((name) => {
            const on = draft.athletes.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleAthlete(name)}
                className={cn(
                  "min-h-14 rounded-full px-5 text-[24px] font-medium transition-colors duration-150",
                  on ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleNewAthlete}
            className="inline-flex min-h-14 items-center gap-1 rounded-full border border-dashed border-border px-5 text-[24px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <Plus className="size-6" />
            Novo
          </button>
        </div>
      </Field>

      <Field label="Timer de treino">
        <div className="flex items-center justify-between rounded-2xl bg-muted px-5 py-4">
          <div>
            <p className="font-display text-4xl tabular-nums tracking-tight text-foreground">
              {formatStopwatch(timerElapsedMs)}
            </p>
            <p className="mt-0.5 text-[21px] text-faint">
              {timerRunning
                ? "Contando… toque para finalizar"
                : timerFinalMs !== null
                  ? "Parado — toque para iniciar de novo"
                  : "Toque para iniciar o treino"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleTimerToggle}
            aria-label={timerRunning ? "Finalizar timer" : "Iniciar timer"}
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
              timerRunning ? "bg-danger text-background" : "bg-ok text-background",
            )}
          >
            {timerRunning ? (
              <Square className="size-7" fill="currentColor" />
            ) : (
              <Play className="size-8 translate-x-0.5" fill="currentColor" />
            )}
          </button>
        </div>
      </Field>

      <Field label="Timer de descanso">
        <div className="rounded-2xl bg-muted px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-4xl tabular-nums tracking-tight text-foreground">
                {formatStopwatch(restRemainingMs)}
              </p>
              <p className="mt-0.5 text-[21px] text-faint">
                {restRunning
                  ? "Contando o descanso… vai avisar sozinho"
                  : "Toque para iniciar o descanso entre séries"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestToggle}
              aria-label={restRunning ? "Parar timer de descanso" : "Iniciar timer de descanso"}
              className={cn(
                "flex size-16 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                restRunning ? "bg-danger text-background" : "bg-ok text-background",
              )}
            >
              {restRunning ? (
                <Square className="size-7" fill="currentColor" />
              ) : (
                <Play className="size-8 translate-x-0.5" fill="currentColor" />
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuir tempo de descanso"
              onClick={() => adjustRest(-REST_STEP_SECONDS)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger text-background active:brightness-90"
            >
              <ChevronDown className="size-6" strokeWidth={3} />
            </button>
            <button
              type="button"
              aria-label="Aumentar tempo de descanso"
              onClick={() => adjustRest(REST_STEP_SECONDS)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok text-background active:brightness-90"
            >
              <ChevronUp className="size-6" strokeWidth={3} />
            </button>
            <p className="flex-1 text-center text-[21px] tabular-nums text-faint">
              {restRunning ? "ajustar o tempo que falta" : `ajustar: ${formatStopwatch(restSeconds * 1000)}`}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Excluir / reiniciar timer de descanso"
              onClick={handleRestReset}
            >
              <Trash2 />
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Volume2 className="size-5 shrink-0 text-faint" />
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={Math.round(restVolume * 100)}
              onChange={(e) => handleRestVolumeChange(Number(e.target.value) / 100)}
              aria-label="Volume do aviso sonoro do timer de descanso"
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-ok [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ok [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ok"
            />
            <span className="w-14 shrink-0 text-right text-[21px] tabular-nums text-faint">
              {Math.round(restVolume * 100)}%
            </span>
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field label="Duração (min)">
          <NumberField
            ref={durationRef}
            min={0}
            max={300}
            step={5}
            value={draft.durationMin}
            onChange={(v) => {
              setDurationError("");
              patch({ durationMin: v });
            }}
          />
          {draft.durationMin > 0 ? (
            <p className="mt-1 text-[24px] tabular-nums text-faint">
              {formatDuration(draft.durationMin)}
            </p>
          ) : cardioTotal > 0 ? (
            <p className="mt-1 text-[24px] text-faint">
              Vale o tempo do cardio: {formatDuration(cardioTotal)}
            </p>
          ) : null}
        </Field>
        <Field label="Aparelhos">
          <NumberField
            min={0}
            max={20}
            value={draft.machines}
            onChange={(v) => patch({ machines: v })}
          />
        </Field>
        <Field label="Séries">
          <NumberField min={0} max={10} value={draft.sets} onChange={(v) => patch({ sets: v })} />
        </Field>
        <Field label="Repetições">
          <NumberField min={0} max={50} value={draft.reps} onChange={(v) => patch({ reps: v })} />
        </Field>
      </div>

      {durationError && (
        <p
          role="alert"
          className="rounded-lg bg-danger/10 px-4 py-3 text-[24px] leading-snug text-danger"
        >
          {durationError}
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label>Grupo muscular</Label>
          <button
            type="button"
            onClick={() => setGroupSheet(true)}
            className="flex min-h-9 items-center gap-1 rounded-full px-3 text-[18px] font-medium text-accent ring-1 ring-accent/50"
          >
            <List className="size-4" />
            Escolher da lista
          </button>
        </div>
        <Input
          placeholder="coxas, posteriores, peito…"
          value={draft.muscleGroups.join(", ")}
          onChange={(e) =>
            patch({
              muscleGroups: e.target.value.split(",").map((s) => s.trimStart()),
            })
          }
        />
      </div>
      <SuggestionSheet
        open={groupSheet}
        onClose={() => setGroupSheet(false)}
        title="Grupo muscular"
        hint="Toque para marcar ou desmarcar"
        options={groupOptions}
        isSelected={(g) => draft.muscleGroups.some((x) => x.trim().toLowerCase() === g.toLowerCase())}
        onToggle={toggleGroup}
        emptyText="Nenhum grupo encontrado."
      />

      <Field label="Outros treinos">
        <div className="flex flex-wrap gap-2">
          {extraOptions.map((name) => {
            const on = extraItems.some((p) => p.name.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleExtra(name)}
                className={cn(
                  "min-h-14 rounded-full px-5 text-[24px] font-medium transition-colors duration-150",
                  on ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleNewExtraType}
            className="inline-flex min-h-14 items-center gap-1 rounded-full border border-dashed border-border px-5 text-[24px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <Plus className="size-6" />
            Novo
          </button>
        </div>

        {extraGroups.length > 0 && (
          <div className="mt-3 space-y-4">
            {extraGroups.map((rows) => {
              const name = rows[0].item.name;
              const split = rows.length > 1;
              return (
                <div key={name}>
                  <p className="text-[24px] text-faint">{name}</p>
                  <div className="mt-1 space-y-3">
                    {rows.map(({ item, index }, i) => (
                      <div key={index}>
                        <div className="flex items-start gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <NumberField
                              min={0}
                              max={10}
                              value={item.sets}
                              aria-label={`Séries de ${name}${split ? ` ${i + 1}` : ""}`}
                              onChange={(v) => updateExtraAt(index, { sets: v })}
                            />
                            <NumberField
                              min={0}
                              max={50}
                              value={item.reps}
                              aria-label={`Repetições de ${name}${split ? ` ${i + 1}` : ""}`}
                              onChange={(v) => updateExtraAt(index, { reps: v })}
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-14 shrink-0"
                            aria-label={`Remover ${name}${item.athlete ? ` de ${item.athlete}` : ""}`}
                            onClick={() => removeExtraAt(index)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        {draft.athletes.length > 1 && (
                          <div className="mt-1.5">
                            <Segmented
                              value={item.athlete ?? "todos"}
                              onChange={(athlete: string) =>
                                updateExtraAt(index, {
                                  athlete: athlete === "todos" ? undefined : athlete,
                                })
                              }
                              options={
                                split
                                  ? draft.athletes.map((a) => ({ value: a, label: a }))
                                  : [
                                      { value: "todos", label: "Ambos" },
                                      ...draft.athletes.map((a) => ({ value: a, label: a })),
                                    ]
                              }
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {draft.athletes.length > 1 && rows.length < draft.athletes.length && (
                    <button
                      type="button"
                      onClick={() => addExtraAthleteRow(name)}
                      className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-4 text-[21px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      <Plus className="size-5" />
                      Atleta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Field>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Core</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-12 text-[24px] [&_svg]:size-6"
            onClick={() =>
              patch({
                core: [...draft.core, { exercise: "Abdominal", sets: 3, reps: 12 }],
              })
            }
          >
            <Plus />
            Linha
          </Button>
        </div>
        {draft.core.length === 0 ? (
          <p className="text-[24px] text-faint">Nenhum exercício de core.</p>
        ) : (
          <div className="space-y-2">
            {draft.core.map((row, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-12"
                  value={row.exercise}
                  onChange={(e) => {
                    const next = [...draft.core];
                    next[index] = { ...row, exercise: e.target.value };
                    patch({ core: next });
                  }}
                />
                <NumberField
                  className="col-span-5"
                  min={0}
                  max={20}
                  value={row.sets}
                  onChange={(v) => {
                    const next = [...draft.core];
                    next[index] = { ...row, sets: v };
                    patch({ core: next });
                  }}
                />
                <NumberField
                  className="col-span-5"
                  min={0}
                  max={100}
                  value={row.reps}
                  onChange={(v) => {
                    const next = [...draft.core];
                    next[index] = { ...row, reps: v };
                    patch({ core: next });
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="col-span-2 h-14"
                  aria-label="Remover core"
                  onClick={() => patch({ core: draft.core.filter((_, i) => i !== index) })}
                >
                  <Trash2 />
                </Button>
                <Input
                  className="col-span-12"
                  placeholder="Atleta (opcional)"
                  value={row.athlete ?? ""}
                  onChange={(e) => {
                    const next = [...draft.core];
                    next[index] = { ...row, athlete: e.target.value || undefined };
                    patch({ core: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Cardio</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-12 text-[24px] [&_svg]:size-6"
            onClick={() => patch({ cardio: [...draft.cardio, { kind: "Bike", minutes: 0 }] })}
          >
            <Plus />
            Linha
          </Button>
        </div>
        {draft.cardio.length === 0 ? (
          <p className="text-[24px] text-faint">Nenhum cardio.</p>
        ) : (
          <div className="space-y-2">
            {draft.cardio.map((row, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-5"
                  value={row.kind}
                  onChange={(e) => {
                    const next = [...draft.cardio];
                    next[index] = { ...row, kind: e.target.value };
                    patch({ cardio: next });
                  }}
                />
                <NumberField
                  className="col-span-5"
                  min={0}
                  max={300}
                  step={5}
                  value={row.minutes}
                  onChange={(v) => {
                    const next = [...draft.cardio];
                    next[index] = { ...row, minutes: v };
                    patch({ cardio: next });
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="col-span-2 h-14"
                  aria-label="Remover cardio"
                  onClick={() => patch({ cardio: draft.cardio.filter((_, i) => i !== index) })}
                >
                  <Trash2 />
                </Button>
                <Input
                  className="col-span-12"
                  placeholder="Atleta (opcional)"
                  value={row.athlete ?? ""}
                  onChange={(e) => {
                    const next = [...draft.cardio];
                    next[index] = { ...row, athlete: e.target.value || undefined };
                    patch({ cardio: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label>Notas</Label>
          <button
            type="button"
            onClick={() => setNotesSheet(true)}
            className="flex min-h-9 items-center gap-1 rounded-full px-3 text-[18px] font-medium text-accent ring-1 ring-accent/50"
          >
            <History className="size-4" />
            Histórico
          </button>
        </div>
        <Textarea
          rows={3}
          placeholder="Como foi o treino…"
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>
      <SuggestionSheet
        open={notesSheet}
        onClose={() => setNotesSheet(false)}
        title="Histórico de notas"
        hint="Toque num item para acrescentar ou tirar da nota"
        options={noteOptions}
        isSelected={(n) => noteLines(draft.notes, noteAthletes).some((l) => l.toLowerCase() === n.toLowerCase())}
        onToggle={toggleNote}
        emptyText="Nenhuma nota anterior."
      />

      <div className="sticky bottom-0 -mx-5 mt-2 flex gap-2 border-t border-border bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <Button
          type="button"
          variant="secondary"
          className="h-14 flex-1 text-[24px]"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" className="h-14 flex-1 text-[24px]">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  isDisabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  isDisabled?: (value: T) => boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled?.(opt.value)}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-14 rounded-md text-[24px] font-medium transition-colors duration-150 disabled:opacity-35",
              on ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
