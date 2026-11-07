# Heads-up for Kenny: Windward is moving to its own repo; the manifest gains an optional `hidden` flag

**FYI, not a sign-off.** Felix decided no OK is needed from you. This is here so nothing in the hub changes under you without you knowing.
Written 2026-11-07. Plan: `docs/WINDWARD-SPLIT-PLAN.md`. Nothing visible changes yet; this describes what is built and what is coming.

## What changes, in one sentence

Windward is being split out of this repo into `felisiwi/windward` (its own address), and to let a game leave the hub picker without being deleted,
`scripts/manifest.js` now skips any game whose `game.json` has `"hidden": true`.

## What this means for your games

**Nothing.** `hidden` is optional and defaults to false: a `game.json` without it behaves exactly as before. Every game is still listed, still live at
`/games/<name>/`, still started by the hub. `shared/net.js` and the hub's `index.html` are not touched. Only these change:

| Where | Change |
|---|---|
| `scripts/manifest.js` | One line: skip a game when `game.hidden === true` (only a real boolean `true`; a stray string does not hide anything). Tested by `scripts/manifest.test.js`. |
| `games/windward/` | `frozen.html` (a frozen, labelled copy of today's entry), `src/save-bridge.js` (+ test), `BRIDGE.md`, and a switched-off redirect in `index.html`. |
| `games/README.md` | One paragraph documenting the `hidden` field. |

## When Windward actually leaves the hub

Later, in one commit, once Felix's final address exists: `games/windward/game.json` gets `"hidden": true` and `index.html` gets its redirect address
(`games/windward/BRIDGE.md` has the steps). Windward then disappears from the hub picker; the other games are unaffected. If you want to hide a game of
yours the same way, add `"hidden": true` to its `game.json` and run `node scripts/manifest.js`.
