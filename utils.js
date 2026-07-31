// Kleine hulpfuncties, gebruikt door app.js.
import { DAGEN, BASIS_OPTIONS, PROTEINE_OPTIONS, KEUKEN_OPTIONS } from './constants.js';

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

// Hoeveel van de ingrediënten van een recept staan al in de koelkast-lijst?
export function fridgeMatchForRecipe(recipe, fridgeItems) {
  const fridgeNorm = fridgeItems.map(normName);
  const total = (recipe.ingredienten || []).length;
  if (total === 0) return { matched: 0, total: 0, pct: 0, missing: [] };
  let matched = 0;
  const missing = [];
  recipe.ingredienten.forEach((ing) => {
    const n = normName(ing.naam);
    const hit = fridgeNorm.some((f) => f && (n.includes(f) || f.includes(n)));
    if (hit) matched++; else missing.push(ing.naam);
  });
  return { matched, total, pct: Math.round((matched / total) * 100), missing };
}

// Bouwt de boodschappenlijst op basis van het weekmenu. Elke dag heeft zijn
// eigen aantal personen (weekmenu[dag].personen); de hoeveelheden worden
// per dag geschaald ten opzichte van het aantal personen waar het recept
// oorspronkelijk voor bedoeld is. Markeert ook wat al in de koelkast staat.
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
    (recipe.ingredienten || []).forEach((ing) => {
      if (!ing.naam) return;
      const key = normName(ing.naam) + '|' + (ing.eenheid || '').toLowerCase().trim();
      const hoeveelheid = (typeof ing.hoeveelheid === 'number' && !isNaN(ing.hoeveelheid))
        ? ing.hoeveelheid * factor : null;
      if (!agg[key]) {
        agg[key] = { key, naam: ing.naam, eenheid: ing.eenheid || '', hoeveelheid };
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

// Zet een (los) JSON-object om naar een geldig recept-object voor het
// formulier: dwingt kenmerken af tot een geldige optie, vult ontbrekende
// velden met redelijke standaardwaarden, en negeert onbruikbare regels.
export function normalizeRecipeJson(raw) {
  raw = raw || {};
  const pick = (val, options, fallback) => {
    if (!val) return fallback;
    const found = options.find((o) => o.toLowerCase() === String(val).toLowerCase());
    return found || fallback;
  };
  return {
    titel: raw.titel ? String(raw.titel).trim() : 'Naamloos recept',
    basis: pick(raw.basis, BASIS_OPTIONS, 'Overig'),
    proteine: pick(raw.proteine, PROTEINE_OPTIONS, 'Geen'),
    keuken: pick(raw.keuken, KEUKEN_OPTIONS, 'Overig'),
    personen: Number(raw.personen) > 0 ? Math.round(Number(raw.personen)) : 4,
    bereidingstijd: Number(raw.bereidingstijd) > 0 ? Math.round(Number(raw.bereidingstijd)) : 30,
    ingredienten: Array.isArray(raw.ingredienten)
      ? raw.ingredienten
          .map((ing) => ({
            naam: ing && ing.naam ? String(ing.naam).trim() : '',
            hoeveelheid: ing && ing.hoeveelheid !== '' && ing.hoeveelheid != null && !isNaN(Number(ing.hoeveelheid))
              ? Number(ing.hoeveelheid) : null,
            eenheid: ing && ing.eenheid ? String(ing.eenheid).trim() : ''
          }))
          .filter((i) => i.naam)
      : [],
    instructies: Array.isArray(raw.instructies) ? raw.instructies.map((s) => String(s).trim()).filter(Boolean) : [],
    bron: raw.bron ? String(raw.bron).trim() : ''
  };
}

export function slugify(str) {
  return (str || 'recept').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'recept';
}
