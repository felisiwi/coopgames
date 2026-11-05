# Last session

**2026-11-05: stage 1b, the lure** (branch `felix/windward-lure`, based on 43d1565, NOT merged). Harbour arrival
(bell, wave, fish on deck), small life, descriptive names before discovery, "places named N" HUD, solo-dev line
only with `?debug=1`. `?lure=0` = off. Label fixes after the phone test: LURE.md. Details, sources, numbers: `games/windward/docs/LURE.md`.

Before that: 2026-11-05: stage 1a, real-coast foundation** (branch `felix/windward-coast-trial`, origin/main merged in,
NOT merged to main). The real coast is the DEFAULT; `?coast=proc` = old islands. Region 58.085-58.30 N,
11.25-11.50 E, start at Grundsund harbour, shore collision, 315 skerries, discovered names (localStorage),
`?debug=1` overlay. Numbers + what is left: `games/windward/docs/COAST-TRIAL.md` ("Stage 1a").
`main` still uses procedural islands until Felix merges.

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
- Stage 1b lure (this branch): arrival, life, descriptive names (LURE.md).
- Real-coast trial (Pixel: 60 fps at 634k tris) → stage 1a: default coast, collision, skerries, names (COAST-TRIAL.md).

## Next

1. Felix: phone check of the preview (`?debug=1`): fps, collision feel, names; judge height x0.5 / smoothing.
2. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`).
3. Felix: try the lure on the phone (LURE.md); confirm Testholmen, Stångehuvud/Islandsberg, Stora Kornö.
4. Next: blue-hour sky, edge fog + thunder, names map.
