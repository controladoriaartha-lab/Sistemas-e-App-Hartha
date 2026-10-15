-- NEUROCORP9 - schema Supabase (rode uma vez no SQL Editor)
-- Usa auth.users direto; cada linha pertence a quem esta logado (RLS).

create table if not exists public.activities_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  texto_original text not null,
  atividade text,
  categorias text[] not null default '{}',
  sub_movimento text[] not null default '{}',
  duracao_min int not null default 15 check (duracao_min between 1 and 120),
  regiao_corporal text[] not null default '{}',
  intensidade int not null default 2 check (intensidade between 1 and 5),
  score int not null default 0
);

create index if not exists activities_log_user_created
  on public.activities_log (user_id, created_at desc);

alter table public.activities_log enable row level security;

drop policy if exists "own activities" on public.activities_log;
create policy "own activities" on public.activities_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- realtime (ignora se ja estiver na publicacao)
do $$
begin
  alter publication supabase_realtime add table public.activities_log;
exception when duplicate_object then null;
end $$;
