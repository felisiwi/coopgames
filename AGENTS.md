# coopgames — Mission Control Handover

## Read this first

You are mission control for this project: audit the plan below with a critical eye, then orchestrate sub-agents in terminal to build it. This document is Claude Sonnet 5's proposal from a design session with Felix (a "grilling" interview — every branch was interrogated one decision at a time, not handed down as a spec). Treat it as a strong starting point, not gospel.

**Step 0 — Audit.** Before writing any code, work through *Risks & open questions* below and record a resolution (adopt / adjust / override) for each one. Don't start the build plan until every risk has an explicit resolution — if you override something, say why, so Felix can see the reasoning later.

## Mission

One hard constraint drives every other decision here: Felix opens a URL, sends the link to a friend, the friend opens it, and within roughly an hour of build time both of them are moving around the same island in real time. Build a **tracer bullet** first — the thinnest possible slice that goes end-to-end (URL → rendered island → two synced players) — before thickening any single part of it. If the budget gets tight, cut richness before you cut the end-to-end path; a live game with a plain-looking island beats a beautiful island that only one person can see.

Everything below is scoped against that constraint. Anything not load-bearing for it is deferred — see *Out of scope*.

## The game

A cozy, 2D isometric exploration co-op game, inspired by the Swedish archipelago. Two friends, playing remotely on separate machines, spawn onto the same procedurally-generated island and freely wander it together — no combat, no win condition, just discovering the island (and each other) as fog-of-war lifts. Aesthetic target: cozy and beautiful, not programmer-art.

## Settled design

**Rendering** — 2D isometric, HTML5 Canvas. Plain JS/HTML/CSS, no framework and no build step, so the whole thing is static files Vercel can deploy with zero config.

**World** — A single island (not a multi-island archipelago yet), generated procedurally per session via a radial falloff mask combined with one layer of simplex/Perlin noise for the coastline. Different island shape every session. Water is the hard boundary — no crossing it in v1 (see *Out of scope*).

**Tile art** — [300+ Isometric Overworld Tiles by Screaming Brain Studios](https://opengameart.org/content/300-isometric-overworld-tiles), OpenGameArt, **CC0** (public domain, no attribution required). 360 tiles, land/forest/water covered, ships as PNGs — this alone is enough for the whole island; don't pull in a second pack for v1 (a second candidate pack, [Coast Isometric Tiles](https://guilhermelaso.itch.io/coast-isometric-tiles), has nicer sand/sea blend tiles but a different grid size — worth layering in later, not now, since reconciling two tile grids costs time the budget doesn't have).

**Camera & fog-of-war** — Camera follows your own character (canvas offset by `-playerPos`). Each player only sees a limited radius around themselves; tiles outside it are hidden/dimmed until walked over, and stay revealed once seen. This is what makes finding your friend take actual exploring instead of being trivial — it's the same mechanic doing double duty (exploration feel + "find your friend"), don't build a separate system for the latter.

**Movement** — WASD / arrow keys, real-time. Broadcast position deltas over the network connection each frame/tick; no pathfinding, no click-to-move.

**Co-op structure** — Pure free-roam, no objectives or win condition. Both players spawn on the *same* island but at *separate* points, far enough apart (given the vision radius) that finding each other takes a few minutes of real exploring, not zero.

**Multiplayer** — WebRTC via PeerJS, using PeerJS's public cloud broker for signaling — no backend server to write or host. Host opens the page, gets a PeerJS peer ID, the page embeds it in the URL (query param or hash) with a "copy link" affordance. Friend opens that exact link, the ID is read off the URL on load, and the connection is established automatically — nothing to type or misread.

**Hosting** — GitHub repo (this one: `felisiwi/coopgames`) deployed to Vercel via its GitHub integration. HTTPS matters here, not just for convention — WebRTC/PeerJS is more reliable under a secure context.

## Risks & open questions

Resolve each of these explicitly before or during the build — this is the part that most needs a critical eye rather than blind execution:

1. **No TURN server.** PeerJS's public broker only arranges STUN-based connections by default. If either player is behind a strict/symmetric NAT (common on some corporate or mobile networks, less common on home wifi), the direct P2P connection can simply fail with no fallback. Decide: accept this risk for v1 (most home networks are fine), or budget extra time for a TURN fallback. Don't discover this live with Felix's friend — test the connection from two genuinely different networks before calling v1 done, not two tabs on one machine.
2. **Procedural generation can produce ugly or broken islands** (touching the map edge, disconnected landmasses, a coastline that reads as noise rather than a shape) without tuning. Budget real minutes for visually checking the generator's output, not just confirming it runs.
3. **Camera-follow + per-player fog-of-war is the most complex interacting system in v1** (offset math, per-player revealed-tile state, keeping that state local vs syncing it). If time runs short, this is the first thing to simplify — e.g., temporarily widen the vision radius or drop to a static camera — not the multiplayer sync, which is the actual point of the exercise.
4. **Spawn distance and vision radius are unset numbers, not a settled design.** They need to be tuned together: too close and there's no "find each other" moment, too far (relative to vision radius) and a short test session might never produce it. Starting suggestion to tune from: vision radius of roughly 4-5 tiles, spawn points 15-20 tiles apart — treat as a first guess, not a spec.
5. **Sanity-check the "under an hour" budget against actual scope** once you've read all of the above — four settled systems (world gen, rendering/camera/fog, networking, deploy) is a lot for an hour even at MVP quality. If it's not going to fit, say so and propose what to cut, rather than quietly running over.

## Build plan (suggested)

A tracer-bullet ordering — each stage is playable/checkable on its own before the next begins:

1. **Scaffold + island generation.** Static site skeleton, procedural island rendered with the tile pack. No players, no networking. *Done when:* opening `index.html` shows a recognizable island — water, coastline, land, forest — not a placeholder grid.
2. **Single-player movement.** Add one character: WASD movement, camera-follow, fog-of-war/vision-radius reveal. *Done when:* you can walk around the rendered island solo and watch it reveal itself as you go.
3. **Multiplayer sync.** PeerJS connection, auto-link join flow, two independent characters spawned apart on the same island with positions synced in real time. *Done when:* two browser instances (ideally on two different networks, per risk #1) each show both characters moving live.
4. **Deploy.** Push to GitHub, connect the repo to Vercel, confirm the live URL. *Done when:* the actual deployed URL — not localhost — works end-to-end for two people on separate machines/networks.

## Resources

- Repo: https://github.com/felisiwi/coopgames
- Tile pack: https://opengameart.org/content/300-isometric-overworld-tiles (CC0)
- Deploy target: Vercel, via GitHub integration

## Out of scope for v1

Boats or any water traversal (single island only, for now), win conditions or objectives, persistence between sessions, mobile support, in-game voice/text chat (assumed to happen externally, e.g. a phone call while playing). These are deliberate deferrals made to hit the time budget — don't build toward them until v1 is live and Felix asks for them.

## Step 0 — Audit resolutions (mission control, 2026-09-11)

Reviewed against the full grilling transcript, not just this doc. Verdict per risk:

1. **No TURN server — ADJUST (softer than stated), then RE-ADJUSTED 2026-09-11.** The shipped PeerJS `DEFAULT_CONFIG` includes a TURN pair (`turn:eu-0.turn.peerjs.com:3478`, `turn:us-0.turn.peerjs.com:3478`, user `peerjs`/`peerjsp`) alongside Google STUN — original resolution was to use PeerJS defaults with no custom ICE config. That TURN pair's hosts no longer resolve in DNS (confirmed via `dig` against 8.8.8.8/1.1.1.1, Stage 3 Batch 2) — PeerJS is STUN-only in practice now. `shared/net.js` passes an explicit `ICE_SERVERS` (Google STUN + the Open Relay Project's free public TURN, `openrelay.metered.ca`) to every `new Peer()` call. Two-different-networks test stays mandatory before calling v1 done (phone hotspot vs home wifi is enough).
2. **Ugly/broken islands — ADOPT, with a concrete gate.** Generator must guarantee: (a) a water margin of ≥3 tiles on every map edge (radial falloff makes this near-free), (b) one connected landmass — flood-fill from the centre tile and drop any land not reached, (c) enough land for two spawns ≥ the spawn distance apart. Stage 1 agent renders 5 seeds to PNG and I eyeball them before sign-off. Seed is a URL param so a good island is reproducible.
3. **Camera + fog is the riskiest system — ADOPT, with the cut pre-committed.** Fog is a per-player `Uint8Array` (0 unseen / 1 seen / 2 currently visible), never synced. Draw order: unseen tiles skipped, seen-but-not-visible dimmed, visible full. Cut order if stage 2 overruns: drop the dimmed middle state first, then widen radius, then static camera. Sync is never the thing cut.
4. **Spawn distance / vision radius unset — ADJUST to explicit first values.** Vision radius 5 tiles, spawns ≥18 tiles apart (Manhattan, on land, picked deterministically from the seed so both peers agree without negotiation: host = spawn A, joiner = spawn B). Both live in one `CONFIG` object at the top of the game file so Felix can tune in one place. First live session with a friend is the real tuning pass.
5. **"Under an hour" — ADJUST.** The hour was scoped for a human coding it; with an agent per stage the constraint is wall-clock across four stages, and the honest estimate is 1–2 h including reviews. Not a reason to cut scope now — the tracer-bullet order already protects the end-to-end path. Cut list if it slips, in order: real tileset → coloured diamonds; fog middle state; TURN verification test → accept risk.

Risks the doc missed, added:

6. **Tileset curation is the real art cost, not the download.** 360 tiles is a picking problem. Stage 1 curates a fixed palette of ~10 tiles (deep water, shallow water, sand, grass ×2, grass+tree ×3, rock, one landmark) into `assets/tiles/` and a `TILES` map; everything else stays out of the repo. Use the 128×72 size; measure the actual diamond footprint from the PNG (the "Thick" style carries a side face, so the drawn height ≠ the grid step) — do not assume 2:1.
7. **World must be identical on both peers.** Seed + spawn assignment travel in the URL alongside the peer ID (`?host=<peerId>&seed=<n>`), so the joiner renders the island before the data channel is even open. Positions are the only thing that crosses the wire.
8. **Host refresh kills the link.** A new page load = new peer ID. Accepted for v1: the host keeps the tab open; the copy-link UI says so in one line.
9. **Isometric depth sorting.** Trees and players must draw back-to-front. v1 rule: draw all ground tiles, then a single list of (trees + players) sorted by map y then x. Anything fancier is out of scope.

Working conventions: this repo now lives under `~/GitHub`, so the workspace `CLAUDE.md` applies — gated batches, stage specific files, DONE-WHEN with pasted evidence, `LAST_SESSION.md` updated at every wrap. Add a repo `CLAUDE.md` containing `@AGENTS.md` in stage 1 so terminal sessions load this file.

## Tool economy

Prefer the cheapest check that proves the point: node scripts, curl, grep, and ASCII dumps before
browser tools. Reach for Claude in Chrome / screenshots only when the criterion is literally visual
and nothing cheaper can prove it — and then one screenshot, not a session. Run each game's
invariants headlessly (`node --input-type=module -e '...'` importing the game's own module) rather
than opening a browser to eyeball a grid. Pixel-perfect and "does it look cozy" calls go to the
human — that's their call anyway, not something a screenshot round-trip settles for them.

## Hub structure (Felix, 2026-09-11 — supersedes single-game layout above; contract added 2026-09-11)

This repo is a **hub of co-op games** shared by Felix and Kenny, not one game. The hub owns the
PeerJS connection; games are plugins — they never touch PeerJS directly, only the `net` object the
hub hands them.

- `index.html` — hub: fetches `games/manifest.json` at runtime and renders a picker (name,
  description, Host button) for every listed game. Plain page, no framework.
- `games/<name>/` — one folder per game: `game.json` (`id`, `name`, `description`,
  `players: {min, max}`) for discovery, `game.js` default-exporting
  `start({ canvas, net, seed, role, players })`, plus its own `src/`/`assets/` as needed. The hub
  creates the PeerJS connection, then calls `start()` with `net: { send(msg), onMessage(fn),
  peerId, isHost }` and `role: 'host' | 'guest'`. Games never import PeerJS. (`games/archipelago/`
  currently ships only `game.json` — its `game.js` wrapper is Stage 2's job.)
- `shared/` — code every game can import: `shared/net.js` (hub-only — PeerJS host/join-link flow;
  games get the resulting `net` object via `start()`, they never call this directly),
  `shared/noise.js`, `shared/input.js` (WASD). Keep it small; only lift into `shared/` what two
  games actually need.
- `scripts/manifest.js` — scans `games/*/game.json` (skipping `_template`), writes
  `games/manifest.json`. Runs as Vercel's `buildCommand` (see `vercel.json`); run it locally the
  same way after adding or editing a game.
- `games/README.md` — the contract in full, written for an agent building a new game.

Deploy: `vercel.json` sets `buildCommand: "node scripts/manifest.js"` and `outputDirectory: "."`,
so Vercel regenerates the manifest on every deploy and serves the repo root as static — every game
is live at `/games/<name>/` with zero further config. Firebase (Kenny's account) is deferred: not
needed for v1; revisit for a live lobby or any game needing shared server state.

Collaboration: Kenny is a collaborator on the private repo. Both push to `main`. One agent per repo
at a time, across both humans; `LAST_SESSION.md` is the handoff. Any commit, push, or work in
another person's folder: follow `docs/COLLABORATION.md`.

- Mission control (claude.ai chat orchestrating terminal agents): read `docs/MISSION-CONTROL.md` first.
