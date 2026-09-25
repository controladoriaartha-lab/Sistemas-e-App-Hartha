import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ATHLETES,
  FOCUS_LABEL,
  INTENSITY_LABEL,
  type Focus,
  type Intensity,
  type Workout,
} from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { useWorkoutStore } from "@/store/workouts";

export function WorkoutForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Workout;
  submitLabel: string;
  onSubmit: (workout: Workout) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Workout>(initial);
  const [durationError, setDurationError] = useState("");
  const durationRef = useRef<HTMLInputElement>(null);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);
  const addAthlete = useWorkoutStore((s) => s.addAthlete);

  const athleteOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_ATHLETES, ...customAthletes, ...initial.athletes])),
    [customAthletes, initial.athletes],
  );

  function patch(partial: Partial<Workout>) {
    setDraft((prev) => ({ ...prev, ...partial }));
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

  function setFocus(focus: Focus) {
    patch({ focus, focusLabel: FOCUS_LABEL[focus] });
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

      <Field label="Foco">
        <Segmented
          value={draft.focus}
          onChange={setFocus}
          options={[
            { value: "pernas", label: "Pernas" },
            { value: "bracos", label: "Braços" },
            { value: "outro", label: "Outro" },
          ]}
        />
      </Field>

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

      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field label="Duração (min)">
          <Input
            type="number"
            ref={durationRef}
            min={0}
            max={300}
            value={draft.durationMin || ""}
            placeholder="0"
            onChange={(e) => {
              setDurationError("");
              patch({ durationMin: Number(e.target.value) || 0 });
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
          <Input
            type="number"
            min={0}
            max={20}
            value={draft.machines || ""}
            placeholder="0"
            onChange={(e) => patch({ machines: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Séries">
          <Input
            type="number"
            min={0}
            max={10}
            value={draft.sets || ""}
            placeholder="0"
            onChange={(e) => patch({ sets: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Repetições">
          <Input
            type="number"
            min={0}
            max={50}
            value={draft.reps || ""}
            placeholder="0"
            onChange={(e) => patch({ reps: Number(e.target.value) || 0 })}
          />
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

      <Field label="Grupo muscular">
        <Input
          placeholder="coxas, posteriores, peito…"
          value={draft.muscleGroups.join(", ")}
          onChange={(e) =>
            patch({
              muscleGroups: e.target.value.split(",").map((s) => s.trimStart()),
            })
          }
        />
      </Field>

      <Field label="Extra">
        <Input
          placeholder="halteres, observação rápida…"
          value={draft.extras}
          onChange={(e) => patch({ extras: e.target.value })}
        />
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
                <Input
                  className="col-span-5"
                  type="number"
                  min={0}
                  value={row.sets || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const next = [...draft.core];
                    next[index] = { ...row, sets: Number(e.target.value) || 0 };
                    patch({ core: next });
                  }}
                />
                <Input
                  className="col-span-5"
                  type="number"
                  min={0}
                  value={row.reps || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const next = [...draft.core];
                    next[index] = { ...row, reps: Number(e.target.value) || 0 };
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
                  className="col-span-6"
                  value={row.kind}
                  onChange={(e) => {
                    const next = [...draft.cardio];
                    next[index] = { ...row, kind: e.target.value };
                    patch({ cardio: next });
                  }}
                />
                <Input
                  className="col-span-4"
                  type="number"
                  min={0}
                  value={row.minutes || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const next = [...draft.cardio];
                    next[index] = { ...row, minutes: Number(e.target.value) || 0 };
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
              </div>
            ))}
          </div>
        )}
      </section>

      <Field label="Notas">
        <Textarea
          rows={3}
          placeholder="Como foi o treino…"
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>

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
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-14 rounded-md text-[24px] font-medium transition-colors duration-150",
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
