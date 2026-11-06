# Last session

**2026-11-06: the busy coast, era-driven, after Felix's phone test** (branch `felix/windward-busy-today`, describes `67eddc3`; NOT merged). Ferry (847) now 14 m (1.75 x Svalan,
era data) and docked slightly off its quay in clear water (skips Östersidan); 36 scheduled boats (20 sail: harbour routes, 8 cruising loops, 4 fishing circles) + an ambient pool
(8, local) that always sails past you; era profiles by year over era-neutral geometry (`data/busy-eras.json`, `data/busy-world.json`, `node tools/plan-busy-coast.mjs`); the modern
kit is a placeholder for 1950 and 1980. `?year=`, `?busy=0`, `?night=1`. Fiskebäckskil: 191 -> 160 draw calls. What an era must supply, perf, shots, checklist: `docs/busy-today/README.md`.

Where things are:
- Boats: `src/boats.js`, `boat-lab.html`, `docs/boat-lab/`, `docs/BOAT-BRIEF.md`. Design: `games/windward/GAME-DESIGN.md`, `DESIGN.md`
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`. Lighthouses: `src/lighthouses.js`, `LIGHTHOUSES.md`
- Coast + data: `src/coast-world.js`, `assets/coast/` (SOURCES.md), `data/`, passes `docs/passes/`, seamarks `docs/seamarks/`
- Busy coast: `src/busy-coast.js`, `busy-route.js`, `busy-era.js`, `busy-kits.js`; `docs/busy-today/`
- Chart, minimap, fog, rope: `src/chart*.js`, `src/minimap.js`, `src/phone.js`; the task: `src/lighthouse-task.js`, `relight.js`, `lantern.js`

Open (TODO(felix)): `sun.shadow.normalBias = 0.25` is a guess; real phone GPU unchecked; moor distance (45 m), fog radius (600 m),
shoal radii are first guesses; ddb-restricted population rows need CEDAR OK before commercial use; NMD CC0 wording to confirm; Käringön
harbour-mouth spawn is approximate. Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Windward 1b lure, Boat Lab, 1c chart and its follow-ups: merged (see CHART.md, LURE.md, docs/boat-lab/).
- Passes data and seamarks data: merged (docs/passes/, docs/seamarks/).
- Stage 1d: shoals, marks, passes, the dark-lighthouses task, chapter 1 ending: merged. Era assets + era 1700 data: merged.
- Busy coast (era-driven traffic, ferry, moorings, summer houses): `felix/windward-busy-today`, pushed, not merged.

## Next

1. Felix: phone check of the busy coast (checklist in `docs/busy-today/README.md`); then merge. A 1950s kit is next (what an era supplies is in that README).
2. Confirm the unplaced harbours (`assets/coast/names.json`); Testholmen, Stora Kornö. Then: night navigation (hooks are in), harbour close-ups.
