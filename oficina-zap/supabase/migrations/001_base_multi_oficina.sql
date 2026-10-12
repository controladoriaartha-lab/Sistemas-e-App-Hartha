-- OficinaZap · 001 · Base multi-oficina (multi-tenant)
-- Cada linha pertence a uma oficina (oficina_id). RLS isola os dados por oficina.
-- Acesso do WhatsApp (webhook) usa service_role; acesso do painel usa auth.uid() via oficina_membros.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------- Tipos ----------
create type regime_tributario as enum ('simples', 'mei', 'outro', 'nao_informado');
create type papel_oficina     as enum ('dono', 'atendente');
create type status_agendamento as enum ('confirmado', 'cancelado', 'concluido', 'faltou');
create type tipo_lancamento   as enum ('receita', 'despesa');
create type status_lancamento as enum ('previsto', 'pago');
create type origem_lancamento as enum ('foto', 'audio', 'texto', 'os', 'manual');
create type forma_pagamento   as enum ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outro');

-- ---------- Oficinas ----------
create table oficinas (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  regime             regime_tributario not null default 'nao_informado',
  boxes              int  not null default 2 check (boxes > 0),
  taxa_cartao_pct    numeric(5,2) not null default 0 check (taxa_cartao_pct >= 0),
  saldo_inicial      numeric(14,2) not null default 0,
  saldo_minimo_alerta numeric(14,2),
  fuso_horario       text not null default 'America/Sao_Paulo',
  antecedencia_min_horas int not null default 2,
  antecedencia_max_dias  int not null default 30,
  wa_phone_number_id text unique,            -- id do número na WhatsApp Cloud API
  criado_em          timestamptz not null default now()
);

create table oficina_membros (               -- quem acessa o painel
  oficina_id uuid not null references oficinas on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  papel      papel_oficina not null default 'atendente',
  primary key (oficina_id, user_id)
);

create table contatos_autorizados (          -- números que podem operar o financeiro por WhatsApp
  oficina_id uuid not null references oficinas on delete cascade,
  telefone   text not null,                  -- E.164, ex.: 5513999990000
  papel      papel_oficina not null,
  nome       text,
  primary key (oficina_id, telefone)
);

-- ---------- Agenda ----------
create table horarios_funcionamento (
  id          uuid primary key default gen_random_uuid(),
  oficina_id  uuid not null references oficinas on delete cascade,
  dia_semana  int  not null check (dia_semana between 0 and 6),   -- 0 = domingo
  abre        time not null,
  fecha       time not null,
  pausa_ini   time,
  pausa_fim   time,
  check (fecha > abre),
  unique (oficina_id, dia_semana)
);

create table bloqueios (                     -- feriados e bloqueios manuais do dono
  id         uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas on delete cascade,
  inicio     timestamptz not null,
  fim        timestamptz not null,
  motivo     text,
  check (fim > inicio)
);

create table servicos (
  id          uuid primary key default gen_random_uuid(),
  oficina_id  uuid not null references oficinas on delete cascade,
  nome        text not null,
  duracao_min int  not null check (duracao_min > 0),
  preco_medio numeric(12,2) not null default 0,
  ativo       boolean not null default true
);

create table clientes (
  id          uuid primary key default gen_random_uuid(),
  oficina_id  uuid not null references oficinas on delete cascade,
  nome        text,
  telefone    text not null,
  criado_em   timestamptz not null default now(),
  unique (oficina_id, telefone)
);

create table veiculos (
  id          uuid primary key default gen_random_uuid(),
  oficina_id  uuid not null references oficinas on delete cascade,
  cliente_id  uuid not null references clientes on delete cascade,
  modelo      text not null,
  placa       text,
  unique (oficina_id, placa)
);

create table agendamentos (
  id            uuid primary key default gen_random_uuid(),
  oficina_id    uuid not null references oficinas on delete cascade,
  cliente_id    uuid not null references clientes,
  veiculo_id    uuid references veiculos,
  servico_id    uuid not null references servicos,
  inicio        timestamptz not null,
  fim           timestamptz not null,
  status        status_agendamento not null default 'confirmado',
  gcal_event_id text,                        -- espelho no Google Calendar (o banco é a fonte da verdade)
  criado_em     timestamptz not null default now(),
  check (fim > inicio)
);
create index on agendamentos (oficina_id, inicio) where status = 'confirmado';

-- ---------- Ordens de serviço e financeiro ----------
create table ordens_servico (
  id             uuid primary key default gen_random_uuid(),
  oficina_id     uuid not null references oficinas on delete cascade,
  numero         int  not null,
  cliente_id     uuid references clientes,
  veiculo_id     uuid references veiculos,
  agendamento_id uuid references agendamentos,
  valor_total    numeric(12,2) not null default 0,
  custo_pecas    numeric(12,2) not null default 0,
  aberta_em      timestamptz not null default now(),
  fechada_em     timestamptz,
  unique (oficina_id, numero)
);

create table categorias (
  id         uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas on delete cascade,
  tipo       tipo_lancamento not null,
  nome       text not null,
  unique (oficina_id, tipo, nome)
);

create table regras_fornecedor (             -- "aprende" a categoria por fornecedor
  oficina_id   uuid not null references oficinas on delete cascade,
  fornecedor   text not null,
  categoria_id uuid not null references categorias,
  primary key (oficina_id, fornecedor)
);

create table lancamentos (
  id               uuid primary key default gen_random_uuid(),
  oficina_id       uuid not null references oficinas on delete cascade,
  tipo             tipo_lancamento not null,
  valor            numeric(14,2) not null check (valor > 0),
  categoria_id     uuid references categorias,
  descricao        text,
  fornecedor       text,
  forma            forma_pagamento,
  parcelas         int not null default 1 check (parcelas >= 1),
  data_competencia date not null,            -- regime de competência (margem por serviço)
  data_caixa       date,                     -- quando entra/sai do caixa (visão principal do dono)
  status           status_lancamento not null default 'pago',
  os_id            uuid references ordens_servico,
  origem           origem_lancamento not null,
  comprovante_path text,                     -- caminho no Storage
  criado_por       text not null,            -- telefone (WhatsApp) ou user_id (painel)
  criado_em        timestamptz not null default now()
);
create index on lancamentos (oficina_id, data_caixa);

create table lancamentos_historico (         -- auditoria: edições nunca sobrescrevem
  id            bigint generated always as identity primary key,
  lancamento_id uuid not null references lancamentos on delete cascade,
  oficina_id    uuid not null,
  alterado_por  text not null,
  alterado_em   timestamptz not null default now(),
  antes         jsonb not null,
  depois        jsonb not null
);

-- ---------- WhatsApp, LGPD ----------
create table mensagens_whatsapp (            -- idempotência do webhook + log (sem dados sensíveis em claro)
  wa_message_id text primary key,
  oficina_id    uuid references oficinas on delete cascade,
  telefone      text not null,
  direcao       text not null check (direcao in ('entrada', 'saida')),
  tipo          text not null,
  recebida_em   timestamptz not null default now(),
  processada    boolean not null default false
);

create table conversas (                     -- estado do fluxo (ex.: aguardando confirmação)
  oficina_id uuid not null references oficinas on delete cascade,
  telefone   text not null,
  estado     jsonb not null default '{}'::jsonb,
  atualizada_em timestamptz not null default now(),
  primary key (oficina_id, telefone)
);

create table consentimentos_lgpd (
  oficina_id uuid not null references oficinas on delete cascade,
  telefone   text not null,
  aceito_em  timestamptz not null default now(),
  texto_versao text not null,
  primary key (oficina_id, telefone)
);

-- ---------- Agendamento sem dupla marcação ----------
-- Serializa por oficina+dia (advisory lock) e confere capacidade de boxes, bloqueios e horário.
create or replace function criar_agendamento(
  p_oficina uuid, p_cliente uuid, p_veiculo uuid, p_servico uuid, p_inicio timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_dur int; v_boxes int; v_fim timestamptz; v_ocupados int; v_id uuid;
  v_tz text; v_dow int; v_h horarios_funcionamento; v_local_ini time; v_local_fim time;
  v_min int; v_max int;
begin
  select duracao_min into v_dur from servicos where id = p_servico and oficina_id = p_oficina and ativo;
  if v_dur is null then raise exception 'servico_invalido'; end if;
  select boxes, fuso_horario, antecedencia_min_horas, antecedencia_max_dias
    into v_boxes, v_tz, v_min, v_max from oficinas where id = p_oficina;
  v_fim := p_inicio + make_interval(mins => v_dur);

  if p_inicio < now() + make_interval(hours => v_min)
     or p_inicio > now() + make_interval(days => v_max) then
    raise exception 'fora_da_antecedencia';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_oficina::text || (p_inicio at time zone v_tz)::date::text, 0));

  v_dow := extract(dow from p_inicio at time zone v_tz);
  select * into v_h from horarios_funcionamento where oficina_id = p_oficina and dia_semana = v_dow;
  v_local_ini := (p_inicio at time zone v_tz)::time;
  v_local_fim := (v_fim    at time zone v_tz)::time;
  if v_h.id is null or v_local_ini < v_h.abre or v_local_fim > v_h.fecha
     or ((p_inicio at time zone v_tz)::date <> (v_fim at time zone v_tz)::date) then
    raise exception 'fora_do_expediente';
  end if;
  if v_h.pausa_ini is not null and v_local_ini < v_h.pausa_fim and v_local_fim > v_h.pausa_ini then
    raise exception 'conflito_pausa';
  end if;

  if exists (select 1 from bloqueios where oficina_id = p_oficina and tstzrange(inicio, fim) && tstzrange(p_inicio, v_fim)) then
    raise exception 'horario_bloqueado';
  end if;

  select count(*) into v_ocupados from agendamentos
   where oficina_id = p_oficina and status = 'confirmado'
     and tstzrange(inicio, fim) && tstzrange(p_inicio, v_fim);
  if v_ocupados >= v_boxes then raise exception 'sem_capacidade'; end if;

  insert into agendamentos (oficina_id, cliente_id, veiculo_id, servico_id, inicio, fim)
  values (p_oficina, p_cliente, p_veiculo, p_servico, p_inicio, v_fim) returning id into v_id;
  return v_id;
end $$;
revoke all on function criar_agendamento from public, anon, authenticated;

-- ---------- RLS ----------
create or replace function minhas_oficinas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select oficina_id from oficina_membros where user_id = auth.uid()
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'horarios_funcionamento','bloqueios','servicos','clientes','veiculos','agendamentos',
    'ordens_servico','categorias','regras_fornecedor','lancamentos','lancamentos_historico',
    'conversas','consentimentos_lgpd','contatos_autorizados'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (oficina_id in (select minhas_oficinas())) with check (oficina_id in (select minhas_oficinas()))', t || '_tenant', t);
  end loop;
end $$;

alter table oficinas enable row level security;
create policy oficinas_leitura on oficinas for select to authenticated using (id in (select minhas_oficinas()));
create policy oficinas_dono_edita on oficinas for update to authenticated
  using (id in (select oficina_id from oficina_membros where user_id = auth.uid() and papel = 'dono'));

alter table oficina_membros enable row level security;
create policy membros_leitura on oficina_membros for select to authenticated using (user_id = auth.uid());

alter table mensagens_whatsapp enable row level security;   -- sem policy: só service_role (webhook)
