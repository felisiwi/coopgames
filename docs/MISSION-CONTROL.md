# Mission Control — handover

Read this if you are the mission-control chat for `coopgames` (claude.ai, usually
Fable): you plan and review; terminal Claude Code agents do the work. Felix pastes
your prompts into a Claude Code session in `~/GitHub/coopgames` and pastes the
agent's report back to you. Kenny runs the same loop on his machine.

## State (2026-09-11, v1 shipped)

- **Live:** https://coopgames-felisiwis-projects.vercel.app — Vercel project
  `coopgames`, auto-deploys every push to `main` (~1 min), branches get preview URLs.
- **Repo:** github.com/felisiwi/coopgames (private; Felix + Kenny collaborators).
- **Verified end-to-end:** Felix (London, VPN on) and Kenny connected across two
  networks, picked Archipelago from the hub, both spawned on the same island.
- **What exists:** hub (`index.html`) owning the PeerJS connection + game picker;
  `shared/net.js` (PeerJS 1.5.5 vendored, explicit `ICE_SERVERS`); game contract
  (`game.json` + `game.js` exporting `start({canvas, net, seed, role, players})`);
  discovery via `scripts/manifest.js` (gitignored output, run by Vercel build);
  `games/archipelago/` — procedural island, curated CC0 tiles, WASD, camera-follow,
  per-player fog, positions synced at 20 Hz; `games/_template/` two-dot game.
- **Stage D drop-in play is merged:** host can pick and play a game solo; a guest
  connecting mid-pick or mid-game gets a `launch` message and lands in the same
  game/seed the host is already in.

## Documents, in reading order

1. `AGENTS.md` — design, audited risks, tool economy, hub structure. Later
   sections override earlier ones.
2. `LAST_SESSION.md` — state pointer, what the last agent did and left open.
3. `docs/COLLABORATION.md` — pull/push/branch/ownership rules for two humans.
4. `games/README.md` — the game contract; what any agent building a game reads.

## How Felix wants mission control to work

- **Verify on disk before trusting a report.** You have Filesystem/Desktop Commander
  access to `~/GitHub/coopgames`; `git log`, `git status`, `grep` and `curl` on the
  live URL are cheap. Handover docs and agent reports are fallible.
- **Root cause with evidence before any fix.** No blind "try this" loops. If an agent
  offers options, pick the one that produces a diagnosis, and prefer a 2-minute manual
  check by Felix over a long agent investigation.
- **Ask before anything long-running or on his accounts.** Vercel/GitHub settings are
  his clicks (the Vercel connector token is read-only: project creation and settings
  changes return 403). Everything else: use judgment and keep moving.
- **One stage per prompt.** Each prompt names the stage, the batches (one commit each),
  and a checkable DONE-WHEN with pasted evidence. End with "stop and report".
  Tell the agent which skill to use (`/grill-me` before new features or shared changes).
- **Cheap tools first.** Node/curl/grep/ASCII before the browser; Claude in Chrome
  only for genuinely visual checks, one screenshot max. Visual/"does it feel good"
  judgments go to Felix.
- **Parallel work = git worktree,** never two agents in the same checkout:
  `git worktree add ../coopgames-<thing> -b felix/<thing>`; merge on `main` after.
  Archipelago is Felix's folder — commit to `main` directly. `shared/`, hub, `docs/`,
  `AGENTS.md`, `scripts/` are shared surfaces — branch + PR always, per
  `docs/COLLABORATION.md` (not just when Kenny happens to be active).

## Hard-won gotchas (each cost a round trip)

- Open Relay free TURN (openrelay.metered.ca) returns no relay candidates for peers
  behind carrier NAT: phone on mobile data → onicecandidateerror, only host remote
  candidates, ICE checking → disconnected. Laptop-to-laptop works. Fix when needed:
  Metered free-tier credentials in shared/net.js ICE_SERVERS (Felix's signup).
- PeerJS's shipped TURN hosts (`eu-0`/`us-0.turn.peerjs.com`) have no DNS. Without a
  relay, VPNs and strict NATs fail silently at ICE "checking". `shared/net.js` now
  uses Google STUN + Open Relay Project's free TURN — fine for hobby use, swap for a
  proper TURN (Cloudflare/Metered account) if it gets flaky.
- Game asset paths must resolve via `import.meta.url`; page-relative paths 404 when the
  hub at `/` imports the game. Test through the hub, not only the solo dev entry.
- The host's address bar is rewritten to `?host=<id>`; a page reload = new peer id =
  dead link. Guest shows a timeout after ~8 s; `start()` errors render on screen.
- `games/manifest.json` is generated and gitignored — never commit it.
- Tileset "Thick" 128×72 cells are a 128×64 diamond plus an 8 px skirt
  (`TILE_STEP_Y = 32`, not 36). Measure, don't assume.
- `coopgames.vercel.app` is taken by someone else; the team-scoped URL is production.
  Vercel Authentication had to be switched off manually for the link to be public.

## Backlog

0. **TURN fallback:** Open Relay free TURN (openrelay.metered.ca) returns no relay
   candidates for peers behind carrier NAT: phone on mobile data → onicecandidateerror,
   only host remote candidates, ICE checking → disconnected. Laptop-to-laptop works.
   Fix when needed: Metered free-tier credentials in shared/net.js ICE_SERVERS (Felix's
   signup).
1. ~~**Housekeeping commit:** live URL into `AGENTS.md`/`README.md`; copy `grill-me` +
   `grilling` from `~/.claude/skills/` into `.claude/skills/` with attribution and a
   `docs/SKILLS.md` index; Skills section in `AGENTS.md`.~~ **Done** (Stage H, 2026-09-11).
2. **Archipelago tuning** from real play: `VISION_RADIUS` (5) and spawn distance (18)
   in `games/archipelago/src/config.js`; player sprite instead of marker; landmarks
   as things to find; boats / multi-island (the original archipelago idea, deferred).
3. **Hub:** show connected-player name/count before launch; "back to picker" after a
   game; live lobby without link-sharing → Kenny's Firebase, only if wanted.
4. **Kenny's first game** — his folder, his agent; mission control only reviews
   contract compatibility and shared-surface PRs.
