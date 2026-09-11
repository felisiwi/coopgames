# Last session

**2026-09-11 — Stage D wrap: docs + picker bleed-through fix (this commit,
branch `felix/stage-d-dropin`, not merged)** — fixed `#lobby[hidden]` losing
to its own `display: flex`; documented Open Relay carrier-NAT TURN gotcha;
marked Stage D drop-in play merged in docs/MISSION-CONTROL.md. Pushed
(updates PR #1), awaiting Felix's preview-URL test.

## Today's sessions

- Batches 0-1.5: hub scaffold, CC0 tileset, `generateIsland(seed)` +
  isometric render, game.json/game.js contract, manifest.js, vercel.json.
- Stage 3: `shared/net.js` on vendored PeerJS + hub lobby. Found live:
  PeerJS's shipped TURN hosts have no DNS record.
- Stage 2 + fixes, TURN fix, asset-path fix, two-network test (passed),
  Stage H housekeeping, Dino Rumble (Kenny, headless 61/61) — see git log.
- Stage D (branch): picker renders right after `host()`, no longer gated
  on a guest connecting; `currentLaunch` + `net.onConnect` is the single
  `'launch'` send site (avoids double-launch for a late-connecting guest).
- Stage D fix: guest-side race dropped `'launch'` arriving during the
  manifest fetch; `shared/net.js` now buffers inbound messages until a
  listener is registered.
- Stage D wrap (this commit): `#lobby[hidden] { display: none }` was
  missing in hub.css, so the ID-selector `display: flex` beat the
  browser's default `[hidden]` rule and the picker bled through behind
  the waiting overlay — fixed with the same pattern already used for
  `#game-canvas`/`#waiting-overlay`/`#launch-error`. Added the Open
  Relay carrier-NAT TURN gotcha and merged-status note to
  docs/MISSION-CONTROL.md.

## Next

1. Merge `felix/stage-d-dropin` after Felix tests the preview URL.
2. Archipelago tuning from real play; Dino Rumble needs a human eye.
3. Otherwise per docs/MISSION-CONTROL.md backlog (hub lobby polish).
