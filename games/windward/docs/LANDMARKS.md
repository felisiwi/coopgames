# Landmarks: the kit, the placements, and how the game should place them

Written 2026-11-07 (agent 4). The first recognisable-from-a-boat things of the coast, built from `docs/ISLAND-ASSETS-BRIEF.md`
and `data/island-lore.json`. **Nothing here is used by the game yet**: new files only. `landmark-lab.html` shows it all.

| File | What |
|---|---|
| `src/landmark-assets.js` | the kit: add-functions in the style of `era-assets.js` (flat Lambert, Skagen pastels, no textures, windows the only lit thing), one registry, `createLandmark()` |
| `data/landmarks.json` | 29 placements (position, eras, source, confidence) and 6 "from the boat" views |
| `src/landmark-place.js` | the pure placement maths: era rules, headings, the three cameras, the boat's start (testable in node) |
| `src/landmark-boat.js` | the lab's "from the boat" mode on the game's own era coast |
| `landmark-lab.html`, `src/landmark-lab.js`, `src/landmark-lab-params.js` | the viewer |
| `src/landmark-assets.test.js`, `landmark-place.test.js`, `landmark-lab.test.js` | 11 + 12 + 7 checks (`node games/windward/src/<file>`) |

## 1. The kit: seven types, 28 looks

Each look is one `variant` of a `type`; `createLandmark(type, { variant, era, night, size, h, n })` returns `{ group, setNight, describe, dispose, readScale }`.
The `era` you ask for picks the look inside a variant (Bonden's pole, Hinneskär's height); a variant that stood in no game era draws with its nearest declared look.

| Type | Looks (variant ids) | Eras | readScale |
|---|---|---|---|
| **cairn** (kummel) | `heap` (unpainted, Måseskär) · `square-white` (Korsholmen 1853) · `cylinder-black` (Tornö 1886) · `cylinder-black-arm` (Kråksundsgap, Bråtö 1838/1868) · `cone-white-arm` (Hinneskär 1878; Pipeskär 1933 with `size:'small'`) · `belt-white-red` (Jämningarna 1874) · `belt-white-green` (Byxeskären 1874) · `tall-white-pole-ball` (Bonden 1875) · `small-white` (Tenholmen 1.8 m, Lilla Bockholmen 2 m, Islandsberg 2.5 m, via `h`) | `heap` 1703 (uncertain); the rest 1950 and today | **1.8** |
| **polemark** (stångmärke) | `maseskar-1829` (18 m, red, white board point down) · `gaven-1835` (15 m, eight stays, the pilots' lookout house) | none: the 1800s only (shown on the lab's "all eras" shelf) | **2.0** |
| **fyrkur** (small automatic light) | `stangholmen-iron` (1940-74) · `stangholmen-plastic` (1974-) · `fredagsholmen-1942` · `fredagsholmen-today` (red roof, solar) · `fredagsholmen-1883` (prefab wooden light house) | 1950 / today; `-1883` is 1800s only | 1.0 |
| **sjobod** (sea huts, nets, racks) | `row` (n huts, gable to the water) · `single` · `nets` · `racks` | 1703, 1950, today (`nets` and `racks`: 1703 and 1950) | 1.0 |
| **church** | `red-chapel-1799` (Grundsund; 1800s only) · `cross-church` (Grundsund 1893) · `tower-church` (Käringön 1796) · `school-chapel` (Gåsö 1955) | 1950 / today (`school-chapel`: today only) | 1.0 |
| **windmill** | `dutch` (Fiskebäckskil, 1854-55) | 1950, today | 1.0 |
| **darkhouse** | `dark` (Stångehuvud, dark since 1940) · `led` (solar LED, 2014) | 1950 / today | 1.0 |

**Reused from `era-assets.js`** (imported, never copied): `Mesher`, `GLASS`, `F50` (colours), `addKummel` (the heaped cairn), `addBoathouse` (the 1703 hut), `addSjobod1950`
(the 1950 huts), `addDryingRacks`, `addFyrkur1950` (Stångholmen's iron octagon), `createAsset('figure1950')` (the scale figure in the lab). That file keeps its small helpers
private, and this work may not edit it, so look-alikes (`frustum`, `win`, `gableHouse`, a palette) live in `landmark-assets.js`.

**Honest data.** Every look carries `source`, `confidence`, what a source actually gave (`real`) and what the designer had to choose (`designer`). Several cairn heights are not in
any record and are flagged there: Korsholmen 3 m, Jämningarna and Byxeskären 4 m, Hinneskär in 1950 about 0.8 m lower (it was raised after 1978), Byxeskären's 1950 belt colour
(shown red, today green: low confidence). The windmill's colour and every church dimension are the designer's: `TODO(felix): confirm`.

## 2. Scale

- **The kit is built at 1:1 real metres**, the boat's scale (a koster is 8 m), like `seamark-meshes.js` and the era kit. The coast is 1:10 in plan only.
- **The game enlarges landmarks when it places them**, so they read from its camera: `src/world-year-build.js` scales a cairn ×1.8 and a rock mark ×2.0. That factor is **data**
  here (`LANDMARK_TYPES[type].readScale`), applied by the placer or the lab, never baked into the geometry. A test reads `world-year-build.js` so the numbers cannot drift.
- Small automatic lights are placed by the game at built size (×1). Big towers use `lighthouses.js gameHeight = 6 + 0.5 × real`; none of those are in this kit.
- Facets follow `shared/ART.md` (about 3 m; small props exempt).

## 3. `data/landmarks.json`

```json
{ "id": "lm-hinneskar", "type": "cairn", "variant": "cone-white-arm", "era": ["1950","today"], "built": 1878, "heading": 135,
  "lat": 58.0905, "lon": 11.3321, "place": "light:Måseskär", "source": "RAÄ ORUST MÅSESKÄR 1:1 husnr 9002 (Söderlund 2007), record coordinates via K-samsök",
  "confidence": "exact", "factConfidence": "high", "note": "…" }
```

| Field | Meaning |
|---|---|
| `id`, `type`, `variant`, `opts` | which look; `opts` = `{ size:'small' }`, `{ h: metres }`, `{ n: huts }` |
| `era` | the game eras it stands in: `1703`, `1950`, `today`. **Never an era it did not exist in** (tested) |
| `built`, `until` | the years **this look** began and ended (not necessarily the first construction), or `null`; the test derives the eras from them (1703, 1950, 2026) |
| `replacedBy` | the id of the look that stands in the eras this one does not |
| `lat`, `lon` | degrees; inside the play region (tested) |
| `heading` | the **compass bearing** (0 north, 90 east) the model's `+Z` side faces: a cairn arm's direction (Hinneskär 135, Pipeskär 90). Omitted = the placer turns it to face the water |
| `place` | an `island-lore.json` key (tested to exist) |
| `confidence` | position: `exact` (a record or node gives it: 20 placements) or `approx` (the place's point, snapped to land: 9) |
| `factConfidence` | `high` / `medium` / `low`: how sure it is that the thing stood there |
| `source`, `note` | where it comes from; free text |

`views` are the lab's "from the boat" start points: `{ id, label, era, focus:{lat,lon}, from, distM, landmarks, note }` (`from` = the bearing the boat is at *from* the focus, `distM` in
game metres).

## 4. The lab, and the cameras

Open `landmark-lab.html` (serve the repo as static files; on a deployment it is `/games/windward/landmark-lab.html`). The address holds every setting:

`?mode=shelf|boat` · `?era=1703|1950|today|all` (no `all` from the boat) · `?type=cairn|polemark|fyrkur|sjobod|church|windmill|darkhouse|all` · `?v=<variant>` · `?view=<id>` ·
`?cam=game|weather|speed|orbit` · `?night=1` · `?rs=0|1` (read scale: off on the shelf, on from the boat) · `?lm=0` (hide the kit: the bare game) · `?fig=0` · `?panel=1`.

**Shelf**: variants on granite plinths, a 1.5 m figure beside each for scale, labels (type, then place and year). **From the boat**: the game's own coast of the era (`buildWorldForSpec`), the
kit's landmarks snapped to land, the boat parked on open water straight south of the landmark, the game's fixed camera.

| `cam` | Camera | Numbers |
|---|---|---|
| `game` | the game today | zoom 1, elevation 52°, distance 125 (`config.js`) |
| `weather` | agent 2's weather camera at rest | zoom ×1.4 |
| `speed` | the weather camera at full speed | zoom ×1.4, 12° lower, 20% closer, a 45 m look-ahead (clamped 6 m a side and 7 m toward the bottom, per unit of zoom) |

**TODO(agent 4): re-sync the `weather` and `speed` numbers when `felix/windward-weather` merges.** They are copied, not imported, from that branch (`src/game-weather.js` `HOME_ZOOM`,
`src/sail-feel-model.js` `FEEL`, `src/sail-feel-fx.js` `lookAheadVector`) because those files are not on `main`. They live in one place: `CAMERA_RIGS` in `src/landmark-place.js`.

**What the cameras show.** The game's camera is narrow: from its field of view (30°) and distance (125) the screen covers roughly 65 to 85 m of sea top to bottom and about 30 m across on a phone (aspect 0.46), always south of the boat looking north. A landmark is only seen when it
is within roughly 25 to 45 m ahead and nearly centred, which is why every view puts it dead ahead. The weather camera shows more sea ahead: at Käringön the church and its tower appear
at the top of the screen (with the current camera it is off the edge), so churches read as landmarks instead of as roofs.

## 5. How the game should place them later (one paragraph)

For an era, take the placements whose `era` list holds it, and for each: convert `lat, lon` with the world's `toGame`; snap to the **nearest land** within 90 game metres with `nearestLand`
(the rule `world-year-build.js` uses for its cairns); put it at `max(0.25, heightAt)` (cairns 0.1 lower); turn it by `yaw = π − bearing`, using `heading` if the row has one and the compass
direction of the lowest ground (`seawardBearing`) if not; scale it by the data's `readScale`; build it with `createLandmark(type, { variant, era, ...opts })`. The rows are data, so the
placer is one loop and a new landmark is a new row. Dusk is `setNight`. Each look is one solid mesh plus up to two window meshes (and a lantern mesh for the lights): a few draw calls, tested.

> **RULE: sea huts, nets and racks REPLACE the game's own village boathouses where they overlap; they must not stack on them.**
> The game already stamps cottages, boathouses and drying racks round every village (`placeVillages`, `placeCoastVillages`). The lab shows the clash plainly (Käringön's village: my
> hut row sits among the game's red cottages). A `sjobod` placement (`row`, `single`, `nets`, `racks`) therefore **owns its footprint**: a row of *n* huts is *n* × 6.2 m wide (the kit's spacing) and
> about 12 m deep, so before stamping it the placer removes any game boathouse, rack or cottage whose origin lies within (row half-width + 4 m) of the row's centre, then stamps the row.
> Where a village has no `sjobod` placement the game's own boathouses stay as they are. Order matters: place the kit first, then let the village code fill the gaps, or filter the village
> list against the kit's footprints. Do not ship both.

## 6. Not modelled yet

- **Kråksundsgap's leading marks**: *Kråksundsgap norra* (a white concrete board, 1941) and *Kråksundsgap södra* (a white concrete cairn on the mainland at Edshult, the former 1926 light, a cairn since 1941). They are in the records (positions known) but need a board and a cairn-on-a-base shape, so they are not in the kit. Also *Kråksundsgap övre / Sollid* (a light on a trestle, 1896) and the manned station on Högholmen (1890-1911).
- **Svarten / Sydbonden**: Måseskär's pole mark of 1829, rebuilt 1853, replaced by a stone cairn in 1878. Not placed (it stood in none of the three eras); the cairn that replaced it is probably Hinneskär (our inference, `low`).
- Churches for **Gullholmen** (on Lilla Härmanö, 1799) and **Fiskebäckskil** (1772); **Lysekil's** church (the sea mark of the approach since 1901).
- Pilot lookouts (Käringön's *Lotsutkiken*, the Vedholmen lookout of 1880), cannery buildings, boatyard slips, quarry scars (Härmanö, Tornö/Vallerö, Stångehuvud's Galleberget), train-oil boilery ruins (Stora Kornö), bath houses and the Gåsö beach hotel, tomtningar (wall-ringed hollows).
- Natural marks: the seal skerries, the cave Klingkyrka, Stångehuvud's granite slabs.
- The game's own **towers** (Måseskär, Hättan, Gäven, Islandsberg ...) and its keeper's houses are not duplicated: `lighthouses.js` and `lights-1950.js` already place them.
- The lab is static: the boat does not sail, and only the kit's landmarks (not the game's world) change at dusk.

## 7. Tests

`node games/windward/src/landmark-assets.test.js` (every look builds, inside its triangle budget, deterministic, on the ground, at the sourced height, no lights, the era differences are real, nothing copied from `era-assets.js`),
`landmark-place.test.js` (every placement is a known look with a source, inside the region, **never in an era it did not exist in**, derived from `built`/`until`; the maths; the cameras; the read scale matches the game) and
`landmark-lab.test.js` (the address, the shelf, the layout, the page). The repo loop: `cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done`.

## 8. Phone checklist (Felix)

Open `landmark-lab.html` on the preview deployment, open the panel (tap the bar at the bottom), and for each place switch **From the boat** and flip the camera chips (The game today · Weather camera · Weather at speed).

1. **Shelf, 1950, Stone cairn:** do the nine cairns look like *different marks* (square white, black cylinder, white cone with an arm, belted ones, the tall one with a pole)? Anything too small, too big, or the wrong colour?
2. **Måseskär** (view 1): does Hinneskär's white cone read as *the cairn next to the lighthouse*? Is the light's beam in the way?
3. **Käringön marks** (view 2): is Korsholmen's white square cairn clear on its skerry, and Tornö's black cylinder beyond it with the weather camera?
4. **Käringön village** (view 3): with the weather camera, does the white church with its tower stand out? Are the sea huts and the game's cottages too crowded (the rule in section 5)?
5. **Kråksundsgap** (view 4): is the black cairn on Bråtö clear? Is the top mark stub OK?
6. **Bonden** (view 5): is the tall white cairn the first thing you see (switch to the weather camera: with the current one it only just clears the top edge)?
7. **Fiskebäckskil** (view 6, today): is it a windmill? (The sails read thin from this angle; the colour is a guess.)
8. **Dusk** (the Day/Dusk button): do windows and lanterns glow without anything else changing?
9. **Era switch** (1703 / 1950 / Today) in the boat view: does anything stand where it should not (a church in 1703, the Gåsö chapel in 1950)?
10. Anything **too small, too big, the wrong colour, or in the wrong place**: send the address (it always holds your settings: Copy link).
