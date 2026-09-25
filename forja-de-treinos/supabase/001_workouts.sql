-- Forja de Treinos: diario de treinos no Supabase.
-- Espelha o tipo Workout de src/lib/types.ts. Cada linha pertence a um
-- usuario autenticado (owner_id) e so ele enxerga/edita (RLS).

create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_date  date not null,
  focus         text not null check (focus in ('pernas', 'bracos', 'outro')),
  focus_label   text not null,
  athletes      text[] not null default '{}',
  duration_min  integer not null check (duration_min >= 0),
  intensity     text not null check (intensity in ('forte', 'medio', 'leve')),
  machines      integer not null default 0,
  sets          integer not null default 3,
  reps          integer not null default 12,
  muscle_groups text[] not null default '{}',
  extras        text not null default '',
  core          jsonb not null default '[]'::jsonb,   -- [{exercise, sets, reps, athlete?}]
  cardio        jsonb not null default '[]'::jsonb,   -- [{kind, minutes}]
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists workouts_owner_date_idx
  on public.workouts (owner_id, workout_date desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists workouts_touch_updated_at on public.workouts;
create trigger workouts_touch_updated_at
  before update on public.workouts
  for each row execute function public.touch_updated_at();

alter table public.workouts enable row level security;

drop policy if exists "workouts_owner_all" on public.workouts;
create policy "workouts_owner_all" on public.workouts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
