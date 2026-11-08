# Last session

**2026-11-07 (agent 2, split phase 4 gate 2, branch `felix/windward-bridge` on main f989ca8; pushed, NOT merged): Windward save bridge built and OFF (`REDIRECT_TO` empty, no game has `hidden`), frozen copy `games/windward/frozen.html`; the old Windward behaves as before.** Read `docs/MISSION-CONTROL.md` first; switches in `games/windward/BRIDGE.md`.

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

1. All pre-split work is merged (landmarks lab + data, 1950 templates + generators in games/windward/tools/templates/). `felix/hub-guest-rejoin` waits for Felix's two-phone test.
2. Then the split into `felisiwi/windward` (docs/WINDWARD-SPLIT-PLAN.md; phase 1 prompt in games/windward/docs/prompts/2026-11-07-split-phase1.md), then invite Pierre (pierre/* branches; main and felix/* protected, Felix is on GitHub Pro).
3. After that: the thing-model slice and the quest slice (docs/ALIVE-SEA.md build order), co-op stage 2, sound, chapter 2, the 1703 jump.

## Today's sessions (2026-11-07, condensed)

- Merged to main: Next run (pause + game clock, Britta's light names, downwind errand, light air, Task card); island lore (27 places); co-op stage 2 plan (F1-F9); research corrections; Islandsberg's gable-window light and no beam (`lanternOptions`); weather + sail feel in the game (`docs/WEATHER-IN-GAME.md`; the "blocky sea" was the gust paint, not shader precision); boat variety (`docs/BOATS-BY-ERA.md`, `boats-lab.html`).
- Design grills settled in `docs/ALIVE-SEA.md` (thing model, weather, mini quests + artifacts, logbook, anchoring, day and night); agent prompts in `docs/prompts/`; Windward split plan + kickoff in `docs/WINDWARD-SPLIT-PLAN.md`, `docs/WINDWARD-KICKOFF.md`.
- agent 2, split phase 4 gate 2: `frozen.html`, `src/save-bridge.js` (+ test), switched-off bridge in `index.html`, optional `hidden` flag in `scripts/manifest.js` (+ test), `BRIDGE.md`, `docs/notes/KENNY-WINDWARD-MOVED.md`. Receiving side: windward `felix/save-import`.
