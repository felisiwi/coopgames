# Real west-coast data: sources and licences

Built by `tools/build-coast.mjs` (zero npm dependencies, Node 22+). Area: 57.85–58.45 N,
11.0–11.8 E (Smögen and Hållö in the north, Marstrand in the south), 2348 × 3336 px at
20 real m/px (47.0 × 66.7 km).

## Attribution line (show it wherever this data is shown)

> Map data © OpenStreetMap contributors (ODbL). Land cover: Naturvårdsverket, NMD 2018.
> Elevation: Copernicus DEM GLO-30.

## What came from where

| Layer | Source | Licence | How it was fetched |
|---|---|---|---|
| Coastline (land/sea mask, islets) | OpenStreetMap `natural=coastline` | ODbL 1.0, © OpenStreetMap contributors | Overpass API (see deviation below) |
| Places (`places.json`) | OpenStreetMap, looked up by name | ODbL 1.0 | Overpass API |
| Height | Copernicus DEM GLO-30, tiles N57 E011 and N58 E011 | Copernicus DEM licence: "free basis for the general public" per the [AWS open-data registry entry](https://registry.opendata.aws/copernicus-dem/); attribution to the Copernicus programme | `copernicus-dem-30m.s3.amazonaws.com`, no account |
| Land cover (`classes.png`) | Naturvårdsverket, Nationella Marktäckedata (NMD) 2018 basskikt, ogeneraliserad v1.1, county O (Västra Götaland), 10 m | CC0 per Naturvårdsverket's data terms as quoted on the [OSM wiki import page](https://wiki.openstreetmap.org/wiki/WikiProject_Sweden/naturvardsverket_import) ("licenstypen CC0 … ser gärna att det ges en referens"). TODO(felix): confirm on Naturvårdsverket's own page; its download page did not show licence text to the build agent | `geodata.naturvardsverket.se/nedladdning/marktacke/NMD2018/bas_lan_ogen/`, public folder, no account |
| Depth (`depth.png`) | **Not data.** A made-up function of distance to shore | n/a | computed |

Not used: Sjöfartsverket sea-chart depths (restricted). Lantmäteriet's elevation grid was
checked first: its downloads go through Geotorget ordering (not confirmed account-free) and the
product found, grid 50+, is only 50 m, so Copernicus (the stated fallback) was used.

## Deviation: coastline via Overpass, not the osmdata land-polygon zip

`osmdata.openstreetmap.de` closed the TLS connection from the build machine (the Geofabrik
download host did too; openstreetmap.org and AWS worked). The brief asked for the osmdata
split-WGS84 land polygons. Instead the script pulls the same OSM coastline ways through
Overpass and rasterises them itself: a pixel is land when a ray from the west edge (open sea)
has crossed an odd number of coastline segments. Same underlying data and licence, different
route. If osmdata works for you, swapping it in only changes step 2 of the script.
Inland lakes are not tagged as coastline, so they appear as land in the mask.

## Files (committed sizes)

| File | Size | What it is |
|---|---|---|
| `land-height.png` | 3.12 MB | 16-bit grey. 0 = water. Land = round(height m × 10) + 1. Copernicus is a *surface* model: tree tops count, so wooded ground reads 5–20 m high |
| `depth.png` | 0.88 MB | 16-bit grey, decimetres, 0 = land. `min(90, 0.5 + 0.04 × metres to shore)` |
| `classes.png` | 0.72 MB | 8-bit grey: 0 water, 1 bare_rock, 2 heath, 3 meadow, 4 scrub, 5 forest, 6 village |
| `skerries.json` | 44 KB | 1735 closed coastline rings under 25 m wide: `[lon, lat, width m, length m]` |
| `places.json` | 4 KB | 22 places with lat/lon and the OSM object used |
| `route.json` | 1 KB | Marstrand → Smögen route polyline and lengths |
| `trees.json` | 1 KB | tree density rule and totals per scale |
| `meta.json` | 2 KB | extent, projection, encodings, class percentages |
| **Total** | **4.77 MB** (4.55 MiB) | under the 5 MB target |

Pixel → position: `lon = 11.0 + x·20 / metersPerDegLon`, `lat = 58.45 − y·20 / 111195`
(equirectangular around the box centre, so east-west distances are off by up to about 1.5 %
across the box; fine for a game).

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
- Each 20 m pixel takes the majority of four 10 m NMD samples around its centre.

Result, % of land: bare_rock 8.9, heath 18.8, meadow 20.3, scrub 5.3, forest 45.0, village 1.7
(land = 1124 km² real, 35.9 % of the box).

## Tree rule (for scattering pines and bushes from data later)

Trees per 100 m² of **game** ground: forest 1.0, scrub 0.5, village 0.1, heath 0.05,
meadow 0.02, bare_rock 0. Map-wide totals at those densities:

| Scale | Trees | vs 3,000 budget | Scale every density by |
|---|---|---|---|
| 1:6 | 153,575 | 51× | 0.0195 |
| 1:8 | 86,385 | 29× | 0.0347 |
| 1:10 | 55,287 | 18× | 0.0543 |

Too heavy for a phone at any of the three scales. Scatter only around the boat instead: an
all-forest disc holds 707 trees at 150 m radius, 1,963 at 250 m, 5,027 at 400 m.

## Rebuild

```
node tools/build-coast.mjs --cache <dir> [--debug]   # re-runs offline once <dir> holds the downloads
```
