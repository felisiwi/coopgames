# Last session

**2026-11-06: Seamarks data** (branch `felix/windward-seamarks` on origin/main 8734bd5, NOT merged). New files
only: real OSM shallows (`assets/coast/shoals.json`, 292) and sea-marks (`seamarks.json`, 206 marks + 12 leading
lines + 24 harbours) for the region, built by `tools/fetch-seamarks.mjs`; check page `seamarks-lab.html`; test
`src/seamarks.test.js`; findings, gaps and the 1d fill-in recommendation in `docs/seamarks/README.md`. Stage 1d
reads these; game.js untouched. Main already has: stage 1b lure, Boat Lab (not yet in game.js), real coast (1a).

Where things are:
- Seamarks: `assets/coast/shoals.json`, `seamarks.json`, `seamarks-lab.html`, `docs/seamarks/README.md`
- Boats: `src/boats.js` (+ test), `boat-lab.html`, `docs/boat-lab/`, brief `docs/BOAT-BRIEF.md`
- Design: `games/windward/GAME-DESIGN.md`; look and labs: `DESIGN.md` ("Reference labs")
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`
- Lighthouses: `src/lighthouses.js`, `lighthouse-lab.html`, `LIGHTHOUSES.md`
- Coast + history: `coast-lab.html`, `assets/coast/` (SOURCES.md), `data/`
- Trial: `src/coast-world.js` (window, terrain, trees, villages), `src/debug-overlay.js`
- Lure (1b): `docs/LURE.md`

Open (TODO(felix)): `sun.shadow.normalBias = 0.25` is a guess; real phone GPU
unchecked; ddb-restricted population rows need CEDAR OK before commercial use;
NMD CC0 wording to confirm; title wording ("Honour and Life") unverified;
Käringön harbour-mouth spawn is approximate; trial vertical scale 0.5 is a guess;
OSM (ODbL) credit needed wherever the marks ship; OSM has no depths for shoals.
Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Seamarks data: OSM shoals + marks + leading lines, lab page, test, gap report (this branch).

## Next

0. Felix: open `seamarks-lab.html` (Grundsund / Fiskebäckskil / Käringön), decide how 1d fills the gaps (README).
1. Stage 1d: render marks + shoals in game; generated leading marks at harbour mouths, flagged `invented`.
2. Felix: phone check of the preview (`?debug=1`): fps, collision feel, names; try the lure (LURE.md).
3. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`).
4. Port Boat Lab + terrain look into game.js (stage 1c); blue-hour sky, edge fog + thunder.
