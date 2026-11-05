# Windward — W0 design

## Reference labs

Frozen decision tools, kept exactly as they were when Felix decided (`ref/`): `look-lab.html` (decided the Bohuslän look: split style, smooth toon water, granite palette), `control-lab.html` (decided the phone controls), `lighthouse-timeline.html` + `lighthouses-kit.js` (decided the 29 west-coast towers: looks, game heights 6 + 0.5 x real, built-year order; kit snapshot at fe4d1ec). Change the live labs, not these.

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

**Curve retuned 2026-09-12 (W0.8, see the W0.8 section below for the full
diagnosis) — window/floor numbers below superseded.** Original values (±15°
full-speed window, 0.5 floor) are kept here for the historical record.

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
between 0° (full in) and 90° (full out). Turn rate 90°/s (superseded, W0.8).

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
**Raised to `BOAT_MAX_SPEED` = 14 m/s (2026-09-12, W0.8) — see the W0.8 section
below**; self.speed also no longer snaps straight to that target, it eases
there under SAIL_FORCE/DRAG.

**Boat asset (added 2026-09-11, Batch 2):** the placeholder box hull is
replaced by Kenney's "Pirate Kit" `ship-small.glb` (CC0, `assets/LICENSE.txt`
records provenance), scaled from its native ~8.8m hull length down to the 6m
target. Its `sail-a` node is reparented under a runtime pivot at its mount
point so `setSailAngle` can still swing it for trim, same mechanism as the
box placeholder. Self/other are distinguished by tinting only the sail's
(cloned) material — hull and flags keep the model's natural colors.

**Water + wind readability (added 2026-09-11, Batch 3; wave/light tuning
2026-09-12 after the wrap screenshot showed a flat-looking sea):** the flat
blue plane is replaced by `src/water.js` — a 128×128-segment plane displaced
in a vertex shader by 3 summed sine waves aligned with wind direction and
scaled by strength, flat-shaded via a fragment-shader normal from
`dFdx`/`dFdy` on world position (cheap: no analytic wave normals, no
CPU-side geometry updates). Amplitude (1.4-4.4m) and the fragment shader's
own light direction are deliberately exaggerated/stylized past realistic
scale — at the W0.5 fixed camera's steep, near-overhead vantage, a
physically-scaled swell under the scene's own near-overhead sun was
imperceptible; a lower, more grazing `uLightDir` plus a sharp glint term
(`pow(diffuse, 12.0)`) make the facets read clearly instead.
`src/windArrow.js` adds a world-space arrow above the boat pointing
where the wind blows to, length scaled by strength; `src/hud.js`'s new
compass-rose canvas shows the same wind bearing plus the boat's heading,
alongside the unchanged text HUD. `src/scatter.js` seeds ~30 throwaway
buoys/rocks over a 600m square (same `seed` as the rest of the world, offset
so its PRNG stream doesn't collide with `wind.js`'s use of `seed`) so
movement reads against something until W1's islands land. `src/wake.js` pools
24 fading/growing foam disks spawned behind each boat while it's moving.

**Wave amplitude corrected to boat scale (W0.6, 2026-09-12):** Batch 3's
amplitude (1.4–4.4m) was tuned only against a screenshot and, at the fixed
camera's distance, read as a flat plane at realistic scale — but it was also
enough to fully submerge the ~6m boat, which sits at a fixed `y=0`. `src/water.js`'s
`WAVE_CONFIG` now caps total displacement at 0.5m, and both the GLSL vertex
shader and a JS `waveHeight(x, z, t, strength, localDir)` (used to bob/tilt
the boat in `game.js`, `src/water.test.js` checks the two stay in lockstep)
are generated from the same numbers. Visibility at that smaller scale comes
from a crest/trough colour band driven by the wave's raw phase (independent
of amplitude, so it doesn't wash out as amplitude shrinks) plus shorter
wavelengths than Batch 3 used (still comfortably above the 128-segment/600m
plane's ~4.7m vertex spacing, to avoid aliasing). GLSL float literals must
carry a decimal point (`0.0`, not `0`) — a bare-integer `phase: 0` broke
shader compilation the first time through; `glslFloat()` guards this now.
Boat loading is now explicit (`boat.js`'s `loadBoatModel()`, called once from
`game.js` before any `createBoatMesh()`), not triggered by `createBoatMesh()`
itself — otherwise `boat.test.js` (plain node, no DOM) threw an unhandled
`fetch` rejection for the model's `file://` URL just from exercising the
module. The wrap screenshot for this batch also surfaced a hub-level bug
(not Windward-specific, fixed alongside since it silently broke the boat
render through the hub): `hub.css`'s `#game-canvas` set only
`position:fixed; inset:0`, no explicit `width`/`height`. Three.js's
`renderer.setSize()` writes the canvas's `width`/`height` attributes every
resize; without an explicit CSS size those attributes can win the layout box
over `inset` alone, so each resize event fed back into a larger canvas
layout size, compounding — observed ballooning a 1200×751 viewport past
76000px on one run. Fixed by pinning `width:100%; height:100%` (the solo
dev entries already do this).

## Wind

**Cadence superseded 2026-09-12 (W0.8, see the W0.8 section below) — wind no
longer snaps to a new value, it holds then eases.** Delivery/ordering/net
contract gap below still hold, just triggered by phase changes instead of a
single "changed" instant.

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

## W0.8 — sailing feel and HUD (2026-09-12)

Felix played W0.7 and reported six feel notes. In priority order:

**1. Trim didn't affect speed — diagnosed, not a wiring bug.** `self.trim`
was correctly read from input and correctly multiplied into `boatSpeed` —
verified headlessly (trim keys update `self.trim`, `leewardSign * self.trim`
feeds `setSailAngle`, `trimMultiplier` receives the right values). The real
cause: `idealTrim` is itself capped to `0..90°` (angle/2, angle ∈ `0..180°`),
so at a mid-range point of sail (beam reach, ideal = 45°) the *largest* diff
a player can actually produce by sheeting fully in or fully out is only 45°
either direction — nowhere near the old window+floor's 90° needed to reach
the 0.5 floor. Worst case landed around a 1.25x speed spread, imperceptible.
Fix: narrowed the full-speed window (15°→8°) and moved the floor from 0.5 to
0.25, reached at 50° instead of 90° (`TRIM_FULL_WINDOW_DEG`, `src/sail.js`).
A beam reach now spans roughly 2.9x between best and worst sheet position —
inside the "obviously slow / obviously fast" target. `trimMultiplier` stays
a pure function of `|actual - ideal|`, still floors above 0 (never stuck),
still monotonic moving away from ideal (all three re-tested in
`sail.test.js`).

**2. Sail swings to both sides — math was already correct, mesh wasn't
legible.** `leewardSign` (unchanged since W0.6) does flip exactly twice per
revolution at the two structurally correct points (head-to-wind, dead
downwind/gybe) — confirmed with a full 360° sweep in `sail.test.js`. The
`sail-a` mesh, though, is modeled symmetric about its own mount point (local
X spans ≈ -2.2..2.2, read directly out of `assets/ship-small.glb`'s
accessor data) rather than hanging off one edge of the mast, so a pure
Y-axis rotation swings a shape that's already centered on the pivot —
reading as a subtle lean, not "the boom slung hard over," which is very
plausibly what "the sail only ever sits on one side" was describing.
`src/boat.js`'s `applySailAngle` now couples the rotation to a lateral
slide of the pivot's mount point (`SAIL_SWING_OFFSET` = 1.4m at full 90°
trim, `sin(angle) * offset`) so the whole assembly visibly moves toward the
leeward side, not just rotates in place. Not verified visually this stage
(no Chrome tools) — Felix's call once played.

**3. Boat was too slow — raised, plus real weight.** `BOAT_MAX_SPEED` 8→14
m/s (1.75x, mid the requested 1.5–2x range). `TURN_RATE` scaled by the same
1.5x (90°→135°/s) to keep turning radius (speed / angular rate) from
ballooning at the new top speed. `self.speed` no longer snaps straight to
the sail model's target speed each frame — `game.js`'s `approachSpeed` eases
it there at `SAIL_FORCE` = 6 m/s² accelerating, `DRAG` = 4 m/s² decelerating
(slightly slower to shed speed than to gain it), so trim/heading/wind
changes land with some inertia instead of an instant jump. All four are
named `CONFIG` constants.

**4. Wind model — hold, then ease, never snap.** Replaced the old "pick a
new random wind every 25–40s" with a two-phase state machine
(`src/wind.js`'s `createWindController`/`stepWindController`): hold a
steady wind for `WIND_HOLD_MIN_S..MAX_S` (40–60s), then ease to a new random
target over `WIND_TRANSITION_MIN_S..MAX_S` (8–12s), smoothstep-eased so
there's no snap at either end and direction takes the shortest angular path
across the 0/2π wrap. A small bounded sine wobble
(`WIND_NOISE_AMPLITUDE`/`WIND_NOISE_FREQ_HZ`) is layered onto *strength*
only during a transition, so it doesn't complicate the "direction never
jumps faster than the transition allows" guarantee (tested in
`wind.test.js` by bounding the per-step delta against smoothstep's peak
rate). Host still owns the timer; the guest only ever applies incoming
`wind` messages. **Delivery changed to keep the guest's view smooth too**:
during a transition the host resends every `WIND_TRANSITION_SEND_INTERVAL_S`
(0.5s) instead of waiting for the 5s hold-phase heartbeat; both cadences
also fire immediately on a phase boundary. Message shape (`{ type: 'wind',
dir, strength, seq }`) and the ordering/`seq` guard are unchanged — the
guest doesn't need to know about phases, it just applies whatever arrives
more often now.

**5. HUD layout + units.** The wind/trim text panel and the compass rose
were side by side (`src/hud.js`); when the text grew wider than the gap
between them it rendered under the rose's opaque background (the "wind 85°
strength 64%" clipped-by-dial screenshot). Restructured into a single
right-anchored column — rose, then text, then a new trim bar, each in a
fixed vertical slot — so no two elements can ever occupy the same
horizontal space regardless of text length. Wind now shows both m/s (honest
range `WIND_STRENGTH_MIN_MS..MAX_MS` = 2–14 m/s, mapped linearly from the
existing 0..1 strength) and knots; boat speed shows in knots
(`CONFIG.MS_TO_KNOTS` = 1.943844, the physical m/s→kn conversion).

**6. Replaced "ideal 71°" with an actionable trim hint.** `src/hud.js`'s
`trimHint` compares actual vs. ideal trim and returns `sheet in N°` / `ease
N°` / `trimmed ✓`, using the *same* `TRIM_FULL_WINDOW_DEG` the physics model
uses for "full speed" — so the HUD's "you're OK" claim can't drift out of
sync with what's actually rewarded. A new small canvas below the text draws
this as a bar too: a track from 0–90°, the full-speed window highlighted
around the ideal point, and a marker for the actual sheet position. The old
`ease out (S)` hint text is gone, folded into the same line.

## First minutes: the wind teaches in stages (Felix, 2026-11-04)

Not built yet — a direction for the opening of every session.

- **Start with an easy wind from behind.** The first wind is a gentle
  run or broad reach for the spawn heading, so the only thing a new
  player has to work out is *where to point*. No tacking, no fiddly trim.
- **Then the wind changes**, so the player discovers the next skill
  themselves: hauling the sail in as the wind comes round, and later
  tacking through the no-go zone.
- Today the opposite happens: `src/spawn.js` faces the boat across the
  wind (a beam reach) and wind shifts are random from the start
  (`src/wind.js`). Implementing this means seeding the first wind
  relative to the spawn heading and scripting the first one or two shifts
  (host-authoritative as now, so both players get the same lesson).

## Upwind should still feel like sailing (Felix, 2026-11-05)

Close to the no-go zone the boat barely moves even with perfect trim: the
polar in `src/sail.js` smoothsteps all the way from 22.5° (0) to 90°
(0.95), so 30° off the wind is ~0.7 kn and 45° is ~5 kn (at 0.75 wind).
Proposed curve, trialled in the Control Lab:
`[[22.5, 0], [28, 0.42], [45, 0.68], [90, 0.95], [100, 1], [180, 0.8]]`
— 30° ~9 kn, 45° ~14 kn, beam reach unchanged at ~19 kn. Upwind stays
slower than reaching (tacking still pays), but it never feels stopped.
Applied to the game 2026-11-05 (`src/sail.js`), locked in by
`sail.test.js`'s "upwind still sails" check.

## Look direction: Look Lab findings (Felix, 2026-11-05)

Explored in a throwaway prototype (claude.ai artifact "Windward Look Lab",
three.js r160). Felix found the faceted water "looking like shit" and the
islands "muted and sad". Settled:

- **Split style.** Objects stay low-poly flat-shaded (boat, houses, pines,
  props). Islands and water get a smooth, painted treatment instead of
  facets. This replaces shared/ART.md's "one facet scale for everything"
  for ground and sea — ART.md needs a PR when this is ported.
- **Water: smooth toon + shore foam.** Smooth waves with analytic normals,
  two soft painted light bands, colour by depth (turquoise shallows ->
  mid blue -> deep blue) from a baked island depth map, foam rings that
  breathe in towards the shore plus a white edge at the waterline. Wave
  speeds never depend on wind strength (the wobble bug); wind changes
  height and the marks below only.
- **Wind on the water: gust patches + subtle wind lines.** Darker, finely
  ruffled patches drifting downwind ("cat's paws") with faint thin lines
  on top; both kept out of the shallows. White crests were rejected.
- **Islands: "Bohuslän" palette, smooth painted ground.** Pale pink-grey
  granite dominant (paler domes, darker veins), Summer-meadow green
  (`#a8e851` / `#74d24b`) only in low, flatter, sheltered hollows, pines
  only in those green pockets, soft heather tufts, a dark wet band at the
  waterline, barely any sand. Crisp zone edges: blending green into pink
  makes brown, which is what read as "sad". All-green islands rejected as
  "not west coast of Sweden".
- Golden haze in the distance kept.

The prototype is saved as `ref/look-lab.html` (and the controls one as
`ref/control-lab.html`) — the reference to port from.

## Phone controls: Control Lab findings (Felix, 2026-11-04)

Explored in a throwaway prototype (claude.ai artifact "Windward Control
Lab", simplified top-down sea using the real sail numbers). Felix's
verdicts so far:

- **Steering: hold to aim.** Hold a finger on the water where you want to
  go; the boat turns towards it. Liked the variant with a **speed line**
  (line to the finger coloured green fast / red no-go, knots shown in a
  pill *above* the finger). Overlay turn buttons rejected: they feel
  mirrored when sailing south. Steering never goes into the no-go zone.
- **Sheet: a second thumb.** Two favourites:
  - **Move it like the dot** — the thumb moves the dot along the arc in
    the same direction; finding the sweet spot feels like a bullseye.
  - **Pull the rope** — the thumb holds the end of the sheet: pull *away
    from the boat* to haul in, back towards it to ease. Fully eased is
    reached at a ring just outside the arc (never cover the boat). The
    rope sags as it slackens — Felix likes that.
  - Plain up/down was confusing ("which way?"); the sail's side flips
    with the tack, so screen-direction rules don't map.
- **Feedback: the sweet-spot arc** round the boat (green zone + dot).
- **Hints: thumb arrow + ghost thumb.** The arrow points the way to move
  the *thumb*, floating ~80px above it so the thumb doesn't hide it; a
  dashed ghost thumb appears when the sail has been off for a moment.
  Anything shown at a finger must sit above it, not under it.
- Wind is read at the boat (streaks on the water + no-go wedge), not from
  a corner compass. HUD in corners with the boat in the middle was
  rejected as hard to read.

## Deferred to later stages

Gust telegraphing (W3, per cadence decision above). Islands, claiming, scoring —
not this stage (see AGENTS.md's Windward concept). Sail trim automation,
if it turns out manual trim isn't fun in practice — Felix's call after playing it.
