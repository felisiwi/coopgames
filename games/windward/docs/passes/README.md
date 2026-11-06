# Passes: carving the real sounds the 1:10 raster closes

Felix chose **option B** for narrow passes (GAME-DESIGN.md "Decisions 2026-11-06, morning"): keep the coast at 1:10 and
carve a hand-picked list of real sounds and natural harbours, widened just enough for the boat. Nothing here is wired
into `game.js`; stage 1d calls `applyPasses`.

## Files

- `assets/coast/passes.json`: 39 passes, each a carve polygon (lon/lat rings) from OSM's coastline, widened at its narrowest point, tuned so the boat really sails through. Tiers: **ship** 5, **later** 19, **eye** 15.
- `assets/coast/pass-candidates.json`: the candidate list (73): every OSM-named sound, every harbour, the villages and Felix's pins, each with open / closed today, real width, length, and which pass fixes it.
- `src/passes.js`: `applyPasses(world, passes, { tiers, ids, depth })`, `findRoute(world, from, to)` (the game's own collision), `passEnds`, `passCellBox`, `resetPasses`.
- `src/pass-derive.js`: the pure derivation (OSM coastline to a 5 m real-water raster, distance transform, trip shortcuts, carve shapes).
- `tools/build-passes.mjs`: builds both JSON files (Overpass `natural=coastline`, `natural=strait`, harbours; retries, a mirror, a generic User-Agent; responses cached, so a re-run is offline). `node tools/build-passes.mjs --cache DIR` (about 4 minutes: the ranking carves and re-measures sailing for every candidate).
- `passes-lab.html`: before / after per pass with the boat drawn to scale, plus "the whole ship batch together".
- `src/passes.test.js`: 10 checks. `node games/windward/src/passes.test.js`.
- Screenshots (390x844) in this folder: `ship-<id>.png`, `eye-<id>.png`, `ship-batch-together.png`.
- **Credit:** the carve shapes derive from OpenStreetMap's coastline, © OpenStreetMap contributors (ODbL 1.0); in both JSON files, the lab page and here.

## Using it (stage 1d)

```js
const world = buildCoastWorld(coast, { skerries });      // src/coast-world.js
const passes = await (await fetch('assets/coast/passes.json')).json();
applyPasses(world, passes);                              // default: the ship tier only
const terrain = createCoastTerrain(world);               // AFTER, so meshes and collision see the carved coast
```

`applyPasses` changes only the world's own arrays: land cells inside a pass polygon become water (deeper toward the
middle, 1.8 to 4 m), land within 12 game m of the new edge is lowered smoothly (a bank that fades into the old ground,
no cliff), the sea's depth map is refreshed (sea colour and shore foam follow), and trees stop where the class goes to
water. Each pass is carved at most once per world, so calling it twice is harmless. About 20 ms for the ship batch.
`{ tiers: ['ship','later'] }` or `{ ids: [...] }` choose others; the **eye** tier is never carved by default.

## How the passes were found

The game's 20 m raster plus smoothing plus the boat's hull (`HULL_RADIUS_M` 2.5 game m = about 50 m real gap) closes real
channels. OSM's coastline is sharp, so it is rasterised at 5 m and compared with what the game allows (`shore.js`
`isBlocked`, the same rule the boat uses). Real water the game blocks is **carvable**. Then, over 44 places (24 OSM
harbours, the named harbours, the villages, Felix's two pins), the best sailing route through carvable water is compared
with the best route today: where it is much shorter, or the only way, the blocked stretch is a pass. 39 stretches.

For each, the carve shape is the **real water of the channel within a corridor** (so the real shape is kept wherever it is
already wide enough) plus a **tube at the boat's minimum width** along the route (widened only at the narrow places). The
tube grows from 60 m until the game's collision lets a boat through end to end, so each width is measured, not assumed.
The ranking is simulated: carve a set, re-measure sailing between all place pairs, add the pass that helps most.

## The first batch to ship: 5 light carves (≤ ×1.7, ≤ 250 m each)

| id | name | real width | length | carved | widened | land to water | sailing saved (combined, all place pairs) | where |
|---|---|---|---|---|---|---|---|---|
| `trindhalet` | near Trindhålet | 59 m | 130 m | 85 m | ×1.4 | 0 m² | 1,489 km | 58.2368, 11.3824 (Vrakevik, Felix's pin) |
| `stockesund-2` | near Stockesund | 66 m | 137 m | 80 m | ×1.2 | 2,400 m² | 986 km | 58.1682, 11.4032 |
| `stangeholme-sund-2` | Stångeholme sund | 62 m | 193 m | 65 m | ×1.0 | 4,400 m² | 798 km | 58.2674, 11.4220 (Stångholmesund harbour) |
| `malo-strommar` | near Malö strömmar | 49 m | 245 m | 85 m | ×1.7 | 8,000 m² | 217 km | 58.1916, 11.4761 (the Malö ferry strait) |
| `vannholmen` | by Vannholmen | 49 m | 128 m | 60 m | ×1.2 | 800 m² | 68 km | 58.1203, 11.4359 |

Together: 15,600 m² (1.6 ha) of land turned to water in a 15 x 24 km region, the whole batch navigable at once. I stopped at
5 and not 8: the 6th to 8th picks save 19, 21 and 11 km, which is noise next to 68 to 1,489. The "km" figure is the sum, over every
pair of the 44 places, of the sailing distance saved (a pair the game cannot join counts as 1,500 steps), so read it as a ranking, not a trip time.
**Optional next three** (all light): `stangeholme-sund` (the other half of the same sound, ×1.5), `kattepannan` (×1.3, 52 km), `trangesund-2` (×1.5, 21 km).

## "Needs Felix's eye": 15 passes widened more than ×2 (not shipped)

Real channels of 15 to 31 m that would be cut to 65 to 85 m. Each has a before / after in `eye-<id>.png`. The worst:
`osoholmesund` (15 m real, 743 m long, ×5.7, 43,600 m²: a ditch across the island next to Grundsund), `osoholmesund-2` and `-3`,
`arsundet-2` (×3.5, 517 m). The rest are short (60 to 140 m) notches: `krakesunds-gap` (**Felix's Kråkholmen pin**, ×4.3: a dead-end
natural harbour, a 140 m notch into the islet), `trangesund`, `gaso-sund-2`, `harmano`, `kattepannan-2`, `stockestrom-2`, `ankerskar-2`
(×4.3 to ×5.7), and `langgaps-hal`, `gaso`, `gaso-2`, `stockestrom-3` (×2.6 to ×3.2).

All 15 are **navigable once carved** (the test proves it); the question is only whether the island still looks right. None is "impossible":
the cost is shape. The ones I would look at first: Kråkholmen (Felix's pin), Långgaps hål (a ×3 notch near Fiskebäckskil),
and Ösöholmesund (Grundsund).

## Candidates: what is open today

73 candidates: 32 open, 36 closed (5 more "partly open"). Of the 29 named sounds in OSM: 9 open, 5 partly open, 15 closed
(Kråkesund, Arsundet, Gåsö sund, Stångeholme sund, Stockeström, Skutloppet and others have a pass; the rest, such as
Trångesund, Smalsund, Tjuvsund, Lilla and Stora Ström, are real channels of 36 to 77 m that no trip between the 44 places needs).
For villages and harbours, "closed" means the raster's nearest sailable water is more than about 80 m from the point (often an
approximate village origin or a quay): that is the later harbour close-up stage (option C), not a pass. Felix's pins: Kråksundsgap (`krakesunds-gap`, eye list) and Vrakevik (`trindhalet`, **ship #1**) are both closed today and both have a pass. Smörasken and Altarholmen are outside the region. The full table is in `pass-candidates.json`.

## Caveats

- Real channels narrower than about 11 m are not detected (the 5 m raster); they would be ×6 or more anyway.
- A pass is carved at a fixed minimum of 60 m real so the boat clears; the width is tuned per pass up to 120 m. The tube hugs the route the search found, which is the middle of the real channel but is smoothed (it can sit a few metres off the true axis in a bend).
- The depth model in the raster is a placeholder; carved water is 1.8 m deep at the edge to 4 m in the middle.
- Verify on the phone: the first batch's carved banks with the terrain style on (`attachTerrainStyle`), and that sail feel through an 80 m sound is not too tight. TODO(felix).
