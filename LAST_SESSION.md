# Last session

**2026-11-05: big merge to `main`** (mission control, for Felix). Merged:
PR #3 design-audit, PR #4 3m facets, PR #5 ART.md split style (facet target
kept at 3m), `felix/windward-look` (Skagen look default, `?tune=1`, pond fix),
`felix/windward-lighthouses` (29 towers, Play time-lapse, flash patterns),
`felix/windward-real-coast` (Gottskär–Koster coast data, villages, population,
history, coast-lab = map + timeline), `felix/game-design` (GAME-DESIGN.md
confirmed: "Shared understanding (CONFIRMED)" wins over older sections) and
`felix/epoch-timeline` (`data/epochs.json`, ref/epoch-timeline.html).
The real coast is still lab-only; the game uses procedural islands.

Where things are:
- Design: `games/windward/GAME-DESIGN.md`; look and labs: `DESIGN.md` ("Reference labs")
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`
- Lighthouses: `src/lighthouses.js`, `lighthouse-lab.html`, `LIGHTHOUSES.md`
- Coast + history: `coast-lab.html`, `assets/coast/` (SOURCES.md), `data/`
  (epochs.json + epochs-factcheck.md, settlements-history.json,
  history-start-area.md)

Open (TODO(felix)): `sun.shadow.normalBias = 0.25` is a guess; real phone GPU
unchecked; ddb-restricted population rows need CEDAR OK before commercial use;
NMD CC0 wording to confirm; title wording ("Honour and Life") unverified.
Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Windward: phone controls, new boat, wave-wobble fix, 3m facets (earlier merge).
- Look: L1 port → Skagen palette (pass 2) → Skagen default + pond fix (pass 3).
- Lighthouses: 12 → 29 towers, real looks, year slider, Play, flash patterns.
- Real coast: R0 → passes 2–5 (Gottskär, Koster, population, west-Orust history,
  combined map + timeline, epochs fact-check).
- Game design: /grill-me rounds 1–11, shared understanding confirmed.

## Next

1. Real-coast trial in the game (west Orust window behind a flag; phone perf).
2. Stage 1 lure: port/house arrival + deck items, small life, blue-hour sky and
   day-night, edge fog + thunder warning (GAME-DESIGN.md "Build first").
3. Worktrees on Felix's laptop can be removed now: coopgames-windward-look,
   coopgames-lighthouses, coopgames-windward-real-coast, coopgames-art-split.
