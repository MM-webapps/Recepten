// Alle communicatie met data loopt via dit bestand.
//
// DEMO-MODUS: zolang config.js nog de placeholder-waarden bevat, gebruikt de
// app voorbeelddata in het geheugen in plaats van Supabase. Zo kun je de
// site meteen bekijken op GitHub Pages, nog voordat je Supabase hebt
// ingesteld. Wijzigingen in demo-modus worden NIET bewaard (ze verdwijnen
// bij een herlaad van de pagina).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const DEMO_MODE =
  !SUPABASE_URL || SUPABASE_URL.includes('JOUW-PROJECT') ||
  !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('JOUW-ANON-KEY');

const supabase = DEMO_MODE ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function check(error) {
  if (error) throw new Error(error.message || 'Onbekende Supabase-fout');
}

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('demo-' + Math.random().toString(36).slice(2));
}

// ─────────────────────────────── Demo-data (alleen gebruikt in demo-modus)
let demoRecipes = [
  {
    id: uuid(),
    titel: 'Kip-kerrie met rijst',
    basis: 'Rijst',
    proteine: 'Kip',
    keuken: 'Indiaas',
    personen: 4,
    bereidingstijd: 35,
    ingredienten: [
      { naam: 'Kipfilet', hoeveelheid: 500, eenheid: 'g' },
      { naam: 'Rijst', hoeveelheid: 300, eenheid: 'g' },
      { naam: 'Ui', hoeveelheid: 1, eenheid: '' },
      { naam: 'Kerriepoeder', hoeveelheid: 2, eenheid: 'el' },
      { naam: 'Kokosmelk', hoeveelheid: 400, eenheid: 'ml' }
    ],
    instructies: [
      'Snijd de kipfilet en ui in stukken.',
      'Bak de ui glazig, voeg de kip toe en bak aan.',
      'Voeg kerriepoeder en kokosmelk toe, laat 15 minuten sudderen.',
      'Kook ondertussen de rijst en serveer samen.'
    ],
    bron: '',
    aangemaakt: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: uuid(),
    titel: 'Pasta met gehaktsaus',
    basis: 'Pasta',
    proteine: 'Gehakt',
    keuken: 'Italiaans',
    personen: 4,
    bereidingstijd: 30,
    ingredienten: [
      { naam: 'Pasta', hoeveelheid: 350, eenheid: 'g' },
      { naam: 'Gehakt', hoeveelheid: 400, eenheid: 'g' },
      { naam: 'Gezeefde tomaten', hoeveelheid: 700, eenheid: 'ml' },
      { naam: 'Ui', hoeveelheid: 1, eenheid: '' },
      { naam: 'Knoflook', hoeveelheid: 2, eenheid: 'teentje' }
    ],
    instructies: [
      'Fruit ui en knoflook aan.',
      'Voeg het gehakt toe en bak rul.',
      'Blus af met de tomaten, laat 15 minuten sudderen.',
      'Kook de pasta en meng erdoor.'
    ],
    bron: '',
    aangemaakt: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    id: uuid(),
    titel: 'Aardappel-viscurry',
    basis: 'Aardappel',
    proteine: 'Vis/Zeevruchten',
    keuken: 'Mediterraans',
    personen: 2,
    bereidingstijd: 25,
    ingredienten: [
      { naam: 'Witvis', hoeveelheid: 300, eenheid: 'g' },
      { naam: 'Aardappel', hoeveelheid: 500, eenheid: 'g' },
      { naam: 'Paprika', hoeveelheid: 1, eenheid: '' },
      { naam: 'Citroen', hoeveelheid: 0.5, eenheid: '' }
    ],
    instructies: [
      'Kook de aardappels in blokjes gaar.',
      'Bak de paprika kort mee.',
      'Voeg de vis toe en gaar hem in ca. 8 minuten.',
      'Maak af met citroensap.'
    ],
    bron: '',
    aangemaakt: new Date().toISOString()
  }
];
let demoWeekmenu = { Ma: null, Di: null, Wo: null, Do: null, Vr: null, Za: null, Zo: null };
let demoKoelkast = [];
let demoInstellingen = { id: 1, huishoud_personen: 2, boodschappen_vinkjes: {} };

// ─────────────────────────────── Recepten
export async function fetchRecipes() {
  if (DEMO_MODE) return demoRecipes.slice().sort((a, b) => new Date(b.aangemaakt) - new Date(a.aangemaakt));
  const { data, error } = await supabase.from('recipes').select('*').order('aangemaakt', { ascending: false });
  check(error);
  return data;
}

export async function saveRecipe(recipe) {
  if (DEMO_MODE) {
    if (recipe.id) {
      demoRecipes = demoRecipes.map((r) => (r.id === recipe.id ? { ...recipe } : r));
      return demoRecipes.find((r) => r.id === recipe.id);
    }
    const saved = { ...recipe, id: uuid(), aangemaakt: new Date().toISOString() };
    demoRecipes = [saved, ...demoRecipes];
    return saved;
  }
  const payload = { ...recipe };
  if (!payload.id) delete payload.id;
  const { data, error } = await supabase.from('recipes').upsert(payload, { onConflict: 'id' }).select().single();
  check(error);
  return data;
}

export async function deleteRecipe(id) {
  if (DEMO_MODE) { demoRecipes = demoRecipes.filter((r) => r.id !== id); return; }
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  check(error);
}

// ─────────────────────────────── Weekmenu
export async function fetchWeekmenu() {
  if (DEMO_MODE) return { ...demoWeekmenu };
  const { data, error } = await supabase.from('weekmenu').select('*');
  check(error);
  const map = {};
  data.forEach((row) => {
    map[row.dag] = row.recipe_id ? { recipeId: row.recipe_id, personen: row.personen || null } : null;
  });
  return map;
}

export async function setWeekmenuDag(dag, recipeId, personen) {
  if (DEMO_MODE) {
    demoWeekmenu[dag] = recipeId ? { recipeId, personen: personen || null } : null;
    return;
  }
  const { error } = await supabase.from('weekmenu')
    .update({ recipe_id: recipeId, personen: recipeId ? (personen || null) : null })
    .eq('dag', dag);
  check(error);
}

export async function setWeekmenuPersonen(dag, personen) {
  if (DEMO_MODE) {
    if (demoWeekmenu[dag]) demoWeekmenu[dag] = { ...demoWeekmenu[dag], personen };
    return;
  }
  const { error } = await supabase.from('weekmenu').update({ personen }).eq('dag', dag);
  check(error);
}

// ─────────────────────────────── Koelkast
export async function fetchKoelkast() {
  if (DEMO_MODE) return demoKoelkast.slice();
  const { data, error } = await supabase.from('koelkast').select('*').order('aangemaakt', { ascending: true });
  check(error);
  return data;
}

export async function addKoelkastItem(naam) {
  if (DEMO_MODE) {
    const row = { id: uuid(), naam, aangemaakt: new Date().toISOString() };
    demoKoelkast.push(row);
    return row;
  }
  const { data, error } = await supabase.from('koelkast').insert({ naam }).select().single();
  check(error);
  return data;
}

export async function removeKoelkastItem(id) {
  if (DEMO_MODE) { demoKoelkast = demoKoelkast.filter((i) => i.id !== id); return; }
  const { error } = await supabase.from('koelkast').delete().eq('id', id);
  check(error);
}

// ─────────────────────────────── Instellingen
export async function fetchInstellingen() {
  if (DEMO_MODE) return { ...demoInstellingen };
  const { data, error } = await supabase.from('instellingen').select('*').eq('id', 1).single();
  check(error);
  return data;
}

export async function updateInstellingen(patch) {
  if (DEMO_MODE) { demoInstellingen = { ...demoInstellingen, ...patch }; return { ...demoInstellingen }; }
  const { data, error } = await supabase.from('instellingen').update(patch).eq('id', 1).select().single();
  check(error);
  return data;
}
