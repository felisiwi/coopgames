# Collaboration protocol

For any agent running on Felix's or Kenny's machine in this repo. Read this before you touch
anything, and follow it exactly — it's what keeps two people working in one repo from clobbering
each other.

## Session start

`git pull --rebase origin main` before touching anything. If it fails, stop and report the
conflict — never resolve it silently. The human decides how to reconcile it, not you.

## Session end

Push. No local-only backlogs — unpushed work is invisible to the other person, and the next
session (theirs or yours) starts from what's on `origin/main`, not from your local commits.

## Folder ownership

`games/<name>/` belongs to whoever created it, recorded in its `game.json` as `"owner"`. In your
own folder, commit straight to `main` (still following Session start/end above).

## Someone else's folder, or a shared surface

Working in someone else's `games/<name>/`? Or in `shared/`, the root hub files (`index.html`,
`hub.css`), `scripts/`, `AGENTS.md`, or `docs/`? All of these are shared surfaces:

1. Branch as `<yourname>/<what>` (e.g. `kenny/fix-fog-timer`).
2. Push the branch, open a PR on GitHub, and stop — the owner merges (for a shared surface with no
   single owner, either of you can merge, but still go through a PR).
3. Keep the change small, and say what it affects in the PR description.
4. Vercel gives every branch a preview URL — put it in the PR.

## Never

- `git add -A` — stage specific files, always.
- Force-push.
- Rewrite history on `main`.
- Commit a generated file (`games/manifest.json` is the current example — see `.gitignore`).

## Handoff

`LAST_SESSION.md` at the repo root is the pointer (workspace cap: 40 lines). If the latest entry
is someone else's session, read it before starting yours.

## Compatibility

A game must keep working against the `shared/net.js` contract documented in `games/README.md`.
Changing that contract is a shared-surface PR (branch + PR, per above) that updates every existing
game in the same PR — never a contract change that leaves games on the old shape.
