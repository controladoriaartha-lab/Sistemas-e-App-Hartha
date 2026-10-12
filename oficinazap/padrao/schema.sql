-- =====================================================================
-- OficinaZap · schema multi-oficina (PostgreSQL 15+ / Supabase)
-- Uma única base atende todas as oficinas: toda tabela tem oficina_id
-- e o acesso é isolado por RLS. O orquestrador (webhook do WhatsApp)
-- usa a service role e descobre a oficina pelo número que recebeu a
-- mensagem (oficinas.wa_phone_number_id).
-- Em Supabase, auth.uid() já existe. Fora dele, crie um stub.
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists btree_gist;   -- exclusão de sobreposição por box

-- ---------- oficinas (tenant) ----------
create table oficinas (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  nome                text not null check (length(nome) between 2 and 60),
  tipo                text not null default 'mecanica',
  cidade              text,
  cor                 text not null default '#ffb020' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  boxes               smallint not null default 2 check (boxes between 1 and 12),
  fuso                text not null default 'America/Sao_Paulo',
  -- roteamento do WhatsApp: 1 número (phone_number_id da Cloud API) = 1 oficina
  wa_phone_number_id  text unique,
  wa_numero           text,
  dono_nome           text,
  dono_wa             text,                     -- único número autorizado a lançar despesas e estender o almoço
  saldo_inicial       numeric(12,2) not null default 0,
  taxa_cartao         numeric(5,2)  not null default 3.2 check (taxa_cartao >= 0),
  politica_almoco     text not null default 'empurrar' check (politica_almoco in ('empurrar','remarcar')),
  avisar_todos        boolean not null default false,
  boas_vindas         text,
  padrao_versao       text not null default '1.0',
  criada_em           timestamptz not null default now()
);

create table oficina_horario (
  oficina_id      uuid primary key references oficinas(id) on delete cascade,
  dias            smallint[] not null default '{1,2,3,4,5,6}',   -- 0=dom … 6=sáb
  abre            time not null default '08:00',
  fecha           time not null default '18:00',
  sab_fecha       time,
  alm_ini         time,
  alm_fim         time,
  antecedencia_min integer not null default 60 check (antecedencia_min >= 0),
  fecha_feriados  boolean not null default true,
  check (abre < fecha),
  check ((alm_ini is null and alm_fim is null) or (alm_ini is not null and alm_fim > alm_ini))
);

-- exceções por dia: almoço estendido, dia fechado (folga/feriado local), feriado aberto à força
create table excecoes_dia (
  oficina_id         uuid not null references oficinas(id) on delete cascade,
  data               date not null,
  fechado            boolean not null default false,
  motivo             text,
  almoco_extra_min   smallint not null default 0 check (almoco_extra_min between 0 and 240),
  almoco_motivo      text,
  aberto_forcado     boolean not null default false,
  atualizado_em      timestamptz not null default now(),
  primary key (oficina_id, data)
);

create table servicos (
  id            uuid primary key default gen_random_uuid(),
  oficina_id    uuid not null references oficinas(id) on delete cascade,
  nome          text not null,
  duracao_min   smallint not null check (duracao_min between 5 and 600),
  preco_medio   numeric(10,2) not null default 0 check (preco_medio >= 0),
  ativo         boolean not null default true,
  unique (oficina_id, nome)
);

-- ---------- agenda ----------
create table agendamentos (
  id                uuid primary key default gen_random_uuid(),
  oficina_id        uuid not null references oficinas(id) on delete cascade,
  servico_id        uuid not null references servicos(id),
  cliente_nome      text not null,
  cliente_wa        text,
  veiculo           text,
  placa             text,
  inicio            timestamptz not null,
  fim               timestamptz not null,
  box               smallint not null check (box >= 1),
  status            text not null default 'confirmado'
                      check (status in ('confirmado','remarcar','cancelado','concluido')),
  origem            text not null default 'whatsapp' check (origem in ('whatsapp','manual')),
  inicio_original   timestamptz,                -- preenchido quando o horário foi empurrado (“era 13:00”)
  pendente_motivo   text check (pendente_motivo in ('almoco','fechado')),
  lembrete_em       timestamptz,
  google_event_id   text,
  criado_em         timestamptz not null default now(),
  check (fim > inicio),
  -- GARANTIA DE 0 DUPLA MARCAÇÃO: o mesmo box não pode ter dois confirmados sobrepostos,
  -- mesmo com duas conversas de WhatsApp tentando reservar ao mesmo tempo.
  constraint sem_dupla_marcacao exclude using gist (
    oficina_id with =, box with =, tstzrange(inicio, fim, '[)') with &&
  ) where (status = 'confirmado')
);
create index on agendamentos (oficina_id, inicio);

-- ---------- avisos por WhatsApp (outbox) ----------
create table avisos (
  id               uuid primary key default gen_random_uuid(),
  oficina_id       uuid not null references oficinas(id) on delete cascade,
  agendamento_id   uuid references agendamentos(id) on delete set null,
  tipo             text not null check (tipo in ('lembrete','almoco_empurrado','almoco_remarcar','almoco_info','almoco_normal','dia_fechado','remarcacao','relatorio_semanal')),
  template         text not null,                -- nome do template aprovado na Meta
  texto            text not null,
  destino_wa       text,
  wa_message_id    text,
  status           text not null default 'enfileirado' check (status in ('enfileirado','enviado','entregue','lido','falhou')),
  erro             text,
  criado_em        timestamptz not null default now()
);
create index on avisos (oficina_id, criado_em desc);

-- ---------- financeiro ----------
create table lancamentos (
  id             uuid primary key default gen_random_uuid(),
  oficina_id     uuid not null references oficinas(id) on delete cascade,
  tipo           text not null check (tipo in ('receita','despesa')),
  descricao      text not null,
  categoria      text not null,
  valor          numeric(12,2) not null check (valor > 0),
  data           date not null,
  vencimento     date,
  forma          text check (forma in ('Pix','Dinheiro','Cartão','Boleto')),
  status         text not null default 'pago' check (status in ('pago','pendente')),
  origem         text not null default 'manual' check (origem in ('foto','audio','texto','os','manual')),
  anexo_path     text,                           -- comprovante no bucket (criptografado em repouso)
  excluido_em    timestamptz,                    -- exclusão lógica: nada some sem rastro
  criado_em      timestamptz not null default now()
);
create index on lancamentos (oficina_id, data);

create table auditoria (
  id          bigint generated always as identity primary key,
  oficina_id  uuid not null references oficinas(id) on delete cascade,
  ator        text not null,                    -- 'dono:+55…', 'cliente:+55…', 'painel:<user>', 'sistema'
  acao        text not null,
  detalhe     jsonb not null default '{}',
  criado_em   timestamptz not null default now()
);
create index on auditoria (oficina_id, criado_em desc);

-- ---------- acesso do painel (usuários humanos) ----------
create table membros (
  oficina_id  uuid not null references oficinas(id) on delete cascade,
  user_id     uuid not null,                    -- auth.users.id
  papel       text not null default 'dono' check (papel in ('dono','atendente','contador')),
  primary key (oficina_id, user_id)
);

create or replace function minhas_oficinas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select oficina_id from membros where user_id = auth.uid()
$$;

-- RLS: cada usuário só enxerga as suas oficinas. A service role do orquestrador ignora RLS.
do $$
declare t text;
begin
  foreach t in array array['oficina_horario','excecoes_dia','servicos','agendamentos','avisos','lancamentos','auditoria','membros'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (oficina_id in (select minhas_oficinas())) with check (oficina_id in (select minhas_oficinas()))', t || '_tenant', t);
  end loop;
end $$;
alter table oficinas enable row level security;
create policy oficinas_tenant on oficinas for all
  using (id in (select minhas_oficinas())) with check (id in (select minhas_oficinas()));
-- contador: só leitura dos lançamentos (ajuste a política conforme o papel)
