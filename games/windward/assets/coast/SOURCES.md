# Real west-coast data: sources and licences

Built by `tools/build-coast.mjs` (zero npm dependencies, Node 22+). Koster in the north to
Gottskär (Halland) in the south, at 20 real m/px. One flat plane of 3669 × 9007 px
(73.4 × 180.1 km) cut into three stored tiles so the empty sea in the corners is never saved:

| Tile | Area | Size | Plane offset |
|---|---|---|---|
| koster | 58.45–58.95 N, 10.9–11.45 E | 1615 × 2780 px | x 146, y 0 |
| north | 57.85–58.45 N, 11.0–11.8 E | 2348 × 3336 px | x 440, y 2780 |
| south | 57.33–57.85 N, 11.5–12.1 E | 1762 × 2891 px | x 1907, y 6116 |

Distance fields (depth, shore distance) are computed on the whole plane before cutting, so
water shading has no seam where the tiles meet.

## Attribution line (show it wherever this data is shown)

> Map data © OpenStreetMap contributors (ODbL). Land cover: Naturvårdsverket, NMD 2018.
> Elevation: Copernicus DEM GLO-30. Population: Statistics Sweden (SCB), CC0.

## What came from where

| Layer | Source | Licence | How it was fetched |
|---|---|---|---|
| Coastline (land/sea mask, islets) | OpenStreetMap `natural=coastline` | ODbL 1.0, © OpenStreetMap contributors | Overpass API (see deviation below), four queries merged by way id |
| Places (`places.json`) | OpenStreetMap, looked up by name | ODbL 1.0 | Overpass API |
| Height | Copernicus DEM GLO-30, tiles N57 E011, N57 E012, N58 E010, N58 E011 | Copernicus DEM licence: "free basis for the general public" per the [AWS open-data registry entry](https://registry.opendata.aws/copernicus-dem/); attribution to the Copernicus programme | `copernicus-dem-30m.s3.amazonaws.com`, no account |
| Land cover (`*-classes.png`) | Naturvårdsverket, Nationella Marktäckedata (NMD) 2018 basskikt, ogeneraliserad v1.1, counties O (Västra Götaland) and N (Halland), 10 m | CC0 per Naturvårdsverket's data terms as quoted on the [OSM wiki import page](https://wiki.openstreetmap.org/wiki/WikiProject_Sweden/naturvardsverket_import) ("licenstypen CC0 … ser gärna att det ges en referens"). TODO(felix): confirm on Naturvårdsverket's own page; its download page did not show licence text to the build agent | `geodata.naturvardsverket.se/nedladdning/marktacke/NMD2018/bas_lan_ogen/`, public folder, no account |
| Depth (`*-depth.png`) | **Not data.** A made-up function of distance to shore | n/a | computed |
| Settlement history and population (`../../data/settlements-history.json`) | see "Settlements and population" below | mixed, see below | by hand, each row cites its page |

Not used: Sjöfartsverket sea-chart depths (restricted). Lantmäteriet's elevation grid was
checked first: its downloads go through Geotorget ordering (not confirmed account-free) and the
product found, grid 50+, is only 50 m, so Copernicus (the stated fallback) was used.
Lantmäteriet Historiska kartor was **not** used: its English page says only that Lantmäteriet "has
chosen to withdraw copyright claims for the maps", and no licence label for the service itself
could be confirmed.

## Deviation: coastline via Overpass, not the osmdata land-polygon zip

`osmdata.openstreetmap.de` closed the TLS connection from the build machine (the Geofabrik
download host did too; openstreetmap.org and AWS worked). The brief asked for the osmdata
split-WGS84 land polygons. Instead the script pulls the same OSM coastline ways through
Overpass and rasterises them itself: a pixel is land when a ray from the west edge (open sea)
has crossed an odd number of coastline segments. Same underlying data and licence, different
route. Inland lakes are not tagged as coastline, so they appear as land in the mask.
Overpass was overloaded during the pass-2 and pass-3 builds (HTTP 502, mirrors unreachable), so
the script retries up to 8 times and rotates through mirrors; a finished build is cached and
re-runs offline.

## Files (committed sizes, 20 m/px)

| File | Size | What it is |
|---|---|---|
| `koster-`, `north-`, `south-land-height.png` | 1.07 + 1.60 + 1.02 MB | 16-bit grey. 0 = water. Land = round(height m) × 10 + 1, so heights come in **1 m steps** (stored as decimetres + 1). Copernicus is a *surface* model: tree tops count, so wooded ground reads 5–20 m high |
| `koster-`, `north-`, `south-depth.png` | 0.32 + 0.49 + 0.36 MB | 16-bit grey, decimetres in 1 m steps, 0 = land. `min(90, 0.5 + 0.04 × metres to shore)` |
| `koster-`, `north-`, `south-classes.png` | 0.46 + 0.71 + 0.49 MB | 8-bit grey: 0 water, 1 bare_rock, 2 heath, 3 meadow, 4 scrub, 5 forest, 6 village |
| `skerries.json` | 137 KB | 5537 closed coastline rings under 25 m wide: `[lon, lat, width m, length m]` |
| `places.json` | 7 KB | 38 places with lat/lon and the OSM object used |
| `routes.json` | 2 KB | Marstrand → Smögen and Gottskär → Marstrand polylines and lengths |
| `trees.json` | 1 KB | tree density rule and totals per scale |
| `meta.json` | 3 KB | extent, tiles, projection, encodings, class percentages |
| **Total map data** | **6.84 MB** | pass-1 area alone was 4.77 MB; pass 2 (to Gottskär) 5.86 MB; budget for pass 3 was under 8 MB |
| `../../data/settlements-history.json` | 96 KB | settlements, phases, population rows |
| `tools/data/scb-tatort-population.json` | 8 KB | the SCB figures exactly as returned (not shipped to the game) |

Koster extension (pass 3): the tile is 1.86 MB. The estimate made before building was 1.0–1.7 MB
(from a sea-heavy crop and from the north tile's average); the real tile has more land and came out
about 10 % over the top of that range. Heights and depths were re-quantised from 0.5 m to 1 m steps
to bring the total from 8.15 MB down to 6.84 MB; the 30 m satellite model is not accurate to better
than a few metres anyway, and the 20 m coast detail is untouched.

Pixel → position: `lon = 10.85 + x·20 / metersPerDegLon`, `lat = 58.95 − y·20 / 111195`, with x, y
plane pixels (a tile pixel adds its tile's offset). Equirectangular around the box centre, so
east-west distances are off by up to about 2 % across the box; fine for a game.

## How the land classes were derived (heuristics, review them in the coast lab)

NMD has no scrub class and does not split heath from meadow, so:

- **bare_rock**: NMD 41 (open land without vegetation), plus re-burned skerries.
- **meadow**: NMD 3 (farmland), NMD 2 (open wetland), and NMD 42 (open land with vegetation)
  that is flat (< 6°), low (< 25 m) and at least 100 m from water.
- **heath**: the rest of NMD 42 (rocky, sloped or shoreline).
- **forest**: NMD 111–127 (pine, spruce, mixed, deciduous) more than 60 m from water.
- **scrub**: NMD 118/128 (young or cleared) and any forest within 60 m of water (wind-trimmed fringe).
- **village**: NMD 51/52 (buildings and other built land). Roads (53), and NMD water or no-data
  on OSM land, take the majority class of their neighbours.
- Each 20 m pixel takes the majority of four 10 m NMD samples around its centre. Where county O
  has no data (the Halland border) county N fills in.

Result, % of land: bare_rock 7.9, heath 16.0, meadow 20.6, scrub 5.6, forest 45.6, village 4.3
(land = 2727 km² real, 39.1 % of the tile area).

## Trees: near the boat only

Trees per 100 m² of **game** ground: forest 1.0, scrub 0.5, village 0.1, heath 0.05,
meadow 0.02, bare_rock 0. Planting the whole map at those densities:

| Scale | Trees | vs 3,000 budget |
|---|---|---|
| 1:6 | 379,252 | 126× |
| 1:8 | 213,330 | 71× |
| 1:10 | 136,531 | 46× |

Too heavy for a phone at any scale, so trees are planted only near the boat:
`src/trees-near.js` → `treesNear(x, z, radius = 250)`. The world is cut into 10 × 10 game-metre
cells (100 m²); each cell's trees come from a hash of its own coordinates, so the same spot always
gets the same trees. A fully forested disc of radius 250 m holds about 1,964 trees.

## Settlements and population (`games/windward/data/settlements-history.json`, built by `tools/make-settlements.mjs`)

30 villages, islands and towns (pass 4 added Härmanö). Nothing comes from memory: a year or count is recorded only if a fetched page
or table states it, and every entry carries its source URLs. Each entry's `confidence` is its weakest
dated fact (high = museum / heritage / municipal document states the years; medium = sv.wikipedia or a
tourism site, or a museum source for the place plus a museum source for the period's years; low = a
decade or century, borrowed regional years on a weak statement, or a reading of the numbers).

**Date sources used:** Bohusläns museum (regional herring periods 1747–1809 and 1877–1906, the
Marstrand bath era from 1822, saltery records, rapport 2012:39 on Gullholmen's harbour), Länsstyrelsen Västra Götaland and Västkuststiftelsen (Härmanö and Gullholmen), Svenska kyrkan church histories (Käringön, Gullholmen, Mollösund), Kungälvs kommun *Kulturmiljöunderlag 2014*
(Marstrand), Bohusläns museum records on digitaltmuseum.org (Grundsund, Gullholmen), Göteborgs Stad
heritage document 2021 (Styrsö), vastsverige.com (regional tourism pages: Lysekil bath era from 1846,
Smögen 1594 and 1900, Strömstad, Käringön), sv.wikipedia (most first-record years). Reached but
yielding nothing usable: bebyggelseregistret.raa.se, kmr.raa.se, sotenas.se, orust.se, tjorn.se,
kungsbacka.se, Länsstyrelsen pages. Result: **Marstrand and Gullholmen have high-confidence facts** (Gullholmen's first record, 1588, and its 1673 map come from Bohusläns museum rapport 2012:39, read in full as text; Härmanö's first record, 1673, from the same report);
the regional herring periods are now high (Bohusläns museum states them), but most place-specific
years remain medium or low. The file's `unsourced` list names what is still missing.

**Population sources and licences** (a count is used only as a *counted* observation; where there is
none at the slider's year the lab draws an outline-only house sized by phase and marks it estimated):

| Source | What | Licence | Used? |
|---|---|---|---|
| **SCB, Folkmängd per tätort 1960–2023** (PxWeb API, table `MI0810A/LandarealTatortN`, fetched by POST) | locality populations, stored verbatim in `tools/data/scb-tatort-population.json` | **CC0 1.0**: "Statistik och geodata som SCB tillgängliggör som öppna data … har licensen Creative commons 0 1.0 Universal, CC0" ([scb.se terms](https://scb.se/om-scb/om-scb.se-och-anvandningsvillkor/)). SCB asks for a source credit on its raw figures | yes, the main source for 1960 onward |
| **sv.wikipedia village pages**, figures for 1900–1950 (Folkräkningen 1900, Nordisk Familjebok, *När, var, hur?* 1945), small-locality (småort) 2015–2023 counts and the SCB island list (2020), Lysekil 1750–1820 (Hansson 1983) | as printed, each row cites its page and names the upstream source | Wikipedia text CC BY-SA 4.0; the figures are facts. Upstream SCB data is CC0 | yes |
| **Tabellverket / Demographic Data Base (CEDAR, Umeå University)**, parish tables 1749–1859 and *Folkmängd 1810–1990* | **not reachable** by the tools (a JavaScript search tool, no download or API) and **restrictive terms**: "not allowed to download information from the search tool … to a database of your own … nor to use the information for commercial purposes" ([terms](https://www.umu.se/en/centre-for-demographic-and-ageing-research/infrastructure-at-cedar/open-data/tabverk-on-the-web)); the SND catalogue record lists access as open but states no licence | **restricted** | **not used directly.** 48 rows that sv.wikipedia prints from it (Mollösund 1750–1890, Fiskebäckskil 1750–1850, Grundsund 1810–1850, Gullholmen 1810–1950) are kept as individually cited figures and **tagged `licence: "ddb-restricted"`**; the lab has a checkbox (and `?ddb=0`) to leave them out. TODO(felix): confirm with CEDAR (they take licensed data requests) before any commercial release, or drop those rows |
| SCB parish-level historical statistics (before 1960) | no readable source found (SCB's tätort tables start in 1960) | n/a | no |

**Parish → village.** Where a page says the village is the *kyrkby* (main village) of a parish
(Käringön, Klädesholmen, Mollösund, Grundsund, Styrsö), the pre-1960 numbers are that parish's and the
entry's `parish.mapping` says so. Where the village only lies in a larger parish (Åstol and Skärhamn in
Stenkyrka, Hälleviksstrand in Morlanda, Kyrkesund in Klövedal, Hönö and Rörö in Öckerö, Smögen in
Kungshamn, Fjällbacka in Kville, Hunnebostrand in Tossene), the numbers are for the village or locality
and the parish is named for context only. Each row's `counts` says exactly what it measures (tätort,
småort, municipalsamhälle, parish, island residents).

**Boundary breaks in the series are real and kept, not smoothed:** Marstrand 1,432 → 381 (2015, part split
off as Arvidsvik), Smögen + Kungshamn + Väjern one tätort from 2020 (shown on Kungshamn, so Smögen is
counted inside it from then), Hönö + Öckerö merged 2018 (2020 uses island residents instead),
Styrsö + Donsö merged 2020 (same), Kyrkesund 76 → 547 (2015), Gottskär 774 → 3,420 (1990–1995).

## Story material (`games/windward/data/history-start-area.md`)

Narrative layer for west Orust (Käringön, Måseskär, Gullholmen, Härmanö, Hälleviksstrand, Mollösund and the
"Kråkesund" gap): 56 items (dated events, people, wrecks, cairns, legends), each with a source link and a confidence,
plus a **Not found** list per place. Format checked by `src/history-start-area.test.js`. Sources and how they
were checked: Bohusläns museum rapport 2012:39 and the Västkuststiftelsen Härmanö folder were downloaded and
every quoted sentence was found in the PDF text; Svenska kyrkan, sv.wikipedia, DigitaltMuseum and vastsverige.com
pages were re-read by a second reader, with the "as relayed" items marked. Not found, even after targeted
searches: any vårdkase (signal-fire) site on Orust, any Bronze Age cairn record (fornsok.se was not reachable),
pre-1900 named wrecks, and a place called "Kråkesund" (the nearest real name is probably Kråksundsgap, from a
search summary only; TODO(felix) confirm).

## Rebuild

```
node tools/build-coast.mjs --cache <dir> [--debug]   # re-runs offline once <dir> holds the downloads
node tools/make-settlements.mjs                      # rebuilds the settlements file from places.json + the SCB file
```
