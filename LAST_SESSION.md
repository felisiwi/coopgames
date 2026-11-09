# Last session

**2026-11-09, docs rewrite on `felix/mc-rewrite`, based on origin/main 3b9beca (pushed, NOT merged).**
`docs/MISSION-CONTROL.md` is now rules only; this file is now state only. Rules: `docs/MISSION-CONTROL.md`.

## Games in the repo (`ls games`, `games/*/game.json`)

- `archipelago` (Felix; obsolete predecessor, no invariants test)
- `dino-rumble` (Kenny's; invariants test passes)
- `will-it-fit` (Kenny's; invariants test passes)
- `windward`: MOVED to `felisiwi/windward` (live at windward-pi.vercel.app). Frozen copy stays here, `"hidden": true` in
  `game.json`, so the hub picker skips it. Its old index.html redirects to the new address with saves.
- `_template` (starting point for new games, not listed)

## Merged on origin/main

- 3b9beca (2026-11-08): Windward moved, old link carries saves to the new address, hidden from hub.
- a3490d9: save bridge, frozen copy and the optional `hidden` flag in `scripts/manifest.js` (tested).
- Hub checks pass on 3b9beca: `scripts/manifest.test.js`, dino-rumble and will-it-fit invariants.

## Open (unmerged remote branches, `git branch -r --no-merged origin/main`)

- `felix/hub-guest-rejoin`: 2 commits, guest rejoin opt-in per game via `"rejoin": true`.
- `felix/windward-touch`: 1 commit from 2026-11-04, Windward touch controls (Windward is hidden from the hub now).
- `kenny/hub-mobile` (2026-09-13) and `kenny/last-session-append-only` (2026-09-11): Kenny's, not ours to delete.
- `felix/mc-rewrite`: this docs rewrite.

## Housekeeping

- Laptop worktrees `../coopgames-busy-today`, `-chapter1-1950`, `-sailfeel`, `-sound-lab` sit on branches already merged
  into main (candidates to remove with Felix's OK); `-rejoin` is on the unmerged branch above.
- Merged remote branches are still on GitHub (about 18, mostly `felix/windward-*`). Deleting them is Felix's command.

## Not verified, dropped from the old file

- Whether `felix/hub-guest-rejoin` still waits on Felix's two-phone test, and the hub "Connection lost" panel bug: no record on disk.
- The old Windward state, TODO list and next steps: now belong in the windward repo.
