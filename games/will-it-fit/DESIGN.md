# Will It Fit? — design

Owner: kenny. Status: **build stage 1 shipped and revised twice from play feedback.** See
[README.md](README.md) for what runs today and what is still owed.

Produced by a grilling session (`.claude/skills/grilling`) on 2026-09-13 — 25 questions
across five rounds, every branch resolved before any code. Where a decision went against
the recommendation, that is recorded too; the reasoning is the point, not the verdict.

## The game

One player pours, the other catches. A vessel sits under a stoppered source; pull the cork
and the material falls. The catcher moves and tilts the vessel to keep it inside. As the
level rises it sits closer to the rim, so every tilt costs more — the difficulty comes from
the material's own behaviour, not from a knob anyone tuned.

Spilled material is gone. It drains a shared pool that carries between stages, and when the
pool hits zero the run is over.

Cozy in register, tense in the moment. No combat, no timer, no loss screen — just a run that
eventually ends and a number to beat.

## Settled design

**Material — falling-sand cellular automaton** (Q1). Integer grid, no floats in cell
decisions. Chosen over droplet particles specifically because integer math lets two machines
agree exactly, which is what makes the netcode below possible.

**Vessel control — move and tilt, instant response** (Q2). No inertia, no mass. All of
"harder as it fills" lives in the material, not in a heavier bottle. Mouse-follow on desktop,
device tilt on mobile (Q6).

**Grid and gravity — bottle-local grid, rotated gravity** (Q11). The CA grid is fixed to the
vessel and stays axis-aligned forever; tilting rotates the *gravity vector* the cells fall
along. The vessel renders rotated on a level table. This is what keeps the grid integer and
deterministic while still allowing a tilting container — a world-aligned grid would have to
re-rasterise curved walls every frame and stair-step the edges.

**Sync — lockstep with small input delay** (Q5). Both peers run the identical CA from
identical inputs; only inputs cross the wire, roughly 20 bytes a frame. No grid state is ever
transmitted. Costs a fixed 2–5 frame input delay, which is invisible in a pouring game and
would have been fatal in Dino Rumble — hence the opposite choice there.

**Pourer's verbs — cork, angle, pressure** (Q7, plus Kenny's sign-off addition). Pull the cork
and material runs; re-cork to pause. The spout has an **aim angle** and a **pour pressure**,
and together they make the stream a ballistic arc rather than a vertical dribble — you can lob
material across a gap or lay it in gently from directly above. This is what makes pouring a
skill rather than a faucet with a switch, and it gives the pair something concrete to negotiate
over the phone ("more arc" / "flatter, you're overshooting").

**Two simulation regimes, one handoff.** The arc means material exists in two forms:

- **In flight** — ballistic, in *world* space, obeying real gravity. Not part of the CA.
- **Settled** — CA cells in the vessel's *local* rotated-gravity grid.

A cell converts at the vessel mouth. This handoff is the single most delicate seam in the
build: it crosses coordinate systems (world → bottle-local), it is where determinism is most
likely to break, and it is what decides whether a near-miss reads as "just clipped the rim"
or as material rudely teleporting. In-flight motion uses fixed-point integers (positions and
velocities scaled by 256) for exactly that reason — floats in the flight path would desync the
peers as surely as floats in a cell rule.

**Stage — one pour** (Q8, Q17). Each stage generates a new vessel and ends when the *source
runs dry*, not when a fill line is reached. This is what makes the cork matter: all the
material is coming out regardless, so *when* you pour is the entire skill. A fill-line ending
would reduce the cork to decoration.

**What escalates — aperture, then vessel shape and height** (Q15). Two dials only. Vessel
motion was considered and deliberately deferred.

**Pool — one meter, draining live** (Q4, Q9, Q13, Q14, Q18). Session-only, no persistence.
Spilling drains it; it refills at stages 10, 20, 40, 80, 160 — doubling forever. **No floor:
at zero the run ends**, restart at stage 1 keeping a best-stage record. The pool is the only
stake in the design, so it has to be able to run out.

Revised after play: it originally reconciled once per stage and sat still while you played,
so it read as doing nothing — and a separate "spilled" readout said the same thing inverted.
It now drains one unit per grain the instant that grain is lost, and it is the **only** meter
on screen. The source's level is drawn inside the source, and how full the vessel is you can
simply see, so neither needs a bar. Called the *reserve* in-game.

**Roles swap every stage** (Q21).

**Both roles work on every platform** (Q19). Either seat by mouse or by tilt; two phones,
two desktops, or one of each all work.

**Solo play** (Q23). One player holds the vessel and taps to unstop; the source is automatic.
Deliberately the *same game* as co-op rather than a different one — you practise the catching
skill you bring to a session. Like Dino Rumble's couch mode, it also makes the whole game
playable and testable with the networking stack entirely out of the picture.

**View — identical for both players** (Q16). This design's asymmetry is *verbs*, not
information. Hiding the fill level from the pourer would read as unfair rather than tense;
that trick belongs in turn-based puzzles.

**Materials — water, slush, magma at launch** (Q20, Q25). All three available from stage 1.
Molten steel, molten glass and smoothie are parameter presets away.

**Molten materials do not cool** (Q24). Hot palettes, no thermodynamics. Setting/hardening is
a good mechanic and explicitly a later experiment, not a v1 system.

## Evidence gathered during design

**One parameterised ruleset covers every material.** A throwaway CA, 90 grains, 45 cells wide:

| material | spread | cohesion | width covered | peak height |
|---|---|---|---|---|
| water | 1.00 | 0.00 | 44/45 | 3 |
| smoothie | 0.45 | 0.25 | 40/45 | 4 |
| slush | 0.30 | 0.45 | 31/45 | 4 |
| magma | 0.15 | 0.60 | 21/45 | 6 |
| molten steel | 0.06 | 0.80 | 11/45 | 8 |

Clean monotonic spread from "levels out flat" to "piles in a steep cone". Materials are a
stage-variety dial for nearly free — this is why Q25 could afford three at launch. Grain size
is separately modulable three ways: `grain` (an N×N block moving as one unit), `spread`
(sideways slide chance), `cohesion` (self-stickiness).

**Art constraints, reconciled.** Pastel ground + orange material + "AAA" cannot all hold:
the deepest orange still reading as orange (`#C2410C`) reaches 4.34:1 on cream, and AAA needs
7:1. But 7:1 is a *text* standard — the bar that applies to a game object is WCAG 1.4.11
non-text contrast, **3:1**, which `#C2410C` clears comfortably. Prototype uses deep orange,
no outline (Q22).

| | on cream `#F6E9DC` | on lilac `#EADCEC` |
|---|---|---|
| orange `#C2410C` | 4.34:1 | 3.93:1 |
| vessel dark `#4A4458` | 7.79:1 | 7.06:1 |
| vessel lit `#6B6480` | 4.68:1 | 4.24:1 |

**Look:** soft pastel gradient ground, vessel as a two-toned paper cut-out in darker shades,
material vivid against it. Spilled material falls away into an abyss — there is no catch
floor.

**Revised after first play (2026-09-13).** The orange above was right on contrast and wrong on
feeling: Kenny's note was that it "is not a restoring shade", and the target is spa / flow
state / a Japanese garden rather than anything hot. Orange is out. The palette is now deep
celadon, soft slate and warm clay on rice paper and mist, with a sumi-ink vessel — every tone
re-measured against both background stops, all clearing 3:1:

| | on mist `#E7EAE3` | on paper `#F3F0E8` |
|---|---|---|
| Water, deep celadon `#4F7A72` | 3.96:1 | 4.23:1 |
| Mist, soft slate `#5F7E93` | 3.53:1 | 3.77:1 |
| Clay, warm clay `#A9705A` | 3.35:1 | 3.58:1 |
| vessel `#39443F` | 8.34:1 | 8.90:1 |

The same note asked for finer, slower grains. Cell size halved (6px → 3px), which quarters
grain area and doubles the grid. Pixel speed was halved and gravity **quartered** rather than
halved — range goes as v²/g, so that preserves reach while roughly doubling time of flight —
and the loop now runs one sim tick per frame instead of two. Net effect is an arc that hangs
long enough to watch, at about four times the original flight duration.

That change surfaced a real bug rather than just a tuning shift: a grain that moves one cell
per tick spreads at a rate set by the grid resolution, so halving the cell size quartered how
fast water levelled and it stopped reading as a liquid. Flow rate has to be a property of the
material, not of how finely the world happens to be diced — hence the `flow` parameter (cells
of lateral travel per tick: water 5, mist 2, clay 1). Water now settles to a surface roughness
of 0.46 cells.

## Risks and open questions

Resolve each explicitly during the build, the way `AGENTS.md` does.

1. **Lockstep delay versus "instant response" (Q2) is a real tension.** The vessel is a
   boundary condition of the CA, so it cannot be locally predicted without the simulation
   disagreeing. A 2–3 frame delay (~33–50ms) is almost certainly imperceptible on a tilt, but
   this is the assumption most likely to be wrong, and it is worth feeling before stage 4 is
   built on it. Fallback if it bites: render-only prediction of the vessel transform, accept
   the small visual/sim mismatch.
2. **Determinism is fragile.** One stray `Math.random()` or float comparison in a cell rule
   desyncs the peers, and it will look like material teleporting. Mitigation: a single seeded
   PRNG owned by the sim, no floats in cell decisions, fixed iteration order, and a grid
   checksum exchanged every N frames that hard-fails loudly rather than drifting.
3. **Rotated gravity in a CA is the untested core.** Cells conventionally fall down and
   diagonally; an arbitrary gravity vector needs quantising (8 directions) or a fractional
   accumulator, and intermediate angles may produce visible artifacts. This is stage 1's gate
   precisely because everything else assumes it works.
4. **Mobile expands `AGENTS.md`'s stated v1 scope**, which lists mobile support as out of
   scope. Kenny has called it key (Q12). iOS needs `DeviceOrientationEvent.requestPermission()`
   behind a user gesture, orientation axes vary by device and browser, and neutral-position
   calibration is its own design problem. If it needs hub-level viewport or touch changes,
   those are shared surfaces and go via branch + PR.
5. **Generated vessels can be unplayable** — a neck narrower than the stream, a shape that
   traps material against a wall. Same class of risk as archipelago's ugly islands, and it
   wants the same answer: a generator gate plus several seeds eyeballed before sign-off.
6. **The pool economy is entirely untuned.** Spill cost, source volume per stage, and the
   doubling refill schedule are guesses. First real session with Felix is the tuning pass.
7. **RESOLVED, and it was real.** The flight/settle handoff at the vessel mouth was the
   riskiest seam, and the first build got it wrong in exactly the predicted way: a grain was
   converted to a cell the instant it crossed the mouth plane, losing all its momentum. Play
   feedback was that the stream "hits the bottle thing and it's like a wall all of a sudden,
   breaks the illusion" — which is precisely what the risk anticipated. Fixed by letting a
   grain keep flying *inside* the vessel, colliding with walls and the pile, and only settling
   where it actually lands. Locked in by a test asserting grains are in flight inside the
   vessel (peak ~75 at once, formerly 0). The original wording, for the record:

   **The flight/settle handoff at the vessel mouth** crosses coordinate systems and is where
   both determinism and game feel are most exposed. A cell arriving at a tilted mouth has to
   be admitted, deflected off the rim, or spilled, and getting that wrong makes near-misses
   feel arbitrary. Gate it with explicit tests for rim-clip cases, not just clean entries.

## Build plan

Tracer-bullet ordering. Each stage is playable on its own before the next begins.

1. **CA in a static upright vessel, solo, no networking — with the arc.** *Done when:* you can
   aim by angle and pressure, pull the cork, watch the stream arc into a vessel, fill it, and
   see it spill over the rim. The flight/settle handoff (risk 7) is in from the start, because
   everything downstream is built on top of it.
2. **Tilt and rotated gravity.** *Done when:* tilting spills believably across a sweep of
   angles, with no artifacts at intermediates — risk 3 resolved.
3. **Stages, pool economy, role swap.** *Done when:* a 20-stage run plays end to end and can
   actually be lost.
4. **Lockstep netcode and hub integration.** *Done when:* two peers play a full stage with
   grid checksums matching throughout — risks 1 and 2 resolved.
5. **Mobile input.** *Done when:* tilt works on both iOS and Android, including the permission
   gesture and calibration.

Solo mode means stages 1–3 need no networking at all, and stage 5 can slip without blocking
a playable game.

## Out of scope for v1

Cooling and solidification (Q24 — the first thing to try afterwards), vessel motion (Q15),
persistence across sessions (Q9 — no backend; Firebase remains deferred), materials beyond the
three, more than two players, and any asymmetric-information layer (Q16).
