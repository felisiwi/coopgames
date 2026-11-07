# Split agent: create felisiwi/windward with history (phase 1 of docs/WINDWARD-SPLIT-PLAN.md)

Send ONLY when mission control says the in-flight branches are merged and Windward in coopgames is frozen.

---

You are the agent named in the message. Your job: phase 1 of ~/GitHub/coopgames/docs/WINDWARD-SPLIT-PLAN.md
(read it first, plus docs/WINDWARD-KICKOFF.md, docs/MISSION-CONTROL.md and AGENTS.md). Felix is on GitHub Pro.
Work in a fresh temp clone, NEVER in ~/GitHub/coopgames.

1. Fresh full clone of coopgames into a temp folder (no --depth). `pip install git-filter-repo` if missing.
   Keep only Windward and what it needs, with history:
   games/windward/, tools/, shared/input.js, shared/noise.js, shared/net.js, shared/ART.md,
   shared/ART-SOURCE.md, shared/vendor/, docs/MISSION-CONTROL.md, docs/SKILLS.md, docs/WINDWARD-SPLIT-PLAN.md,
   docs/WINDWARD-KICKOFF.md, .claude/skills/. Move games/windward/ to the repo root (filter-repo
   --path-rename games/windward/:). Check with git log that old Windward commits are there.
2. Fix every path that pointed out of games/windward (`../../shared`, `../../../shared`, `../../../tools`,
   tools' paths into games/windward/, the "← hub" link in index.html, vercel/ignore rules). Find them with grep,
   don't guess. Run all tests (src/*.test.js; game-imports.test.js is the blank-page guard) and load index.html
   and every *-lab.html locally once (headless or Chrome) with no console errors.
3. New repo files: AGENTS.md (Windward's working rules only: gated batches with DONE WHEN and screenshots, root
   cause before fixes, ask before long rebuilds, saves rule, worktrees for parallel agents, agents named by
   terminal number, push only at gates, mission control merges, commit attribution), CLAUDE.md = `@AGENTS.md`,
   a fresh LAST_SESSION.md, docs/MISSION-CONTROL.md rewritten for the new repo (paths, live URL TBD, branches),
   .vercelignore (docs/). Co-op still needs the hub for now: leave a note that phase 2 adds Windward's own
   Host / Join; don't build it here.
4. Create the private repo felisiwi/windward (`gh repo create felisiwi/windward --private`) and push main.
5. Branch protection (GitHub Pro), with `gh api`: protect `main` (no force pushes, no deletion, changes only
   by Felix: allow Felix to push directly so mission control's merges still work, or require PRs if direct
   push can't be limited to him; report which) and the `felix/*` pattern (no force pushes, no deletion by
   others). Leave `pierre/*` open. Report the exact rules set.
6. Report: the new repo URL, commit count carried over, every path you changed, test results, what the
   protection rules are, and anything that didn't come across. Do NOT touch coopgames itself (no redirect, no
   removal: those are phases 4 and 6). Commits: author `Claude <noreply@anthropic.com>`, Co-Authored-By /
   Claude-Session lines.
