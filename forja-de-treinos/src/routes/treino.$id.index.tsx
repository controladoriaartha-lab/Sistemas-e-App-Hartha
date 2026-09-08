import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IntensityBadge } from "@/components/intensity-badge";
import { Button } from "@/components/ui/button";
import { formatDuration, formatFullDate, formatWeekday } from "@/lib/format";
import { useWorkoutStore } from "@/store/workouts";
import type { Workout } from "@/lib/types";

export const Route = createFileRoute("/treino/$id/")({ component: WorkoutDetailPage });

function WorkoutDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const workout = useWorkoutStore((s) => s.workouts.find((w) => w.id === id));
  const duplicateWorkout = useWorkoutStore((s) => s.duplicateWorkout);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);

  if (!workout) {
    return (
      <main className="px-5 pt-16 text-center">
        <p className="font-display text-2xl">Treino não encontrado</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
          Voltar ao diário
        </Button>
      </main>
    );
  }

  return <WorkoutDetail workout={workout} duplicateWorkout={duplicateWorkout} deleteWorkout={deleteWorkout} />;
}

function WorkoutDetail({
  workout,
  duplicateWorkout,
  deleteWorkout,
}: {
  workout: Workout;
  duplicateWorkout: (id: string) => string | null;
  deleteWorkout: (id: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <main className="relative px-5 pb-28 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            {formatWeekday(workout.date)}
          </p>
          <h1 className="font-display text-2xl font-medium tracking-tight">{workout.focusLabel}</h1>
        </div>
        <IntensityBadge intensity={workout.intensity} />
      </header>

      <p className="text-sm text-muted-foreground">{formatFullDate(workout.date)}</p>
      <p className="mt-1 text-sm">
        <span className="tabular-nums text-foreground">{formatDuration(workout.durationMin)}</span>
        <span className="mx-2 text-faint">·</span>
        {workout.athletes.join(", ")}
      </p>

      <dl className="mt-6 space-y-3 rounded-xl bg-card p-4 text-sm shadow-[0_0_0_1px_rgba(244,239,232,0.08)]">
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const nextId = duplicateWorkout(workout.id);
            if (!nextId) return;
            toast.success("Treino duplicado para hoje");
            void navigate({ to: "/treino/$id/editar", params: { id: nextId } });
          }}
        >
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
      <Button
        variant="destructive"
        className="mt-2 w-full"
        onClick={() => {
          if (!window.confirm("Excluir este treino?")) return;
          deleteWorkout(workout.id);
          toast.success("Treino excluído");
          void navigate({ to: "/" });
        }}
      >
        <Trash2 />
        Excluir
      </Button>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
