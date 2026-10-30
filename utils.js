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
// De keuzelijst met eenheden zelf staat niet meer hier, maar in Supabase
// (tabel "eenheden", beheerbaar via de app). Deze aliassen zijn een losse,
// vaste vangnet-normalisatie voor tekst die uit een JSON-import komt (bv.
// van een AI die "gram" typt in plaats van "gr") — onafhankelijk van welke
// eenheden je op dit moment beheert.
const EENHEID_ALIASSEN = {
  'gram': 'gr', 'grammen': 'gr', 'g': 'gr',
  'kilogram': 'kg', 'kilo': 'kg',
  'milliliter': 'ml',
  'liter': 'l', 'ltr': 'l',
  'eetlepel': 'el', 'eetlepels': 'el', 'tbsp': 'el',
  'theelepel': 'tl', 'theelepels': 'tl', 'tsp': 'tl',
  'stuk': 'st', 'stuks': 'st', 'stk': 'st',
  'teen': 'tenen', 'teentje': 'tenen', 'teentjes': 'tenen',
  'snuf': 'snufje', 'snufjes': 'snufje',
  'blik': 'blikje', 'blikjes': 'blikje'
};

// Zet "g"/"gram"/"Gram" allemaal om naar dezelfde schrijfwijze ("gr"),
// en "stuk"/"stuks" naar "st".
// Onbekende eenheden worden alleen getrimd/lowercase gemaakt, niet
// weggegooid.
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

// Exacte match: alleen als de genormaliseerde namen (kleine letters, zonder
// accenten, getrimd) gelijk zijn. "kip" matcht dus niet op "kipgehakt".
function inKoelkast(naam, fridgeNorm) {
  const n = normName(naam);
  return !!n && fridgeNorm.some((f) => f && f === n);
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
    const hit = inKoelkast(ing.naam, fridgeNorm);
    if (hit) matched++; else missing.push(ing.naam);
  });
  return { matched, total, pct: Math.round((matched / total) * 100), missing };
}

// Bouwt de boodschappenlijst op basis van het weekmenu. Elke dag heeft zijn
// eigen aantal personen; hoeveelheden worden per dag geschaald ten opzichte
// van het aantal personen waar het recept oorspronkelijk voor bedoeld is.
// Er wordt opgeteld op het canonieke ingredient_id (+ eenheid) in plaats van
// op losse tekst, zodat "ui" uit twee recepten samen op één regel komt, ook
// als de een "g" en de ander "gram" schreef.
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
        agg[key] = { key, ingredientId: ing.ingredientId || null, naam: ing.naam, eenheid, hoeveelheid, bronnen: [] };
      } else if (hoeveelheid !== null) {
        agg[key].hoeveelheid = (agg[key].hoeveelheid || 0) + hoeveelheid;
      }
      // Per-bron uitsplitsing: welk recept/welke dag levert hoeveel.
      const bron = agg[key].bronnen.find((b) => b.dag === dag);
      if (bron) {
        if (hoeveelheid !== null) bron.hoeveelheid = (bron.hoeveelheid || 0) + hoeveelheid;
      } else {
        agg[key].bronnen.push({ dag, recipeId: recipe.id, titel: recipe.titel, hoeveelheid });
      }
    });
  });
  const fridgeNorm = fridgeItems.map(normName);
  return Object.values(agg)
    .map((item) => {
      const inHuis = inKoelkast(item.naam, fridgeNorm);
      return {
        ...item,
        bronnen: item.bronnen.map((b) => ({ ...b, hoeveelheid: b.hoeveelheid !== null ? Math.round(b.hoeveelheid * 100) / 100 : null })),
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
            afdeling: ing && ing.afdeling ? String(ing.afdeling).trim() : '',
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
  const minuten = (v) => (Number(v) > 0 ? Math.round(Number(v)) : null);
  const voor = minuten(raw.voorbereidingstijd);
  const oven = minuten(raw.oventijd);
  // Is de tijd opgesplitst, dan is het totaal altijd de som van de twee.
  const totaal = voor != null || oven != null ? (voor || 0) + (oven || 0) : (minuten(raw.bereidingstijd) || 30);
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
    bereidingstijd: totaal,
    voorbereidingstijd: voor,
    oventijd: oven,
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

// ─────────────────────────────── Afdeling voorstellen (trefwoordenregels)
// Wordt alleen gebruikt voor NIEUWE ingrediënten zonder afdeling en voor de
// knop "Automatisch indelen". De eerste regel die past wint, dus de
// specifieke regels staan bovenaan. Trefwoord-notatie:
//   "kip"   = begin van een woord  (kip, kipfilet, kippendij)
//   "~olie" = overal in het woord  (olijfolie, sesamolie)
//   "ei!"   = alleen het hele woord (ei, niet eiland)
const AFDELING_REGELS = [
  ['Conserven & houdbaar', ['bakpoeder', '~bouillon', 'fond!', 'tomatenpuree', 'passata', 'gezeefde', 'tomatenblokjes', 'blik', 'ingeblikt', 'kikkererwten', 'kidneybonen', 'witte bonen', 'bruine bonen', 'zwarte bonen', 'bonen!', 'linzen', 'mais!', 'maiskorrels', 'olijven', 'kappertjes', 'augurk', 'pindakaas', '~jam', 'honing', 'suiker', 'bloem!', '~meel', 'maizena', 'paneermeel', 'gist', 'hagelslag', 'pindas', 'noten', 'amandel', 'cashew', 'walnoot', 'hazelnoot', 'pijnboompitten', 'rozijnen', 'tonijn', 'sardine', 'ansjovis']],
  ['Groente & fruit', ['rode peper', 'groene peper', 'spaanse peper', 'chilipeper', 'peperoni', 'jalapeno']],
  ['Wereldkeuken & sauzen', ['currypasta', 'kerriepasta', '~saus', 'sambal', 'harissa', 'miso', 'tahin', 'pesto', 'sriracha', 'ketjap', 'hoisin', 'kokosmelk', 'kokosroom', 'santen', 'wasabi', 'salsa', 'ketchup', 'mayonaise', 'mosterd', 'teriyaki', 'gochujang', 'tortillachips', 'taco', 'nacho', 'hummus', 'guacamole']],
  ['Kruiden & olie', ['~olie', '~azijn', '~poeder', 'zout', '~zeezout', '~keukenzout', 'peper!', '~kruiden', 'gedroogd', 'laurier', 'kruidnagel', 'kardemom', 'saffraan', 'vanille', 'komijn', 'kurkuma', 'kaneel', 'nootmuskaat', 'oregano', 'garam', 'masala', 'kerrie', 'curry!', 'cayenne', 'piment', 'venkelzaad', 'sesamzaad', 'chilivlokken', '~vlokken', 'ras el hanout', 'zaatar', 'sumak']],
  ['Diepvries', ['diepvries', 'bevroren', 'bladerdeeg', 'frites', 'friet']],
  ['Zuivel & eieren', ['melk', '~melk', 'yoghurt', 'kwark', 'room', 'slagroom', 'creme fraiche', 'kaas', '~kaas', '~boter', 'margarine', 'ei!', 'eieren', 'eiwit', 'eidooier', 'mozzarella', 'parmezaan', 'parmigiano', 'pecorino', 'feta', 'ricotta', 'mascarpone', 'cheddar', 'gouda', 'brie', 'camembert', 'halloumi', 'paneer', 'boursin', 'vla', 'skyr']],
  ['Vlees & vis', ['kip', 'kalkoen', 'gehakt', 'rundvlees', 'rund', 'varkens', 'spek', 'ham!', 'hamlap', 'worst', 'braadworst', 'rookworst', 'bacon', 'biefstuk', 'entrecote', 'lams', 'eend', 'schnitzel', 'shoarma', 'kebab', 'chorizo', 'salami', 'pancetta', 'prosciutto', 'vlees', 'filet', 'ribs', 'slavink', 'hamburger', 'vis', 'zalm', 'kabeljauw', 'forel', 'makreel', 'haring', 'garnaal', 'gamba', 'mosselen', 'inktvis', 'schol', 'tilapia', 'pangasius', 'zeevruchten', 'lapjes', 'stoofvlees', 'balletjes']],
  ['Brood & bakkerij', ['brood', 'broodje', 'stokbrood', 'bol!', 'bollen', 'pistolet', 'wrap', 'tortilla', 'pita', 'naan', 'chapati', 'roti', 'bagel', 'croissant', 'toast', 'beschuit', 'cracker', 'pizzabodem', 'pizzadeeg', 'focaccia', 'ciabatta']],
  ['Groente & fruit', ['ui', 'uien', 'sjalot', 'knoflook', 'prei', 'lente', 'bosui', 'tomaat', 'tomaten', 'kerstomaat', 'cherry', 'komkommer', 'paprika', 'courgette', 'aubergine', 'wortel', 'peen', 'aardappel', 'krieltjes', 'zoete aardappel', 'bataat', 'pompoen', 'broccoli', 'bloemkool', 'spinazie', 'sla', 'ijsbergsla', 'rucola', 'andijvie', 'spruitjes', 'boerenkool', 'kool', 'witlof', 'sperziebonen', 'snijbonen', 'doperwten', 'erwten', 'champignon', 'paddenstoel', 'oesterzwam', 'shiitake', 'maiskolf', 'avocado', 'citroen', 'limoen', 'sinaasappel', 'appel', 'peer', 'banaan', 'druiven', 'aardbei', 'framboos', 'bosbes', 'blauwe bessen', 'mango', 'ananas', 'meloen', 'kiwi', 'perzik', 'nectarine', 'pruim', 'gember', 'koriander', 'peterselie', 'basilicum', 'munt', 'bieslook', 'dille', 'tijm', 'rozemarijn', 'salie', 'selderij', 'bleekselderij', 'venkel', 'radijs', 'knolselderij', 'pastinaak', 'biet', 'asperge', 'artisjok', 'edamame', 'taugee', 'paksoi', 'citroengras', 'groente', 'fruit', 'salade', 'veldsla', 'rabarber', 'abrikoos', 'granaatappel', 'vijgen']],
  ['Pasta, rijst & granen', ['pasta', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'farfalle', 'tagliatelle', 'lasagne', 'rigatoni', 'linguine', 'fettuccine', 'orzo', 'gnocchi', 'rijst', 'basmati', 'jasmijn', 'risotto', 'noedel', 'mie!', 'mihoen', 'udon', 'ramen', 'soba', 'couscous', 'bulgur', 'quinoa', 'havermout', 'muesli', 'cornflakes', 'gries', 'polenta', 'cannelloni', 'vermicelli', 'tortelloni', 'ravioli']],
  ['Dranken', ['wijn', 'bier', 'sap!', 'jus', 'water!', 'cola', 'limonade', 'frisdrank', 'koffie', 'thee', 'prosecco', 'whisky', 'tonic']]
];

const AFDELING_REGELS_RE = AFDELING_REGELS.map(([afdeling, woorden]) => [
  afdeling,
  woorden.map((w) => {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (w.startsWith('~')) return new RegExp(esc(w.slice(1)));
    if (w.endsWith('!')) return new RegExp('(^|[^a-z])' + esc(w.slice(0, -1)) + '(?![a-z])');
    return new RegExp('(^|[^a-z])' + esc(w));
  })
]);

// Geeft de NAAM van een voorgestelde afdeling terug, of null als geen regel past.
export function suggestAfdeling(naam) {
  const n = normName(naam);
  if (!n) return null;
  for (const [afdeling, regexen] of AFDELING_REGELS_RE) {
    if (regexen.some((re) => re.test(n))) return afdeling;
  }
  return null;
}

// Maakt een deelbare tekst van de boodschappenlijst, gegroepeerd per afdeling.
// groepen: [{ titel, items: [{ naam, hoeveelheid, eenheid }] }]
export function shoppingListToText(groepen) {
  const regels = ['Boodschappen'];
  groepen.forEach((g) => {
    if (!g.items.length) return;
    regels.push('', g.titel);
    g.items.forEach((i) => {
      const hoev = i.hoeveelheid != null ? ` ${i.hoeveelheid}${i.eenheid ? ' ' + i.eenheid : ''}` : '';
      regels.push(`- ${i.naam}${hoev}`);
    });
  });
  return regels.join('\n');
}

// Bouwt de volledige AI-prompt (zie ook ai-prompt.md) met de lijsten uit de
// app zelf: basis, proteïne, keuken, afdelingen en eenheden.
export function buildAiPrompt({ basis, proteine, keuken, afdelingen, eenheden, extra, ingredienten }) {
  const lijst = (a) => a.join(', ');
  const heeft = (e) => eenheden.includes(e);
  const hints = [
    heeft('gr') ? '"gr" in plaats van "gram" of "g"' : '',
    heeft('st') ? '"st" in plaats van "stuk" of "stuks"' : '',
    heeft('tenen') ? '"tenen" voor knoflook ("teentjes" wordt dus "tenen")' : '',
    heeft('tl') ? '"tl" in plaats van "theelepel"' : ''
  ].filter(Boolean);
  const regels = [
    `Kies voor "basis", "proteine" en "keuken" altijd exact één van de genoemde opties, letterlijk overgenomen (geen eigen bewoording). Gebruik "${basis[basis.length - 1]}" (bij proteine "${proteine[proteine.length - 1]}", bij keuken "${keuken[keuken.length - 1]}") als niets goed past.`,
    'Schat "personen" in als het niet in het recept staat.',
    `Tijd, alles in minuten:
  - "voorbereidingstijd" is de tijd dat je zelf actief bezig bent (snijden, roeren, bakken met aandacht).
  - "oventijd" is de tijd dat het gerecht zichzelf klaarmaakt in de oven of pan (laten sudderen, bakken in de oven, rijzen), zonder handwerk.
  - "bereidingstijd" is het totaal: voorbereidingstijd + oventijd.
  - Staat er in het recept maar één totale tijd, of weet je de verdeling niet? Laat "voorbereidingstijd" en "oventijd" dan weg en vul alleen "bereidingstijd" in (schat die als er niets staat).`,
    `Gebruik voor "eenheid" uitsluitend: ${lijst(eenheden)} (of laat leeg).${hints.length ? ` Schrijf dus ${hints.join(', ')}.` : ''} Zo telt de boodschappenlijst dezelfde ingrediënten van verschillende recepten goed bij elkaar op.`,
    '"hoeveelheid" is een getal (gebruik een punt voor decimalen, bv. 0.5), of null wanneer er geen hoeveelheid is aangegeven (bv. "naar smaak" of "een snufje").',
    'Gebruik voor "naam" van een ingrediënt de gewone, korte naam in het enkelvoud of zoals je het in de winkel koopt, zonder bereidingswijze ("ui", niet "fijngesneden ui"; "kipfilet", niet "gebakken kipfilet"), en gebruik voor hetzelfde product steeds dezelfde naam.',
    `Kies voor "afdeling" bij elk ingrediënt exact één van deze afdelingen, letterlijk overgenomen (geen eigen bewoording): ${lijst(afdelingen)}. Kies de afdeling waar je het product in een gewone Nederlandse supermarkt vindt. Gebruik "${afdelingen[afdelingen.length - 1]}" alleen als niets past.`,
    'Bron: staat het recept op een foto uit een kookboek? Zet dan in "bron" de boektitel en de bladzijde, bv. "Ottolenghi Simple, blz 45". Komt het van een website, zet dan de link. Weet je het niet, laat "bron" leeg.',
    'Eén handeling per stap in "instructies", kort en duidelijk.',
    'Geef uitsluitend het JSON-object terug, verder niets — het moet direct als .json-bestand opgeslagen en geüpload kunnen worden.'
  ];
  if (ingredienten && ingredienten.length) {
    regels.push(`Staat een ingrediënt in onderstaande lijst van mijn bestaande ingrediënten? Gebruik dan exact die naam. Alleen als iets er echt niet in staat, bedenk je een nieuwe naam.\n  Bestaande ingrediënten: ${lijst(ingredienten)}`);
  }
  const eigen = (extra || '').trim();
  if (eigen) regels.push(`Extra regels van mij:\n${eigen.split('\n').map((r) => '  ' + r).join('\n')}`);

  return `Zet het volgende recept om naar geldige JSON met exact deze structuur. Geef ALLEEN het JSON-object terug — geen uitleg, geen inleidende tekst, geen markdown-codeblok (dus niet tussen \`\`\`).

Voor een GEWOON recept (één geheel, geen aparte onderdelen) gebruik je één item in "onderdelen" met "naam": "":

{
  "titel": "string",
  "basis": "kies exact één van: ${lijst(basis)}",
  "proteine": "kies exact één van: ${lijst(proteine)}",
  "keuken": "kies exact één van: ${lijst(keuken)}",
  "personen": 4,
  "voorbereidingstijd": 20,
  "oventijd": 35,
  "bereidingstijd": 55,
  "onderdelen": [
    {
      "naam": "",
      "ingredienten": [
        { "naam": "kipfilet", "hoeveelheid": 500, "eenheid": "${heeft('gr') ? 'gr' : eenheden[0] || ''}", "afdeling": "${afdelingen.find((a) => /vlees/i.test(a)) || afdelingen[0]}" },
        { "naam": "zout", "hoeveelheid": null, "eenheid": "", "afdeling": "${afdelingen.find((a) => /kruid/i.test(a)) || afdelingen[0]}" }
      ],
      "instructies": ["Eerste stap.", "Tweede stap.", "..."]
    }
  ],
  "bron": "boektitel + bladzijde, of een link, of leeg"
}

Bestaat het recept uit aparte delen die je apart bereidt (bv. een marinade en een saus, of een deeg en een vulling)? Geef dan per deel een eigen item in "onderdelen", elk met een eigen "naam" (bv. "Marinade", "Saus"), eigen "ingredienten" en eigen "instructies".

Regels:
${regels.map((r) => '- ' + r).join('\n')}

Wil je meerdere recepten in één keer? Geef dan een JSON-array van meerdere van dit soort objecten terug ([ {...}, {...} ]).

Het recept:

[plak hier de tekst van het recept, een link, of een omschrijving]
`;
}

// ─────────────────────────────────────────── Verras me (release 9)
// Kiest recepten voor de opgegeven dagen. Vaste regels:
//  - nooit een recept dat al in de week staat, en nooit boven de maximale tijd;
//  - niet dezelfde proteïne op twee opeenvolgende dagen en hooguit 2x per week
//    (proteïne "Geen" valt hier buiten);
//  - voorkeur (score) voor favorieten, recepten die lang niet gekookt zijn en
//    recepten waarvan je veel in de koelkast hebt, met een beetje toeval.
// Lukt het niet met alle regels, dan worden eerst de weekgrens en daarna het
// "niet twee dagen achter elkaar" versoepeld (versoepeld = true).
// week: { Ma: recipeId|null, ... } = de stand van de week zonder de dagen die vervangen worden.
export function verrasVoorstel({ recipes, week, dagen, dagenVolgorde, maxTijd, laatstGekookt, fridgeNames, uitsluiten, random }) {
  const rnd = random || Math.random;
  const volgorde = dagenVolgorde;
  const plan = { ...week };
  const picks = {};
  const onvolledig = [];
  let versoepeld = false;
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const vandaag = new Date();
  const dagenGeleden = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.round((new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate()) - new Date(y, m - 1, d)) / 86400000);
  };
  const score = (r) => {
    let s = r.favoriet ? 3 : 0;
    const laatst = laatstGekookt(r.id);
    s += laatst ? Math.min(Math.max(dagenGeleden(laatst), 0) / 7, 8) * 0.375 : 3;
    if (fridgeNames && fridgeNames.length) s += (fridgeMatchForRecipe(r, fridgeNames).pct / 100) * 2;
    return s + rnd();
  };
  const proteineVan = (id) => { const r = byId.get(id); return r ? r.proteine : null; };
  for (const dag of dagen) {
    const idx = volgorde.indexOf(dag);
    const buren = [volgorde[idx - 1], volgorde[idx + 1]].map((d) => (d ? proteineVan(plan[d]) : null)).filter(Boolean);
    const inWeek = new Set(Object.values(plan).filter(Boolean));
    const basis = recipes.filter((r) => !inWeek.has(r.id) && !(uitsluiten || []).includes(r.id) && (!maxTijd || r.bereidingstijd <= maxTijd));
    const telProteine = (p) => Object.values(plan).filter((id) => id && proteineVan(id) === p).length;
    const niveaus = [
      (r) => r.proteine === 'Geen' || (!buren.includes(r.proteine) && telProteine(r.proteine) < 2),
      (r) => r.proteine === 'Geen' || !buren.includes(r.proteine),
      () => true
    ];
    let keuze = null;
    for (let n = 0; n < niveaus.length && !keuze; n++) {
      const kand = basis.filter(niveaus[n]);
      if (kand.length) {
        keuze = kand.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s)[0].r;
        if (n > 0) versoepeld = true;
      }
    }
    if (keuze) { plan[dag] = keuze.id; picks[dag] = keuze.id; } else onvolledig.push(dag);
  }
  return { picks, onvolledig, versoepeld };
}

