# Last session

**2026-11-06: Passes (option B)** (branch `felix/windward-passes` on origin/main f57774c, NOT merged). New files only;
game.js and existing src untouched. Real sounds the 1:10 raster closes, carved from OSM's coastline: `assets/coast/passes.json`
(39 passes: **5 ship** = light carves ≤ ×1.7, 19 later, **15 "needs Felix's eye"** = widened > ×2, never carved by default)
and `pass-candidates.json` (73 sounds/harbours/favourites, open or closed today). `src/passes.js` `applyPasses(world, passes)`
(call before meshes/collision; ~20 ms), `src/pass-derive.js`, `tools/build-passes.mjs`, `passes-lab.html` (before/after, boat to
scale). Method, tables, caveats: `games/windward/docs/passes/README.md`. Stage 1d wires it in. Main has stage 1b lure,
Boat Lab (not yet in game.js), real coast (1a).

Where things are:
- Passes: `docs/passes/README.md`, `src/passes.js` (+ test), `passes-lab.html`, `assets/coast/passes.json`
- Boats: `src/boats.js` (+ test), `boat-lab.html`, `docs/boat-lab/`, brief `docs/BOAT-BRIEF.md`
- Design: `games/windward/GAME-DESIGN.md`; look and labs: `DESIGN.md` ("Reference labs")
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`
- Lighthouses: `src/lighthouses.js`, `lighthouse-lab.html`, `LIGHTHOUSES.md`
- Coast + history: `coast-lab.html`, `assets/coast/` (SOURCES.md), `data/`
- Trial: `src/coast-world.js` (window, terrain, trees, villages), `src/debug-overlay.js`

Open (TODO(felix)): `sun.shadow.normalBias = 0.25` is a guess; real phone GPU unchecked; ddb-restricted population rows
need CEDAR OK before commercial use; NMD CC0 wording to confirm; title wording ("Honour and Life") unverified;
Käringön harbour-mouth spawn is approximate; trial vertical scale 0.5 is a guess; pass widths/radii by eye on the phone;
OSM (ODbL) credit wherever pass shapes ship. Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Passes: 39 closed sounds found by trip test, carve shapes tuned to the hull, 5 light ones recommended, 15 heavy ones listed for Felix's eye.

## Next

0. Felix: open `passes-lab.html` on the phone; judge the 5 ship passes and the 15 "eye" before/afters (esp. Kråkholmen pin, Ösöholmesund).
1. Stage 1d: `applyPasses(world, passes)` before `createCoastTerrain`; credit OSM.
2. Felix: phone check of the preview (`?debug=1`), the lure (LURE.md), boat lab (`esail=`).
3. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`).
4. Blue-hour sky, edge fog + thunder, names map; harbour close-ups at near-true scale (option C) later.
