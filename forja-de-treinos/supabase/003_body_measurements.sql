-- Forja de Treinos: evolucao corporal (medidas e como o atleta se sente).
-- Uma linha por atleta por dia (id = atleta-data), entao salvar de novo no
-- mesmo dia atualiza em vez de duplicar. Cada linha pertence a um usuario
-- autenticado (owner_id) e so ele enxerga/edita (RLS), como em workouts.

create table if not exists public.body_measurements (
  id           text not null,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  athlete      text not null check (length(btrim(athlete)) > 0),
  measured_on  date not null,
  weight_kg    numeric(5, 1),
  waist_cm     numeric(5, 1),
  arm_cm       numeric(5, 1),
  thigh_cm     numeric(5, 1),
  chest_cm     numeric(5, 1),
  calf_cm      numeric(5, 1),
  energy       numeric(3, 1) check (energy is null or (energy >= 0 and energy <= 10)),
  sleep_hours  numeric(4, 1) check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  feeling      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists body_measurements_owner_idx
  on public.body_measurements (owner_id, athlete, measured_on desc);

drop trigger if exists body_measurements_touch_updated_at on public.body_measurements;
create trigger body_measurements_touch_updated_at
  before update on public.body_measurements
  for each row execute function public.touch_updated_at();

alter table public.body_measurements enable row level security;

drop policy if exists "body_measurements_owner_all" on public.body_measurements;
create policy "body_measurements_owner_all" on public.body_measurements
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
