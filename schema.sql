-- MMenu-Planner — Supabase schema
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

-- ───────────────────────────────────────────── Ingrediënten (canoniek)
-- Eén vast record per product (bv. "ui"), zodat de boodschappenlijst kan
-- optellen op ingredient_id in plaats van op los getypte tekst.
create table if not exists ingredients (
  id                uuid primary key default gen_random_uuid(),
  naam              text not null,
  standaard_eenheid text
);
create unique index if not exists ingredients_naam_lower_idx on ingredients ((lower(trim(naam))));

-- Bijnamen die naar een canoniek ingrediënt verwijzen (bv. "rode ui" → "ui").
create table if not exists ingredient_aliassen (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references ingredients(id) on delete cascade,
  alias          text not null
);
create unique index if not exists ingredient_aliassen_alias_lower_idx on ingredient_aliassen ((lower(trim(alias))));

-- ───────────────────────────────────────────── Onderdelen binnen een recept
-- Een gewoon recept heeft één onderdeel zonder naam. Een samengesteld
-- recept (bv. "Marinade" + "Saus") heeft er meerdere, elk met eigen
-- ingrediënten én eigen instructies.
create table if not exists recipe_onderdelen (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references recipes(id) on delete cascade,
  naam         text not null default '',
  volgorde     integer not null default 1,
  instructies  jsonb not null default '[]'::jsonb
);

create table if not exists recipe_ingredienten (
  id             uuid primary key default gen_random_uuid(),
  onderdeel_id   uuid not null references recipe_onderdelen(id) on delete cascade,
  ingredient_id  uuid not null references ingredients(id),
  hoeveelheid    numeric,
  eenheid        text,
  notitie        text,
  volgorde       integer not null default 1
);

-- ───────────────────────────────────────────── Eenheden (beheerbaar)
-- De keuzelijst met eenheden voor het receptformulier. "eenheid" op
-- recipe_ingredienten blijft gewoon tekst (net als basis/proteine/keuken) —
-- hernoemen hieronder werkt daarom automatisch door naar bestaande regels.
create table if not exists eenheden (
  id        uuid primary key default gen_random_uuid(),
  naam      text not null unique,
  volgorde  integer not null default 0
);

insert into eenheden (naam, volgorde) values
  ('g', 1), ('kg', 2), ('ml', 3), ('l', 4), ('el', 5), ('tl', 6),
  ('stuks', 7), ('teentje', 8), ('snufje', 9), ('blikje', 10)
on conflict (naam) do nothing;

-- ───────────────────────────────────────────── Volgorde (slepen in Beheren)
-- tags en ingredients krijgen een volgorde-kolom (kenmerk_opties en eenheden
-- hadden die al). Rijen met volgorde 0 (bestaand of nieuw uit een oude
-- versie) worden eenmalig achteraan genummerd, op alfabet. Veilig om opnieuw
-- te draaien: er wordt alleen iets aangepast aan rijen met volgorde 0.
alter table tags        add column if not exists volgorde integer not null default 0;
alter table ingredients add column if not exists volgorde integer not null default 0;

update tags t set volgorde = s.nr
from (
  select id, (select coalesce(max(volgorde), 0) from tags) + row_number() over (order by lower(naam)) as nr
  from tags where volgorde = 0
) s
where t.id = s.id;

update ingredients i set volgorde = s.nr
from (
  select id, (select coalesce(max(volgorde), 0) from ingredients) + row_number() over (order by lower(naam)) as nr
  from ingredients where volgorde = 0
) s
where i.id = s.id;

update eenheden e set volgorde = s.nr
from (
  select id, (select coalesce(max(volgorde), 0) from eenheden) + row_number() over (order by lower(naam)) as nr
  from eenheden where volgorde = 0
) s
where e.id = s.id;

update kenmerk_opties k set volgorde = s.nr
from (
  select k0.id,
         (select coalesce(max(k2.volgorde), 0) from kenmerk_opties k2 where k2.categorie = k0.categorie)
           + row_number() over (partition by k0.categorie order by lower(k0.naam)) as nr
  from kenmerk_opties k0 where k0.volgorde = 0
) s
where k.id = s.id;

-- ───────────────────────────────────────────── Eenmalige migratie
-- Zet bestaande recepten (met de oude platte kolommen recipes.ingredienten
-- / recipes.instructies) om naar de nieuwe structuur hierboven. Draait
-- vanzelf maar één keer: zodra de oude kolommen zijn hernoemd naar
-- "_legacy", doet dit blok bij een volgende run niets meer (veilig om
-- schema.sql te blijven herplakken).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'recipes' and column_name = 'ingredienten'
  ) then

    -- (a) elk recept krijgt één onderdeel zonder naam, met de bestaande instructies
    insert into recipe_onderdelen (recipe_id, naam, volgorde, instructies)
    select r.id, '', 1, coalesce(r.instructies, '[]'::jsonb)
    from recipes r
    where not exists (select 1 from recipe_onderdelen ro where ro.recipe_id = r.id);

    -- (b) van elke voorkomende ingrediënt-tekst een canoniek ingrediënt maken
    insert into ingredients (naam)
    select distinct trim(elem->>'naam')
    from recipes r, jsonb_array_elements(coalesce(r.ingredienten, '[]'::jsonb)) elem
    where trim(coalesce(elem->>'naam', '')) <> ''
    on conflict ((lower(trim(naam)))) do nothing;

    -- (c) de eenheidsnotatie normaliseren en de ingrediëntregels aanmaken
    insert into recipe_ingredienten (onderdeel_id, ingredient_id, hoeveelheid, eenheid, volgorde)
    select
      ro.id,
      ing.id,
      nullif(t.elem->>'hoeveelheid', '')::numeric,
      case lower(trim(coalesce(t.elem->>'eenheid', '')))
        when 'gram'       then 'g'
        when 'grammen'    then 'g'
        when 'gr'         then 'g'
        when 'kilogram'   then 'kg'
        when 'kilo'       then 'kg'
        when 'milliliter' then 'ml'
        when 'liter'      then 'l'
        when 'ltr'        then 'l'
        when 'eetlepel'   then 'el'
        when 'eetlepels'  then 'el'
        when 'theelepel'  then 'tl'
        when 'theelepels' then 'tl'
        when 'stuk'       then 'stuks'
        when 'teen'       then 'teentje'
        when 'teentjes'   then 'teentje'
        when 'snuf'       then 'snufje'
        when 'snufjes'    then 'snufje'
        when 'blik'       then 'blikje'
        when 'blikjes'    then 'blikje'
        else lower(trim(coalesce(t.elem->>'eenheid', '')))
      end,
      t.ord
    from recipes r
    join recipe_onderdelen ro on ro.recipe_id = r.id and ro.naam = ''
    cross join lateral jsonb_array_elements(coalesce(r.ingredienten, '[]'::jsonb)) with ordinality as t(elem, ord)
    join ingredients ing on lower(trim(ing.naam)) = lower(trim(t.elem->>'naam'))
    where trim(coalesce(t.elem->>'naam', '')) <> ''
      and not exists (select 1 from recipe_ingredienten ri where ri.onderdeel_id = ro.id);

    -- (d) oude kolommen bewaren als back-up, de app gebruikt ze niet meer
    alter table recipes rename column ingredienten to ingredienten_legacy;
    alter table recipes rename column instructies to instructies_legacy;

  end if;
end $$;

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
alter table ingredients enable row level security;
alter table ingredient_aliassen enable row level security;
alter table recipe_onderdelen enable row level security;
alter table recipe_ingredienten enable row level security;
alter table eenheden enable row level security;

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

drop policy if exists "ingredients_open" on ingredients;
create policy "ingredients_open" on ingredients for all using (true) with check (true);

drop policy if exists "ingredient_aliassen_open" on ingredient_aliassen;
create policy "ingredient_aliassen_open" on ingredient_aliassen for all using (true) with check (true);

drop policy if exists "recipe_onderdelen_open" on recipe_onderdelen;
create policy "recipe_onderdelen_open" on recipe_onderdelen for all using (true) with check (true);

drop policy if exists "recipe_ingredienten_open" on recipe_ingredienten;
create policy "recipe_ingredienten_open" on recipe_ingredienten for all using (true) with check (true);

drop policy if exists "eenheden_open" on eenheden;
create policy "eenheden_open" on eenheden for all using (true) with check (true);
