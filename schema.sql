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

-- ───────────────────────────────────────────── Kenmerk-opties (basis/proteine/keuken)
-- Vervangt de eerder hardgecodeerde lijstjes: nu beheerbaar vanuit de app.
create table if not exists kenmerk_opties (
  id         uuid primary key default gen_random_uuid(),
  categorie  text not null check (categorie in ('basis','proteine','keuken')),
  naam       text not null,
  volgorde   integer not null default 0,
  unique (categorie, naam)
);

insert into kenmerk_opties (categorie, naam, volgorde) values
  ('basis','Aardappel',1), ('basis','Pasta',2), ('basis','Rijst',3), ('basis','Wraps/Tortilla',4),
  ('basis','Brood',5), ('basis','Peulvruchten',6), ('basis','Noedels',7), ('basis','Couscous/Bulgur',8), ('basis','Overig',9),
  ('proteine','Kip',1), ('proteine','Rundvlees',2), ('proteine','Gehakt',3), ('proteine','Varkensvlees',4),
  ('proteine','Vis/Zeevruchten',5), ('proteine','Ei',6), ('proteine','Tofu/Peulvruchten',7), ('proteine','Vegetarisch overig',8), ('proteine','Geen',9),
  ('keuken','Nederlands',1), ('keuken','Italiaans',2), ('keuken','Mediterraans',3), ('keuken','Aziatisch',4),
  ('keuken','Mexicaans',5), ('keuken','Indiaas',6), ('keuken','Midden-Oosters',7), ('keuken','Overig',8)
on conflict (categorie, naam) do nothing;

-- ───────────────────────────────────────────── Tags (bv. "grote groepen")
create table if not exists tags (
  id    uuid primary key default gen_random_uuid(),
  naam  text not null unique
);

create table if not exists recipe_tags (
  recipe_id  uuid not null references recipes(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  primary key (recipe_id, tag_id)
);

-- ───────────────────────────────────────────── Opmerkingen-log per recept
create table if not exists notities (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references recipes(id) on delete cascade,
  tekst       text not null,
  datum       date not null default current_date,
  aangemaakt  timestamptz not null default now()
);

-- ───────────────────────────────────────────── Row Level Security
-- Geen login gekozen → open policies, zodat de site met alleen de
-- anon-key kan lezen/schrijven. Zie README.md voor het beveiligingsaspect.

alter table recipes enable row level security;
alter table weekmenu enable row level security;
alter table koelkast enable row level security;
alter table instellingen enable row level security;
alter table kenmerk_opties enable row level security;
alter table tags enable row level security;
alter table recipe_tags enable row level security;
alter table notities enable row level security;

drop policy if exists "recipes_open" on recipes;
create policy "recipes_open" on recipes for all using (true) with check (true);

drop policy if exists "weekmenu_open" on weekmenu;
create policy "weekmenu_open" on weekmenu for all using (true) with check (true);

drop policy if exists "koelkast_open" on koelkast;
create policy "koelkast_open" on koelkast for all using (true) with check (true);

drop policy if exists "instellingen_open" on instellingen;
create policy "instellingen_open" on instellingen for all using (true) with check (true);

drop policy if exists "kenmerk_opties_open" on kenmerk_opties;
create policy "kenmerk_opties_open" on kenmerk_opties for all using (true) with check (true);

drop policy if exists "tags_open" on tags;
create policy "tags_open" on tags for all using (true) with check (true);

drop policy if exists "recipe_tags_open" on recipe_tags;
create policy "recipe_tags_open" on recipe_tags for all using (true) with check (true);

drop policy if exists "notities_open" on notities;
create policy "notities_open" on notities for all using (true) with check (true);
