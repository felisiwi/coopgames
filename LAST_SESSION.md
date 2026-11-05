# Last session

**2026-11-05: stage 1b (lure) and the Boat Lab are MERGED to main.** Stage 1b: harbour arrival (bell, wave,
fish on deck), small life, descriptive names before discovery, label layout fixes; `?lure=0` = off; details in
`games/windward/docs/LURE.md`. Boat Lab: `src/boats.js` + `boat-lab.html`, Felix's picks as defaults (Svalan gaff +
jib, all deck items, wear 0.8, no name board); eka sail tone chosen = rust (`esail=rust`); not yet used by game.js,
porting in stage 1c (`docs/boat-lab/README.md`). Terrain look chosen (GAME-DESIGN.md), branch
felix/windward-terrain-style not merged, ported in 1c. Stage 1a real coast is the default on main.

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
- Stage 1b lure (this branch): arrival, life, descriptive names (LURE.md).
- Real-coast trial (Pixel: 60 fps at 634k tris) → stage 1a: default coast, collision, skerries, names (COAST-TRIAL.md).
- Boat Lab: koster (gaff+jib / sprit+jib / gaff) and eka, pennant, deck items, night lantern, wear; ~1k tris each.
- Boat Lab revision 1 (Felix's picks): gaff + jib only, slimmer koster with sharp stems + rudder, readable gaff, eka sail tones, name board removed.

## Next

0. Felix: open the boat lab on the phone, pick an eka sail tone (esail=), say what to change; then port into game.js (README).
1. Felix: phone check of the preview (`?debug=1`): fps, collision feel, names; judge height x0.5 / smoothing.
2. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`).
3. Felix: try the lure on the phone (LURE.md); confirm Testholmen, Stångehuvud/Islandsberg, Stora Kornö.
4. Next: blue-hour sky, edge fog + thunder, names map.
