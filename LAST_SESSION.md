# Last session

**2026-09-11 — Stage H housekeeping + Dino Rumble** — live URL into
README/AGENTS; `grill-me`/`grilling` skills vendored into `.claude/skills/`
with attribution; `docs/SKILLS.md` index + AGENTS.md Skills section;
two-network test retired from Next (passed). Kenny added
`games/dino-rumble/`, a 2-player play-fighting game — verified headless
(61/61), **not yet opened in a browser or run through the hub**.

## Today's sessions

- Batches 0-1.5 (3035e0a..93367f9): hub scaffold, CC0 tileset, real
  `generateIsland(seed)` + isometric render; game.json/game.js contract,
  hub owns PeerJS; manifest.js + vercel.json; docs/COLLABORATION.md.
- Stage 3 Batches 1-2: real `shared/net.js` on vendored PeerJS + hub
  lobby. **Found live**: data channel never opened — `dig` confirmed
  PeerJS's shipped `eu-0`/`us-0.turn.peerjs.com` pair has no DNS record.
- Stage 2 + hub fixes (a071de1, 41a68e1): movement/camera/fog merged;
  shareable address bar, guest timeout. TURN fix (6ddd21b): explicit
  `ICE_SERVERS` (Google STUN + Open Relay free TURN) + ICE diagnostics.
- Hub asset-path fix (c25d340): archipelago tile paths via
  `import.meta.url`, not page-relative; games/README.md rules added; hub
  `launchGame()` shows `start()` errors on screen, not a grey canvas.
- Two-network test (docs/MISSION-CONTROL.md): Felix + Kenny connected
  across two networks, same island. **Passed.** Stage H (47b7c0a):
  docs/skills cleanup, see above.
- Dino Rumble (Kenny): `games/dino-rumble/` — 2-player fighter, pep not
  health, first to 3 flops. Procedural canvas dinos (no vendored art);
  latency-tolerant netcode, hits attacker-authoritative and cheatable by
  design. `node games/dino-rumble/test/invariants.mjs` = 61 checks, which
  caught a missing push-box. Rationale in that folder's README.

## Next

1. Archipelago tuning from real play: `VISION_RADIUS` (5) and spawn
   distance (18) in `games/archipelago/src/config.js`; player sprite
   instead of marker; landmarks worth finding.
2. Dino Rumble needs a human eye — browser + hub launch, plus the
   feel/cuteness calls, which are Kenny's rather than an agent's.
3. Otherwise per docs/MISSION-CONTROL.md backlog (hub lobby polish).
