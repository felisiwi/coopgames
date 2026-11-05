# Design checks — Windward

Audited after the six hub-wide checks in
`.claude/skills/design-audit/SKILL.md`. Feel document: `shared/ART.md`.
Mechanics: `DESIGN.md`. Direction (2026-09-12): cosy, slow co-op on the
west coast of Sweden; each player keeps their own boat.

## What counts as discoverable

Nothing yet. Islands are scenery; there are no objects, landmarks or
pickups. Props (jetties, boathouses, lighthouses, channel markers) arrive
with stage P1. When they do, list which ones count here and add a
dead-zone measurement: the share of open water too far from
anything worth sailing to.

## Sailing is a skill you can feel yourself getting better at
**Principle:** the wind, the no-go zone and sail trim are the game's core
verb; mastery should be visible.
**Why:** if trim makes no visible difference, or tacking is a chore, the
one thing the game asks you to do isn't fun.
**How to check:** read `src/boat.js`/`src/sail.js` and their tests — does
trim change speed measurably, is the no-go zone enforced, does the HUD
show the effect? The feel is a playtest call.

## The sea tells you about the wind
**Principle:** `shared/ART.md` — "the sea is how the player reads the
wind".
**Why:** if players have to read numbers to sail, the HUD becomes the
game.
**How to check:** wave amplitude/speed in `src/water.js` scale with wind
strength per ART.md's formula; wind direction visible without the compass.

## Going somewhere is worth it
**Principle:** an archipelago invites you to sail to the next island.
**Why:** a pretty sea with nothing to sail *for* gets put down after a
few minutes.
**How to check:** whether anything in the world differs between islands
or rewards arriving; until P1, expect fail.
