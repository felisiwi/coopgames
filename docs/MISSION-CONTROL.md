# Mission Control: handover

Read this first if you are the mission-control chat for `coopgames` (a claude.ai chat that plans,
reviews and merges; terminal Claude Code agents on Felix's Mac do the building). Last full rewrite:
2026-11-07, after the long Windward mission-control chat (2026-11-05 to 11-07). Handover docs are
fallible: verify on disk (`git log`, tests, the live URL) before trusting any line here.

## 1. The state today (2026-11-07)

- **Game:** Windward, Felix's cosy sailing game on the real Bohuslän coast (`games/windward/`).
  The hub's other games (Archipelago = obsolete predecessor, Kenny's Dino Rumble, Will it fit) are
  out of scope unless Felix says otherwise.
- **Live (production, share this one):** https://coopgames-felisiwis-projects.vercel.app/games/windward/index.html
  (also aliased as `coopgames-murex.vercel.app`). Auto-deploys every push to `main`.
- **Vercel:** Felix upgraded the team "felisiwi's projects" (all his projects) to **Pro** on
  2026-11-06 after we hit the Hobby limit of 100 deployments/day. `.vercelignore` keeps
  `games/*/docs/` out of deployments (they were 46 MB of screenshots per deploy).
- **What is playable (chapter 1, in 1950):** opening in the engine (dusk over today's
  Fiskebäckskil, fog, storm, the **lighthouse rewind** from 2026 to 1950 landing on Gäven) → dawn on
  Skaftö's mainland shore with battered Svalan → **the boy** (young Grandpa, a boatbuilder's son)
  lends you an eka → fittings from Grundsund → back at the yard → **Britta** (about 17) at her
  jetty in Fiskebäckskil (the house from the opening; her father tends the lights and broke his
  arm) → four **AGA gas lights** (Hättan, Gäven, Stångholmen, Fredagsholmen) + post to **Måseskär's
  keeper** → report at Britta's → **Svalan relaunched** → the **Kråksundsgap glimpse** (the small
  1941 lantern becomes its 1954 tower for a moment). Paper-style cards, one speaker per card.
- **Underneath:** real coast at 1:10 (`src/coast-world.js`, `assets/coast/`), chart + fog + minimap
  (round, north-up; tap opens chart), north-up camera, terrain style, Svalan/eka boats, rope trim
  control, knots + nautical miles, shoals, real OSM sea marks (+ invented harbour gates), 5 passes
  + 16 harbour approaches carved, busy era-driven traffic + ferry, the **world-years system**
  (`worldAtYear(year)`, rows in `data/world-years.json` for 1700 / 1950 / today; `?year=2015` gives
  the old Today game), research data for 1700 and 1950, a synthesised 1950 sound lab (not yet wired).
- **Tests:** 65 node test files in `games/windward/src/` on `main` (recounted 2026-11-07; there is no `test/` folder; 69 on `felix/windward-next-run`), all passing. Run: `cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done`.

## 2. Where the truth lives (read in this order)

1. `games/windward/GAME-DESIGN.md`: the design, appended over time. **Later sections override
   earlier ones.** Most current: "The flow, revised: wake in 1950", "Opening and chapter 1 story,
   revised", the "Correction and decision" notes, "Decisions (… late afternoon)", "Next run".
2. `LAST_SESSION.md` (repo root): the state pointer the last agent/mission control left.
3. `games/windward/story/characters/`: `britta-1950.md`, `britta-today.md`, `torhild-1700.md`.
4. `games/windward/data/`: `epochs.json` (epochs, eras, markers: 1703 first big jump, 1950 home
   base, 2026 finale), `world-1700.json`, `world-1950.json`, `people-1700.json`, `people-1950.json`,
   `world-years.json`.
5. `games/windward/docs/`: per-stage reports and research (CHART, LURE, LIGHTHOUSE-TASK, WORLD-1700/1950,
   PEOPLE-1700/1950, SOUND-1950, COOP-CHECK, BOAT-BRIEF, passes/, seamarks/, harbours/, era-assets/…).
   `games/windward/docs/ALIVE-SEA.md`: the alive-sea ideas plus the settled thing-model and weather grills.
6. `AGENTS.md`, `docs/COLLABORATION.md`, `games/README.md`: hub contract and rules (Kenny shares the repo).

## 3. The story canon (short)

- **Frame:** a ~30 s opening today → you wake in **1950** (home base, chapters 1–2) → first big jump
  to **late 1703** (echo of the November 1703 North Sea storm) → later eras → **finale today**: old
  Britta opens the door, "I've been waiting for you since 1950"; maybe Grandpa alive because you
  changed history (kept the lights burning).
- **People:** Britta (b. ~1933; 17 in 1950, ~93 today; your grandma). The boy = young Grandpa
  (unnamed so far), boatbuilder's son; **you are why your grandparents meet** (he sends you to her).
  Torhild, the pilot's daughter around 1703, lives by **Lysekil** (the area's only recorded pilot
  station). Måseskär's keeper: invented, unnamed (never use real people's names).
- **Svalan's loop:** Grandpa's koster washes up in 1950, the boy's family repairs her, she becomes
  "Grandpa's boat" that you inherit today. Clinker-built: riveted, not caulked.
- **Lighthouses are the clock and the code:** real flash patterns as glyphs (light log), the sun
  valve, the rewind, the glimpse of a light's future self. Later: night navigation by lights.
- **"Grandpa"** everywhere (not "Granddad"; a test enforces it). All spoken lines are draft
  (`INVENTED-DIALOGUE`, `TODO(felix)` in `src/story-1950.js`); Felix rewrites by eye.
- **Ghost chart after a jump:** pencil outlines of the land you explored, no names/marks; the sea
  stood ~0.55 m higher in 1700, so remembered rocks hide; re-sailing inks the 1700 chart.
- **Co-op model:** "you visit the host's world" (host's era, progress, lights; friend keeps personal
  souvenirs). Not built yet; see `docs/COOP-CHECK.md`.

## 4. How Felix works with mission control

- He pastes **prompts** from mission control into terminal agents and pastes **reports** back. He
  wants prompts, not mission control doing big builds itself (small fixes are fine when he asks).
- **Mission control merges.** Felix says "merge …" in this chat; mission control does
  `git merge --no-ff` locally on `main`, runs all tests, resolves `LAST_SESSION.md` conflicts (they
  happen on almost every merge; keep main's version and add a line), pushes. Agents don't merge.
- Name agents **by job** ("stage agent", "research agent"), not numbers: his phone and laptop
  sessions are labelled differently.
- **Root cause before fixes** (with evidence); ask before long rebuilds; options before
  recommendations on design; let him judge looks and feel on his phone.
- **Gated batches:** each prompt = stage, batches, DONE WHEN with 390×844 screenshots the agent
  has looked at, "push (not merged)", preview URL from the deployment record, phone checklist.
  Add **"push only at gates/end"** to every prompt (preview builds count against Vercel limits).
- **Parallel agents = separate git worktrees**, never the main folder (an agent once switched the
  main folder's branch). Two agents must not touch `game.js` at once: give the second a research,
  data or lab task (new files only).
- **Saves must survive updates:** never rename/drop a localStorage key without a migration + test
  (rule in GAME-DESIGN.md). Progress is per web address: share only the production link.
- He keeps decision-making labs/tools frozen as they were (`games/windward/ref/`).
- Commit attribution: commits must show as verified on GitHub: author `Claude <noreply@anthropic.com>`
  (a stop hook enforces it), messages end with the Co-Authored-By / Claude-Session lines.

## 5. Tools and checks that work

- **Headless checks (container):** Python Playwright, chromium with
  `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`, served by `python3 -m http.server`.
  Kill servers by port (`kill $(lsof -t -i:PORT)`), never `pkill -f` (it killed the shell).
- **Preview/deploy status:** `gh api repos/felisiwi/coopgames/commits/<sha>/statuses` (shows
  "rate limited" etc.) and the Vercel MCP `list_deployments`. Mission control may NOT deploy to
  production itself (blocked); pushes to `main` deploy automatically.
- **Network from the container:** vercel.app, Overpass, sv.wikipedia are blocked; read them via
  Claude in Chrome on Felix's machine (MediaWiki API URLs work) or have a terminal agent fetch.
- **Jump links for testing:** `?opening=1` replay the opening; `?lights=reset` restart chapter 1;
  `?jump=britta` straight to Britta's jetty (overwrites that browser's chapter-1 save: use a
  private window); `?debug=1` overlay (fps, draw calls) and debug hooks; `?year=1700|1950|2015`.
- **Labs** (all under `/games/windward/`): coast-lab, lighthouse-lab, boat-lab, terrain-lab,
  seamarks-lab, passes-lab, harbours-lab, era-asset-lab, world-1700-lab (`?era=1950|today`), sound-lab.

## 6. Hard-won gotchas (Windward era)

- Vercel Hobby = 100 deployments/day; Promote also counts as a deployment. Now on Pro.
- The game is `index.html`; `coast-lab.html` in the same folder looks like a loading game: send exact URLs.
- A tab left open keeps old code until reloaded; fresh loads get updates (no cache problem).
- `requestAnimationFrame` freezes the game when the tab is hidden. `main` has no pause screen: traffic/ferry run on the wall
  clock and jump ahead. `felix/windward-next-run` fixes it (one game clock, `src/game-clock.js`; paper pause card; co-op keeps wall time).
- At 1:10 the boat acts like an ~80 m ship; the 20 m coast raster closes passes under ~40–60 m.
  An oriented hull barely helps (raster limit). Narrow gems (Smörasken, Kråksundsgap, Grundsund's
  canal) belong to the planned **harbour close-ups**, not carving.
- Same-year lighthouses (Lindholmen, Brandskärsflak, Dynabrott, all 1974) needed spread "effective"
  years in the rewind. Brandskärsflak and Dynabrott share coordinates in `lighthouses.js` (data quirk).
- Research corrections to remember: in 1950 only Måseskär had keepers here (others automatic AGA);
  Kråksundsgap Södra had a light from 1941 (tower 1954); Islandsberg's old light dark from 1938,
  new tower 425 m away; 1950 sea marks were red/black by compass side (IALA A from 1980).
- Older hub gotchas (PeerJS TURN on mobile data, `import.meta.url` asset paths, `?host=` rewrite
  dropping game options): see `AGENTS.md` and `docs/COOP-CHECK.md`. Fixing the hub launch message
  touches Kenny's shared surface: tell him.

## 7. Next (Felix's order)

1. **Next run list** (GAME-DESIGN.md "Next run"): built on `felix/windward-next-run` (pause card, scripted
   first-errand wind, light-air curve), waiting for Felix's phone check and a merge.
2. Navigate tag: after Britta's cards the four AGA lights show their real names (same branch); Måseskär and
   the rest keep the discovery rule.
3. **Co-op stage 2** ("visit the host's world"): host session message on join (clock offset + era),
   game options through the hub launch message (shared hub: Kenny), host's lit lights for the friend.
4. **Day and night** (reuse `src/dusk.js` looks; quests bound to day/night; moor to pass time;
   AGA sun valves light themselves at dusk; night navigation ideas in GAME-DESIGN.md).
5. Wire the 1950 sound lab into the game; the dialogue pass with Felix; chapter 2 in 1950; the
   storm jump to 1703 (Torhild, the eka, ghost chart); harbour close-ups (Fiskebäckskil first).
6. Consider a custom domain early (free with Pro for year one), before many players have saves
   on the current address; a save carry-over would be needed after.

## 8. Branches and worktrees (cleanup pending)

From `git ls-remote --heads origin` on 2026-11-07 (merged = ancestor of `main`).
Merged into `main`, still on GitHub, safe to delete: `felix/windward-1700-people`,
`felix/windward-busy-today`, `felix/windward-chapter1-1950` (keep only while anyone still uses its
preview link), `felix/windward-coop-check`, `felix/windward-sound-lab`, `felix/art-facet-rule`.
(`felix/windward-1950-people` is already gone.) Unmerged: `felix/windward-touch` (superseded touch
controls; ours). **Kenny's, not ours to delete:** `kenny/hub-mobile`, `kenny/last-session-append-only`.
Deleting remote branches is Felix's command to run (mission control is blocked from it).
Laptop worktrees under `~/GitHub/coopgames-*` can be removed once their branches are merged.
