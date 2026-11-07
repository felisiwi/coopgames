# Agent 1: Islandsberg model fix (written 2026-11-07)

---

You are agent 1. Small model fix. New worktree from the latest main:
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-islandsberg -b felix/windward-islandsberg-model origin/main
Research (docs/CORRECTIONS-TODO.md, data/island-lore.json, fyr.org via the lore): Islandsberg's 1883 light
sat behind a row of windows on the upper floor of one gable of the keeper's house (seaward gable white, the
rest red), not in a lantern on the roof ridge. The game's model still draws a ridge lantern (flagged
TODO(felix) in the data). Find where that model is built (lighthouse meshes / lantern.js / era assets) and
change it to the gable-window light, lit and dark states as the other lights do. Do NOT touch game.js
(agent 2 is changing it); if the fix truly needs game.js, stop and report. Keep the rewind and relight
working. Tests pass; a 390x844-ish screenshot of the house lit and dark that you've looked at. Commits:
author `Claude <noreply@anthropic.com>`, Co-Authored-By / Claude-Session lines. Push at the end; do not
merge; report with the preview URL.
