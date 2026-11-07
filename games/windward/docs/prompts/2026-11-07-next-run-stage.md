# Stage agent: Next run (written 2026-11-07, not yet sent)

Paste everything below the line into a terminal Claude Code agent.

---

You are the stage agent for Windward's "Next run" batch in the coopgames repo.

SETUP (worktree, never the main folder):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-nextrun -b felix/windward-next-run origin/main
  cd ~/GitHub/coopgames-nextrun
Read first: AGENTS.md, docs/MISSION-CONTROL.md, LAST_SESSION.md, then games/windward/GAME-DESIGN.md
sections "Next run" and "Rule: players keep their progress" (later sections override earlier).
Docs are fallible: verify on disk before trusting them.
You are the only agent touching games/windward/game.js. Other agents work in separate
worktrees on new files only.

RULES
- Root cause with evidence before any fix; ask before long rebuilds.
- Saves rule: NO new or renamed localStorage keys without a migration that carries old data
  over plus a test. Prefer deriving state from existing saved state (e.g. beats.phase). Mention
  any save change in your report.
- Must not break: ?jump=britta, ?lights=reset, ?opening=1, ?year=2015, existing chapter-1 saves
  at every phase, co-op (host/guest).
- Commits: author `Claude <noreply@anthropic.com>` (a stop hook enforces it); messages end with
  the Co-Authored-By / Claude-Session lines.
- Push only at gates and at the end (each preview build counts against Vercel). Push, do NOT
  merge. Mission control merges.
- Tests: cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done
  All must pass at every gate.

BATCH 0: docs fixes (first commit, docs only)
- GAME-DESIGN.md "Next run": the "Then: merge chapter 1 (after agent 1's rewind fixes)" line is
  stale (chapter 1 is merged and live). Reword it to: Then: co-op stage 2, then day/night.
- docs/MISSION-CONTROL.md section 1: the test command globs a non-existent test/ folder; use
  the src-only loop above and state the real count (65 test files on 2026-11-07; recount).
- docs/MISSION-CONTROL.md section 8: fix the branch list from `git ls-remote --heads origin`.
  felix/windward-1950-people is already gone. List kenny/hub-mobile and
  kenny/last-session-append-only as Kenny's, not ours to delete.
- docs/MISSION-CONTROL.md section 2: add games/windward/docs/ALIVE-SEA.md (the alive-sea ideas
  and the settled thing-model and weather grills) to "where the truth lives".

BATCH 1: pause + light-name tags
1a. Pause. Today a hidden tab just freezes (requestAnimationFrame stops). Traffic and the ferry
  (src/busy-coast.js; clock defaults to Date.now(), game.js ~line 466 passes none) and the
  host's wind controller (stepWindController with performance.now()-based nowS, game.js ~497/920)
  run on wall time, so they jump ahead on resume.
  - Introduce ONE game clock: wall time minus total paused time. Pass it to createBusyCoast's
    `clock` and use it for the wind controller's nowS. Keep it in its own small module with a
    test (pausing for N seconds, then resuming, advances the clock by 0).
  - On visibilitychange to hidden (and pagehide): pause. On return, show a paper card (paper.js
    style) "Tap to continue"; the clock resumes on tap, not on visibility.
  - CO-OP EXCEPTION: busy-route.js keeps both phones' traffic in step by using the wall clock.
    When a peer is connected, do not freeze the shared clock (the friend keeps sailing): still
    show the card, but traffic/ferry/wind stay on wall time. Solo = freeze. Write the rule in a
    comment and a test.
  - Sound: not wired yet. Add a mute hook (e.g. onPause/onResume callbacks, or audio.setMuted)
    that the current audio.js respects if trivial. Do NOT wire in the 1950 sound lab.
  - Don't count a lighthouse visit / story card / opening as a second pause layer: the pause
    card sits on top and returning resumes exactly where you were. The opening (opening-stage.js
    has its own clock) must not jump either. Check it, fix it the same way if needed.
1b. Navigate tag names. In 1950 the four AGA lights (Hättan, Gäven, Stångholmen, Fredagsholmen)
  are named by Britta, so their tag and visit card show the real name, not "A lighthouse"
  (src/chart-controller.js lightInfo: `known ? entry.name : (entry.desc || 'A lighthouse')`;
  guide() in game.js ~715 picks the target). Smallest correct fix: treat those four as known
  once Britta's card has been shown (derive from task phase; no new save key). Måseskär and all
  other lights keep the discovery rule. Test it.
GATE 1: tests pass; 390x844 screenshots you have looked at: pause card over the sea, a Navigate
tag reading "Hättan" (or the nearest dark light's real name). Push. Report.

BATCH 2: first errand downwind both ways + light air (same batch: same wind/boat code)
2a. First check, with numbers: speedFactor() in src/sail.js at 180° vs ~135° (broad reach).
  If dead downwind is noticeably slower, script a broad reach both ways instead and say so.
2b. Scripted wind for the first beats: while beats.phase is the outbound leg to Grundsund,
  the wind blows from behind the yard→Grundsund line; once the fittings are aboard ('return'),
  it swings (smooth transition, a few seconds) to blow from behind the Grundsund→yard line.
  When the yard beat finishes ('free'), hand back to the normal wind controller smoothly (no snap).
  - Derive everything from beats.phase (already saved). No new save key.
  - Do it inside the host's wind controller (or a wrapper the host uses), so the guest still just
    applies incoming 'wind' messages and both phones agree.
  - ?jump=britta, ?year=2015 and saves already past 'free' must get the normal wind from frame 1.
  - Tests: the wind direction per phase; hand-back at 'free'; a save loaded at each phase.
2c. Light air: low wind feels stuck (WIND_TARGET_STRENGTH_MIN 0.2 → target speed can drop to
  ~1 m/s; boatSpeed() in sail.js is linear in strength). Give a sensible floor, e.g. a light-air
  curve so speed at minimum wind is still a pleasant crawl-free pace, while strong wind stays
  as it is. Put the numbers in config.js with a comment, and report before/after target speeds
  at strength 0.2, 0.5, 1.0 on a beam reach and a broad reach. phone.js:563 also calls boatSpeed:
  keep the two consistent.
GATE 2: tests pass; report the speed table and the wind per phase; one 390x844 screenshot on the
first leg showing the wind arrow behind the eka. Push.

END
- Update LAST_SESSION.md (keep main's history, add your lines).
- Report: what changed per batch, any save changes (should be none), the preview URL from the
  deployment record (gh api repos/felisiwi/coopgames/commits/<sha>/statuses or Vercel), and a
  phone checklist for Felix:
  1. Switch apps mid-sail, come back: paper card, tap, traffic and ferry did not jump.
  2. Navigate after Britta: tag shows the real light name.
  3. Fresh private window: first errand downwind there and back; normal wind after the yard.
  4. Lull: the boat still moves at a calm, not stuck, pace.
  5. ?jump=britta in a private window still works.
