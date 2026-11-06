# Last session

**2026-11-06: stage 1d, the dark lighthouses** (branch `felix/windward-lighthouse-task` from e36b286; describes up to the storm card; NOT merged).
Batch 1, the water tells the truth: passes carved (ship + harbour tiers), real shoals (hard rocks stop the boat, soft ones slow it), the 226 OSM
sea-marks (invented gates look the same; the chart shows them only with ?debug=1), OSM credit. Batch 2, the task: the 5 lights nearest Grundsund
are dark; moor close + slow, the camera circles, the light comes on mid-circle, the fog lifts, "lights 2/5" saved, goal grandma in Fiskebäckskil, end
card. Batch 3, the storm card (once; the Task button on the chart reopens it). Also: skerries that only share a major place's name (the 2 OSM
"Marstrand" skerries) show no name. Details, numbers, screenshots: `games/windward/docs/LIGHTHOUSE-TASK.md`. 1c (CHART.md), passes and seamarks
data are merged to main. Harbour approaches (Grundsund through-channel) are on felix/windward-harbour-approaches.

Where things are:
- Boats: `src/boats.js`, `boat-lab.html`, `docs/boat-lab/`, `docs/BOAT-BRIEF.md`. Design: `games/windward/GAME-DESIGN.md`, `DESIGN.md`
- Look: `src/water.js`, `src/depthmap.js`, `src/island-look.js`, `src/config.js`. Lighthouses: `src/lighthouses.js`, `LIGHTHOUSES.md`
- Coast + data: `src/coast-world.js`, `assets/coast/` (SOURCES.md), `data/`, passes `docs/passes/`, seamarks `docs/seamarks/`
- Chart, minimap, fog, rope: `src/chart*.js`, `src/minimap.js`, `src/phone.js`; the task: `src/lighthouse-task.js`, `relight.js`, `lantern.js`

Open (TODO(felix)): `sun.shadow.normalBias = 0.25` is a guess; real phone GPU unchecked; moor distance (45 m), fog radius (600 m),
shoal radii are first guesses; ddb-restricted population rows need CEDAR OK before commercial use; NMD CC0 wording to confirm; Käringön
harbour-mouth spawn is approximate. Hub bug from the audit, not fixed: "Connection lost" panel sits in hidden `#lobby`.

## Today's sessions

- Windward 1b lure, Boat Lab, 1c chart and its follow-ups: merged (see CHART.md, LURE.md, docs/boat-lab/).
- Passes data and seamarks data: merged (docs/passes/, docs/seamarks/).
- Stage 1d (this branch): shoals, marks, passes wired in, the dark-lighthouses task, the storm card, the Marstrand name fix.

## Next

1. Felix: phone check of 1d (checklist in the report and LIGHTHOUSE-TASK.md); then merge 1d.
2. Confirm the unplaced harbours (`assets/coast/names.json`); Testholmen, Stora Kornö. Then: night navigation (hooks are in), harbour close-ups.
