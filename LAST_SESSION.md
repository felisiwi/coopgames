# Last session

**2026-11-06: Harbour approaches** (branch `felix/windward-harbour-approaches` on origin/main 4f840b6, NOT merged). New files plus
passes data; `shore.js` untouched (Felix: no oriented hull, no smaller circle: narrow water is the close-ups' job). Audit of all 49
harbours / villages (the arrival's name list + every OSM harbour / marina + Felix's pins): can the boat's centre get within 60 m of the
quay water from open sea? 33 open, 16 blocked and carved as tier `harbour` in `assets/coast/passes.json` (default `applyPasses` tiers are
now ship + harbour). Rule: reach each harbour BASIN; narrow inner channels stay closed (Grundsund's canal through the village; its south
basin is carved from the south-west entrance along the real channel's curves, 60 m wide, x6). `harbour-audit.json`, `src/harbour-approach.js` (+ test),
`tools/build-harbours.mjs`, `harbours-lab.html`, `docs/harbours/README.md` (numbers, the oriented-hull study, 49 screenshots).
Existing files touched: `passes.js` (tier list, default tiers), `passes.test.js`, `passes-lab.html`. Main also has 1c (chart, minimap,
Svalan, rope) and the passes data (ship tier: 5 light carves); applyPasses is not wired into the game yet (stage 1d).

Where things are:
- Harbours: `docs/harbours/README.md`, `harbours-lab.html`, `src/harbour-approach.js`, `assets/coast/harbour-audit.json`
- Passes: `docs/passes/README.md`, `src/passes.js`, `passes-lab.html`, `assets/coast/passes.json`
- Boats: `src/boats.js` (+ test), `boat-lab.html`, `docs/boat-lab/`, brief `docs/BOAT-BRIEF.md`
- Design: `games/windward/GAME-DESIGN.md`; look and labs: `DESIGN.md` ("Reference labs")
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`
- Coast + history: `coast-lab.html`, `assets/coast/` (SOURCES.md), `data/`; chart + minimap: `docs/CHART.md`
- Lighthouses: `src/lighthouses.js`, `lighthouse-lab.html`, `LIGHTHOUSES.md`; trial: `src/coast-world.js`

Open (TODO(felix)): the two big carves by eye on the phone (Grundsund south basin x6, Härmanö x3.5); real phone GPU unchecked;
`sun.shadow.normalBias = 0.25` is a guess; ddb-restricted population rows need CEDAR OK before commercial use; NMD CC0 wording to
confirm; Käringön harbour-mouth spawn is approximate. Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Windward 1b/1c merged (lure, chart, minimap, Svalan, rope); Boat Lab; real coast; lighthouses; look passes (see git).
- Passes data merged: 5 light carves ship tier; 15 heavy ones on the "needs Felix's eye" list.
- Seamarks data + stage 1d kit (branch felix/windward-seamarks, not merged).
- Harbour approaches (this branch): audit of 49 harbours, 16 carved, Grundsund south basin, collision-shape study (no change).

## Next

1. Felix: open `harbours-lab.html` on the phone (Grundsund south basin first); judge the x6.5 and x3.5 carves.
2. Stage 1d: `applyPasses(world, passes)` (ship + harbour) before `createCoastTerrain`; OSM credit; seamarks + shoals.
3. Close-ups (later): the Grundsund canal, through-routes (Usholmen, Porsholmen, Danholmen, Stångholmesund), finer collision.
