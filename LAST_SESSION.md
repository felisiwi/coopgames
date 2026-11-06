# Last session

**2026-11-06: Seamarks data + stage 1d kit** (branch `felix/windward-seamarks` on origin/main 8734bd5, NOT merged).
New files only; game.js and existing src untouched. Real OSM shallows (`shoals.json`, 292) and sea-marks
(`seamarks.json`: 206 real + 20 INVENTED harbour-mouth gate marks, `invented: true`, look the same in game, flagged
only in chart/debug). Kit for 1d: `src/seamark-meshes.js` (buoys/beacons/lights, real rhythms, emissive only),
`src/seamark-place.js` (+ tools/invent-harbour-marks.mjs), `src/shoal-look.js` (look + collision). Lab:
`seamarks-lab.html` Map + 3D. Details, API and gaps: `docs/seamarks/README.md`. Credit OSM (ODbL) wherever shown.

Where things are:
- Seamarks: `assets/coast/shoals.json`, `seamarks.json`, `seamarks-lab.html`, `docs/seamarks/README.md`; kit `src/seamark-meshes.js`, `seamark-place.js`, `shoal-look.js`
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
- Seamarks kit: mark meshes + light rhythms, 10 invented harbour gates, shoal look/collision, 3D lab (this branch).

## Next

0. Felix: open `seamarks-lab.html?view=3d` on the phone (Fiskebäckskil, Käringön); judge the gates, shoal radii, night visibility.
1. Stage 1d: render marks + shoals in game from the kit (README "Stage 1d kit"); show the OSM credit.
2. Felix: phone check of the preview (`?debug=1`): fps, collision feel, names; try the lure (LURE.md).
3. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`).
4. Port Boat Lab + terrain look into game.js (stage 1c); blue-hour sky, edge fog + thunder.
