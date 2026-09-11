# Dino Rumble

Two dinosaurs play-fighting, Street Fighter style. Chomp, tail-swipe and
block until someone flops over, tuckered out. Nobody gets hurt — there is no
health bar, only **pep**, and running out of it means you flop on your back
and wiggle your legs for a couple of seconds.

Owner: kenny. Plugs into the hub via the standard `games/README.md` contract.

## Playing

**Online** — pick it from the hub; the hub makes the connection and hands
the game a `net` object. You are always on the left-hand controls:

| | |
|---|---|
| move / jump / crouch | `W` `A` `S` `D` |
| chomp (fast, chips) | `J` |
| tail swipe (slow, sends you flying) | `K` |
| block | `L` |

**Same keyboard** — open `index.html` directly (or via
`python3 -m http.server`) for couch versus, no hub and no networking at all.
Player two gets the arrow keys plus `,` `.` `/`.

| URL param | effect |
|---|---|
| `?seed=N` | pick a specific jungle clearing |
| `?mode=net` | exercise the online code path instead of couch versus |
| `?role=guest` | start as Tri rather than Rex |

## The fight

- **Pep** regenerates slowly while you are idle or walking, but not for
  ~1.6s after you get hit, and never while you hold block — turtling has a
  cost, though it can never flop you on its own.
- **Blocking only works in the direction you are facing.** Dinos auto-turn
  to face each other, so this mostly matters when you jump past someone.
- **Chomp** is 8 pep and fast enough to use in traffic; **tail swipe** is 19
  and slow enough to be punished on whiff. Roughly 14 chomps or 6 tails to a
  flop.
- First to 3 flops wins the romp, then it resets and you go again.

Every one of those numbers lives in [`src/config.js`](src/config.js) — tune
the whole feel there without reading the state machine.

## Netcode

Fighting games are the most latency-sensitive genre there is, and this repo's
WebRTC path was still unverified end-to-end when this was written. So rather
than rollback or lockstep (weeks of work, and both assume a connection that
works), this is deliberately the latency-**tolerant** design:

- Each peer simulates **only its own dino** and broadcasts a snapshot 30×/s.
  Your own inputs are never delayed.
- The remote dino is **not simulated locally** — it plays back snapshots,
  eased toward the latest. A dropped packet degrades into a small glide
  rather than a desync.
- Hits are **attacker-authoritative**: if my hitbox overlaps your hurtbox on
  my screen, I say so and you take it. No "I swear that hit" arguments — at
  the cost of being trivially cheatable. That is the right trade for two
  friends play-fighting and the wrong one for anything competitive. If this
  ever needs to be fair, that is the line to change.
- Push-boxes are resolved **half by each peer**, so neither side ever moves a
  fighter it does not own, and the two halves add up to the same separation
  couch mode produces.

Only positions, hits and round bookkeeping cross the wire; the host is the
tiebreaker on the scoreline. The jungle is generated from the hub's `seed`,
so scenery never needs syncing.

## Tests

Headless, no browser, per the tool-economy rule in `AGENTS.md`:

```
node games/dino-rumble/test/invariants.mjs
```

61 checks over physics, attack frame windows, hitbox mirroring, blocking,
pep economy, push-boxes, round reset, a full simulated round, and stage
determinism (same seed ⇒ same clearing). These caught a real gap during the
build: there were originally no push-boxes at all, so the dinos walked
straight through each other and the spacing game — the actual substance of a
fighter — did not exist.

## Art

No sprite sheet, by choice. The dinosaurs are drawn from canvas paths and
posed directly from the state machine, so there is nothing to license, no
files to vendor, and no animator needed for a new move — see the pose table
at the top of [`src/draw.js`](src/draw.js).
