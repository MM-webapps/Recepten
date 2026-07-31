// Kleine hulpfuncties, gebruikt door app.js en ai.js.
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

// Bouwt de boodschappenlijst op basis van het weekmenu, geschaald naar het
// aantal personen thuis, en markeert wat al in de koelkast staat.
export function buildShoppingList(weekmenu, recipes, huishoudPersonen, fridgeItems) {
  const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const agg = {};
  DAGEN.forEach((dag) => {
    const recipeId = weekmenu[dag];
    if (!recipeId) return;
    const recipe = byId[recipeId];
    if (!recipe) return;
    const factor = recipe.personen > 0 ? huishoudPersonen / recipe.personen : 1;
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

// Zoekt het eerste volledige JSON-object in een stuk tekst (negeert tekst
// ervoor/erna en accolades binnen strings).
export function extractJsonObject(text) {
  if (!text) return null;
  let cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonStr = cleaned.slice(start, i + 1);
        try { return JSON.parse(jsonStr); } catch (e) { return null; }
      }
    }
  }
  return null;
}

// Comprimeert een foto naar een redelijke grootte en geeft base64 (zonder
// data-URL-prefix) + media type terug, klaar om naar de Anthropic API te sturen.
export function fileToResizedBase64(file, maxDim = 1500, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => reject(new Error('Kon de foto niet laden.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Kon het bestand niet lezen.'));
    reader.readAsDataURL(file);
  });
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

export function slugify(str) {
  return (str || 'recept').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'recept';
}
