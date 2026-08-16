// Alle communicatie met data loopt via dit bestand.
//
// DEMO-MODUS: zolang config.js nog de placeholder-waarden bevat, gebruikt de
// app voorbeelddata in het geheugen in plaats van Supabase. Zo kun je de
// site meteen bekijken op GitHub Pages, nog voordat je Supabase hebt
// ingesteld. Wijzigingen in demo-modus worden NIET bewaard (ze verdwijnen
// bij een herlaad van de pagina).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { DEFAULT_BASIS_OPTIONS, DEFAULT_PROTEINE_OPTIONS, DEFAULT_KEUKEN_OPTIONS } from './constants.js';

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

let demoKenmerkOpties = [
  ...DEFAULT_BASIS_OPTIONS.map((naam, i) => ({ id: uuid(), categorie: 'basis', naam, volgorde: i + 1 })),
  ...DEFAULT_PROTEINE_OPTIONS.map((naam, i) => ({ id: uuid(), categorie: 'proteine', naam, volgorde: i + 1 })),
  ...DEFAULT_KEUKEN_OPTIONS.map((naam, i) => ({ id: uuid(), categorie: 'keuken', naam, volgorde: i + 1 }))
];

let demoTags = [
  { id: uuid(), naam: 'Grote groepen' },
  { id: uuid(), naam: 'Snel klaar' }
];
let demoRecipeTagIds = {}; // { [recipeId]: [tagId, ...] }
let demoNotities = {}; // { [recipeId]: [{id, tekst, datum, aangemaakt}, ...] }

function demoTagsFor(recipeId) {
  return (demoRecipeTagIds[recipeId] || []).map((tid) => demoTags.find((t) => t.id === tid)).filter(Boolean);
}

// ─────────────────────────────── Recepten
export async function fetchRecipes() {
  if (DEMO_MODE) {
    return demoRecipes
      .slice()
      .sort((a, b) => new Date(b.aangemaakt) - new Date(a.aangemaakt))
      .map((r) => ({ ...r, tags: demoTagsFor(r.id) }));
  }
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_tags(tags(id, naam))')
    .order('aangemaakt', { ascending: false });
  check(error);
  return data.map((row) => {
    const { recipe_tags, ...rest } = row;
    return { ...rest, tags: (recipe_tags || []).map((rt) => rt.tags).filter(Boolean) };
  });
}

export async function saveRecipe(recipe) {
  const { tagIds, tags, ...fields } = recipe;
  if (DEMO_MODE) {
    let saved;
    if (fields.id) {
      demoRecipes = demoRecipes.map((r) => (r.id === fields.id ? { ...r, ...fields } : r));
      saved = demoRecipes.find((r) => r.id === fields.id);
    } else {
      saved = { ...fields, id: uuid(), aangemaakt: new Date().toISOString() };
      demoRecipes = [saved, ...demoRecipes];
    }
    if (tagIds) demoRecipeTagIds[saved.id] = tagIds;
    return { ...saved, tags: demoTagsFor(saved.id) };
  }
  const payload = { ...fields };
  if (!payload.id) delete payload.id;
  const { data, error } = await supabase.from('recipes').upsert(payload, { onConflict: 'id' }).select().single();
  check(error);
  if (tagIds) await setRecipeTags(data.id, tagIds);
  const { data: rtData, error: rtErr } = await supabase.from('recipe_tags').select('tags(id, naam)').eq('recipe_id', data.id);
  check(rtErr);
  return { ...data, tags: (rtData || []).map((r) => r.tags).filter(Boolean) };
}

export async function deleteRecipe(id) {
  if (DEMO_MODE) {
    demoRecipes = demoRecipes.filter((r) => r.id !== id);
    delete demoRecipeTagIds[id];
    delete demoNotities[id];
    return;
  }
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

// ─────────────────────────────── Kenmerk-opties (basis / proteine / keuken)
export async function fetchKenmerkOpties() {
  if (DEMO_MODE) {
    return demoKenmerkOpties.slice().sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam));
  }
  const { data, error } = await supabase.from('kenmerk_opties').select('*').order('categorie').order('volgorde').order('naam');
  check(error);
  return data;
}

export async function addKenmerkOptie(categorie, naam) {
  if (DEMO_MODE) {
    const volgorde = demoKenmerkOpties.filter((k) => k.categorie === categorie).length + 1;
    const row = { id: uuid(), categorie, naam, volgorde };
    demoKenmerkOpties.push(row);
    return row;
  }
  const { data, error } = await supabase.from('kenmerk_opties').insert({ categorie, naam }).select().single();
  check(error);
  return data;
}

// Hernoemen werkt door naar bestaande recepten: elk recept dat de oude
// waarde gebruikte, krijgt automatisch de nieuwe naam.
export async function renameKenmerkOptie(id, categorie, oudeNaam, nieuweNaam) {
  if (DEMO_MODE) {
    demoKenmerkOpties = demoKenmerkOpties.map((k) => (k.id === id ? { ...k, naam: nieuweNaam } : k));
    demoRecipes = demoRecipes.map((r) => (r[categorie] === oudeNaam ? { ...r, [categorie]: nieuweNaam } : r));
    return;
  }
  const { error } = await supabase.from('kenmerk_opties').update({ naam: nieuweNaam }).eq('id', id);
  check(error);
  const { error: err2 } = await supabase.from('recipes').update({ [categorie]: nieuweNaam }).eq(categorie, oudeNaam);
  check(err2);
}

// Verwijderen mag alleen als geen enkel recept deze waarde nog gebruikt,
// zodat recepten nooit stilzwijgend een ongeldig kenmerk overhouden.
export async function deleteKenmerkOptie(id, categorie, naam) {
  if (DEMO_MODE) {
    const inUse = demoRecipes.some((r) => r[categorie] === naam);
    if (inUse) throw new Error(`Kan "${naam}" niet verwijderen: nog in gebruik bij een of meer recepten.`);
    demoKenmerkOpties = demoKenmerkOpties.filter((k) => k.id !== id);
    return;
  }
  const { count, error: cErr } = await supabase.from('recipes').select('id', { count: 'exact', head: true }).eq(categorie, naam);
  check(cErr);
  if (count && count > 0) throw new Error(`Kan "${naam}" niet verwijderen: nog in gebruik bij ${count} recept(en).`);
  const { error } = await supabase.from('kenmerk_opties').delete().eq('id', id);
  check(error);
}

// ─────────────────────────────── Tags
export async function fetchTags() {
  if (DEMO_MODE) return demoTags.slice().sort((a, b) => a.naam.localeCompare(b.naam));
  const { data, error } = await supabase.from('tags').select('*').order('naam');
  check(error);
  return data;
}

export async function addTag(naam) {
  if (DEMO_MODE) {
    const row = { id: uuid(), naam };
    demoTags.push(row);
    return row;
  }
  const { data, error } = await supabase.from('tags').insert({ naam }).select().single();
  check(error);
  return data;
}

export async function renameTag(id, naam) {
  if (DEMO_MODE) { demoTags = demoTags.map((t) => (t.id === id ? { ...t, naam } : t)); return; }
  const { error } = await supabase.from('tags').update({ naam }).eq('id', id);
  check(error);
}

export async function deleteTag(id) {
  if (DEMO_MODE) {
    demoTags = demoTags.filter((t) => t.id !== id);
    Object.keys(demoRecipeTagIds).forEach((rid) => {
      demoRecipeTagIds[rid] = demoRecipeTagIds[rid].filter((tid) => tid !== id);
    });
    return;
  }
  const { error } = await supabase.from('tags').delete().eq('id', id);
  check(error);
}

export async function setRecipeTags(recipeId, tagIds) {
  if (DEMO_MODE) { demoRecipeTagIds[recipeId] = tagIds; return; }
  const { error: delErr } = await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId);
  check(delErr);
  if (tagIds.length) {
    const { error: insErr } = await supabase.from('recipe_tags').insert(tagIds.map((tagId) => ({ recipe_id: recipeId, tag_id: tagId })));
    check(insErr);
  }
}

// ─────────────────────────────── Opmerkingen-log per recept
export async function fetchNotities(recipeId) {
  if (DEMO_MODE) {
    return (demoNotities[recipeId] || []).slice().sort((a, b) => (b.datum + b.aangemaakt).localeCompare(a.datum + a.aangemaakt));
  }
  const { data, error } = await supabase.from('notities').select('*').eq('recipe_id', recipeId)
    .order('datum', { ascending: false }).order('aangemaakt', { ascending: false });
  check(error);
  return data;
}

export async function addNotitie(recipeId, tekst, datum) {
  if (DEMO_MODE) {
    const row = { id: uuid(), recipe_id: recipeId, tekst, datum: datum || todayISO(), aangemaakt: new Date().toISOString() };
    demoNotities[recipeId] = [row, ...(demoNotities[recipeId] || [])];
    return row;
  }
  const payload = { recipe_id: recipeId, tekst };
  if (datum) payload.datum = datum;
  const { data, error } = await supabase.from('notities').insert(payload).select().single();
  check(error);
  return data;
}

export async function deleteNotitie(id, recipeId) {
  if (DEMO_MODE) {
    demoNotities[recipeId] = (demoNotities[recipeId] || []).filter((n) => n.id !== id);
    return;
  }
  const { error } = await supabase.from('notities').delete().eq('id', id);
  check(error);
}
