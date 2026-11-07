# Agent 2: sail feel and weather into the game (written 2026-11-07; send AFTER agent 1's next-run branch is merged)

Paste everything below the line into agent 2 (it built the sail-feel lab).

---

You built the sail-feel lab (felix/windward-sail-feel-lab, head bc3b0c9). Felix tried it on his phone.
His verdict: too many settings to judge by tuning, and he doesn't want to fine-tune now. Decision: take
the lab's DEFAULTS as they are and put them into the real game, fix two readability problems, and Felix
judges it by sailing his normal routes. He'll give feedback in plain words afterwards.

SETUP (new worktree from the latest main, which now has agent 1's game clock, pause, errand wind and
light-air floor):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-weather -b felix/windward-weather origin/main
  cd ~/GitHub/coopgames-weather
  git merge --no-ff origin/felix/windward-sail-feel-lab   (bring your lab in; it only adds files)
Read: docs/MISSION-CONTROL.md, LAST_SESSION.md, games/windward/docs/ALIVE-SEA.md ("Grill: weather and
sail feel": the 17 decisions), your SAIL-FEEL-LAB.md, and on main: src/game-clock.js, src/pause.js,
src/errand-wind.js, src/sail.js (the light-air floor), game.js's wind block (host-run controller, 'wind'
messages). You are the only agent touching game.js now.

WHAT TO BUILD
1. Wind from the weather, in the game. Replace the random 360° wind controller with your weather.js +
   wind-field.js, driven by the GAME clock (src/game-clock.js, so a solo pause freezes the weather too)
   and a day seed (per session for now: the hub's launch seed; no new save key). Boat speed uses windAt()
   at the boat. Keep ONE light-air floor: main's sail.js one (drop the lab's local copy, or reconcile and
   say which numbers you kept).
   - Co-op: both phones compute the same wind from the same seed and clock (co-op runs on wall time per
     src/pause.js). Decide with evidence whether the host's 'wind' messages are still needed; if you
     remove them, the guest must still get the same wind, and an old guest page must not break. Test it.
   - The first errand's scripted wind (src/errand-wind.js) becomes a use of your story override hook,
     handing back smoothly at 'help', exactly as it behaves now. Its tests must still pass.
   - The opening's storm stays scripted (opening-stage.js): weather starts after it.
   - In-game time of day: a game day of ~30 real minutes; a new session starts late morning (~11:00) so
     the sea breeze builds during play. Day type from the day seed. Visuals for night are NOT in scope.
2. Readability fixes (Felix couldn't tell the swell was waves; gust contrast is unproven on a phone):
   - Swell must read as waves from above: foam/brighter water along crests, darker troughs, so a still
     screenshot shows lines of waves utomskärs and flat water inside the skerries.
   - Gust and lull patches: clearly darker (gusts) and smoother/glassier (lulls, lees) at phone size.
     Show before/after screenshots side by side.
3. Speed feel and camera from the lab, at the lab's defaults: camera dip with speed, bow spray, growing
   wake, heel, luff flutter on a header, and the camera pulled back (x1.4) with the forward look-ahead, so
   gusts are visible ~15 s ahead. The chart, minimap, lighthouse visits and story cards must still work
   with the new camera.
4. Squalls (soft: warning glow + countdown + dimming, never damage) and weather mist (clearly different
   from the exploration "not yet" fog) as in the lab.
5. No panel in the game. Keep URL params for testing: ?day=<type>, ?t=HH:MM, ?weather=0 (old behaviour,
   for comparison), ?debug=1 readout (wind at boat, day type, game time).

RULES
- Root cause with evidence before fixes; ask before long rebuilds.
- Saves rule: no new or renamed localStorage keys (none should be needed).
- Must not break: the opening, ?jump=britta, ?lights=reset, ?year=2015 (Today game gets weather too),
  chapter-1 saves at every phase, the pause, co-op host/guest.
- Performance: the game is heavier than the lab (coast, traffic). Report fps with ?weather=0 vs on at the
  same spot. Spread costly work across frames as you did in the lab.
- Commits: author `Claude <noreply@anthropic.com>`; messages end with the Co-Authored-By /
  Claude-Session lines. Push only at gates and the end; do not merge.
- Tests: cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done
  (game-imports.test.js is the blank-page guard: node --check misses some breakages.)

GATES
1. Weather drives the wind in the game (items 1); co-op decision with evidence; errand override still
   right. Tests pass. Push. Report.
2. Readability fixes + speed feel + camera (items 2, 3), with before/after screenshots you've looked at
   (as close to 390x844 as Chrome allows; say what size). Push. Report.
3. Squalls + mist (item 4), fps table, LAST_SESSION.md lines. Push. Final report with the preview URL
   from Vercel and a plain-words phone checklist for Felix: sail Fiskebäckskil to Måseskär and back, the
   first errand, a squall (?day=unsettled), a misty morning (?day=misty&t=07:00), and "does sailing feel
   more alive than before?" (compare ?weather=0).
