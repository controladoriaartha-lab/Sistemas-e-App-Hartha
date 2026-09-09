import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, subDays, subMonths } from "date-fns";
import { WorkoutCard } from "@/components/workout-card";
import { formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sortedWorkouts, useWorkoutStore } from "@/store/workouts";
import { DEFAULT_ATHLETES, type Focus } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

type FocusFilter = "todos" | Focus;
type Period = "tudo" | "semana" | "quinzenal" | "mes" | "trimestral" | "semestral" | "anual";

const PERIODS: { value: Period; label: string }[] = [
  { value: "tudo", label: "Tudo" },
  { value: "semana", label: "Semana" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mes", label: "Mês" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

function periodCutoffIso(period: Period): string | null {
  const now = new Date();
  const cutoff =
    period === "semana"
      ? subDays(now, 7)
      : period === "quinzenal"
        ? subDays(now, 15)
        : period === "mes"
          ? subMonths(now, 1)
          : period === "trimestral"
            ? subMonths(now, 3)
            : period === "semestral"
              ? subMonths(now, 6)
              : period === "anual"
                ? subMonths(now, 12)
                : null;
  return cutoff ? format(cutoff, "yyyy-MM-dd") : null;
}

function Home() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);

  const [focus, setFocus] = useState<FocusFilter>("todos");
  const [athlete, setAthlete] = useState<string>("todos");
  const [period, setPeriod] = useState<Period>("tudo");

  const athleteOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_ATHLETES);
    for (const w of workouts) for (const a of w.athletes) set.add(a);
    for (const a of customAthletes) set.add(a);
    return ["todos", ...set];
  }, [workouts, customAthletes]);

  const filtersActive = focus !== "todos" || athlete !== "todos" || period !== "tudo";

  const visible = useMemo(() => {
    let list = sortedWorkouts(workouts);
    if (focus !== "todos") list = list.filter((w) => w.focus === focus);
    if (athlete !== "todos") list = list.filter((w) => w.athletes.includes(athlete));
    const cutoff = periodCutoffIso(period);
    if (cutoff) list = list.filter((w) => w.date >= cutoff);
    return list;
  }, [workouts, focus, athlete, period]);

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

  function clearFilters() {
    setFocus("todos");
    setAthlete("todos");
    setPeriod("tudo");
  }

  return (
    <main className="relative px-5 pb-28 pt-8">
      <header className="mb-6">
        <p className="text-2xs font-medium uppercase tracking-widest text-accent">Diário</p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight">Forja de Treinos</h1>
        <p className="mt-2 max-w-xs text-2xl font-normal text-muted-foreground">Treinos de Cada Dia</p>
      </header>

      <div className="mb-5 space-y-3">
        <FilterGroup label="Foco">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
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
                onClick={() => setFocus(opt.value)}
                className={cn(
                  "min-h-10 rounded-md text-sm font-medium transition-colors duration-150",
                  focus === opt.value ? "bg-paper text-ink" : "text-muted-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Atletas">
          <PillRow
            options={athleteOptions.map((name) => ({
              value: name,
              label: name === "todos" ? "Todos" : name,
            }))}
            value={athlete}
            onChange={setAthlete}
          />
        </FilterGroup>

        <FilterGroup label="Período">
          <PillRow options={PERIODS} value={period} onChange={setPeriod} />
        </FilterGroup>
      </div>

      {workouts.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[0_0_0_1px_rgba(244,239,232,0.08)]">
          <p className="font-display text-2xl">Nenhum treino</p>
          <p className="mt-2 text-sm text-muted-foreground">Nada encontrado com esses filtros.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 inline-flex min-h-11 items-center rounded-md bg-paper px-4 text-sm font-medium text-ink"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          {filtersActive && (
            <div className="mb-4 flex items-center justify-between text-sm text-faint">
              <span className="tabular-nums">
                {visible.length} {visible.length === 1 ? "treino" : "treinos"}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 rounded-md px-2 font-medium text-muted-foreground"
              >
                Limpar filtros
              </button>
            </div>
          )}
          <div className="space-y-8">
            {groups.map(([month, list]) => (
              <section key={month} className="space-y-3">
                <h2 className="text-2xl font-normal text-faint">{formatMonthYear(`${month}-01`)}</h2>
                {list.map((workout) => (
                  <WorkoutCard key={workout.id} workout={workout} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-faint">{label}</p>
      {children}
    </div>
  );
}

function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150",
              on ? "bg-paper text-ink" : "bg-muted text-muted-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
