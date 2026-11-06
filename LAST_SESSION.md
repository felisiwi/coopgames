# Last session

**2026-11-06: Windward stage 1e, chapter 1 in 1950, REVISED plan** (branch `felix/windward-chapter1-1950`, describes `ff2d3f1`; pushed, NOT merged). Plan changed after Felix's
phone test (GAME-DESIGN.md "Opening and chapter 1 story, revised"). Done: batch 1 world adapter; **batch 2b the opening in the engine** (`src/opening-stage.js`: dusk over today's
Fiskebäckskil, storm, lighthouse rewind `src/rewind.js`, looks `src/dusk.js`, site `src/opening-site.js`; then dawn on the 1950 mainland shore); the SVG opening is deleted.
STILL TO DO under the revised plan: **2c** the first story beats (the boy; errand to Grundsund for parts; "someone in Fiskebäckskil was asking for help") replacing today's wake
cards in `src/story-1950.js`; **3** the task redone (an earlier batch-3 build, `f452ffe`, is in the history but its story is superseded: Britta ~17, her house = the opening's house,
depot = her family's shed instead of Lysekil, report back at her house). `?opening=1` replays, `?lights=reset` restarts. All copy is draft (TODO(felix)).

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
- Busy coast: merged. Stage 1e chapter 1 in 1950 (batches 1-3): `felix/windward-chapter1-1950`, pushed, not merged.

## Next

1. Felix: phone check of the opening (batch 2b report); then batch 2c (story beats) and batch 3 (the task, revised).
2. Open data TODOs: Bx/B/K light readings, Stångholmen position, the four undrawn fyrkurar, 1950 buoy colour, ferry timetable. Then: night navigation, harbour close-ups.
