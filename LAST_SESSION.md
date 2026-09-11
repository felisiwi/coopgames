# Last session

**2026-09-11 — Stage 3 Batch 2 (this commit)** — hub lobby + launch flow,
real `net.js` on vendored PeerJS. Networking code is in; the live
same-machine two-tab test could not be verified end-to-end this session
(see below) — Felix is doing a manual Chrome+Safari test next.

## Today's sessions

- Batches 1-3 (3035e0a..34a862c): hub scaffold, curated CC0 tileset, real
  `generateIsland(seed)` + isometric render — seeds 1-5 pass all
  invariants. Pushed (e702ac9), Kenny joined as collaborator.
- Stage 1.5 (21a6782): game.json/game.js contract, hub owns PeerJS per
  AGENTS.md, scripts/manifest.js + vercel.json wire discovery.
- Batch 0 (93367f9): docs/COLLABORATION.md — session start/end, folder
  ownership + branch/PR rule, never-list, this handoff file's own rules.
  `games/manifest.json` untracked + gitignored, generated only.
- Stage 3 Batch 1: real `shared/net.js` on `shared/vendor/peerjs.min.js`
  (1.5.5, MIT, no CDN at runtime). `host()`/`joinFromUrl()` on PeerJS
  defaults, no custom ICE config.
- Stage 3 Batch 2: hub lobby (host → copy-link → picker → launch) wired
  to `net.js`; `games/_template/` is now a real 2-dot WASD game (20Hz
  broadcast). **Unverified live**: a same-machine two-tab test never got
  the WebRTC data channel to open (ICE stuck checking→disconnected).
  `dig` against 8.8.8.8/1.1.1.1 confirms `eu-0`/`us-0.turn.peerjs.com`
  have no DNS record — PeerJS's shipped TURN pair is dead, so risk 1's
  "TURN is free" conclusion no longer holds; it's STUN-only in practice.
  Same-machine failure may be macOS Local Network permission for Chrome
  (unchecked, not a repo fix).

## Next

1. Get a live two-peer connection confirmed (Felix, manually). If it
   still fails cross-browser/cross-network, revisit the Step 0 audit's
   "no custom ICE config" call (real TURN server).
2. Stage 2: single-player movement (WASD, camera-follow, fog-of-war) for
   archipelago — wrap its existing src/ into game.js per the contract.
   Cut order if it overruns (AGENTS.md risk #3): dimmed fog middle-state
   first, then widen vision radius, then static camera.
