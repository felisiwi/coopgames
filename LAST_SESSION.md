# Last session

**2026-11-05: Boat Lab** (branch `felix/windward-boat-lab`, on top of origin/main 890b310, NOT merged). New
files only; game.js and src/boat.js untouched. Two boats (koster "Svalan" with 3 rigs to pick by eye, and the
1700 eka) behind boat.js's API: `src/boats.js`, `boat-lab.html`. How to port + what to know:
`games/windward/docs/boat-lab/README.md` (screenshots there too). Stage 1a coast is as before.

Where things are:
- Boats: `src/boats.js` (+ test), `boat-lab.html`, `src/boat-lab.js`, `docs/boat-lab/`, brief `docs/BOAT-BRIEF.md`
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
- Real-coast trial (Pixel: 60 fps at 634k tris) → stage 1a: default coast, collision, skerries, names (COAST-TRIAL.md).
- Boat Lab: koster (gaff+jib / sprit+jib / gaff) and eka, pennant, deck items, night lantern, wear; ~1k tris each.

## Next

0. Felix: open the boat lab on the phone, pick a koster rig, say what to change; then port into game.js (README).
1. Felix: phone check of the preview (`?debug=1`): fps, collision feel, names; judge height x0.5 / smoothing.
2. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`).
3. Stage 1b lure: port arrival, small life, blue-hour sky, edge fog + thunder, names map.
