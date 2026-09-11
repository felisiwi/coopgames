# Last session

**2026-09-11 — Stage H housekeeping (this commit)** — live URL into
README.md/AGENTS.md; vendored `grill-me`/`grilling` skills into
`.claude/skills/` with attribution; added `docs/SKILLS.md` index and an
AGENTS.md Skills section; retired the two-network test from Next (it
passed — see docs/MISSION-CONTROL.md).

## Today's sessions

- Batches 1-3 (3035e0a..34a862c): hub scaffold, curated CC0 tileset, real
  `generateIsland(seed)` + isometric render, seeds 1-5 pass invariants.
  Pushed (e702ac9), Kenny joined as collaborator.
- Stage 1.5 (21a6782): game.json/game.js contract, hub owns PeerJS per
  AGENTS.md, scripts/manifest.js + vercel.json wire discovery.
- Batch 0 (93367f9): docs/COLLABORATION.md session/folder rules.
- Stage 3 Batches 1-2: real `shared/net.js` on vendored PeerJS; hub lobby
  wired to it. **Found live**: same-machine two-tab test never opened the
  data channel — `dig` confirmed `eu-0`/`us-0.turn.peerjs.com` have no DNS
  record, PeerJS's shipped TURN pair is dead.
- Stage 2 + hub fixes (a071de1, 41a68e1): single-player movement/camera/
  fog merged; shareable address bar, guest timeout.
- TURN fix (6ddd21b): `shared/net.js` now passes explicit `ICE_SERVERS`
  (Google STUN + Open Relay Project free TURN) to every `new Peer()`;
  added ICE state + candidate-type console diagnostics on close/error.
- Hub asset-path fix (c25d340): `games/archipelago/src/render.js` tile
  paths resolve via `import.meta.url`, not page-relative; added
  games/README.md rules; hub `launchGame()` shows `start()` errors on
  screen instead of a dead grey canvas.
- Two-network test (per docs/MISSION-CONTROL.md): Felix + Kenny connected
  across two networks, both spawned on the same island. **Passed.**
- Stage H housekeeping (this commit): docs/skills cleanup, see above.

## Next

1. Archipelago tuning from real play: `VISION_RADIUS` (5) and spawn
   distance (18) in `games/archipelago/src/config.js`; player sprite
   instead of marker; landmarks as things to find.
2. Otherwise proceed per docs/MISSION-CONTROL.md backlog (hub lobby
   polish, Kenny's first game).
