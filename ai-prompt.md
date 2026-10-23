# Prompt: recept omzetten naar JSON voor MMenu-Planner

Plak onderstaande prompt in een AI-tool (Claude, ChatGPT, etc.), samen met
het recept (tekst, een link, of een beschrijving van een foto). Sla het
antwoord op als `.json`-bestand en upload het in de app via **Nieuw recept
→ JSON uploaden**.

---

Zet het volgende recept om naar geldige JSON met exact deze structuur. Geef
ALLEEN het JSON-object terug — geen uitleg, geen inleidende tekst, geen
markdown-codeblok (dus niet tussen ```).

Voor een GEWOON recept (één geheel, geen aparte onderdelen) gebruik je één
item in "onderdelen" met "naam": "":

```
{
  "titel": "string",
  "basis": "kies exact één van: Aardappel, Pasta, Rijst, Wraps/Tortilla, Brood, Peulvruchten, Noedels, Couscous/Bulgur, Overig",
  "proteine": "kies exact één van: Kip, Rundvlees, Gehakt, Varkensvlees, Vis/Zeevruchten, Ei, Tofu/Peulvruchten, Vegetarisch overig, Geen",
  "keuken": "kies exact één van: Nederlands, Italiaans, Mediterraans, Aziatisch, Mexicaans, Indiaas, Midden-Oosters, Overig",
  "personen": 4,
  "bereidingstijd": 30,
  "onderdelen": [
    {
      "naam": "",
      "ingredienten": [
        { "naam": "string", "hoeveelheid": 500, "eenheid": "g" },
        { "naam": "zout", "hoeveelheid": null, "eenheid": "" }
      ],
      "instructies": ["Eerste stap.", "Tweede stap.", "..."]
    }
  ],
  "bron": "URL van het recept, indien bekend, anders leeg"
}
```

Bestaat het recept uit aparte delen die je apart bereidt (bv. een marinade
en een saus, of een deeg en een vulling)? Geef dan per deel een eigen item
in "onderdelen", elk met een eigen "naam" (bv. "Marinade", "Saus"), eigen
"ingredienten" en eigen "instructies". Voorbeeld voor butter chicken:

```
"onderdelen": [
  { "naam": "Marinade", "ingredienten": [...], "instructies": [...] },
  { "naam": "Saus", "ingredienten": [...], "instructies": [...] }
]
```

Regels:
- Kies voor "basis", "proteine" en "keuken" altijd exact één van de
  genoemde opties, letterlijk overgenomen (geen eigen bewoording). Gebruik
  "Overig" (of bij proteine "Geen") als niets goed past.
- Schat "personen" en "bereidingstijd" in minuten als deze niet expliciet
  in het recept staan.
- Gebruik voor "eenheid" bij voorkeur: g, kg, ml, l, el, tl, stuks,
  teentje, snufje of blikje (of laat leeg). Schrijf dus "g" in plaats van
  "gram", en "tl" in plaats van "theelepel" — zo telt de boodschappenlijst
  dezelfde ingrediënten van verschillende recepten goed bij elkaar op.
- "hoeveelheid" is een getal (gebruik een punt voor decimalen, bv. 0.5),
  of `null` wanneer er geen hoeveelheid is aangegeven (bv. "naar smaak" of
  "een snufje").
- Eén handeling per stap in "instructies", kort en duidelijk.
- Geef uitsluitend het JSON-object terug, verder niets — het moet direct
  als .json-bestand opgeslagen en geüpload kunnen worden.

Wil je meerdere recepten in één keer uploaden? Dat kan ook: laat de AI dan
een JSON-*array* van meerdere van dit soort objecten teruggeven
(`[ {...}, {...} ]`) — de app herkent dat automatisch en importeert ze
allemaal in één keer.

Het recept:

[plak hier de tekst van het recept, een link, of een omschrijving]
