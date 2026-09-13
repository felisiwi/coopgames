# Last session

**2026-09-13 — Will It Fit? stage 1, signed off (Kenny)** — 43/43 headless,
not hub-launched yet; see `games/will-it-fit/README.md`.

**2026-09-11/12 — Windward W0.6: wave amplitude fixed to boat scale, boat
bob/tilt, explicit boat-model load, HUD clear of hub pill** (commit
f92c58c, pushed to main). W0.5's water amplitude (up to 4.4m) was
submerging the ~6m boat; W0.6 caps displacement at 0.5m and gets visibility
from crest/trough shading instead. Also fixed a hub-level canvas-sizing bug
(`hub.css`) that was silently breaking rendering of any game launched
through the hub picker.

## Today's sessions

- Hub scaffold, CC0 tileset, `generateIsland(seed)`, manifest.js, vercel.json.
- `shared/net.js` on vendored PeerJS + hub lobby; found PeerJS's shipped TURN
  hosts have no DNS record (fixed later with Open Relay TURN).
- Stage D (PR #1): drop-in play — host plays solo, guest gets `'launch'`.
- Windward W0 (felix): DESIGN.md from `/grill-me`, sail speed/trim model
  (10/10 headless tests), boat/camera/wind/hud modules, 20 Hz `pos` sync.
- Windward W0.5 (felix): fixed-orientation camera, real CC0 boat model,
  wind-aligned water shader, HUD compass rose, buoy/rock scatter, wake;
  wrap screenshot caught and fixed a stretched compass canvas + invisible
  water.
- Windward W0.6 (felix): wave amplitude capped at 0.5m (boat scale — W0.5's
  4.4m was submerging the boat), crest/trough shading for visibility at that
  scale, JS/GLSL wave-height parity (`water.test.js`), boat model load made
  explicit (fixed `boat.test.js`'s stray fetch stack trace), boat bob/tilt
  from the wave surface, HUD pushed clear of the hub's waiting-for-friend
  pill, and a `hub.css` canvas-sizing feedback-loop bug (missing explicit
  width/height let Three.js's own `renderer.setSize()` balloon the canvas
  on every resize) that was breaking rendering for any game through the hub.

## Next

1. Play-test Windward W0.6 (hub, two real networks per AGENTS.md risk #1);
   tune `src/config.js` (turn rate, trim window, wind cadence, tilt gain).
2. Windward: gust telegraphing (W3); islands/claiming/scoring (W1) not in
   scope — scatter.js's buoys/rocks are throwaway.
3. Will It Fit? stage 2 (vessel tilt); then docs/MISSION-CONTROL.md backlog.
