// AI-import: recept vanaf een link of foto omzetten naar JSON.
// Gebruikt de eigen Anthropic API-key van de gebruiker (alleen lokaal
// bewaard, nooit in de repo) en Anthropic's browser-CORS-header.
import { BASIS_OPTIONS, PROTEINE_OPTIONS, KEUKEN_OPTIONS } from './constants.js';
import { extractJsonObject } from './utils.js';

const LS_KEY = 'receptenkist_anthropic_key';
const MODEL = 'claude-sonnet-5';

export function getApiKey() {
  return localStorage.getItem(LS_KEY) || '';
}

export function setApiKey(key) {
  if (key) localStorage.setItem(LS_KEY, key.trim());
  else localStorage.removeItem(LS_KEY);
}

async function callClaude({ system, content, tools }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Geen Anthropic API-key ingesteld. Voeg er een toe via "AI-instellingen".');
  }
  const body = {
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content }]
  };
  if (system) body.system = system;
  if (tools && tools.length) body.tools = tools;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      msg = (errJson && errJson.error && errJson.error.message) || msg;
    } catch (e) { /* negeren, val terug op status */ }
    throw new Error(`Anthropic API-fout: ${msg}`);
  }

  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function schemaHint() {
  return `Gebruik exact dit schema en geef ALLEEN het JSON-object terug, zonder uitleg en zonder markdown-codeblokken:
{
  "titel": string,
  "basis": een van [${BASIS_OPTIONS.join(', ')}],
  "proteine": een van [${PROTEINE_OPTIONS.join(', ')}],
  "keuken": een van [${KEUKEN_OPTIONS.join(', ')}],
  "personen": number,
  "bereidingstijd": number (minuten),
  "ingredienten": [{"naam": string, "hoeveelheid": number, "eenheid": string}],
  "instructies": [string]
}
Kies de best passende waarde uit de lijst voor basis, proteine en keuken; gebruik "Overig" (of "Geen" bij proteine) als niets goed past. Schat personen en bereidingstijd als ze niet expliciet vermeld staan. Houd instructiestappen bondig.`;
}

function normalizeExtractedRecipe(raw) {
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
            hoeveelheid: ing && !isNaN(Number(ing.hoeveelheid)) && ing.hoeveelheid !== '' && ing.hoeveelheid != null
              ? Number(ing.hoeveelheid) : null,
            eenheid: ing && ing.eenheid ? String(ing.eenheid).trim() : ''
          }))
          .filter((i) => i.naam)
      : [],
    instructies: Array.isArray(raw.instructies) ? raw.instructies.map((s) => String(s).trim()).filter(Boolean) : [],
    bron: raw.bron ? String(raw.bron) : ''
  };
}

export async function extractRecipeFromLink(url) {
  const text = await callClaude({
    system: 'Je zet recepten om naar strikt geldige JSON volgens het gegeven schema. Antwoord uitsluitend met het JSON-object.',
    content: [{ type: 'text', text: `Zoek het recept op via deze URL en zet het om naar JSON: ${url}\n\n${schemaHint()}` }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
  });
  const raw = extractJsonObject(text);
  if (!raw) throw new Error('Kon geen geldige receptdata herkennen op die pagina.');
  const recipe = normalizeExtractedRecipe(raw);
  recipe.bron = url;
  return recipe;
}

export async function extractRecipeFromPhoto(base64Jpeg) {
  const text = await callClaude({
    system: 'Je zet recepten om naar strikt geldige JSON volgens het gegeven schema. Antwoord uitsluitend met het JSON-object.',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } },
      { type: 'text', text: `Zet het recept op deze foto om naar JSON.\n\n${schemaHint()}` }
    ]
  });
  const raw = extractJsonObject(text);
  if (!raw) throw new Error('Kon geen geldig recept herkennen op deze foto.');
  return normalizeExtractedRecipe(raw);
}
