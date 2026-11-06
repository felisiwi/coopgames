# Last session

**2026-11-06: Windward stage 1e, chapter 1 in 1950, REVISED plan** (branch `felix/windward-chapter1-1950`, describes `7cdac9b`; pushed, NOT merged). Done: batch 1 world adapter;
**2b the opening in the engine** (`src/opening-stage.js`, `rewind.js` lands on Gäven at 1950, `dusk.js`, `opening-site.js`; dawn on the mainland shore) with Felix's fixes (sky, no labels,
new lines, strike then dark); **paper cards everywhere** (`src/paper.js`); **2c the first beats** (`src/beats-1950.js`, copy in `story-1950.js`: the boy, the eka, Grundsund fittings,
back at the yard, then Fiskebäckskil). TO DO: **batch 3** the task on the revised story: Britta ~17 in Fiskebäckskil (father's broken arm), her family's shed = the depot (replaces
Lysekil), four AGA lights + Måseskär's keeper, the Kråksundsgap glimpse, Svalan relaunched, report at her house (= the opening's house, `opening-site.js`). The first batch-3 build is
in the code but DORMANT (`JOB_1950_LIVE = false` in game.js) and its cards are pre-revision. `?opening=1` replays, `?lights=reset` restarts. All copy is draft (TODO(felix)).

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

1. Felix: phone check of the opening and the beats (batch 2c report); then batch 3 (the task, revised).
2. Open data TODOs: Bx/B/K light readings, Stångholmen position, the four undrawn fyrkurar, 1950 buoy colour, ferry timetable. Then: night navigation, harbour close-ups.
