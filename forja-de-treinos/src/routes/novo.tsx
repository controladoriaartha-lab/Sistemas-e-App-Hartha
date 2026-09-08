import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { WorkoutForm } from "@/components/workout-form";
import { Button } from "@/components/ui/button";
import { createBlankWorkout, useWorkoutStore } from "@/store/workouts";

export const Route = createFileRoute("/novo")({ component: NewWorkoutPage });

function NewWorkoutPage() {
  const navigate = useNavigate();
  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const [draft] = useState(() => createBlankWorkout());

  return (
    <main className="relative px-5 pb-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft />
        </Button>
        <div>
          <p className="text-2xs font-medium uppercase tracking-widest text-accent">Novo</p>
          <h1 className="font-display text-2xl font-medium tracking-tight">Inserir treino</h1>
        </div>
      </header>
      <WorkoutForm
        initial={draft}
        submitLabel="Salvar treino"
        onCancel={() => navigate({ to: "/" })}
        onSubmit={(workout) => {
          addWorkout(workout);
          toast.success("Treino registrado");
          void navigate({ to: "/treino/$id", params: { id: workout.id } });
        }}
      />
    </main>
  );
}
