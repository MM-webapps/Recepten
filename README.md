# Receptenkist

Een persoonlijke receptenapp: recepten met kenmerken (basis, proteïne, keuken,
personen), een weekmenu, een koelkast-check en een boodschappenlijst — met
optionele AI-import van recepten vanaf een link of foto.

Pure HTML/CSS/JS, geen build-stap. Data staat in Supabase, hosting via GitHub
Pages.

## 1. Supabase instellen

1. Maak een gratis project op [supabase.com](https://supabase.com).
2. Ga naar **SQL Editor → New query**, plak de inhoud van `schema.sql` en klik
   **Run**. Dit maakt de tabellen aan (`recipes`, `weekmenu`, `koelkast`,
   `instellingen`) inclusief de rijen voor de 7 dagen.
3. Ga naar **Project Settings → API** en kopieer:
   - **Project URL**
   - **anon public key**
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
   (`index.html`, `style.css`, `app.js`, `db.js`, `ai.js`, `constants.js`,
   `utils.js`, `config.js`) naar de `main`-branch.
2. Ga in de repo naar **Settings → Pages**.
3. Kies bij **Source**: `Deploy from a branch`, branch `main`, map `/ (root)`.
4. Na een minuut is de site live op `https://<gebruikersnaam>.github.io/<repo-naam>/`.

## 4. AI-import instellen (optioneel)

De knop **"recept vanaf link/foto"** gebruikt de Anthropic API rechtstreeks
vanuit je browser, met je eigen API-key:

1. Maak een key op [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Klik in de app op **AI-key** (rechtsboven) en plak de key.

De key wordt alleen lokaal in jouw browser bewaard (`localStorage`) — nooit
in de GitHub-repo. Let op: omdat de aanroep vanuit de browser gebeurt, is de
key zichtbaar in het netwerkverkeer van jouw eigen sessie. Voor een
persoonlijke tool is dat een geaccepteerd patroon (Anthropic ondersteunt dit
expliciet via een speciale header), maar deel je site-URL dus niet met
mensen die je key niet zouden mogen gebruiken. Zonder key werkt de rest van
de app (handmatig recepten toevoegen, weekmenu, koelkast, boodschappenlijst)
gewoon.

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
| `db.js`          | Alle Supabase-lees/schrijffuncties                              |
| `ai.js`          | AI-import (link/foto → JSON) via de Anthropic API              |
| `constants.js`   | Kenmerk-opties (basis/proteïne/keuken), dagen, kleuren          |
| `utils.js`       | Hulpfuncties: matching, boodschappenlijst, JSON-parsing         |
| `app.js`         | De applicatie zelf: state, rendering, events                    |
| `schema.sql`      | Het hele Supabase-schema, in één keer te runnen                |
