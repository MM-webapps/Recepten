# Receptenkist

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

**Voor deze update moet je `schema.sql` opnieuw draaien in Supabase** (SQL
Editor → plak het hele bestand → Run). Dit voegt drie nieuwe tabellen toe
(`kenmerk_opties`, `tags`, `recipe_tags`, `notities`) en vult
`kenmerk_opties` met de bestaande basis/proteïne/keuken-waarden, zodat je
niets kwijtraakt. Bestaande recepten, weekmenu's en koelkastinhoud blijven
ongewijzigd.



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
| `utils.js`       | Hulpfuncties: matching, boodschappenlijst, JSON-validatie       |
| `app.js`         | De applicatie zelf: state, rendering, events                    |
| `schema.sql`      | Het hele Supabase-schema, in één keer te runnen                |
| `ai-prompt.md`   | Prompt om recepten met een AI-tool naar het juiste JSON-formaat om te zetten |
