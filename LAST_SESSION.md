# Last session

**2026-11-07, describes `felix/windward-next-run` @ e3e231c + the Task-card commit (pushed, NOT merged; main = d5e54e2). Felix phone-tested pause and ?jump=britta: both work.** Mission control: read `docs/MISSION-CONTROL.md` first, then merge the branch.

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

1. Merge `felix/windward-next-run` (Next run is built there: pause card + `src/game-clock.js`, Britta's four lights by name, `src/errand-wind.js`, light air in `sail.js`); Felix's phone checklist is in the stage report.
2. Co-op stage 2 ("visit the host's world", docs/COOP-CHECK.md), then day and night, sound wiring, chapter 2, the 1703 jump.

## Today's sessions

- mission-control handover written (`docs/MISSION-CONTROL.md`).
- stage agent, Next run: batches 0-2 on `felix/windward-next-run` (1020d30); 69 test files pass; no save keys changed. Errand wind covers `errand`+`return`, hands back at `help` (not `free`: the doc was stale).
- stage agent, Task card: in 1950 the Task button now shows what-and-why (`TASK_WHY`, `taskCardLines` in `story-1950.js`, draft copy) before the progress line; 70 test files pass.
