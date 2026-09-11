# Last session

**2026-09-11 — Stage D fix (this commit, branch `felix/stage-d-dropin`, not
merged)** — fixed a race that dropped the late-join `'launch'` message on
the guest side. PR open (updates PR #1), awaiting Felix's preview-URL test.

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
- Stage D (branch): picker renders right after `host()` resolves, no
  longer gated on a guest connecting. `currentLaunch` + `net.onConnect`
  is the single send site for `'launch'` (avoids double-launch for a
  late-connecting guest — caught in `/grill-me` before coding).
  `shared/net.js` `sendQueue` capped at 50 (FIFO drop-oldest). Confirmed
  archipelago and dino-rumble both tolerate zero remote players and a
  peer connecting later — no game code changes needed.
- Stage D fix (this commit): guest-side race dropped `'launch'` when it
  arrived during `runGuest()`'s manifest fetch. `shared/net.js` now
  buffers inbound messages (cap 50, drop-oldest) until a listener is
  registered; `runGuest()` registers `onMessage()` before the fetch and
  holds an early `'launch'` in `pendingLaunch` until `games` loads.
  `games/README.md`'s net contract documents the buffering guarantee.

## Next

1. Merge `felix/stage-d-dropin` after Felix tests the preview URL.
2. Archipelago tuning from real play; Dino Rumble needs a human eye.
3. Otherwise per docs/MISSION-CONTROL.md backlog (hub lobby polish).
