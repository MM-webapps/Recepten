# Prompt: recept omzetten naar JSON voor Receptenkist

Plak onderstaande prompt in een AI-tool (Claude, ChatGPT, etc.), samen met
het recept (tekst, een link, of een beschrijving van een foto). Sla het
antwoord op als `.json`-bestand en upload het in de app via **Nieuw recept
→ JSON uploaden**.

---

Zet het volgende recept om naar geldige JSON met exact deze structuur. Geef
ALLEEN het JSON-object terug — geen uitleg, geen inleidende tekst, geen
markdown-codeblok (dus niet tussen ```).

```
{
  "titel": "string",
  "basis": "kies exact één van: Aardappel, Pasta, Rijst, Wraps/Tortilla, Brood, Peulvruchten, Noedels, Couscous/Bulgur, Overig",
  "proteine": "kies exact één van: Kip, Rundvlees, Gehakt, Varkensvlees, Vis/Zeevruchten, Ei, Tofu/Peulvruchten, Vegetarisch overig, Geen",
  "keuken": "kies exact één van: Nederlands, Italiaans, Mediterraans, Aziatisch, Mexicaans, Indiaas, Midden-Oosters, Overig",
  "personen": 4,
  "bereidingstijd": 30,
  "ingredienten": [
    { "naam": "string", "hoeveelheid": 500, "eenheid": "g" },
    { "naam": "zout", "hoeveelheid": null, "eenheid": "" }
  ],
  "instructies": ["Eerste stap.", "Tweede stap.", "..."],
  "bron": "URL van het recept, indien bekend, anders leeg"
}
```

Regels:
- Kies voor "basis", "proteine" en "keuken" altijd exact één van de
  genoemde opties, letterlijk overgenomen (geen eigen bewoording). Gebruik
  "Overig" (of bij proteine "Geen") als niets goed past.
- Schat "personen" en "bereidingstijd" in minuten als deze niet expliciet
  in het recept staan.
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
