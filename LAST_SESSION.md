# Last session

**2026-11-06: Windward stage 1e, chapter 1 in 1950, REVISED plan: all three batches built** (branch `felix/windward-chapter1-1950`, describes the commit this file is in; pushed, NOT merged).
The game builds from `worldAtYear(1950)` (`?year=2015` is Today, untouched). Order of play: the opening in the engine (`src/opening-stage.js`: dusk over today's Fiskebäckskil, storm, lighthouse
rewind `rewind.js` landing on Gäven, `dusk.js`) -> dawn on the mainland shore -> the boy, the eka (`beats-1950.js`) -> fittings from Grundsund -> the yard -> Britta's jetty (`britta-house.js`,
her shed = the depot) -> four AGA lights + Måseskär's keeper (`task-1950.js`) -> the Kråksundsgap glimpse -> report at her jetty -> Svalan relaunched. Cards are old paper (`paper.js`);
"Grandpa" everywhere (`grandpa-text.test.js`). `?opening=1` replays, `?lights=reset` restarts. All copy is draft: every spoken line is INVENTED-DIALOGUE / TODO(felix) in `story-1950.js`.

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

1. Felix: phone check of the whole chapter (batch 3 report); settle the draft copy and the open choices; then merge.
2. Open data TODOs: Bx/B/K light readings, Stångholmen position, the four undrawn fyrkurar, 1950 buoy colour, ferry timetable. Then: night navigation, harbour close-ups.
