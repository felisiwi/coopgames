# Last session

**2026-11-06: stage 1d, the dark lighthouses + chapter 1 ending** (branch `felix/windward-lighthouse-task`; describes the Batch B commit; NOT merged).
Batch 1 water (passes, shoals, 226 OSM marks, credit), Batch 2 the task (5 dark lights nearest Grundsund: moor, circle, light on, fog lifts, saved), Batch 3 storm
card, naming fix, Batch A (sail-home card; arrival = entering Fiskebäckskil's harbour; no card blur + render paused under cards). Batch B, the lights speak: relit
lights show their real flash pattern as a glyph + chimes and go in a light log (chart "Lights" button); grandma's dusk card gives granddad's sea chest (Svalan's
chest slot, saved); his chart adds 8 favourites + the strange mark; near Måseskär's old tower (dark since 1978) a faint flash, a bell, fog, "But you saw it."
(its pattern is INVENTED, flagged). Details, citations, screenshots: `games/windward/docs/LIGHTHOUSE-TASK.md`. 1c, passes, seamarks, harbours are on main.

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
- Stage 1d (this branch): shoals, marks, passes, the dark-lighthouses task, storm card, Marstrand fix, Batch A fixes, Batch B (chapter 1 ending).

## Next

1. Felix: phone check of 1d (checklist in the report); sound unheard; Måseskär framing; confirm the invented pattern; `?lights=reset` replays chapter 1; then merge 1d.
2. Confirm the unplaced harbours (`assets/coast/names.json`); Testholmen, Stora Kornö. Then: night navigation (hooks are in), harbour close-ups.
