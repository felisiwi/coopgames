# Last session

**2026-09-11 — Stage D: drop-in play (this commit, branch
`felix/stage-d-dropin`, not merged)** — host can pick a game and play solo;
guest joins whenever, lands in the same game/seed. PR open, awaiting
Felix's preview-URL test before merge.

## Today's sessions

- Batches 0-1.5 (3035e0a..93367f9): hub scaffold, CC0 tileset, real
  `generateIsland(seed)` + isometric render; game.json/game.js contract,
  hub owns PeerJS; manifest.js + vercel.json; docs/COLLABORATION.md.
- Stage 3 Batches 1-2: real `shared/net.js` on vendored PeerJS + hub
  lobby. **Found live**: data channel never opened — `dig` confirmed
  PeerJS's shipped `eu-0`/`us-0.turn.peerjs.com` pair has no DNS record.
- Stage 2 + hub fixes, TURN fix, asset-path fix, two-network test
  (**passed**), Stage H housekeeping, Dino Rumble (Kenny, headless 61/61,
  not yet hub-tested) — see git log for this range, summarized previously.
- Stage D (branch, this session): picker renders right after `host()`
  resolves, no longer gated on a guest connecting. `currentLaunch` +
  `net.onConnect` is the single send site for `'launch'` (the naive
  "send at pick time AND resend on connect" plan double-launched
  `start()` for a guest who connects after the host already picked —
  caught in `/grill-me` before coding). `shared/net.js` `sendQueue`
  capped at 50 (FIFO drop-oldest) — was unbounded, would grow by
  archipelago's 20 pos-msgs/sec for as long as the host plays solo.
  Non-blocking "waiting for a friend" corner overlay while solo.
  Confirmed both archipelago and dino-rumble already tolerate zero
  remote players and a peer connecting at any later time — no game
  code changes needed. `games/README.md` documents that contract.
  `docs/MISSION-CONTROL.md`'s stale "branch+PR if Kenny active" line
  corrected to match `docs/COLLABORATION.md` (always branch+PR for
  shared surfaces, no exception).

## Next

1. Merge `felix/stage-d-dropin` after Felix tests the preview URL.
2. Archipelago tuning from real play; Dino Rumble needs a human eye.
3. Otherwise per docs/MISSION-CONTROL.md backlog (hub lobby polish).
