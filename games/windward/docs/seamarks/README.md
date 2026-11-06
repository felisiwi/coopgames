# Seamarks data (shallows + harbour marks)

Real OpenStreetMap data for the Windward region (58.085-58.30 N, 11.25-11.50 E), for stage 1d. Fetched 2026-11-06
(OSM data timestamp in each file). Nothing is invented: every row carries its OSM id.

- `assets/coast/shoals.json` (35 KB), `assets/coast/seamarks.json` (94 KB)
- `tools/fetch-seamarks.mjs`: re-run `node tools/fetch-seamarks.mjs` to refresh (retries and a mirror when Overpass is busy; `node tools/fetch-seamarks.mjs saved.json` re-processes a saved response offline)
- `games/windward/seamarks-lab.html`: plots both over the land-cover raster (tap a symbol for tags; jump buttons for the three harbours)
- `node games/windward/src/seamarks.test.js`: 10 checks (region, valid types, IALA colours, cardinal bands and rhythms, unique ids)
- Screenshots (390x844): `overview.png`, `grundsund.png`, `fiskebackskil.png`, `karingon.png`, `panel.png`, `desktop.png`
- Licence: © OpenStreetMap contributors, ODbL 1.0. Credit it wherever the data ships (it is share-alike for the data itself).

## What is in it

**Shoals (292)**

| kind | n | notes |
|---|---|---|
| `rock` | 281 | `seamark:type=rock`. level: awash 200, submerged 39, unknown 39, covers 2, dry 1. Only 4 carry a depth |
| `named_shoal` | 9 | Sverkerbådan, Jämningsbådan (x2, two marks), Tors både, Hästebåden, Bytebåden, Långgaps både, Smedjeflut (x2). `radiusM` where OSM has an outline (3-23 m) |
| `wreck` | 1 | Pråmiss, 58.15294 N 11.42073 E (9 m) |
| `obstruction` | 1 | an unnamed Sjöfartsverket obstruction at 58.21217 N 11.26167 E |

**There are no `-grund / -grynna / -grynnan / -grunden` names in OSM for this box** (also none in `names.json`),
and no `natural=shoal` / `reef`. The local word is **båd / både / båden / bådan** (and **flu / flut**), so the query
looks for those too. They are mostly OSM `bare_rock` islet outlines. The other ~290 `bare_rock` islets are real islands
and are not in shoals.json; `skerries.json` already has them.

**Sea-marks (206 marks, 12 leading lines, 24 harbours)**

| type | n | notes |
|---|---|---|
| `lateral` | 80 | 43 port (red) / 37 starboard (green), all IALA A. 73 spars, 5 cans, 2 conical. 13 lit (`Fl(2) G 6s` style). No `beacon_lateral` in OSM here |
| `cardinal` | 10 | 4 E, 2 N, 2 S, 2 W, all buoys. Two lit: Q(3) W 10s (E) and Q(9) W 15s (W) |
| `isolated_danger` | 38 | black beacons (piles); 11 named. None lit |
| `special` | 37 | yellow spar buoys (cable areas, outfalls, mussel farms) |
| `light` | 41 | `light_minor` with sectors (up to 11 per light, e.g. Kråkesundsgap), no `light_major` in the box |
| `safe_water` | 0 | none tagged here |
| leading / clearing lines | 12 | 10 leading, 2 clearing, with bearings |

Each mark has `type`, `form` (buoy/beacon/light), `colours`, `shape`, optional `topmark`, `lights[]` with a ready
`text` ("Q(3) W 10s", "Fl(2) R 6s"), and `nearHarbour` when within 1.5 km of a harbour node.

## Coverage per harbour (the 24 OSM `harbour` nodes)

Marks counted are the navigational ones (lateral, cardinal, isolated danger, lights); yellow special marks are not
counted because they are not for entering. "Nearest" is straight-line from the harbour node.

| harbour | nearest nav mark | within 600 m | within 1.5 km |
|---|---|---|---|
| **Grundsunds hamn** (spawn) | 89 m | 2 | 8 |
| Grundsunds Marina | 516 m | 1 | 6 |
| **Käringön fiskehamn** | 195 m | 2 | 11 |
| **Käringöns gästhamn** | 278 m | 1 | 10 |
| **Fiskebäckskils småbåtshamn** | **853 m** | **0** | 4 |
| Fröjdendals småbåtshamn | 192 m | 9 | 23 |
| Gullholmens gästhamn | 228 m | 6 | 12 |
| Havsbadets gästhamn | 233 m | 2 | 10 |
| Fiskhamnens gästhamn | 248 m | 1 | 8 |
| Gullmarsstrands småbåtshamn | 263 m | 3 | 4 |
| Norra Hamnens gästhamn | 283 m | 1 | 7 |
| Småbåtshamn Kolholmarna/Grötö | 337 m | 4 | 7 |
| Stångholmesunds småbåtshamn | 416 m | 2 | 7 |
| Ellös gästhamn | 428 m | 3 | 7 |
| Edshultshalls gästhamn | 615 m | 0 | 6 |
| Hällevik Yacht Club | 751 m | 0 | 3 |
| Lyckans slip Marina | 758 m | 0 | 4 |
| Gåsö småbåtshamn | 775 m | 0 | 3 |
| Stockens gästhamn | 888 m | 0 | 12 |
| Hälleviksstrands Varvs Marina | 918 m | 0 | 6 |
| Hälleviksstrands Hamn | 934 m | 0 | 6 |
| Stockeviks småbåtshamn | 1,355 m | 0 | 1 |
| Långeviks småbåtshamn | 1,392 m | 0 | 1 |
| Valbodalen småbåtshamn | 1,730 m | 0 | 0 |

## Gaps

- **11 of 24 harbours have no navigational mark within 600 m.** Worst: Valbodalen, Långeviks, Stockeviks (nothing
  within ~1.4 km), then Hälleviksstrand, Stocken, Fiskebäckskil, Gåsö, Lyckans slip, Hällevik (750-950 m).
- **Fiskebäckskil** (one of Felix's three): the harbour is at the end of a narrow inlet and the nearest mark is the
  Q(3) cardinal about 850 m out. Nothing marks the inlet mouth.
- **Grundsund** is well covered: marks at 89 m, 2 within 600 m, 8 within 1.5 km. **Käringön** has marks on all sides
  (2 cardinals, laterals) but none that leads into the fishing harbour itself.
- **Leading lines exist for almost nowhere near a harbour**: only Fröjdendal has any within 600 m. The other 10 lines
  are open-water or fairway lines.
- **No depths for shoals** (4 of 281 rocks). 39 rocks have no water level, so draw them as the weakest hazard.
- OSM has very few `grund/grynna` features, so the "grund" feel has to come from rocks and the `båd` names, not names.

## Recommendation for stage 1d

1. **Use the real data as-is** for everything it covers: all 80 laterals, 10 cardinals, 38 isolated-danger beacons,
   the lights and the 281 rocks. They are in the right places (see the lab) and rhythms are standard.
2. **Fill harbour mouths with generated marks, flagged `invented: true`** (never mixed in silently, so we can drop them
   if OSM improves). Rule: for each harbour with no navigational mark within 600 m, place a port/starboard pair
   (red can, green cone, IALA A looking from seaward) across the narrowest water gap between the harbour node and open
   water, ~100-200 m outside the quay line, plus one **transit pair** (front and rear beacons in line with the
   fairway) where the approach is a straight channel. Use the existing land-class raster to find the gap.
3. **Priority order:** Fiskebäckskil first (a named place of Felix's, no mark at the mouth), then Käringön fishing harbour,
   then the 8 harbours at 600-950 m. Valbodalen / Långeviks / Stockeviks are deep inland inlets; mark their mouths too.
4. **Keep leading lines as a visual aid only where OSM has them** and invent transits only where a mark pair is
   generated. Say so in the legend ("charted" vs "gameplay mark").
5. **Shoal look:** awash / dry = bright foam ring (always visible), submerged = faint dark patch visible only close
   up, unknown = same as submerged. `named_shoal` get the name on the map after discovery.
6. **Credit OSM (ODbL)** in the in-game credits and keep the `osm` id on rows, so a later refresh stays traceable.
