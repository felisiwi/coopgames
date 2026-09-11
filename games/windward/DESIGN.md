# Windward — W0 design

Decisions from a `/grill-me` session (2026-09-11), Batch 0 of Stage W0. Scope: boat
feel (sail speed, tacking, trim, camera) and the wind sync mechanism — no islands,
no scoring, no claiming yet (see AGENTS.md's Windward concept note).

## Sail speed model

`angle` = angular difference between boat heading and the direction the wind is
blowing *from*, folded to `[0°, 180°]` (port/starboard are symmetric). `angle = 0`
is dead upwind, `angle = 180` is dead downwind.

| Zone | Range | Speed factor (before strength/trim) | Why |
|---|---|---|---|
| No-go | 0°–22.5° | 0 (pinned) | ±22.5° half-width — narrow enough that most headings are sailable, wide enough tacking is a real decision. |
| Ramp | 22.5°–90° | smooth 0 → 0.95 | Continuous climb as you bear away from the no-go edge — no plateau, no cliff at the boundary. |
| Near peak | 90°–100° | smooth 0.95 → 1.0 | Small further gain to the sweet spot. |
| Peak | 100° | 1.0 | Fastest point of sail (broad reach). |
| Reach-to-run | 100°–180° | smooth 1.0 → 0.80 | Downwind is slower than broad reach but never punished hard. |

All four segments are smoothstep-interpolated between the key points
`(22.5,0) (90,0.95) (100,1.0) (180,0.80)`, with 0 below 22.5° — one continuous
curve, not independent pieces (that was the explicit correction on the first
draft: the 22.5°→90° ramp must join the 90°→100°→180° polar without a seam).

Final speed = `maxSpeed * strength * speedFactor(angle) * trimMultiplier(...)`.

## Trim (manual, not automatic)

Second control, meant to be fiddly-fun, not automatic. Ideal sheet angle is a
function of angle off the wind: `idealTrim = angle / 2` (close-hauled → sheeted
in tight near 11°; running → eased out near 90°) — the standard "sheet at roughly
half the wind angle" simplification.

`trimMultiplier(actualTrim, idealTrim)`:
- `|actual - ideal| ≤ 15°` → 1.0 (full speed; forgiving window, not pixel-precise)
- `15°–90°` → linear falloff to 0.5
- `> 90°` → floor at 0.5 (bad trim is slow, never stuck — matches "never to 0")

Controls: sheet in/out reuses `shared/input.js`'s four-flag state, reinterpreted —
`up` (W or ↑) = sheet in, `down` (S or ↓) = sheet out, `left`/`right` (A/D or ←/→)
= turn. No changes to `shared/input.js` needed; Windward just reads the flags with
different meaning than the template's dot-mover does. Sheet adjusts at 60°/s
between 0° (full in) and 90° (full out). Turn rate 90°/s.

Sail mesh renders at the actual current sheet angle (visible swing to leeward).
HUD shows a trim bar/hint (ease vs. sheet-in) comparing actual to ideal.

## Camera

**Superseded 2026-09-11 (Stage W0.5, Batch 1).** W0's chase cam rotated with
the boat's heading, which meant wind direction and the compass rotated with
it too — Felix played it and had nothing fixed to judge his heading against.
Also, the chase cam initially snapped-to-boat-facing bug (Batch 0) was a
symptom of a design that made the camera's own orientation load-bearing for
readability in the first place.

Default is now a **fixed-orientation three-quarter camera**: a constant
compass bearing (`FIXED_CAMERA_AZIMUTH_DEG`, `src/config.js`) and elevation
(`FIXED_CAMERA_ELEVATION_DEG` = 52°) from the boat, narrow FOV
(`FIXED_CAMERA_FOV_DEG` = 30°, so it reads almost isometric), far enough
(`FIXED_CAMERA_DISTANCE` = 125) to put roughly 120m across the screen at the
boat's position. Only *position* is damped (dt-based exponential smoothing,
same as before) to follow the boat — orientation never rotates with heading,
so wind arrow / compass rose (Batch 3) stay legible at a glance regardless of
which way the boat is pointed. `src/camera.js`'s `snapFixedCamera` sets the
camera directly (no lerp) at setup, for the same t=0 reason as Batch 0's
`snapChaseCamera`.

The old chase cam (12 units behind, 6 up, looking slightly ahead, wider FOV)
is kept in `src/camera.js` behind `CONFIG.CAMERA_MODE = 'chase'` for
comparison — turns and wake still feel weighty under it, it's just no longer
the default because it fights the wind/compass readability goal.

## World units & scale

1 unit = 1 meter. Boat ~6m long. `maxSpeed` = 8 m/s (~15.5 kn) at full strength
and the 100° peak — tuned to feel brisk in a chase cam, not a realism target.

**Boat asset (added 2026-09-11, Batch 2):** the placeholder box hull is
replaced by Kenney's "Pirate Kit" `ship-small.glb` (CC0, `assets/LICENSE.txt`
records provenance), scaled from its native ~8.8m hull length down to the 6m
target. Its `sail-a` node is reparented under a runtime pivot at its mount
point so `setSailAngle` can still swing it for trim, same mechanism as the
box placeholder. Self/other are distinguished by tinting only the sail's
(cloned) material — hull and flags keep the model's natural colors.

**Water + wind readability (added 2026-09-11, Batch 3):** the flat blue plane
is replaced by `src/water.js` — a 96×96-segment plane displaced in a vertex
shader by 3 summed sine waves aligned with wind direction and scaled by
strength, flat-shaded via a fragment-shader normal from `dFdx`/`dFdy` on
world position (cheap: no analytic wave normals, no CPU-side geometry
updates). `src/windArrow.js` adds a world-space arrow above the boat pointing
where the wind blows to, length scaled by strength; `src/hud.js`'s new
compass-rose canvas shows the same wind bearing plus the boat's heading,
alongside the unchanged text HUD. `src/scatter.js` seeds ~30 throwaway
buoys/rocks over a 600m square (same `seed` as the rest of the world, offset
so its PRNG stream doesn't collide with `wind.js`'s use of `seed`) so
movement reads against something until W1's islands land. `src/wake.js` pools
24 fading/growing foam disks spawned behind each boat while it's moving.

## Wind

- **Cadence**: changes every 25–40s, uniformly random in that range. No
  pre-telegraphing in W0 (deferred to W3 per the mission's stage split) — wind
  just changes and the HUD updates immediately.
- **Authority**: host-only. The guest never runs its own change timer; every
  change after the first comes from a host `wind` message.
- **Initial wind before any `wind` message arrives**: both host and guest derive
  it identically from `seed` via the same seeded-PRNG formula, so the guest's
  boat behaves correctly from frame 1 without waiting on the network.
- **Delivery** (resolves the net-contract gap below): host resends the current
  `wind` message every 5s regardless of change (bounds a late-join's wait to
  5s) **and** immediately on the first message received from a peer it hasn't
  heard from before (covers the common case fast, without relying on
  `net.onConnect`).
- **Ordering**: every `wind` message carries a monotonic `seq`; the guest
  discards any message with `seq` ≤ the last one it applied, so a 5s heartbeat
  can never stomp a newer change delivered out of order.

### Net contract gap (found during grilling, not in the original mission prompt)

The mission prompt's "send `wind` on... `net.onConnect`" assumes a hub API games
don't actually have — `games/README.md`'s public `net` object is
`{ send(msg), onMessage(fn), peerId, isHost }` only; `onConnect`/`onClose` are
hub-internal (`shared/net.js` reduces the object before handing it to
`start()`). Resolved above: periodic resend + first-message detection replaces
`onConnect` entirely, using only the documented contract.

## Message shapes

`t`/single-letter field names collide with the existing convention in this repo
(`archipelago` already uses `msg.t` as the *type* discriminator, e.g.
`msg.t === 'pos'` — see `games/archipelago/game.js`). To avoid ambiguity between
"type" and "timestamp", Windward spells both out:

```js
// 20 Hz, either peer → other
{ type: 'pos', x, z, heading, speed, ts }

// host → guest, on change / every 5s / on first message from an unknown peer
{ type: 'wind', dir, strength, seq }
```

`x`/`z` are world-plane coordinates (boat sits on the water plane, `y` is up and
unused for position sync). `heading`/`dir` in radians. `strength` normalized
`0..1`. `ts`/`seq`: `ts` is `performance.now()`-style, informational only (no
interpolation logic in W0); `seq` is the ordering guard above.

## Deferred to later stages

Gust telegraphing (W3, per cadence decision above). Islands, claiming, scoring —
not this stage (see AGENTS.md's Windward concept). Sail trim automation,
if it turns out manual trim isn't fun in practice — Felix's call after playing it.
