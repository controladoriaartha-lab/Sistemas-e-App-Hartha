import { useCallback, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { WorkoutForm } from "@/components/workout-form";
import { Button } from "@/components/ui/button";
import {
  clearNovoDraft,
  isPristineNovo,
  loadNovoDraft,
  saveNovoDraft,
  type NovoSnapshot,
} from "@/lib/novo-draft";
import { createBlankWorkout, useWorkoutStore } from "@/store/workouts";

export const Route = createFileRoute("/novo")({ component: NewWorkoutPage });

/**
 * O rascunho fica guardado no aparelho a cada mudança (campos e cronômetros)
 * e esta tela é reaberta sozinha se o app for fechado e aberto de novo. Ele
 * só é descartado em Cancelar ou Salvar — a setinha de voltar só descarta se
 * nada foi digitado/cronometrado ainda.
 */
function NewWorkoutPage() {
  const navigate = useNavigate();
  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const [saved] = useState(loadNovoDraft);
  const [draft] = useState(() => saved?.workout ?? createBlankWorkout());
  const latest = useRef<NovoSnapshot | null>(saved);

  const handleSnapshot = useCallback((snapshot: NovoSnapshot) => {
    latest.current = snapshot;
    saveNovoDraft(snapshot);
  }, []);

  function handleBack() {
    if (!latest.current || isPristineNovo(latest.current)) clearNovoDraft();
    void navigate({ to: "/" });
  }

  return (
    <main className="relative px-5 pb-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={handleBack}>
          <ArrowLeft />
        </Button>
        <div>
          <p className="text-2xs font-medium uppercase tracking-widest text-accent">Novo</p>
          <h1 className="font-display text-2xl font-medium tracking-tight">Inserir treino</h1>
        </div>
      </header>
      <WorkoutForm
        initial={draft}
        initialTimers={saved?.timers}
        onSnapshot={handleSnapshot}
        submitLabel="Salvar treino"
        onCancel={() => {
          clearNovoDraft();
          void navigate({ to: "/" });
        }}
        onSubmit={(workout) => {
          clearNovoDraft();
          addWorkout(workout);
          toast.success("Treino salvo no aparelho");
          void navigate({ to: "/treino/$id", params: { id: workout.id } });
        }}
      />
    </main>
  );
}
