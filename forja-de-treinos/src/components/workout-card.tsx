import type { MouseEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IntensityBadge } from "@/components/intensity-badge";
import { formatDayMonth, formatDuration, formatWeekday } from "@/lib/format";
import type { Workout } from "@/lib/types";
import { useWorkoutStore } from "@/store/workouts";

export function WorkoutCard({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const duplicateWorkout = useWorkoutStore((s) => s.duplicateWorkout);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);

  function onDuplicate(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const id = duplicateWorkout(workout.id);
    if (!id) return;
    toast.success("Treino duplicado para hoje");
    void navigate({ to: "/treino/$id/editar", params: { id } });
  }

  function onDelete(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm("Excluir este treino?")) return;
    deleteWorkout(workout.id);
    toast.success("Treino excluído");
  }

  return (
    <article className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_rgba(244,239,232,0.08)]">
      <Link to="/treino/$id" params={{ id: workout.id }} className="block">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
              {formatDayMonth(workout.date)} · {formatWeekday(workout.date)}
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground">
              {workout.focusLabel}
            </h2>
          </div>
          <IntensityBadge intensity={workout.intensity} />
        </header>

        <p className="mt-2 text-sm text-muted-foreground">
          <span className="tabular-nums text-foreground">{formatDuration(workout.durationMin)}</span>
          <span className="mx-2 text-faint">·</span>
          {workout.athletes.join(", ")}
        </p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <Row
            label="Musculação"
            value={
              workout.machines
                ? `${String(workout.machines).padStart(2, "0")} aparelhos (${workout.sets}×${workout.reps})`
                : "—"
            }
          />
          {workout.muscleGroups.length > 0 && (
            <Row label="Grupo muscular" value={workout.muscleGroups.join(", ")} />
          )}
          {workout.extras ? <Row label="Extra" value={workout.extras} /> : null}
          {workout.core.map((row, i) => (
            <Row
              key={`${row.exercise}-${i}`}
              label="Core"
              value={`${row.exercise} (${row.sets}×${row.reps})${row.athlete ? ` ${row.athlete}` : ""}`}
            />
          ))}
          {workout.cardio.map((row, i) => (
            <Row key={`${row.kind}-${i}`} label="Cardio" value={`${row.kind} (${row.minutes} min)`} />
          ))}
          {workout.notes ? <Row label="Nota" value={workout.notes} /> : null}
        </dl>
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onDuplicate}>
          <Copy />
          Duplicar
        </Button>
        <Button variant="outline" asChild>
          <Link to="/treino/$id/editar" params={{ id: workout.id }}>
            <Pencil />
            Editar
          </Link>
        </Button>
      </div>
      <Button variant="destructive" className="mt-2 w-full" onClick={onDelete}>
        <Trash2 />
        Excluir
      </Button>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}
