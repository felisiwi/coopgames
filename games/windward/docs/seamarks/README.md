# Seamarks data (shallows + harbour marks)

Real OpenStreetMap data for the Windward region (58.085-58.30 N, 11.25-11.50 E), for stage 1d. Fetched 2026-11-06
(OSM data timestamp in each file). Nothing is invented: every row carries its OSM id.

- `assets/coast/shoals.json` (35 KB), `assets/coast/seamarks.json` (about 100 KB: 206 real rows + 20 invented)
- `tools/fetch-seamarks.mjs`: re-run `node tools/fetch-seamarks.mjs` to refresh from OSM (retries and a mirror when Overpass is busy; `node tools/fetch-seamarks.mjs saved.json` re-processes a saved response offline). **It rewrites `seamarks.json`, so always follow it with `node tools/invent-harbour-marks.mjs`** (idempotent: replaces every invented mark, never touches real rows)
- `src/seamark-meshes.js`, `src/seamark-place.js`, `src/shoal-look.js`: the stage 1d kit (below)
- `games/windward/seamarks-lab.html`: **Map** (both files over the land-cover raster, invented marks ringed in dashed magenta) and **3D** (the real coast, the game's sea / sky / light / camera, the marks, the shoal rings and a koster for scale; Day / Night, "All mark types", "Debug: ring invented marks", zoom). URL: `?view=3d&h=Fiskeb&night=1&zoom=0.5&debug=1&types=1&ll=58.15236,11.3981&flash=1`
- Tests: `node games/windward/src/seamarks.test.js` (data, 11), `seamark-meshes.test.js` (12), `seamark-place.test.js` (8), `shoal-look.test.js` (6)
- Screenshots (390x844): 2D `overview / grundsund / fiskebackskil / karingon / panel / desktop`; 3D `fiskebackskil-3d-day / -night` (game camera), `-close-day / -close-night`, `-debug`, `mark-types-day / -night`, `shoals-day / -night`
- **Credit: © OpenStreetMap contributors, ODbL 1.0** (https://www.openstreetmap.org/copyright). It is in both JSON files (`credit`, `licence`, `licenceUrl`), `OSM_CREDIT` in `seamark-meshes.js`, the lab page (top right, both views) and here. The game must show it in its credits wherever the marks or shoals appear; ODbL is share-alike for the data itself. The invented gates are derived from OSM harbour positions plus our own coast raster and are marked `invented: true`.

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

**Sea-marks (206 real marks + 20 invented, 12 leading lines, 24 harbours)** (the table is the real OSM rows; the invented ones add 10 port + 10 starboard laterals)

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

## Stage 1d kit

Nothing here is wired into `game.js`. All sizes are game metres.

### 1. Meshes: `createSeamarkMesh(spec, { night })` (`src/seamark-meshes.js`)

`spec` is one row of `seamarks.json` (or `{ type: 'leading', role: 'front' | 'rear' }`). It returns
`{ group, step(t, { seaY }), setNight(bool), triangles, bobs, lit, light, variant, height, dispose() }`.

```js
const m = createSeamarkMesh(row, { night });      // row.invented marks look exactly the same (Felix's rule)
m.group.position.set(x, 0, z); scene.add(m.group);
// per frame: buoys ride the real wave height, lit marks blink in their real rhythm when night is on
m.step(timeSeconds, { seaY: seaHeightCPU(x, z, waves.phases, wind.dir, wind.strength) });
```

| variant | built from | notes |
|---|---|---|
| `port-can` | lateral, side port | red can float + red spar + red cylinder topmark (IALA A) |
| `starboard-cone` | lateral, side starboard | green conical float + green spar + green cone topmark |
| `cardinal-N/E/S/W` | cardinal | bands top to bottom: N black/yellow, E black/yellow/black, S yellow/black, W yellow/black/yellow; two black topmark cones: N both up, E base to base, S both down, W point to point (`ref/cardinal-marks.png`) |
| `isolated-danger` | isolated_danger | black, red band, two black spheres; OSM ones are beacons (a pile on a small cairn, no bobbing) |
| `special` | special | yellow with a yellow X |
| `safe-water` | safe_water | red/white bands, red sphere (none in the data yet) |
| `lit-beacon` | light (light_minor) | white pile on a cairn, platform, falu-red lamp house, grey roof |
| `leading-front` / `leading-rear` | `{ type: 'leading', role }` | a cairn, a post and a flat triangular daymark, rear taller and bigger |

- **Budget:** 43 to 84 triangles per mark, hard limit 150 (a test builds all 226 rows). One vertex-coloured Lambert mesh per mark, plus a lamp mesh and a halo sprite when lit.
- **Style:** flat Lambert, no outlines, ART.md buoy colours pulled toward the Skagen pastels. Size is at the *boat's* scale (a spar mark is about 4 m tall), not the coast's 1:10, or they would be invisible. Cardinal topmarks are deliberately big: from the game's high camera a small cone is just a dark lump.
- **Lights:** `lightIsOn(light, t)` / `lightPattern(light)` are pure and tested: Q (0.3 s on, 1 s spacing), VQ (0.15 s, 0.5 s), Fl (0.5 s, 1.5 s apart), LFl (2 s), Iso, Oc, F, and `Q+LFl`. Q(3) 10s = three quick flashes then dark; checked against every light in the file. Each mark has its own phase from its id, so two identical lights do not blink in lock-step. **Emissive only: a lamp mesh (MeshBasicMaterial) and an additive halo sprite, no PointLight** (a new light recompiles every material in the scene). Sector lights blink their first light; sector colours are not modelled.
- **Bobbing:** buoys only (`form: 'buoy'`): pass `seaY` to ride the real waves, or leave it out for a small built-in sine. Beacons stand still. For beacons on land, set `group.position.y` to the terrain height.

### 2. Invented harbour-mouth gates (`tools/invent-harbour-marks.mjs`, `src/seamark-place.js`)

Felix's call (2026-11-06): **in the game they look the same as real marks; only the chart / debug view tells them apart** (`invented: true` stays in the data; the lab's Map shows a dashed magenta ring, 3D has a Debug toggle).

Rule (`findHarbourMouth`): sailable water is the field at or below `shore.js` `BLOCK_H` and 3 m from anything blocked; route from the harbour out to open water, keeping mid-channel; the **mouth is where the water is narrowest shore to shore across the route**, at least 150 m (real) from the quay, and a mouth further than 400 m must be under 150 m wide (a long inlet has a far mouth, a wide bay does not); the **gate** is two spar buoys across the channel there, centred between the shores, 45 to 100 m apart, **red to port when entering from seaward (IALA A)**. A harbour whose mouth is within 600 m of another gate shares that gate. Harbours that already have a real navigational mark within 600 m get none (Käringön's fishing harbour is the exception, named by Felix).

| harbour | mouth from quay | water across | gate | entering bearing |
|---|---|---|---|---|
| **Fiskebäckskils småbåtshamn** | 745 m | 85 m | 53 m | 180° |
| **Käringön fiskehamn** | 153 m | 300 m | 100 m | 233° |
| Edshultshalls gästhamn | 168 m | 525 m | 100 m | 0° |
| Långeviks småbåtshamn | 153 m | 285 m | 100 m | 40° |
| Hällevik Yacht Club | 165 m | 325 m | 100 m | 14° |
| Gåsö småbåtshamn | 173 m | 600 m | 100 m | 322° |
| Stockens gästhamn | 265 m | 300 m | 100 m | 351° |
| Hälleviksstrands Varvs Marina | 250 m | 150 m | 100 m | 34° |
| Valbodalen småbåtshamn | 168 m | 290 m | 100 m | 180° |
| Stockeviks småbåtshamn | 165 m | 525 m | 100 m | 76° |
| Lyckans slip Marina | shares the gate of Fiskebäckskil | | | |
| Hälleviksstrands Hamn | shares the gate of Hälleviksstrands Varvs Marina | | | |

Each harbour row in `seamarks.json` has `inventedGate: { ids, mouth: {lat, lon}, enteringBearingDeg, ... }` (or `{ sharedWith }`), so the game can park the boat or aim an arrival.
Where the water across is 285 to 600 m (a wide opening, not a neck) the 100 m gate is a symbolic mark pair on the approach, not a channel: judge by eye in the 3D view. TODO(felix): confirm the gates by eye on the phone, especially Käringön fiskehamn.

### 3. Shoal look and collision: `shoalLook(shoal)` (`src/shoal-look.js`)

One function, so the picture and the rule cannot drift apart. Radii are game metres, exaggerated like the skerries (x10 real to game, x3 size, 3 m minimum). `collisionRadiusM` is the rock's own radius: **add the hull** (`shore.js` `HULL_RADIUS_M`, 2.5) as for land. `shoalHit(list, x, z)` does that and returns the deepest overlap with `blocks` and `slow`.

| shoal | look | collision radius | hard / soft |
|---|---|---|---|
| rock, dry | foam ring + granite stub | 2.8 | hard (slide off, like land) |
| rock, awash | foam ring + granite stub | 2.4 | hard |
| named shoal (båd, flu) | foam ring, bigger | max(3, outline x0.3) | hard |
| rock covers / submerged / unknown | faint darker water, no foam | 1.5 / 1.0 / 1.0 (1.8 if OSM depth is 1.5 m or less) | soft: slow to 0.7 (0.55 if shallow), never stop |
| wreck, obstruction | faint darker water | 2.0, 1.5 | soft |

`createShoalLayer(list)` draws all 292 as three instanced meshes (soft-edged surf rings, rock stubs, dark patches), no lights, and `update(t)` makes the surf breathe. The rings sit 0.48 m up so the waves (0.4 m) never swallow them. TODO(felix): all the radii are a first guess; tune by eye on the phone.

### Things to know

- **At night the invented gate marks are dark** (real Swedish spar buoys are unlit), so they are hard to see in the dusk lab view. Options for 1d: leave it (realistic), or give the gate marks a faint reflective glint at night. Felix's call.
- The map's `invented` layer is on by default; turn it off in Layers to see only OSM.
- The 3D lab loads the whole real coast (about 4 s headless) and shows marks within 420 m of the focus.
