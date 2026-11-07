# Windward: kickoff for the new Claude project

Written 2026-11-07 by the coopgames mission-control chat, for the new Windward-only Claude project.
Until the split (docs/WINDWARD-SPLIT-PLAN.md) is done, the code is still in `felisiwi/coopgames` under
`games/windward/`; afterwards it is `felisiwi/windward` at the root. Everything below is also true in the repo;
the repo wins where they differ.

## 1. Project instructions (paste into the new Claude project's instructions)

```
You are mission control for Windward, Felix's cosy sailing game on the real Bohuslän coast.
Repo: github felisiwi/windward (on Felix's Mac at ~/GitHub/windward). Until the split is done the game is
still in felisiwi/coopgames under games/windward/ (~/GitHub/coopgames).
At the start of a session: add/clone the repo, read docs/MISSION-CONTROL.md, then LAST_SESSION.md, then
GAME-DESIGN.md (later sections override earlier ones) and docs/ALIVE-SEA.md (settled design grills).
Handover docs are fallible: verify claims on disk (git log, tests, the live URL) before trusting them.

How we work: Felix pastes prompts from mission control into terminal Claude Code agents (agent 1, 2, 3, 4:
fixed terminal slots, their tasks change) and pastes their reports back. Mission control writes prompts
(saved in docs/prompts/, Felix sends a one-liner "Read <file> and carry out the prompt below its first ---
line. You are agent N."), reviews and verifies each report (fetch the branch, run all tests, check the
preview URL from Vercel), and merges to main only when Felix says "merge N". Write prompts for agents
rather than building big things yourself.

Felix's rules: root cause with evidence before any fix; ask before long rebuilds; saves must survive updates
(no new or renamed localStorage key without a migration and a test); options with a recommendation on design;
he judges look and feel on his phone, so give exact links with plain-words checks; grill design with the
tap-to-answer question tool, not long text; keep notes and docs in the repo, not in chat artifacts.
```

## 2. First message for the new project's first chat

```
You're mission control for Windward. Add/clone the repo (felisiwi/coopgames until the split is done, then
felisiwi/windward), read docs/WINDWARD-KICKOFF.md and docs/WINDWARD-SPLIT-PLAN.md, then
docs/MISSION-CONTROL.md, LAST_SESSION.md, games/windward/GAME-DESIGN.md and games/windward/docs/ALIVE-SEA.md.
Verify against the repo before trusting them, then tell me in a few lines where we are and what's next.
```

## 3. Where things stand (2026-11-07 evening)

**Live game:** https://coopgames-felisiwis-projects.vercel.app/games/windward/index.html (co-op via the hub
https://coopgames-felisiwis-projects.vercel.app). Auto-deploys on every push to coopgames `main`.

**On main (merged 2026-11-07):** chapter 1 in 1950; Next run (pause card + one game clock, Britta's four lights
by real name, the first errand downwind both ways, a light-air floor, a Task card that says what and why);
island lore (`data/island-lore.json`, 27 places, `docs/ISLAND-LORE.md`, `ISLAND-ASSETS-BRIEF.md`,
`UNIQUE-ARTIFACT-CANDIDATES.md`); research corrections (`docs/CORRECTIONS-TODO.md`, all ticked); the co-op stage
2 plan with Felix's decisions F1 to F9 (`docs/COOP-STAGE2-PLAN.md`); Islandsberg's light behind gable windows.

**In flight on branches (not merged; agents numbered by terminal):**
- Agent 2, `felix/windward-weather`: weather and sail feel in the game (wind from day types and the game clock,
  gusts/lulls, island lees, faster sea outside the skerries, swell to surf, squalls, mist, camera x1.4 with
  look-ahead, speed feel). Felix: sailing feels fun, mist good. Open: the gust/lull patches look like hard-edged
  blotches on his phone (not a precision bug: his phone is highp); redesign to large, soft, subtle patches;
  make the squall's hit felt. Felix's screenshots: `games/windward/docs/weather-into-game/felix-phone/`.
- Agent 4, `felix/windward-landmarks`: landmark asset kit (cairns, pole marks, small lights, sea huts, chapels,
  windmill) with real placements and "from the boat" views. Felix: looks great. Gate 3 (docs) pending, then merge.
- Agent 1, `felix/windward-boat-variety`: era-appropriate passing boats with seeded colours, rigs and sizes.
- Agent 3, `felix/windward-thing-templates`: draft 1950 things, quests, artifacts and rumours from the lore.
- `felix/hub-guest-rejoin` (agent 3, earlier): a returning co-op guest can rejoin; opt-in per game. Untested on
  real phones; it's a coopgames hub change; for Windward, bring the fix into its own co-op code (split plan,
  Phase 2).
- Follow-up after the weather merge: pass `beam: false` for Islandsberg's window light in game.js.

**Settled design (all in `docs/ALIVE-SEA.md`):** the thing model (templates on real anchors, world seed + day
seed, only your changes saved, cross-era traces), weather and sail feel, generated mini quests and artifacts
(rarity tiers, uniques placed by Felix, lore told by regulars), the logbook (Grandpa's logbook, sections: light
log, sightings, collection, stories, people, places, quests), anchoring close-ups, day and night (short summer
night, sector lights). Build order at the end of that doc: thing-model slice (tap vs hold, fish box, seals,
net-mender, one rumour, world seed), weather in the game, quest slice, co-op stage 2.

**Open design areas not yet grilled:** unique artifacts (pick from the 14 candidates), chapter 2 in 1950, sound
(wire the 1950 sound lab).

**Decided for the split (2026-11-07):** after in-flight work; own Host / Join; keep history; own custom domain
later with save carry-over; old page redirects but an old copy stays playable as history; repo
`felisiwi/windward`. Full plan: `docs/WINDWARD-SPLIT-PLAN.md`.

## 4. Felix and how he works (for the new project)

- Felix is a designer and creative director in London, originally Swedish; he works across design and
  AI-assisted development and plays the game on an Android phone (Chrome, dpr 3).
- He often works from his phone: give links he can tap, keep replies short, one screenful where possible.
- He likes design grilled one decision at a time with the tap-to-answer question tool and a recommended option.
- He wants systems, not one-off content: things grow from data and research (era files, island lore).
- Kenny (his friend) shares coopgames; Windward leaving the hub only needs a heads-up note for him, no sign-off.
- Vercel team "felisiwi's projects" is on Pro (since 2026-11-06). Preview links come from the Vercel deployment
  record (agents often can't find them: look them up). Mission control can't deploy to production itself;
  pushes to main deploy.
- Tools that work from the container: Python Playwright with swiftshader for headless checks; vercel.app,
  Overpass and sv.wikipedia are blocked from the container (have a terminal agent fetch, or use Claude in Chrome).
