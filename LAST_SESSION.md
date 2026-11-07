# Last session

**2026-11-07 (agent 2, Islandsberg beam): `felix/windward-islandsberg-beam` @ 2f02bd5 (pushed, NOT merged) on main cb9bc0c; 85 test files pass. Main otherwise as mission control left it (weather + sail feel, boat variety, corrections, Islandsberg, island lore, Next run). Open: landmarks (agent 4), templates (agent 3), hub rejoin (needs a two-phone test).** Read `docs/MISSION-CONTROL.md` first.

**State:** chapter 1 in 1950 is MERGED and LIVE (https://coopgames-felisiwis-projects.vercel.app/games/windward/index.html).
Order of play: the opening in the engine (`src/opening-stage.js`: dusk over today's Fiskebäckskil, storm, lighthouse rewind
`rewind.js` landing on Gäven, `dusk.js`) -> dawn on the mainland shore -> the boy, the eka (`beats-1950.js`) -> fittings from
Grundsund -> the yard -> Britta's jetty (`britta-house.js`, her shed = the depot) -> four AGA lights + Måseskär's keeper
(`task-1950.js`; the nearest dark light is the Navigate target) -> report at her jetty -> Svalan relaunched -> the Kråksundsgap
glimpse. Cards are old paper (`paper.js`); "Grandpa" everywhere (`grandpa-text.test.js`). Links: `?opening=1` replays,
`?lights=reset` restarts, `?jump=britta` jumps to Britta (private window), `?year=2015` = the old Today game. All copy is draft
(INVENTED-DIALOGUE / TODO(felix) in `story-1950.js`). Vercel team is on Pro since 2026-11-06; `.vercelignore` drops docs.

Where things are:
- Design: `games/windward/GAME-DESIGN.md` (later sections override), characters `story/characters/`, data `data/`, docs `docs/`
- Boats `src/boats.js`; coast `src/coast-world.js` + `assets/coast/`; world by year `src/world-year*.js` + `data/world-years.json`
- Chart/minimap/rope `src/chart*.js`, `src/minimap.js`, `src/phone.js`; lighthouses `src/lighthouses.js`, `lantern.js`, `relight.js`
- Busy coast `src/busy-*.js`; sound lab `src/sounds-1950.js` (not wired into the game yet)

Open (TODO(felix)): dialogue pass; moor distance, fog radius, shoal radii are first guesses; real-phone GPU unchecked; Bx/B/K
light readings, Stångholmen position, undrawn fyrkurar, 1950 buoy colour, ferry timetable; hub "Connection lost" panel bug.

## Next

1. Felix sails `felix/windward-weather` on his phone (see `games/windward/docs/WEATHER-IN-GAME.md` for the checklist and what is NOT verified: co-op live, real-phone GPU), then merge or adjust. `?weather=0` = the old game for comparison; `?squall=soon` = a test squall in ~60 s; `?debug=1` prints the shader precision (`gpu` line) and the weather line. Agent 1: research corrections (docs/CORRECTIONS-TODO.md). Agent 3: guest rejoin fix (`felix/hub-guest-rejoin`); co-op stage 2 plan on `felix/windward-coop2-plan`.
2. Then: the thing-model slice and the quest slice (docs/ALIVE-SEA.md build order), co-op stage 2 ("visit the host's world", docs/COOP-CHECK.md), then day and night, sound wiring, chapter 2, the 1703 jump.

## Today's sessions

- mission-control handover written (`docs/MISSION-CONTROL.md`).
- stage agent, Next run: batches 0-2 on `felix/windward-next-run` (1020d30); 69 test files pass; no save keys changed. Errand wind covers `errand`+`return`, hands back at `help` (not `free`: the doc was stale).
- stage agent, Task card: in 1950 the Task button now shows what-and-why (`TASK_WHY`, `taskCardLines` in `story-1950.js`, draft copy) before the progress line; 70 test files pass.
- mission control: merged next-run (pause, game clock, light names, errand wind, light air, task card) and island-lore (`data/island-lore.json`, 27 places; `docs/ISLAND-LORE.md`, `ISLAND-ASSETS-BRIEF.md`, `UNIQUE-ARTIFACT-CANDIDATES.md`). Design grills (thing model, weather, mini quests, logbook) in `docs/ALIVE-SEA.md`; agent prompts in `docs/prompts/`.
- mission control: merged the co-op stage 2 plan (`games/windward/docs/COOP-STAGE2-PLAN.md`, decisions F1-F9) and `docs/notes/KENNY-HUB-LAUNCH.md`.
- stage agent, corrections: `felix/windward-corrections` applies docs/CORRECTIONS-TODO.md (data and docs only; ticked off with evidence); 71 test files pass; rewind unaffected (no build year changed). Still open: Islandsberg's 3D model has a ridge lantern.
- mission control: merged the corrections. Still on branches: `felix/hub-guest-rejoin` (needs Felix's two-phone test before merge), `felix/windward-landmarks` (agent 4, in progress), weather into the game (agent 2, in progress).
- agent 1, Islandsberg model: `felix/windward-islandsberg-model` replaces the ridge lantern with a row of five gable windows (`gableWindowLight`, `src/lighthouses.js`); lit/dark via the unchanged glow code; 72 test files pass; game.js untouched.
- mission control: merged the Islandsberg model fix. Follow-up for after the weather merge (game.js): pass beam: false for Islandsberg's window light (it gets the sweeping beam today).
- agent 2, weather in the game (merged): the lab's weather drives the wind on the game clock (co-op: same seed + clock, `wx` rides the host's `wind` message; old guest/host tested); readable swell, soft rare gusts (`src/sea-look.js`; the "blocky sea" was the gust paint, NOT 16-bit precision), speed feel, squalls + `?squall=soon`, mist. Detail: `games/windward/docs/WEATHER-IN-GAME.md`.
- agent 1, boat variety: `felix/windward-boat-variety` gives the busy coast varied, era-correct boats: looks drawn from each boat's seed (`src/boat-looks.js`), new koster / eka (1950) and daysailer / RIB (today) in `src/boat-models.js`, research in `docs/BOATS-BY-ERA.md`, shelf in `boats-lab.html`; game.js untouched; `busy-eras.json` widened (boats capped at 10 m).
- mission control: merged weather (agent 2) and boat variety (agent 1). Still open: landmarks gate 3 (agent 4), 1950 templates (agent 3), Islandsberg beam: false in game.js, rejoin (two-phone test). Then the split (docs/WINDWARD-SPLIT-PLAN.md).
- agent 2, Islandsberg beam: `lanternOptions(name)` (`src/lighthouses.js`) gives `{ beam: false }` to Islandsberg only; used where lanterns are created, `world-year-build.js` (game.js reuses that lantern, so game.js alone would not have worked) and game.js's fallback. Tested on the real 1950 build.
