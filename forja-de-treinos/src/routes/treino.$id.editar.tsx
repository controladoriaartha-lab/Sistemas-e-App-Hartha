import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { WorkoutForm } from "@/components/workout-form";
import { Button } from "@/components/ui/button";
import { useWorkoutStore } from "@/store/workouts";

export const Route = createFileRoute("/treino/$id/editar")({ component: EditWorkoutPage });

function EditWorkoutPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const workout = useWorkoutStore((s) => s.workouts.find((w) => w.id === id));
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);

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

  return (
    <main className="relative px-5 pb-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Voltar"
          onClick={() => navigate({ to: "/treino/$id", params: { id: workout.id } })}
        >
          <ArrowLeft />
        </Button>
        <div>
          <p className="text-2xs font-medium uppercase tracking-widest text-accent">Editar</p>
          <h1 className="font-display text-2xl font-medium tracking-tight">{workout.focusLabel}</h1>
        </div>
      </header>
      <WorkoutForm
        key={workout.id}
        initial={workout}
        submitLabel="Salvar alterações"
        onCancel={() => navigate({ to: "/treino/$id", params: { id: workout.id } })}
        onSubmit={(next) => {
          updateWorkout(workout.id, next);
          toast.success("Alterações salvas");
          void navigate({ to: "/treino/$id", params: { id: workout.id } });
        }}
      />
    </main>
  );
}
