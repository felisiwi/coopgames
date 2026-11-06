# Last session

**2026-11-06: Windward stage 1e, chapter 1 in 1950** (branch `felix/windward-chapter1-1950`, describes `ec4092c`; pushed, NOT merged). The game builds from `worldAtYear(1950)` (default year 1950;
`?year=2015` is the Today game, untouched, own save keys). Batch 1 world adapter + 1950 kit; batch 2 opening (SVG, once), waking on Skaftö, borrowed eka, Britta; batch 3
(`src/task-1950.js`): gas at the Lysekil quay -> relight Hättan, Gäven, Stångholmen, Fredagsholmen -> post to the unnamed Måseskär keeper -> Britta ("the lights talk") ->
Svalan relaunched, you switch eka -> koster -> Kråksundsgap Södra glimpse (small iron lantern becomes the 1954 tower, then gone). Wreck is on Skaftö's mainland shore
(`src/wake-plan.js`). All story copy: `src/story-1950.js`, invented lines marked INVENTED-DIALOGUE / TODO(felix). `?lights=reset` restarts the job; `?opening=1` replays the opening.

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

1. Felix: phone check of 1950 (checklist in the batch 3 report); decide the TODO(felix) copy and the open choices (night for the glimpse, depot/post, year on cards); then merge.
2. Open data TODOs: Bx/B/K light readings, Stångholmen position, the four undrawn fyrkurar, 1950 buoy colour, ferry timetable. Then: night navigation, harbour close-ups.
