# Will It Fit?

One of you pours, the other catches. Arc a stream of material into a vessel and keep it
inside — every drop you spill is gone for good, drained from a shared pool that the run
eventually dies without.

Owner: kenny. Full design and the reasoning behind every decision: [DESIGN.md](DESIGN.md).

## Build status — stage 1 of 5, signed off

The [build plan](DESIGN.md#build-plan) is a tracer bullet. **Stage 1 is done and signed off by
Kenny after play** (2026-09-13): the ballistic stream, the CA, the flight→settle handoff,
vessel generation, filling, overflow and the reserve economy all work, solo, with no
networking.

Four rounds of play feedback shaped it, and three of them were the same class of bug — the sim
*deleting* something at the moment it *decided* something, so it vanished instead of playing
out:

| reported | cause |
|---|---|
| "hits the bottle and it's like a wall" | grains converted to cells at the mouth, losing all momentum |
| "drops that miss disappear suddenly" | doomed grains deleted in mid-air rather than falling away |
| "make the material deflect from the bottle" | no collision against the vessel's outside at all |
| "pool seems to do nothing, spill is redundant" | reserve reconciled per stage, not live; two meters saying one thing |

Worth remembering for stage 2: tilt introduces exactly this kind of seam again, when grains
start sliding out of a tipped mouth.

| stage | what | status |
|---|---|---|
| 1 | CA in a static upright vessel, solo, with the arc | **done** |
| 2 | Vessel tilt via rotated gravity | next |
| 3 | Stages, pool economy, role swap | partly (economy is in) |
| 4 | Lockstep netcode + hub integration | not started |
| 5 | Mobile tilt input | not started |

Right now you play the **pourer**. The vessel is static, so there is nobody to catch yet —
vessel control arrives in stage 2, and the grid is already bottle-local so that lands as a
gravity rotation rather than a rewrite.

## Playing

Open [`index.html`](index.html) directly, or via a static server.

| | |
|---|---|
| aim | move the mouse — the ghost arc shows where it lands |
| pressure | mouse wheel, or `W` / `S` |
| pour | hold click, or hold `space` |
| restart | `R` |

`?seed=N` for a specific run.

Angles are **positive above horizontal** (a lob) and negative below. Pressure sets exit speed,
so the two together are what let you arc material over a lip instead of dribbling it straight
down.

## How it works

**Two regimes, one handoff.** Material in flight is ballistic, in world space, in fixed-point
integers. Material that has landed is cells in a falling-sand CA on the vessel's own local
grid. A droplet converts at the mouth — and only on the tick it *crosses* the mouth plane, so
a fast drop can't tunnel through the rim. That seam is the most delicate part of the build
(DESIGN.md risk 7) and it is where near-misses either feel fair or feel arbitrary.

**Everything the sim touches is an integer.** No floats, no `Math.random()` — one seeded
xorshift PRNG, precomputed integer trig tables, positions scaled by 256. This is not
fastidiousness: lockstep netcode (stage 4) means both peers run the identical simulation and
only inputs cross the wire, and a single float or stray `Math.random()` would desync them into
teleporting material. There is a test asserting the sim never calls `Math.random`.

**Materials are one parameterised ruleset.** `spread` (sideways slide chance), `cohesion`
(self-stickiness) and `grain` cover water through molten steel. Water levels out flat, magma
piles in a cone. Adding a material is a table entry, not a new simulation.

**Vessels are per-row interior spans** — for each grid row, which columns are inside. Bellies,
necks and tapers are all the same code, wall collision is two integer comparisons, and
generation is seeded so both peers build the identical vessel with nothing crossing the wire.

## Tests

```
node games/will-it-fit/test/invariants.mjs
```

35 checks, headless, no browser — per the tool-economy rule in `AGENTS.md`. Vessel generation
(240 vessels validated), ballistics, the handoff, conservation of material, filling and
overflow, determinism, material behaviour, and that the aim preview matches the real droplet
path exactly.

Two things they caught during the build: the aim angle convention was inverted relative to its
own documentation and the range barely permitted a lob at all, and the preview originally had
its own copy of the launch maths — the seed of a preview that eventually lies to the player.
Both are now single-sourced through `launchVelocity` / `traceArc`.

## Not done

**No hub launch yet.** `games/README.md` requires testing through the hub before sign-off,
because the hub loads `game.js` from a different URL than the solo entry — the rule exists
because archipelago's tiles 404'd exactly that way. This game loads no assets at all, so the
risk is low, but the box is genuinely unticked.

The reserve economy numbers (`POOL_MAX`, spill cost, source volume, the doubling refill
schedule) are still guesses. Nothing has been played past a few stages, so whether a run dies
at stage 8 or stage 80 is unknown.

Stage 2 is next: vessel tilt via rotated gravity, which is where the catcher's seat and the
"harder as it fills" pressure actually arrive.
