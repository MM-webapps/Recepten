# MMenu-Planner — overdrachtsdocument

Laatst bijgewerkt: 22 okt 2026 (release 5.3 afgerond).

## 1. Wat doet de app
Persoonlijke recepten- en weekmenu-app (geen login, één gebruiker/huishouden).
- Recepten bewaren met basis (aardappel/pasta/rijst…), proteïne, keuken, personen, bereidingstijd, tags.
- Recepten bestaan uit **onderdelen** (bv. marinade + saus), elk met eigen ingrediënten en instructies.
- Opmerkingen-log per recept (met datum).
- Filteren op kenmerken, tags, max. tijd en zoekterm.
- Weekmenu (Ma–Zo) met **per dag** het aantal personen.
- Koelkast: ingrediënten invullen en zien welke recepten ermee kunnen.
- Boodschappenlijst uit het weekmenu (geschaald per dag, minus koelkast, afvinkbaar).
- Recepten toevoegen: **handmatig** of via **JSON-upload** (één recept of array). De JSON maakt de gebruiker zelf met een AI via `ai-prompt.md`.
- Beheren-venster: basis/proteïne/keuken-opties, tags, ingrediënten (hernoemen/samenvoegen/verwijderen), eenheden.
- DEMO_MODE: zolang `config.js` placeholders bevat draait de app met data in het geheugen.

## 2. Tech stack
- Plain HTML + CSS + JS (ES modules, geen build). Iconen: Lucide via unpkg.
- Hosting: GitHub Pages (branch main, root).
- Data: Supabase (supabase-js v2 via esm.sh), REST met geneste selects.
- Beveiliging: geen login; RLS aan met open policies (`using (true)`). De publishable/anon key staat bewust publiek in de repo.
- Werkwijze: bestanden vervangen op GitHub; `schema.sql` volledig opnieuw plakken in de Supabase SQL-editor (idempotent, veilig).
- **`config.js` op GitHub bevat de echte Supabase-URL en key van de gebruiker — niet overschrijven** (in de outputs staan placeholders).

## 3. Bestanden
| Bestand | Inhoud |
|---|---|
| index.html | Skeleton, laadt style.css, Lucide, app.js (module). Titel op regel 6. |
| style.css | Design tokens, knoppen, kaarten, modal, stepper, shop-items |
| config.js | Supabase URL + key |
| constants.js | Demo-startlijsten, DAGEN/DAG_NAMEN, KENMERK_STYLE |
| utils.js | escapeHtml, normName, normalizeEenheid, alleIngredienten, fridgeMatchForRecipe, buildShoppingList, normalizeRecipeJson, downloadJSON, formatDatumNL, slugify |
| db.js | Alle Supabase-calls + demo-modus (in-memory) |
| app.js | State, rendering, events (~65 KB) |
| schema.sql | Tabellen, RLS, seeds, eenmalige migratie |
| ai-prompt.md | Prompt om recept → JSON te maken |
| README.md | Setup- en gebruiksuitleg |

## 4. Tabelstructuur (13 tabellen, allemaal RLS aan + open policy `*_open`)
- **recipes**: id, titel, basis, proteine, keuken, personen, bereidingstijd, bron, aangemaakt (+ `ingredienten_legacy`, `instructies_legacy` na migratie)
- **recipe_onderdelen**: id, recipe_id, naam, volgorde, instructies (jsonb)
- **recipe_ingredienten**: id, onderdeel_id, ingredient_id, hoeveelheid (numeric), eenheid (text), notitie, volgorde
- **ingredients**: id, naam, standaard_eenheid; unieke index op lower(trim(naam))
- **ingredient_aliassen**: alias → ingredient
- **eenheden**: naam (uniek), volgorde
- **kenmerk_opties**: id, categorie (basis/proteine/keuken), naam, volgorde, unique(categorie,naam)
- **tags**, **recipe_tags**
- **notities**: recipe_id, tekst, datum, aangemaakt
- **weekmenu**: dag (PK), recipe_id, personen
- **koelkast**: id, naam, aangemaakt
- **instellingen**: één rij (id=1): huishoud_personen, boodschappen_vinkjes (jsonb, key = item.key), boodschappen_thuis (bool: Thuis = basisvoorraad verborgen, Alles = alles tonen)
- **afdelingen**: id, naam (uniek), volgorde — supermarktafdelingen, beheerbaar/sleepbaar; ingredients.afdeling_id (on delete set null) en ingredients.altijd_in_huis (bool, basisvoorraad)

## 5. Code-architectuur in het kort
- Eén `state`-object in app.js; `rerender()` tekent alles opnieuw. Events via `data-action` + `handleAction` (switch). Modals: `state.modal = {type: add|view|edit|pick|manage}`.
- Receptmodel: recipe → `onderdelen[]` → `ingredienten[]` ({ingredientId, naam, hoeveelheid, eenheid, notitie}). Opslaan = onderdelen/ingrediënten verwijderen en opnieuw inserten (`saveOnderdelen`).
- `resolveIngredientId`: eerst ilike-match op ingredients, dan aliassen, anders nieuw aanmaken.
- Eenheden worden genormaliseerd (`normalizeEenheid`, kleine aliaslijst gram→g enz.); beheerbaar in tabel `eenheden`.
- Weekmenu-entry = `{recipeId, personen}`. Boodschappenlijst groepeert op (ingredientId of normName) + eenheid, geschaald met dagpersonen / receptpersonen. Geen g↔kg-omrekening.
- Rename in Beheren werkt door in recepten; verwijderen is geblokkeerd als iets in gebruik is.

## 6. Genomen beslissingen
- Geen login/accounts (simpelst). Delen met vrienden is bewust niet gebouwd; technisch mogelijk later via Supabase Auth + RLS per gebruiker (grote structurele wijziging → eerst voorstel).
- Recepten toevoegen alleen handmatig of via JSON-upload; link/foto-import in de app is geschrapt (gebruiker doet AI-stap zelf).
- Ingrediënten genormaliseerd (canonical + aliassen); eenheden beheerbaar.
- Onderdelen binnen recepten (bv. butter chicken: marinade + saus).
- Schema altijd idempotent, zodat het hele bestand opnieuw geplakt kan worden.
- Voorkeur gebruiker: eerst een voorstel bij grote structurele wijzigingen; geen code ontwikkelen als alleen haalbaarheid gevraagd wordt; kleine, token-zuinige releases.

## 7. Bekende gaps
- Koelkast-match is nu exact op genormaliseerde naam (`inKoelkast` in utils.js); niet aliasbewust en geen enkelvoud/meervoud-herkenning ("ui" ≠ "uien").
- Geen g↔kg of ml↔l omrekening in de boodschappenlijst.
- AI-import alias-map is niet gekoppeld aan beheerde eenheden.
- Slepen in Beheren: pointer events met window-listeners (muis + touch); `volgorde` staat nu op tags, ingredients, eenheden en kenmerk_opties; nieuwe items komen achteraan (`nextVolgorde` in db.js); schema.sql nummert rijen met volgorde 0 eenmalig op alfabet.

## 8. Backlog en voorgestelde releases
**Release 1 — kleine app-wijzigingen ✅ KLAAR (22 okt 2026)**
- (c) Hernoemen naar "MMenu-Planner" (index.html titel, app.js:91 laadtekst, app.js:166 header, README/ai-prompt).
- (f) Knop "Weekmenu leegmaken" (met bevestiging).
- (b) Recept openen vanuit het weekmenu (titel klikbaar → bestaande view-modal, `open-view`).
- (g) Afgevinkte boodschappen onderaan de lijst.

**Release 2 — zoeken en boodschappen ✅ KLAAR (22 okt 2026)**
- (a) Koelkast alleen exacte match: kies semantiek (genormaliseerde naam of aliasbewust via ingredientId) en pas `fridgeMatchForRecipe` + `buildShoppingList` (`inHuis`) samen aan.
- (e) Tik op boodschappen-item → popup met welke weekrecepten het gebruiken, met hoeveelheden (bv. paprika: 2 stuks recept A, 1 stuk recept B) en doorklik naar het recept. Vereist een per-bron-uitsplitsing in `buildShoppingList`; bouw samen met de sorteerwijziging uit release 1 of direct erna, en hergebruik de "open recept"-actie.

**Release 3 — slepen in Beheren ✅ KLAAR (23 okt 2026)**
- (d) Drag-and-drop volgorde voor opties/eenheden/tags/ingrediënten: `volgorde` zetten bij insert (kenmerk_opties, eenheden), `volgorde`-kolom toevoegen waar nodig (tags, evt. ingredients) via idempotente migratie in schema.sql, db.js-functies voor herordenen, drag-handlers in de Beheren-UI. Bestaande rijen met volgorde 0 hernummeren.

**Release 4 — afdelingen, basisvoorraad, delen ✅ KLAAR (26 okt 2026)**
- Tabel `afdelingen` + `ingredients.afdeling_id`/`altijd_in_huis` + `instellingen.boodschappen_thuis`; Beheren-tabs Afdelingen en Basisvoorraad; afdeling-keuzelijst per ingrediënt, filter "Zonder afdeling", "Automatisch indelen" (trefwoordenregels `suggestAfdeling` in utils.js) en "Kopieer namen".
- Boodschappenlijst gegroepeerd per afdeling (volgorde = afdelingenvolgorde, daarna "Nog niet ingedeeld"), Thuis/Alles-schakelaar, "Deel lijst" (`shoppingListToText`, Web Share API met kopieer-fallback).
- Afdeling-consistentie: bestaand ingrediënt houdt zijn afdeling; alleen NIEUWE ingrediënten (of ingrediënten zonder afdeling) krijgen er een: eerst `afdeling` uit de import-JSON (alleen bij exacte naam en niet "Overig"), anders trefwoordenregels, anders niets (`kiesAfdelingId` in db.js).

**Release 5 — tijd en bron ✅ KLAAR (26 okt 2026)**
- `recipes.voorbereidingstijd` en `recipes.oventijd` (nullable); `bereidingstijd` blijft het TOTAAL (filter + weekmenu). Totaal = som zodra een van beide is ingevuld (formulier, import en opslaan). Receptkaart: `55 min · 20 actief`; detail: tijdbalk met legenda; weekmenu: alleen totaal.
- Bron: `bronInfo()` in app.js — http(s)-link blijft link (kaart toont domein), andere tekst (boek + blz) wordt met boekicoon getoond op kaart en detail; zoekbalk zoekt ook in bron.
- JSON-import: optionele velden `voorbereidingstijd` en `oventijd`; `bereidingstijd` wordt de som als een van beide is gegeven.

**Release 5.1/5.2 ✅ KLAAR (27 okt 2026)** — kleine fixes: ingrediëntenlijst ververst nu na een array-import en heeft een zoekveld (Beheren → Ingrediënten); Beheren-knop leesbaar in de donkere header (`.header .btn-outline` in style.css); receptkaart toont `55 min · 20 min voorbereiding`; bronvoorbeeld `boek, blz xx — of https://...`; uitlegzin onder het weekmenu verwijderd.

**Release 5.3 ✅ KLAAR (28 okt 2026)** — mobiel: de weekmenu-kaartrij (stappenteller + "Weekmenu leegmaken" + "Boodschappenlijst") mag nu naar een nieuwe regel (wrap, geen horizontale scroll meer op telefoonbreedte); header-top kreeg weer zijn zijmarge van 20 px (logo/knoppen stonden tegen de rand).

**Release 6 ✅ KLAAR (29 okt 2026)** — webapp + Delen-popup. `manifest.webmanifest`, iconen (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`), standalone-meta's en safe-area-padding in `index.html`/`style.css`: via Safari "Zet op beginscherm" opent de site schermvullend (geen offline/service worker). Eén **Delen**-knop (weekmenu- en boodschappen-tab) opent een popup met vinkjes Weekmenu + Boodschappenlijst (standaard beide); één gecombineerd bericht via Web Share, anders klembord. Geen schema-wijziging.

**Release 7 ✅ KLAAR (29 okt 2026)** — Gekookt + Favorieten. Schema: `recipes.favoriet` + tabel `gekookt` (recipe_id, datum; schema.sql opnieuw draaien). Hartje in receptdetail (♥ ook op kaart/lijst), filter "Alleen favorieten", sortering "Lang niet gemaakt" (nooit gekookt eerst) in receptenlijst en dagkiezer. Detail: "Gekookt vandaag" + "Andere datum", laatste 5 keren met verwijderknop; kaart toont "Laatst gekookt: x geleden · n×". Weekmenu: knop "Gekookt" per dag (logt de datum van die dag in de huidige week, nooit in de toekomst; nogmaals tikken haalt het weg). Datums nu lokaal (niet UTC).

**Release 8 ✅ KLAAR (30 okt 2026)** — AI-prompt-knop + sneller opslaan. Schema: `instellingen.prompt_extra` (schema.sql opnieuw draaien). Nieuw recept → "AI-prompt kopiëren": `buildAiPrompt()` in utils.js bouwt de volledige prompt uit de lijsten in Beheren (basis, proteïne, keuken, afdelingen, eenheden), met veld "Mijn eigen extra regels" (opgeslagen) en optie "voeg mijn ingrediëntenlijst toe". Opslaan: `db.createImportContext()` laadt ingrediënten/bijnamen/afdelingen één keer; `saveOnderdelen` matcht lokaal en doet per recept 3 batch-inserts (onderdelen, nieuwe ingrediënten, ingrediëntregels) i.p.v. tientallen losse queries. Array-import toont voortgang ("4 van 10 opgeslagen"), gaat door na een fout per recept en eindigt met overzicht (✓/✗ + reden). Getest in demo-modus en tegen een zelfgebouwde Supabase-mock (niet tegen echte Supabase). ai-prompt.md in de repo is nu alleen nog een referentie; de app genereert de actuele prompt.

**Release 9 ✅ KLAAR (30 okt 2026)** — Verras me. Knop op het weekmenu opent een popup met een vinkje per dag (lege dagen aan; gevulde dagen uit met "al gevuld: titel", aan te zetten om te vervangen) en een optionele maximale totale tijd. `verrasVoorstel()` in utils.js: nooit een recept dat al in de week staat, niet boven de maxtijd, score = favoriet +3, lang niet/nooit gekookt tot +3, koelkastmatch tot +2, plus toeval. (Proteïne-regel in release 10 verwijderd op verzoek.) Na invullen: banner met "Ongedaan maken" (zet alle vervangen dagen terug) en per dag een knop "Ander voorstel". Geen schema-wijziging.

**Release 10 ✅ KLAAR (30 okt 2026)** — Kookmodus + proteïne-regel uit Verras me. Knop "Kookmodus" in receptdetail en op elke ingevulde weekmenu-dag (met het aantal personen van die dag). Schermvullend, één stap tegelijk (`kookStappen()` in utils.js), voortgangsbalk, ingrediënten van het huidige onderdeel (inklapbaar, geschaald met eigen personen-stepper), grote tekst, vorige/volgende. Timers: `timersUitTekst()` haalt "15 minuten", "1,5 uur", "10-15 min", seconden uit de stap en toont een startknop; plus "Oventimer x min" als het recept oventijd heeft. Timers staan boven in beeld, lopen door over stappen heen, geven bij afloop geluid + trillen + rood knipperend chipje. Wake Lock houdt het scherm aan ("scherm blijft aan" zichtbaar als dat gelukt is). Laatste stap: "Klaar, gekookt" logt gekookt (vandaag) en gaat terug naar het detail. Beperking: timers lopen op de absolute eindtijd; in de achtergrond (scherm uit/andere app) loopt de klok door maar het alarm klinkt pas zodra de app weer zichtbaar is (iOS pauzeert JavaScript). Geen schema-wijziging.

**Releaseplan**: alle 10 releases klaar. Idee-plank: offline (service worker), sterren/ratings, kookmodus-notificaties.

## 9. Doorgaan in een nieuwe chat / Project
Plak dit document + upload de bestanden (of plak alleen de bestanden die de release raakt: release 1 = index.html, app.js, README.md, ai-prompt.md; release 2 = utils.js, app.js; release 3 = db.js, schema.sql, app.js, style.css). Vraag per release: "Voer release N uit". Vergeet niet `config.js` op GitHub te laten staan.
