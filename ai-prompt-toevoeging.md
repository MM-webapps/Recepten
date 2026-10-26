# Toevoeging voor je eigen AI-prompt (release 4: afdelingen)

Pas in je eigen prompt twee dingen aan.

## 1. Voeg `"afdeling"` toe aan elke ingrediëntregel in het JSON-voorbeeld

Bijvoorbeeld:

```
{ "naam": "string", "hoeveelheid": 500, "eenheid": "gr", "afdeling": "kies exact één van: Groente & fruit, Brood & bakkerij, Vlees & vis, Zuivel & eieren, Pasta, rijst & granen, Wereldkeuken & sauzen, Conserven & houdbaar, Kruiden & olie, Diepvries, Dranken, Overig" },
{ "naam": "zout", "hoeveelheid": null, "eenheid": "", "afdeling": "Kruiden & olie" }
```

## 2. Voeg deze regel toe onder "Regels"

```
- Kies voor "afdeling" bij elk ingrediënt exact één van de genoemde
  afdelingen, letterlijk overgenomen (geen eigen bewoording). Kies de
  afdeling waar je het product in een gewone Nederlandse supermarkt vindt.
  Gebruik "Overig" alleen als niets past.
```

Heb je eigen afdelingen aangemaakt of hernoemd in Beheren → Afdelingen? Zet
dan jouw lijst in plaats van bovenstaande opsomming, letterlijk zoals ze in de
app heten.

Let op: een ingrediënt dat al in de app staat houdt zijn eigen afdeling. De
afdeling uit de AI wordt alleen gebruikt voor nieuwe ingrediënten.
