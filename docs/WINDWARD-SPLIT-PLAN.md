# Windward's own repo: the split plan

Written 2026-11-07 by mission control (coopgames chat), with Felix's decisions. Felix is also starting a
separate Claude project for Windward; its kickoff is `docs/WINDWARD-KICKOFF.md` (copied into the new repo).

## Felix's decisions (2026-11-07)

- **When:** after the in-flight work is merged (weather, landmarks, boat variety, templates), so the new repo
  starts with everything.
- **Co-op:** Windward gets its own small Host / Join flow with its own copy of the connection code; it no
  longer needs the coopgames hub.
- **History:** keep Windward's git history (every commit, blame and log still work).
- **Address:** its own custom domain (free with Vercel Pro for year one), chosen later by Felix; players'
  saves carried over once from the old address.
- **Old home:** the old Windward page in coopgames carries saves over and redirects to the new address, while
  an **old copy stays playable as history** (frozen, its own link); Windward leaves the hub's game list.
- **Repo:** `felisiwi/windward` (private, like coopgames).

## What Windward depends on outside games/windward (checked 2026-11-07)

- `shared/input.js`, `shared/noise.js` (imported by its src), `shared/net.js` (the hub's PeerJS code, for
  co-op), `shared/ART.md` + `ART-SOURCE.md` (the art style), `shared/vendor/` (PeerJS).
- `tools/` (all of it is Windward's: build-coast, build-harbours, build-passes, fetch-names, fetch-seamarks,
  invent-harbour-marks, make-settlements, plan-busy-coast, lib/, data/); some tests import `../../../tools/...`.
- The hub (`index.html`) creates the co-op connection and calls `game.js start()`; `games/README.md` is the
  contract. Windward's own `index.html` is the solo entry and links "← hub".
- `.vercelignore` drops `games/*/docs/` (52 MB of screenshots). Size: games/windward is 78 MB, of which docs
  52 MB, assets 8.3 MB, vendor 2.3 MB.
- Repo conventions to carry: `AGENTS.md` (only the parts that apply), `docs/MISSION-CONTROL.md`, `LAST_SESSION.md`,
  `.claude/skills/` (grilling, design-audit), the commit-author stop hook (author `Claude <noreply@anthropic.com>`).

## Phases

### Phase 0: finish in-flight work in coopgames (now)
- Agent 2: weather into the game (gust/lull look redesign + the squall moment), then Felix's phone check, merge.
- Agent 4: landmark kit gate 3, merge. Agent 1: boat variety, merge. Agent 3: 1950 templates, merge.
- Follow-up already noted: Islandsberg `beam: false` in game.js after the weather merge.
- `felix/hub-guest-rejoin` is a hub change (coopgames, Kenny's games). Windward's own co-op will copy the
  connection code, so bring the rejoin fix along there (Phase 2). The hub branch itself can wait for a
  two-phone test or be dropped; decide with Felix.
- Then **freeze Windward in coopgames**: no new Windward branches there.

### Phase 1: create felisiwi/windward with history (one agent, in a fresh clone, never the main folder)
1. Felix creates the empty private repo `felisiwi/windward` on GitHub (or the agent with `gh repo create`).
2. Fresh full clone of coopgames into a temp folder; `pip install git-filter-repo`; keep only:
   `games/windward/`, `tools/`, `shared/input.js`, `shared/noise.js`, `shared/net.js`, `shared/ART.md`,
   `shared/ART-SOURCE.md`, `shared/vendor/`, and the Windward-relevant docs (`docs/MISSION-CONTROL.md`,
   `docs/SKILLS.md`, `.claude/skills/`).
3. Layout in the new repo: the game at the root (`index.html`, `game.js`, `src/`, `assets/`, `data/`, `docs/`,
   labs...), `shared/` and `tools/` beside it. Fix every relative path that pointed up out of games/windward
   (`../../shared`, `../../../shared`, `../../../tools`, the "← hub" link) and run all tests.
4. New `AGENTS.md` for Windward (the working rules: gated batches, root cause first, saves rule, worktrees,
   agents by number, push only at gates, mission control merges, commit attribution), `CLAUDE.md` = `@AGENTS.md`,
   a fresh `LAST_SESSION.md`, `docs/MISSION-CONTROL.md` rewritten for the new repo, `.vercelignore` (docs/),
   the commit-author hook. `docs/WINDWARD-KICKOFF.md` copied in.
5. Push `main`. Verify: `git log` shows the old history; tests pass; the labs and `index.html` load locally.

### Phase 2: Windward's own Host / Join
- A start screen in Windward: "Sail alone / Host with a friend / (join link)". Copy `shared/net.js` with the
  rejoin fix; the launch options follow `games/windward/docs/COOP-STAGE2-PLAN.md` (decisions F1 to F9). The
  game's `start({ canvas, net, seed, role, ... })` stays the same, so nothing inside the game changes shape.
- Tests with a fake PeerJS, then Felix's two-phone, two-network test.

### Phase 3: Vercel
- New Vercel project linked to `felisiwi/windward` (team "felisiwi's projects", Pro), no build step (or a tiny
  one if a manifest is still needed). Preview deploys per branch as today.
- When Felix picks the domain: attach it. **Players are only moved (Phase 4) once the domain is final**, so
  saves move once, to their final home.

### Phase 4: carry saves across, redirect, keep a frozen copy
- Saves are localStorage, per web address (keys listed in docs: `windward.*.v1`, per era with a `.<era>`
  suffix, see `src/era-storage.js`). A page on the new address cannot read the old address's storage.
- **Bridge:** coopgames' `games/windward/index.html` becomes a small page that reads every `windward.*` key on the
  old address and opens the new address with them in the URL fragment (`#import=<base64 JSON>`, never sent to
  a server). The new game imports them **only if its own storage has no Windward save yet** (never overwrite
  newer progress), then clears the fragment. Tests for: import into empty storage, no overwrite, bad data
  ignored, every key carried, era suffixes kept.
- **Frozen copy:** the old game stays playable at its own link in coopgames (e.g. `games/windward/frozen.html`,
  no bridge, no redirect), and is labelled as the old version. Windward leaves the hub list (`game.json`
  removed or a `hidden` flag the manifest respects).
- Kenny gets a heads-up note (Windward left the hub; the hub itself is unchanged).

### Phase 5: the new Claude project
- Felix creates the project and pastes the project instructions and first message from
  `docs/WINDWARD-KICKOFF.md`. The new project's memory starts empty for Windward-specific notes (it can read
  Felix's account-level memory, not this project's), so the kickoff doc and the repo docs carry everything.

### Phase 6: tidy coopgames
- coopgames' `docs/MISSION-CONTROL.md` and `AGENTS.md`: Windward moved, with the new repo and address.
- Windward's prompts, docs and history stay in coopgames' git history; nothing needs deleting.

## Risks
- **Saves:** the one thing players would notice. Do Phase 4 only once, to the final domain, with tests.
- **Paths:** many relative imports point out of games/windward; tests and the blank-page guard
  (`game-imports.test.js`) catch most; load every lab once.
- **Co-op:** the own Host / Join must be tested on two phones before the old hub route goes away.
- **Agents:** none may be working in coopgames' Windward folder during Phase 1 (freeze first).
