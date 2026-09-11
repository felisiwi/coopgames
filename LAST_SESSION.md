# Last session

**2026-09-11 — hub asset-path fix (this commit)** — archipelago's tile
images 404'd when launched through the hub (page-relative paths resolve
against whoever loaded the module, not the module itself). Fixed via
`import.meta.url`; documented the rule in games/README.md; hub now shows
`start()` errors on screen instead of a dead grey canvas.

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
- Hub asset-path fix (this commit): `games/archipelago/src/render.js`
  tile paths resolve via `import.meta.url`, not page-relative; added
  games/README.md rules (import.meta.url for assets; test through the
  hub before sign-off); hub `launchGame()` now shows `start()` errors
  on screen instead of leaving a dead grey canvas.

## Next

1. Live two-peer test on two different networks (Felix, manually) now
   that ICE_SERVERS points at a real relay.
2. Otherwise proceed per AGENTS.md build plan / risk list.
