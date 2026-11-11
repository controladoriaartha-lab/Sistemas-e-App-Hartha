-- Forja de Treinos: aparelhos/exercicios proprios do usuario ("banco de memoria").
-- O dicionario padrao fica no codigo (src/lib/exercise-dictionary.ts); aqui
-- ficam os aparelhos que o usuario ensina ao app. Cada linha pertence a um
-- usuario autenticado (owner_id) e so ele enxerga/edita (RLS), como em workouts.

create table if not exists public.custom_exercises (
  id          text not null,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  -- palavras que, escritas nas notas/grupos, identificam o aparelho
  keywords    text[] not null default '{}',
  -- regiao do corpo -> peso de 0 a 1 (1 = principal, menos = apoio)
  weights     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists custom_exercises_owner_idx
  on public.custom_exercises (owner_id, created_at desc);

drop trigger if exists custom_exercises_touch_updated_at on public.custom_exercises;
create trigger custom_exercises_touch_updated_at
  before update on public.custom_exercises
  for each row execute function public.touch_updated_at();

alter table public.custom_exercises enable row level security;

drop policy if exists "custom_exercises_owner_all" on public.custom_exercises;
create policy "custom_exercises_owner_all" on public.custom_exercises
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
