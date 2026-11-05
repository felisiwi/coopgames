# Last session

**2026-11-05: real-coast trial** (branch `felix/windward-coast-trial`, on `origin/main` e1812c7,
NOT merged). Spike behind `?coast=real&debug=1`: Käringön-to-Grundsund window (1118 x 1838 m at 1:10) in the
real game, with a perf overlay. Results + recommendation: `games/windward/docs/COAST-TRIAL.md`.
Felix reads the overlay on a real phone next. Earlier today: big merge to `main` (look, lighthouses,
real-coast data, game design confirmed, epochs); the game on `main` still uses procedural islands.

Where things are:
- Design: `games/windward/GAME-DESIGN.md`; look and labs: `DESIGN.md` ("Reference labs")
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`
- Lighthouses: `src/lighthouses.js`, `lighthouse-lab.html`, `LIGHTHOUSES.md`
- Coast + history: `coast-lab.html`, `assets/coast/` (SOURCES.md), `data/`
- Trial: `src/coast-world.js` (window, terrain, trees, villages), `src/debug-overlay.js`

Open (TODO(felix)): `sun.shadow.normalBias = 0.25` is a guess; real phone GPU
unchecked; ddb-restricted population rows need CEDAR OK before commercial use;
NMD CC0 wording to confirm; title wording ("Honour and Life") unverified;
Käringön harbour-mouth spawn is approximate; trial vertical scale 0.5 is a guess.
Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Windward: phone controls, new boat, wave-wobble fix, 3m facets (earlier merge).
- Look: L1 port → Skagen palette (pass 2) → Skagen default + pond fix (pass 3).
- Lighthouses: 12 → 29 towers, real looks, year slider, Play, flash patterns; game design /grill-me rounds 1–11 confirmed.
- Real coast: R0 → passes 2–5 (Gottskär, Koster, population, west-Orust history, combined map + timeline).
- Real-coast trial: west Orust in the game behind a flag, measured (see COAST-TRIAL.md).

## Next

1. Felix: open the branch preview on a phone with `?coast=real&debug=1`, read the overlay.
2. Decide: stage 1 on the real coast (needs window-cropped data, skerries, collision) or procedural.
3. Stage 1 lure: port/house arrival + deck items, small life, blue-hour sky, edge fog + thunder.
