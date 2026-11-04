# Skills

Index of skills vendored into `.claude/skills/` for this repo. Copied from Felix's local
`~/.claude/skills` (2026-09-11), origin unknown.

| Skill | Purpose | When mission control expects it |
| --- | --- | --- |
| `grill-me` | Trigger alias for `grilling` — call the Skill tool with `"grilling"`. | Same trigger points as `grilling`; use whichever name comes to mind. |
| `grilling` | Relentless round-by-round interview that stress-tests a plan or design before it's built. | Run `/grill-me` before starting work on a new feature or any change to a shared surface (`shared/`, hub root files, `scripts/`, `AGENTS.md`, `docs/`) — per `docs/COLLABORATION.md`'s shared-surface rules. |
| `design-audit` | Audits one game against six hub-wide checks (first 30 seconds, both players matter, a "come here" moment, graceful end, hub contract, true to its own feel) plus the game's own `design-checks.md`. Rates each pass / weak / fail / needs playtest with evidence; report only, changes no code. Writes `games/<id>/AUDIT.md` (newest first) in your own folder, or reports in chat for someone else's. | Before marking a game "playable" or showing it to the other person, and after any big gameplay change. Not for art-only changes (use photo spots + `CHANGELOG.md`, see `games/README.md`). |
