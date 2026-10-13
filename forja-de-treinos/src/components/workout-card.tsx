import type { MouseEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IntensityBadge } from "@/components/intensity-badge";
import { displayExtras, formatDayMonth, formatDuration, formatWeekday } from "@/lib/format";
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

  const day = workout.date.slice(8, 10);
  const month = formatDayMonth(workout.date).split(" ")[1] ?? "";
  const chips = workout.muscleGroups.filter((g) => g.trim());

  return (
    <article className="glass-card p-4">
      <Link to="/treino/$id" params={{ id: workout.id }} className="block">
        <header className="flex items-start gap-3.5">
          <div className="date-block shrink-0">
            <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.14em] text-accent">
              {month}
            </span>
            <span className="halo-text mt-1 font-display text-[40px] font-semibold leading-none tabular-nums text-foreground">
              {day}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 font-display text-2xl font-medium leading-tight tracking-tight text-foreground">
                {workout.focusLabel}
              </h2>
              <IntensityBadge intensity={workout.intensity} />
            </div>
            <p className="mt-1.5 text-[18px] leading-snug first-letter:uppercase text-muted-foreground">
              {formatWeekday(workout.date)}
            </p>
          </div>
        </header>

        <p className="mt-4 text-2xl font-normal text-muted-foreground">
          <span className="tabular-nums text-foreground">{formatDuration(workout.durationMin)}</span>
          <span className="mx-2 text-faint">·</span>
          {workout.athletes.join(", ")}
        </p>

        <dl className="mt-4 space-y-3 text-2xl font-normal leading-snug">
          <Row
            label="Musculação"
            value={
              workout.machines
                ? `${String(workout.machines).padStart(2, "0")} aparelhos (${workout.sets}×${workout.reps})`
                : "—"
            }
          />
          {workout.extras ? <Row label="Outros treinos" value={displayExtras(workout.extras)} /> : null}
          {workout.core.map((row, i) => (
            <Row
              key={`${row.exercise}-${i}`}
              label="Core"
              value={`${row.exercise} (${row.sets}×${row.reps})${row.athlete ? ` ${row.athlete}` : ""}`}
            />
          ))}
          {workout.cardio.map((row, i) => (
            <Row key={`${row.kind}-${i}`} label="Cardio" value={`${row.kind} (${row.minutes} min)${row.athlete ? ` ${row.athlete}` : ""}`} />
          ))}
          {workout.notes ? <Row label="Nota" value={workout.notes} /> : null}
        </dl>

        {chips.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[24px] text-faint">Grupo muscular</p>
            <ul className="flex flex-wrap gap-2">
              {chips.map((group, i) => (
                <li key={`${group}-${i}`} className="chip-3d first-letter:uppercase" data-hot={i < 2}>
                  {group}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Link>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="ghost" className="btn-3d h-14 text-[24px] [&_svg]:size-6" onClick={onDuplicate}>
          <Copy />
          Duplicar
        </Button>
        <Button variant="ghost" className="btn-3d h-14 text-[24px] [&_svg]:size-6" asChild>
          <Link to="/treino/$id/editar" params={{ id: workout.id }}>
            <Pencil />
            Editar
          </Link>
        </Button>
      </div>
      <Button
        variant="ghost"
        data-danger="true"
        className="btn-3d mt-3 h-14 w-full text-[24px] [&_svg]:size-6"
        onClick={onDelete}
      >
        <Trash2 />
        Excluir
      </Button>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-faint">{label}</dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}
