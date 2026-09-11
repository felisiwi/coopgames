# Last session

**2026-09-11 — Windward W0 Batches 0-2: grill-me → DESIGN.md, three.js
scaffold, boat/wind/tacking sail model + 20 Hz pos sync** (commits 12d49e0,
df723a6, dc9d202, pushed to main). Boat feel only — no islands yet, per
AGENTS.md's Windward concept. PR #1 (Stage D drop-in play) is merged at
c8fff34; the previous header's "not merged" note was stale, corrected here.

## Today's sessions

- Batches 0-1.5: hub scaffold, CC0 tileset, `generateIsland(seed)` +
  isometric render, game.json/game.js contract, manifest.js, vercel.json.
- Stage 3: `shared/net.js` on vendored PeerJS + hub lobby. Found live:
  PeerJS's shipped TURN hosts have no DNS record.
- Stage 2 + fixes, TURN fix, asset-path fix, two-network test (passed),
  Stage H housekeeping, Dino Rumble (Kenny, headless 61/61) — see git log.
- Stage D (branch, merged PR #1): drop-in play — host plays solo, picker
  renders right after `host()`; guest connecting later gets `'launch'`;
  fixed a guest-side inbound-message race and a lobby CSS bleed-through.
- Windward W0 (felix): DESIGN.md from `/grill-me` — sail speed curve
  (no-go zone, polar, smoothstep joins), manual trim (not auto), chase
  cam, and a wind-delivery fix (mission prompt assumed `net.onConnect`,
  which games don't have — replaced with periodic resend + first-message
  detection). Scaffolded game.json/game.js/index.html, vendored three.js
  0.186.0. `src/sail.js` pure speed/trim model (10/10 headless tests);
  boat/camera/wind/hud modules wired into game.js; 20 Hz `pos` sync.

## Next

1. Play-test Windward (solo dev entry, then through the hub); tune
   `src/config.js` (turn rate, trim window, wind cadence) from feel.
2. Windward: gust telegraphing (deferred to W3); islands/claiming/scoring
   not in scope yet.
3. Otherwise per docs/MISSION-CONTROL.md backlog (Archipelago tuning from
   real play, hub lobby polish).
