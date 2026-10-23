# MMenu-Planner — overdrachtsdocument

Laatst bijgewerkt: 22 okt 2026 (release 3 afgerond, backlog leeg).

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
- **instellingen**: één rij (id=1): huishoud_personen, boodschappen_vinkjes (jsonb, key = item.key)

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

## 9. Doorgaan in een nieuwe chat / Project
Plak dit document + upload de bestanden (of plak alleen de bestanden die de release raakt: release 1 = index.html, app.js, README.md, ai-prompt.md; release 2 = utils.js, app.js; release 3 = db.js, schema.sql, app.js, style.css). Vraag per release: "Voer release N uit". Vergeet niet `config.js` op GitHub te laten staan.
