import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { WorkoutCard } from "@/components/workout-card";
import { formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sortedWorkouts, useWorkoutStore } from "@/store/workouts";
import type { Focus } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

type Filter = "todos" | Focus;

function Home() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const [filter, setFilter] = useState<Filter>("todos");

  const visible = useMemo(() => {
    const list = sortedWorkouts(workouts);
    if (filter === "todos") return list;
    return list.filter((w) => w.focus === filter);
  }, [workouts, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const workout of visible) {
      const key = workout.date.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(workout);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <main className="relative px-5 pb-28 pt-8">
      <header className="mb-6">
        <p className="text-2xs font-medium uppercase tracking-widest text-accent">Diário</p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight">Forja de Treinos</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">Treinos de Cada Dia</p>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            { value: "todos", label: "Todos" },
            { value: "pernas", label: "Pernas" },
            { value: "bracos", label: "Braços" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={cn(
              "min-h-10 rounded-md text-sm font-medium transition-colors duration-150",
              filter === opt.value ? "bg-paper text-ink" : "text-muted-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {groups.map(([month, list]) => (
            <section key={month} className="space-y-3">
              <h2 className="text-2xs font-medium uppercase tracking-widest text-faint">
                {formatMonthYear(`${month}-01`)}
              </h2>
              {list.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[0_0_0_1px_rgba(244,239,232,0.08)]">
      <p className="font-display text-2xl">Nenhum treino</p>
      <p className="mt-2 text-sm text-muted-foreground">Registre o primeiro dia na Forja de Treinos.</p>
      <Link
        to="/novo"
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-paper px-4 text-sm font-medium text-ink"
      >
        Novo treino
      </Link>
    </div>
  );
}
