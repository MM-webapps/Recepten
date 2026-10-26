# MMenu-Planner

Een persoonlijke receptenapp: recepten met kenmerken (basis, proteïne, keuken,
personen), een weekmenu, een koelkast-check en een boodschappenlijst.
Recepten voeg je handmatig toe, of door een `.json`-bestand te uploaden dat
je zelf met een AI-tool hebt gemaakt (zie `ai-prompt.md`).

Pure HTML/CSS/JS, geen build-stap. Data staat in Supabase, hosting via GitHub
Pages.

## 0. Meteen bekijken zonder Supabase (demo-modus)

Je hoeft niet eerst Supabase in te stellen om de site te zien werken. Zolang
`config.js` nog de placeholder-waarden bevat, start de app automatisch in
**demo-modus**: je krijgt een paar voorbeeldrecepten te zien en alle
functies (filteren, weekmenu, koelkast, boodschappenlijst) werken gewoon —
alleen worden wijzigingen niet opgeslagen; ze verdwijnen bij het herladen
van de pagina. Zo kun je de site direct pushen naar GitHub Pages en meteen
bekijken, en pas daarna Supabase koppelen (stap 1 hieronder) zodra je je
eigen recepten wilt gaan bewaren.

## 1. Supabase instellen

1. Maak een gratis project op [supabase.com](https://supabase.com).
2. Ga naar **SQL Editor → New query**, plak de inhoud van `schema.sql` en klik
   **Run**. Dit maakt de tabellen aan (`recipes`, `weekmenu`, `koelkast`,
   `instellingen`) inclusief de rijen voor de 7 dagen.

   **Bij een update van `schema.sql` later:** het hele bestand opnieuw
   plakken en runnen is altijd veilig — bestaande data blijft staan, en
   nieuwe kolommen/tabellen worden alleen toegevoegd als ze nog niet
   bestaan.
3. Ga naar **Project Settings → API Keys** en kopieer:
   - **Project URL** (zonder `/rest/v1/` of `/` erachter)
   - een key om te gebruiken: ofwel de **anon public** key (tabblad
     "Legacy API Keys", begint met `eyJhbGci...`), ofwel de nieuwere
     **publishable** key (tabblad "API Keys", begint met
     `sb_publishable_...`) — beide werken prima.
4. Open `config.js` in dit project en vul beide in:
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

## 2. Lokaal bekijken (optioneel, maar handig om te testen)

Dit project gebruikt ES modules (`import`/`export`), en browsers laden die
alleen via `http://`, niet door het bestand rechtstreeks te openen
(`file://`). Je hebt dus een simpele lokale server nodig:

```bash
# vanuit de map met index.html
python3 -m http.server 8000
# of, als je Node hebt:
npx serve .
```

Ga dan naar `http://localhost:8000`. Zonder lokale server (of als
`config.js` nog de placeholder-waarden heeft) krijg je een foutmelding
"Kon de gegevens niet laden".

## 3. Hosten op GitHub Pages

1. Maak een nieuwe GitHub-repository en push alle bestanden uit deze map
   (`index.html`, `style.css`, `app.js`, `db.js`, `constants.js`,
   `utils.js`, `config.js`) naar de `main`-branch.
2. Ga in de repo naar **Settings → Pages**.
3. Kies bij **Source**: `Deploy from a branch`, branch `main`, map `/ (root)`.
4. Na een minuut is de site live op `https://<gebruikersnaam>.github.io/<repo-naam>/`.

## 4. Recepten toevoegen

In de app, via **Nieuw recept**, kies je tussen:

- **Handmatig** — alle velden zelf invullen.
- **JSON uploaden** — een `.json`-bestand kiezen dat je zelf eerst met een
  AI-tool (Claude, ChatGPT, …) hebt gemaakt van een recept (tekst, link, of
  een foto die je erbij beschrijft). Gebruik daarvoor de prompt uit
  `ai-prompt.md` — die dwingt de AI om exact het schema te gebruiken dat
  deze app verwacht. Na het uploaden krijg je het recept nog even te zien
  om te controleren en aan te passen voordat het wordt opgeslagen.
  Je kunt ook een JSON-*array* met meerdere recepten in één keer uploaden;
  die worden dan direct allemaal geïmporteerd (zonder controlestap).

## 5. Nieuw: opmerkingen, tags en beheerbare kenmerken

- **Opmerkingen-log per recept:** open een recept → onderaan bij "Opmerkingen"
  kun je een tekst met datum toevoegen. Elke opmerking blijft staan (met
  datum), zo ontstaat een log per recept.
- **Tags:** vrij toe te voegen labels (bv. "Grote groepen", "Snel klaar").
  Toevoegen kan direct in het receptformulier ("+ Toevoegen" bij Tags), of
  via **Beheren** (rechtsboven) → tabblad Tags. Filteren op tag kan in de
  filterbalk bij Recepten.
- **Basis / Proteïne / Keuken beheren:** deze opties staan niet meer vast in
  de code, maar in Supabase, en zijn te beheren via **Beheren** (rechtsboven
  in de app). Hernoemen werkt automatisch door naar alle recepten die die
  waarde gebruiken; verwijderen kan alleen als geen enkel recept de waarde
  nog gebruikt.

## 6. Nieuw: onderdelen binnen een recept, en een schone boodschappenlijst

- **Onderdelen:** een recept kan uit meerdere delen bestaan die je apart
  bereidt (bv. "Marinade" + "Saus" bij butter chicken). Klik in het
  formulier op **+ Onderdeel** om een tweede deel toe te voegen, met een
  eigen naam, eigen ingrediënten en eigen bereidingswijze. Voor een gewoon
  recept laat je de naam van het (ene) onderdeel gewoon leeg — je ziet dan
  geen verschil met vroeger.
- **Eén ingrediëntenlijst achter de schermen:** elk ingrediënt dat je typt
  wordt gekoppeld aan een vast, uniek ingrediënt (bv. "ui"). Typ je een
  volgende keer "Ui" of "ui" met een spatie erachter, dan wordt automatisch
  hetzelfde ingrediënt herkend. Bij **Beheren → Ingrediënten** kun je
  bovendien dubbele varianten die je AI-import verschillend heeft genoemd
  (bv. "rode ui" en "ui") handmatig **samenvoegen** tot één — de
  boodschappenlijst telt ze daarna als één ding op, ook met terugwerkende
  kracht.
- **Eenheden worden genormaliseerd:** "g", "gram" en "gr" (en zo ook bij
  el/eetlepel, tl/theelepel, etc.) worden intern allemaal dezelfde
  eenheid, zodat de boodschappenlijst hoeveelheden goed kan optellen. In
  het formulier kies je de eenheid nu uit een lijstje in plaats van vrije
  tekst te typen, zodat nieuwe invoer altijd meteen goed staat.

**Voor deze update moet je `schema.sql` opnieuw draaien in Supabase** (SQL
Editor → plak het hele bestand → Run). Dit is de grootste migratie tot nu
toe:
- Er komen vier nieuwe tabellen bij: `ingredients` (canonieke
  ingrediënten), `ingredient_aliassen` (samengevoegde/bijnamen),
  `recipe_onderdelen` en `recipe_ingredienten`.
- Je **bestaande recepten worden automatisch omgezet**: elk recept krijgt
  één onderdeel (zonder naam) met precies de ingrediënten en instructies
  die het al had, en van elke ingrediënt-tekst wordt een canoniek
  ingrediënt gemaakt. Er gaat niets verloren en je hoeft niets over te
  typen.
- De oude kolommen `recipes.ingredienten` / `recipes.instructies` worden
  hernoemd naar `..._legacy` (als back-up, de app gebruikt ze niet meer).
  Je kunt ze desgewenst later handmatig verwijderen, maar dat hoeft niet.
- Dit migratieblok draait vanzelf maar één keer: de tweede keer dat je
  `schema.sql` runt (nu of bij een volgende update), ziet het script dat de
  oude kolommen al hernoemd zijn en slaat het de migratie over. Gewoon het
  hele bestand blijven herplakken is dus nog steeds veilig.

## 7. Nieuw: eenheden beheren

De keuzelijst met eenheden (gr, kg, ml, l, el, tl, st, tenen, snufje,
blikje) staat niet meer vast in de code, maar in Supabase, en is te
beheren via **Beheren → Eenheden**: toevoegen, hernoemen (werkt automatisch
door naar alle receptregels die die eenheid gebruiken) en verwijderen
(alleen als niets die eenheid meer gebruikt). Wil je bijvoorbeeld
"teentje" naar "tenen" hernoemen, dan kan dat daar.

Let op één detail: bij een JSON-import (via de AI-prompt) blijft een kleine
vaste lijst met veelgebruikte schrijfwijzen bestaan (zoals "gram" → "gr",
"theelepel" → "tl"), onafhankelijk van wat je hierboven beheert. Hernoem je
een eenheid, dan werkt dat meteen door in je bestaande recepten en in de
keuzelijst van het formulier — een AI-import die toevallig de oude
schrijfwijze gebruikt, komt er in het ergste geval gewoon als extra,
niet-beheerde waarde bij te staan (niets gaat verloren, het valt alleen
niet automatisch samen met je hernoemde eenheid). Wil je dat ook helemaal
sluitend maken, laat het weten.

**Voor deze update moet je `schema.sql` opnieuw draaien in Supabase**
(gewoon het hele bestand opnieuw plakken en Run — dit voegt alleen de
nieuwe tabel `eenheden` toe, met de huidige lijst er al in; niets anders
verandert).

## Beveiliging — belangrijk om te weten

Je hebt gekozen voor **geen login**. Dat betekent:

- De `anon`-sleutel van Supabase staat straks gewoon leesbaar in je
  GitHub-repo (dat is normaal en met opzet — die key is niet geheim).
- De bescherming zit in de policies uit `schema.sql`, die op dit moment
  **iedereen met die key volledige lees/schrijftoegang geven**. Voor een
  receptenapp is dat een klein risico, maar besef dat iemand die je
  repo/site vindt in theorie je recepten kan lezen of wijzigen.
- Wil je dit later alsnog afsluiten? Voeg Supabase Auth toe (bijv. magic
  link via e-mail), zet de policies om naar `using (auth.uid() = user_id)`,
  en voeg een `user_id`-kolom toe aan elke tabel. Zeg het gerust, dan bouw
  ik dat om.

## Bestanden

| Bestand         | Inhoud                                                        |
|------------------|----------------------------------------------------------------|
| `index.html`     | HTML-skelet, laadt de stylesheet en `app.js`                  |
| `style.css`      | Vormgeving                                                     |
| `config.js`      | **Hier vul je je Supabase-gegevens in**                        |
| `db.js`          | Alle Supabase-lees/schrijffuncties (met ingebouwde demo-modus)  |
| `constants.js`   | Dagen, kleuren/iconen per kenmerk (de opties zelf staan in Supabase) |
| `utils.js`       | Hulpfuncties: matching, boodschappenlijst, eenheden, JSON-validatie |
| `app.js`         | De applicatie zelf: state, rendering, events                    |
| `schema.sql`      | Het hele Supabase-schema, in één keer te runnen                |
| `ai-prompt.md`   | Prompt om recepten met een AI-tool naar het juiste JSON-formaat om te zetten |

## Volgorde aanpassen (Beheren)

In **Beheren** kun je bij Basis, Proteïne, Keuken, Tags, Ingrediënten en
Eenheden het handvat links van een regel vasthouden en omhoog/omlaag
slepen (werkt met muis en met je vinger). De volgorde geldt overal, ook in
de keuzelijsten. Nieuwe items komen onderaan.

**Voor deze update moet je `schema.sql` opnieuw draaien in Supabase** (hele
bestand plakken, Run): het voegt een `volgorde`-kolom toe aan `tags` en
`ingredients` en nummert bestaande rijen eenmalig op alfabet.

## Afdelingen, basisvoorraad en lijst delen

- **Afdelingen** (Beheren → Afdelingen): de afdelingen van de supermarkt, in
  jouw looproute. Sleep ze in de juiste volgorde; de boodschappenlijst volgt
  die volgorde. Elk ingrediënt hoort bij één afdeling (Beheren →
  Ingrediënten, keuzelijst onder de naam).
- **Automatisch indelen** (Beheren → Ingrediënten): deelt alle ingrediënten
  zonder afdeling in met een lijst trefwoorden. Wat niet herkend wordt, vind
  je met het filter **Zonder afdeling**; **Kopieer namen** kopieert die lijst
  (bv. om te laten indelen door een AI).
- **Nieuwe ingrediënten** uit een import krijgen automatisch een afdeling
  (uit het veld `afdeling` van de JSON, anders de trefwoorden). Een
  ingrediënt dat al bestaat houdt zijn afdeling.
- **Basisvoorraad** (Beheren → Basisvoorraad): ingrediënten die je altijd in
  huis hebt (zout, olie, boter...). Zoek een ingrediënt en tik op het plusje.
- **Thuis / Alles** (boven de boodschappenlijst): in *Thuis* staat je
  basisvoorraad niet op de lijst, in *Alles* wel (handig voor een vakantie).
- **Deel lijst**: deelt wat je nog moet kopen, per afdeling, als tekst (op je
  telefoon via het deelmenu, bv. naar WhatsApp; op een computer wordt het
  gekopieerd).

**Voor deze update moet je `schema.sql` opnieuw draaien in Supabase.** Dit
voegt de tabel `afdelingen` toe (met een startlijst) en de kolommen
`ingredients.afdeling_id`, `ingredients.altijd_in_huis` en
`instellingen.boodschappen_thuis`. Bestaande data blijft ongemoeid.

## Voorbereidings- en oventijd, en de bron van een recept

- **Tijd opsplitsen:** bij een recept kun je *Voorbereiding* (jouw handwerk)
  en *In de oven/pan* invullen. Het **totaal** wordt dan automatisch
  opgeteld. Vul je alleen het totaal in, dan werkt het zoals altijd. Het
  filter "Max. tijd" en het weekmenu gebruiken alleen het totaal.
- **Receptdetail:** bij een opgesplitste tijd zie je een balk met de twee
  delen. Op de receptkaart staat bv. `55 min · 20 actief`.
- **Bron:** vul hier een link in, of gewoon tekst zoals een boek en
  bladzijde (bv. `Ottolenghi Simple, blz 45`). Tekst staat met een boekje
  onder de titel van het recept en op de receptkaart; een link blijft
  klikbaar. De zoekbalk zoekt ook in de bron, dus "Ottolenghi" vindt alle
  recepten uit dat boek.

**Voor deze update moet je `schema.sql` opnieuw draaien in Supabase**
(twee nieuwe kolommen `voorbereidingstijd` en `oventijd` bij `recipes`;
bestaande recepten blijven ongewijzigd).

