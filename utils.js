// Kleine hulpfuncties, gebruikt door app.js.
import { DAGEN } from './constants.js';

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function normName(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─────────────────────────────── Eenheden normaliseren
// Canonieke eenheden die de app gebruikt — dit is ook de lijst die in het
// formulier als keuzelijst verschijnt.
export const EENHEID_OPTIES = ['', 'g', 'kg', 'ml', 'l', 'el', 'tl', 'stuks', 'tenen', 'snufje', 'blikje','cm'];

const EENHEID_ALIASSEN = {
  'gram': 'g', 'grammen': 'g', 'gr': 'g',
  'kilogram': 'kg', 'kilo': 'kg',
  'milliliter': 'ml',
  'liter': 'l', 'ltr': 'l',
  'eetlepel': 'el', 'eetlepels': 'el', 'tbsp': 'el',
  'theelepel': 'tl', 'theelepels': 'tl', 'tsp': 'tl',
  'stuk': 'stuks', 'stk': 'stuks',
  'tenen': 'teentje', 'teentjes': 'tenen',
  'snuf': 'snufje', 'snufjes': 'snufje',
  'blik': 'blikje', 'blikjes': 'blikje'
};

// Zet "gr"/"gram"/"Gram" allemaal om naar dezelfde canonieke schrijfwijze
// ("g"), zodat de boodschappenlijst dezelfde eenheid herkent. Onbekende
// eenheden worden alleen getrimd/lowercase gemaakt, niet weggegooid.
export function normalizeEenheid(input) {
  const clean = (input || '').toLowerCase().trim();
  if (!clean) return '';
  return EENHEID_ALIASSEN[clean] || clean;
}

// ─────────────────────────────── Ingrediënten over alle onderdelen
// Recepten zijn opgebouwd uit "onderdelen" (bv. Marinade + Saus); dit geeft
// een platte lijst van alle ingrediëntregels van een recept, ongeacht bij
// welk onderdeel ze horen.
export function alleIngredienten(recipe) {
  return (recipe.onderdelen || []).flatMap((o) => o.ingredienten || []);
}

// Hoeveel van de ingrediënten van een recept staan al in de koelkast-lijst?
export function fridgeMatchForRecipe(recipe, fridgeItems) {
  const fridgeNorm = fridgeItems.map(normName);
  const ingredienten = alleIngredienten(recipe);
  const total = ingredienten.length;
  if (total === 0) return { matched: 0, total: 0, pct: 0, missing: [] };
  let matched = 0;
  const missing = [];
  ingredienten.forEach((ing) => {
    const n = normName(ing.naam);
    const hit = fridgeNorm.some((f) => f && (n.includes(f) || f.includes(n)));
    if (hit) matched++; else missing.push(ing.naam);
  });
  return { matched, total, pct: Math.round((matched / total) * 100), missing };
}

// Bouwt de boodschappenlijst op basis van het weekmenu. Elke dag heeft zijn
// eigen aantal personen; hoeveelheden worden per dag geschaald ten opzichte
// van het aantal personen waar het recept oorspronkelijk voor bedoeld is.
// Er wordt opgeteld op het canonieke ingredient_id (+ eenheid) in plaats van
// op losse tekst, zodat "ui" uit twee recepten samen op één regel komt, ook
// als de een "gr" en de ander "gram" schreef.
export function buildShoppingList(weekmenu, recipes, fridgeItems) {
  const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const agg = {};
  DAGEN.forEach((dag) => {
    const entry = weekmenu[dag];
    if (!entry || !entry.recipeId) return;
    const recipe = byId[entry.recipeId];
    if (!recipe) return;
    const personen = entry.personen || recipe.personen;
    const factor = recipe.personen > 0 ? personen / recipe.personen : 1;
    alleIngredienten(recipe).forEach((ing) => {
      if (!ing.naam) return;
      const eenheid = normalizeEenheid(ing.eenheid);
      const key = (ing.ingredientId || normName(ing.naam)) + '|' + eenheid;
      const hoeveelheid = (typeof ing.hoeveelheid === 'number' && !isNaN(ing.hoeveelheid))
        ? ing.hoeveelheid * factor : null;
      if (!agg[key]) {
        agg[key] = { key, naam: ing.naam, eenheid, hoeveelheid };
      } else if (hoeveelheid !== null) {
        agg[key].hoeveelheid = (agg[key].hoeveelheid || 0) + hoeveelheid;
      }
    });
  });
  const fridgeNorm = fridgeItems.map(normName);
  return Object.values(agg)
    .map((item) => {
      const n = normName(item.naam);
      const inHuis = fridgeNorm.some((f) => f && (n.includes(f) || f.includes(n)));
      return {
        ...item,
        hoeveelheid: item.hoeveelheid !== null ? Math.round(item.hoeveelheid * 100) / 100 : null,
        inHuis
      };
    })
    .sort((a, b) => a.naam.localeCompare(b.naam));
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function normalizeOnderdeel(raw) {
  raw = raw || {};
  return {
    naam: raw.naam ? String(raw.naam).trim() : '',
    ingredienten: Array.isArray(raw.ingredienten)
      ? raw.ingredienten
          .map((ing) => ({
            naam: ing && ing.naam ? String(ing.naam).trim() : '',
            hoeveelheid: ing && ing.hoeveelheid !== '' && ing.hoeveelheid != null && !isNaN(Number(ing.hoeveelheid))
              ? Number(ing.hoeveelheid) : null,
            eenheid: ing && ing.eenheid ? normalizeEenheid(String(ing.eenheid)) : '',
            notitie: ing && ing.notitie ? String(ing.notitie).trim() : ''
          }))
          .filter((i) => i.naam)
      : [],
    instructies: Array.isArray(raw.instructies) ? raw.instructies.map((s) => String(s).trim()).filter(Boolean) : []
  };
}

// Zet een (los) JSON-object om naar een geldig recept-object voor het
// formulier: dwingt kenmerken af tot een geldige optie uit de huidige
// (beheerde) lijsten, vult ontbrekende velden met redelijke
// standaardwaarden, en negeert onbruikbare regels. Ondersteunt zowel het
// nieuwe schema (met "onderdelen") als het oude platte schema (met
// "ingredienten"/"instructies" direct op het recept) — dat laatste wordt
// automatisch als één naamloos onderdeel behandeld.
export function normalizeRecipeJson(raw, basisOptions, proteineOptions, keukenOptions) {
  raw = raw || {};
  const pick = (val, options, fallback) => {
    if (!val) return fallback;
    const found = options.find((o) => o.toLowerCase() === String(val).toLowerCase());
    return found || fallback;
  };
  const onderdelen = Array.isArray(raw.onderdelen) && raw.onderdelen.length
    ? raw.onderdelen.map(normalizeOnderdeel)
    : [normalizeOnderdeel({ naam: '', ingredienten: raw.ingredienten, instructies: raw.instructies })];
  return {
    titel: raw.titel ? String(raw.titel).trim() : 'Naamloos recept',
    basis: pick(raw.basis, basisOptions, basisOptions[basisOptions.length - 1]),
    proteine: pick(raw.proteine, proteineOptions, proteineOptions[proteineOptions.length - 1]),
    keuken: pick(raw.keuken, keukenOptions, keukenOptions[keukenOptions.length - 1]),
    personen: Number(raw.personen) > 0 ? Math.round(Number(raw.personen)) : 4,
    bereidingstijd: Number(raw.bereidingstijd) > 0 ? Math.round(Number(raw.bereidingstijd)) : 30,
    onderdelen,
    bron: raw.bron ? String(raw.bron).trim() : ''
  };
}

// Formatteert een ISO-datum (YYYY-MM-DD) als DD-M-YYYY, zoals in het
// opmerkingen-log.
export function formatDatumNL(isoDatum) {
  if (!isoDatum) return '';
  const [y, m, d] = isoDatum.split('-');
  if (!y || !m || !d) return isoDatum;
  return `${Number(d)}-${Number(m)}-${y}`;
}

export function slugify(str) {
  return (str || 'recept').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'recept';
}
