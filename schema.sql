-- Receptenkist — Supabase schema
-- Plak dit hele bestand in Supabase → SQL Editor → New query → Run.
-- Geen login: alle tabellen zijn leesbaar/schrijfbaar met de "anon" sleutel.
-- Zie README.md voor de afweging die daarbij hoort.

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────── Recepten
create table if not exists recipes (
  id             uuid primary key default gen_random_uuid(),
  titel          text not null,
  basis          text not null default 'Overig',
  proteine       text not null default 'Geen',
  keuken         text not null default 'Overig',
  personen       integer not null default 4,
  bereidingstijd integer not null default 30,
  ingredienten   jsonb not null default '[]'::jsonb,
  instructies    jsonb not null default '[]'::jsonb,
  bron           text default '',
  aangemaakt     timestamptz not null default now()
);

-- ───────────────────────────────────────────── Weekmenu (1 rij per dag)
create table if not exists weekmenu (
  dag        text primary key check (dag in ('Ma','Di','Wo','Do','Vr','Za','Zo')),
  recipe_id  uuid references recipes(id) on delete set null,
  personen   integer
);

-- Migratie: als je dit schema al eerder had gedraaid, voegt deze regel
-- alleen de nieuwe kolom toe (bestaande data blijft ongemoeid).
alter table weekmenu add column if not exists personen integer;

insert into weekmenu (dag) values
  ('Ma'),('Di'),('Wo'),('Do'),('Vr'),('Za'),('Zo')
on conflict (dag) do nothing;

-- ───────────────────────────────────────────── Koelkast (voorraad)
create table if not exists koelkast (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null,
  aangemaakt  timestamptz not null default now()
);

-- ───────────────────────────────────────────── Instellingen (1 rij)
create table if not exists instellingen (
  id                     integer primary key default 1,
  huishoud_personen      integer not null default 2,
  boodschappen_vinkjes   jsonb not null default '{}'::jsonb,
  constraint instellingen_single_row check (id = 1)
);

insert into instellingen (id) values (1)
on conflict (id) do nothing;

-- ───────────────────────────────────────────── Row Level Security
-- Geen login gekozen → open policies, zodat de site met alleen de
-- anon-key kan lezen/schrijven. Zie README.md voor het beveiligingsaspect.

alter table recipes enable row level security;
alter table weekmenu enable row level security;
alter table koelkast enable row level security;
alter table instellingen enable row level security;

drop policy if exists "recipes_open" on recipes;
create policy "recipes_open" on recipes for all using (true) with check (true);

drop policy if exists "weekmenu_open" on weekmenu;
create policy "weekmenu_open" on weekmenu for all using (true) with check (true);

drop policy if exists "koelkast_open" on koelkast;
create policy "koelkast_open" on koelkast for all using (true) with check (true);

drop policy if exists "instellingen_open" on instellingen;
create policy "instellingen_open" on instellingen for all using (true) with check (true);
