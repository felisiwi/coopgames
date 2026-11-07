# Last session

**2026-11-07 (mission control): `felix/windward-next-run` and `felix/windward-island-lore` are MERGED into main; 70 test files pass.** Read `docs/MISSION-CONTROL.md` first.

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

1. Agent 2: weather and sail feel into the game (docs/prompts/2026-11-07-weather-into-game.md; the lab is on `felix/windward-sail-feel-lab`). Agent 1: research corrections (docs/CORRECTIONS-TODO.md). Agent 3: guest rejoin fix (`felix/hub-guest-rejoin`); co-op stage 2 plan on `felix/windward-coop2-plan`.
2. Then: the thing-model slice and the quest slice (docs/ALIVE-SEA.md build order), co-op stage 2 ("visit the host's world", docs/COOP-CHECK.md), then day and night, sound wiring, chapter 2, the 1703 jump.

## Today's sessions

- mission-control handover written (`docs/MISSION-CONTROL.md`).
- stage agent, Next run: batches 0-2 on `felix/windward-next-run` (1020d30); 69 test files pass; no save keys changed. Errand wind covers `errand`+`return`, hands back at `help` (not `free`: the doc was stale).
- stage agent, Task card: in 1950 the Task button now shows what-and-why (`TASK_WHY`, `taskCardLines` in `story-1950.js`, draft copy) before the progress line; 70 test files pass.
- mission control: merged next-run (pause, game clock, light names, errand wind, light air, task card) and island-lore (`data/island-lore.json`, 27 places; `docs/ISLAND-LORE.md`, `ISLAND-ASSETS-BRIEF.md`, `UNIQUE-ARTIFACT-CANDIDATES.md`). Design grills (thing model, weather, mini quests, logbook) in `docs/ALIVE-SEA.md`; agent prompts in `docs/prompts/`.
- mission control: merged the co-op stage 2 plan (`games/windward/docs/COOP-STAGE2-PLAN.md`, decisions F1-F9) and `docs/notes/KENNY-HUB-LAUNCH.md`.
