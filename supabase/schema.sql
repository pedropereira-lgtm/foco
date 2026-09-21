-- Foco · base de dados (Supabase / Postgres)
-- Correr uma vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Usa o prefixo foco_ para não mexer nas tabelas antigas do Nexo.
--
-- Cada linha guarda o objeto inteiro em `data` (jsonb). Só o servidor do Foco
-- lê e escreve (com a service role key). O RLS fica ligado e sem políticas,
-- por isso a chave pública (anon) não consegue ler nada.

create table if not exists public.foco_contacts  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_deals     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_projects  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_tasks     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_events    (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_payments  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_recurring (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_inbox     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_settings  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.foco_weeks     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());

alter table public.foco_contacts  enable row level security;
alter table public.foco_deals     enable row level security;
alter table public.foco_projects  enable row level security;
alter table public.foco_tasks     enable row level security;
alter table public.foco_events    enable row level security;
alter table public.foco_payments  enable row level security;
alter table public.foco_recurring enable row level security;
alter table public.foco_inbox     enable row level security;
alter table public.foco_settings  enable row level security;
alter table public.foco_weeks     enable row level security;

create table if not exists public.foco_goals (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
alter table public.foco_goals enable row level security;
