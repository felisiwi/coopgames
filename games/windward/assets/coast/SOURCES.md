# Real west-coast data: sources and licences

Built by `tools/build-coast.mjs` (zero npm dependencies, Node 22+). Smögen and Hållö in the
north to Gottskär (Halland) in the south, at 20 real m/px. One flat plane of 3251 × 6227 px
(65.0 × 124.5 km) cut into two stored tiles so the empty sea in the south-west corner is
never saved:

| Tile | Area | Size | Plane offset |
|---|---|---|---|
| north | 57.85–58.45 N, 11.0–11.8 E | 2365 × 3336 px | x 0, y 0 |
| south | 57.33–57.85 N, 11.5–12.1 E | 1774 × 2891 px | x 1477, y 3336 |

Distance fields (depth, shore distance) are computed on the whole plane before cutting, so
water shading has no seam where the tiles meet.

## Attribution line (show it wherever this data is shown)

> Map data © OpenStreetMap contributors (ODbL). Land cover: Naturvårdsverket, NMD 2018.
> Elevation: Copernicus DEM GLO-30.

## What came from where

| Layer | Source | Licence | How it was fetched |
|---|---|---|---|
| Coastline (land/sea mask, islets) | OpenStreetMap `natural=coastline` | ODbL 1.0, © OpenStreetMap contributors | Overpass API (see deviation below), three queries merged by way id |
| Places (`places.json`) | OpenStreetMap, looked up by name | ODbL 1.0 | Overpass API |
| Height | Copernicus DEM GLO-30, tiles N57 E011, N57 E012, N58 E011 | Copernicus DEM licence: "free basis for the general public" per the [AWS open-data registry entry](https://registry.opendata.aws/copernicus-dem/); attribution to the Copernicus programme | `copernicus-dem-30m.s3.amazonaws.com`, no account |
| Land cover (`*-classes.png`) | Naturvårdsverket, Nationella Marktäckedata (NMD) 2018 basskikt, ogeneraliserad v1.1, counties O (Västra Götaland) and N (Halland), 10 m | CC0 per Naturvårdsverket's data terms as quoted on the [OSM wiki import page](https://wiki.openstreetmap.org/wiki/WikiProject_Sweden/naturvardsverket_import) ("licenstypen CC0 … ser gärna att det ges en referens"). TODO(felix): confirm on Naturvårdsverket's own page; its download page did not show licence text to the build agent | `geodata.naturvardsverket.se/nedladdning/marktacke/NMD2018/bas_lan_ogen/`, public folder, no account |
| Depth (`*-depth.png`) | **Not data.** A made-up function of distance to shore | n/a | computed |
| Settlement history (`../../data/settlements-history.json`) | sv.wikipedia.org and vastsverige.com pages, each cited per entry | Wikipedia text is CC BY-SA 4.0; the file stores facts (dates) and the page URL as the source | read by hand, see the file's `unsourced` list |

Not used: Sjöfartsverket sea-chart depths (restricted). Lantmäteriet's elevation grid was
checked first: its downloads go through Geotorget ordering (not confirmed account-free) and the
product found, grid 50+, is only 50 m, so Copernicus (the stated fallback) was used.
Lantmäteriet Historiska kartor was **not** used for the settlements: its English page says only
that Lantmäteriet "has chosen to withdraw copyright claims for the maps", and no licence label for
the service itself could be confirmed.

## Deviation: coastline via Overpass, not the osmdata land-polygon zip

`osmdata.openstreetmap.de` closed the TLS connection from the build machine (the Geofabrik
download host did too; openstreetmap.org and AWS worked). The brief asked for the osmdata
split-WGS84 land polygons. Instead the script pulls the same OSM coastline ways through
Overpass and rasterises them itself: a pixel is land when a ray from the west edge (open sea)
has crossed an odd number of coastline segments. Same underlying data and licence, different
route. Inland lakes are not tagged as coastline, so they appear as land in the mask.
Overpass was overloaded during the pass-2 build (HTTP 502, mirrors unreachable), so the script
now retries up to 8 times and rotates through mirrors; a finished build is cached and re-runs
offline.

## Files (committed sizes, 20 m/px)

| File | Size | What it is |
|---|---|---|
| `north-land-height.png`, `south-land-height.png` | 2.07 + 1.34 MB | 16-bit grey. 0 = water. Land = round(height m × 10) + 1, stored in 0.5 m steps. Copernicus is a *surface* model: tree tops count, so wooded ground reads 5–20 m high |
| `north-depth.png`, `south-depth.png` | 0.63 + 0.47 MB | 16-bit grey, decimetres in 0.5 m steps, 0 = land. `min(90, 0.5 + 0.04 × metres to shore)` |
| `north-classes.png`, `south-classes.png` | 0.73 + 0.51 MB | 8-bit grey: 0 water, 1 bare_rock, 2 heath, 3 meadow, 4 scrub, 5 forest, 6 village |
| `skerries.json` | 94 KB | 3724 closed coastline rings under 25 m wide: `[lon, lat, width m, length m]` |
| `places.json` | 6 KB | 31 places with lat/lon and the OSM object used |
| `routes.json` | 2 KB | Marstrand → Smögen and Gottskär → Marstrand polylines and lengths |
| `trees.json` | 1 KB | tree density rule and totals per scale |
| `meta.json` | 3 KB | extent, tiles, projection, encodings, class percentages |
| **Total** | **5.86 MB** | pass-1 area alone was 4.77 MB; the budget for pass 2 was about 8 MB |

Budget decision (pass 2): the first full build was 8.1 MB. Rather than drop to 25 m/px, heights
and depths are quantised to 0.5 m steps (still stored as decimetres, so the loader is
unchanged). That cut the total to 5.86 MB and kept the full 20 m coast detail.

Pixel → position: `lon = 11.0 + x·20 / metersPerDegLon`, `lat = 58.45 − y·20 / 111195`, with x, y
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

Result, % of land: bare_rock 8.1, heath 17.4, meadow 20.8, scrub 3.8, forest 44.3, village 5.6
(land = 1953 km² real, 37.5 % of the tile area). Village is higher than in pass 1 because
Göteborg is now on the map.

## Trees: near the boat only

Trees per 100 m² of **game** ground: forest 1.0, scrub 0.5, village 0.1, heath 0.05,
meadow 0.02, bare_rock 0. Planting the whole map at those densities:

| Scale | Trees | vs 3,000 budget | Scale every density by |
|---|---|---|---|
| 1:6 | 260,886 | 87× | 0.0115 |
| 1:8 | 146,748 | 49× | 0.0204 |
| 1:10 | 93,918 | 31× | 0.0319 |

Too heavy for a phone at any scale, so trees are planted only near the boat:
`src/trees-near.js` → `treesNear(x, z, radius = 250)`. The world is cut into 10 × 10 game-metre
cells (100 m², so density = expected trees per cell); each cell's trees come from a hash of its
own coordinates, so the same spot always gets the same trees. A fully forested disc of radius
250 m holds about 1,964 trees; on the real map no sampled 250 m disc exceeded 1,530 trees at
any of the three scales.

## Rebuild

```
node tools/build-coast.mjs --cache <dir> [--debug]   # re-runs offline once <dir> holds the downloads
```
