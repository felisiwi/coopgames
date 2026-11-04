# Design checks — Archipelago

Audited after the six hub-wide checks in
`.claude/skills/design-audit/SKILL.md`.

## What counts as discoverable

A tile type listed in `CONFIG.DISCOVERABLE_TYPES` (`src/config.js`).
Today that is **only `landmark`** — one tile per island, the land tile
furthest from the coast. Terrain (sand, grass, forest, rock) is scenery,
not a discovery. Add a type to the list when the game gains something new
worth finding, and update this section in the same commit.

## Every stretch of island has something worth finding
**Principle:** exploration is only rewarding if walking somewhere new
tends to pay off.
**Why:** large empty stretches teach players that wandering is pointless,
and the game is nothing *but* wandering.
**How to check:** dead-zone % from `src/serendipity.js` — the share of
walkable tiles more than `CONFIG.SERENDIPITY_DEAD_ZONE_TILES` (10) walking
steps from anything discoverable. Run seeds 1, 2, 3. Target: under 25%.
See it in the browser with `?debug=serendipity` on the solo entry.

## Finding each other takes a few minutes, not zero and not forever
**Principle:** the "where are you?" search is the game's main shared goal.
**Why:** spawn too close and there's no search; too far and a short
session never produces the reunion.
**How to check:** walking distance between `spawnA` and `spawnB` against
`VISION_RADIUS` for seeds 1–3 (headless, from `generateIsland`); whether
anything helps players head towards each other. The feel needs a playtest:
time from spawn to first sighting.

## The island reads as a place, not a noise field
**Principle:** a cozy archipelago island should have recognisable parts —
beach, meadow, forest, rocky heights.
**Why:** if every tile looks like its neighbours, there's nothing to
describe to the other player ("I'm by the rocks").
**How to check:** tile-type proportions per seed (headless); visual
judgement goes to Felix via photo spots (`?spot=1..3`).
