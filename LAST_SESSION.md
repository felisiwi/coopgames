# Last session

**2026-11-06: stage 1c and the passes data are MERGED to main.** 1c: chart + fog, minimap (round, north-up),
zoom-to-chart, terrain look, Svalan in game, rope A, knots/nm, Navigate here (docs/CHART.md). Follow-up also merged:
north-up camera (azimuth 0, sun 30), minimap tap opens chart, round block rope, no settings button. Passes: assets/coast/passes.json + src/passes.js (applyPasses, ship tier = 5 light carves), not wired into
the game yet (docs/passes/README.md). Seamarks merged too (assets/coast/seamarks.json, shoals.json, src/seamark-meshes.js, seamarks-lab.html);
both feed stage 1d. Harbour approaches (Grundsund through-channel) in progress on felix/windward-harbour-approaches.

**2026-11-05: stage 1c, the chart and the new look** (branch `felix/windward-chart`, based on aa4bdc0 + the terrain-style
branch, NOT merged). New terrain look (crisp zones, granite on steep ground, trees keep off it), Svalan in the game (`?boat=eka`
for the eka), zoom out 4x then a scale-matched crossfade into the chart, minimap (round, north-up, fixed), fogged chart
of the 7 sections (fog saved on the device), lighthouses on chart + minimap with a visit view (`?debug=1` adds "Jump here").
Numbers, decisions, phone checklist: `games/windward/docs/CHART.md`. Before that: 1b (lure) and the Boat Lab merged to main.

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
- Stage 1b lure: arrival, life, descriptive names (LURE.md), merged.
- Real-coast trial (Pixel: 60 fps at 634k tris) → stage 1a: default coast, collision, skerries, names (COAST-TRIAL.md).
- Boat Lab: koster (gaff+jib / sprit+jib / gaff) and eka, pennant, deck items, night lantern, wear; ~1k tris each.
- Boat Lab revision 1 (Felix's picks): gaff + jib only, slimmer koster, eka sail tones, name board removed.
- Stage 1c (this branch): terrain style, boats.js, zoom -> chart, minimap, fog, lighthouse visits (CHART.md).
- 1c revision (2026-11-06, phone test): boat arrow, blank uncharted sections, fog-gated + quiet names, Navigate here, trimmed glow, seams. Rope control (option A) built.

## Next

1. Felix: phone check of the 1c revision incl. the rope (CHART.md); then merge 1c.
2. Confirm the 7 unplaced harbours (candidates in `assets/coast/names.json`); Testholmen, Stora Kornö.
3. Then: merge 1c; blue-hour sky, edge fog + thunder; the jump to ~1700 (the eka exists behind `?boat=eka`).
