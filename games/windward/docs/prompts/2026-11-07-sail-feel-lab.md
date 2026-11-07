# Lab agent: sail feel and weather (written 2026-11-07, not yet sent)

Paste everything below the line into a terminal Claude Code agent. Can run alongside the other two.

---

You are the lab agent for Windward's sail-feel and weather lab in the coopgames repo.
NEW FILES ONLY: do not edit any existing file (another agent is changing game.js, config.js,
sail.js, phone.js and wind.js in its own worktree right now). Import existing modules freely;
if you need a different behaviour, write a new module beside it.

SETUP (own worktree, never the main folder):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-sailfeel -b felix/windward-sail-feel-lab origin/main
  cd ~/GitHub/coopgames-sailfeel
Read: AGENTS.md, docs/MISSION-CONTROL.md, games/windward/docs/ALIVE-SEA.md, sections
"Grill: weather and sail feel" rounds 1 to 3 (this is your spec: 17 settled decisions). Then
read src/world-1700-lab.js + world-1700-lab.html (a standalone sailing lab on the real coast
with phone controls: your model), src/wind.js, src/sail.js, src/water.js, src/wake.js,
src/camera.js, src/phone.js, src/coast-world.js (heightAt / sailHeightAt).
Docs are fallible: verify on disk.

WHAT TO BUILD
games/windward/sail-feel-lab.html + src/sail-feel-lab.js: sail the 1950 (or today) real coast
with phone controls, around Skaftö, so you can reach both inside the skerries and utomskärs
(open water west, towards Måseskär) within a minute or two. A small phone-friendly panel (a
collapsible paper card, not a dev wall) with toggles and a few sliders.

Pure, tested modules (node tests, *.test.js beside them, no THREE, no Date.now inside):
1. src/weather.js: weather as a fixed function of (daySeed, gameTimeS). Day types: sea-breeze,
   grey westerly, misty morning (clears), unsettled (showers, squalls). Returns the day's wind
   (direction slowly veering, strength following the day rhythm: calm/light morning, westerly
   sea breeze filling in ~midday, fresh afternoon, easing evening), sea state, visibility.
   Game day ~30 real min (constant at the top, tunable).
2. src/wind-field.js: windAt(x, z, gameTimeS, ctx) = day wind + shifts (±10 to 20° every 1 to
   2 min) + gust/lull patches (gusts +30 to 50%, lulls ~-40%, 30 to 60 s life, drifting
   downwind, deterministic from daySeed) + island shadow (smooth calm in the lee, from
   heightAt upwind, coarse grid, cached per wind direction) + funnelling in narrow sounds +
   a steadier, stronger open-water wind utomskärs. Same inputs = same output on any phone.
   Story override hook: setOverride({dir, strength}, blendS) and clear with smooth hand-back.
3. src/squall.js: a squall on unsettled days: approaching dark line, wind +~60% and ~30° swing,
   1 to 2 min, warning visible well ahead.
All numbers in one exported constants object per module with comments, tunable from the panel.

In the lab (THREE side, new files):
- Gusts/lulls visible on the water as darker ripple patches (lulls and lees smoother/glassier),
  visible 10 to 20 s before they reach you: THIS is the key test.
- Swell outside the skerries you can surf on a broad reach (a short speed burst when riding
  down a wave face); flat water in among the skerries.
- Sail luff flutter when headed (the shift signal), the wind arrow as fallback.
- Speed feel: camera dips and tightens with speed and pulls back when slow; bow spray; wake
  growing with speed; heel in gusts and strong wind.
- Squall: dark cloud, dark line on the water, rain, then it passes. Ease or round up, or the
  boat heels hard and slows (soft only: no damage).
- Weather mist (misty morning): thin, drifting, all around, clearly different from the game's
  exploration fog.
- Boat speed: use sail.js boatSpeed with windAt() at the boat. Add your own light-air floor
  locally in the lab (the other agent is adding one in sail.js; don't touch it).

Panel toggles: each layer on/off (shifts, gusts, shadows, funnelling, utomskärs boost, swell,
squalls, mist, camera dip, spray, heel, luff flutter, arrow); day type picker; time-of-day
slider + "fast-forward x10"; day seed field; a "today's wind" readout (true wind at the boat,
boat speed, inside/outside the skerries). URL params for all of it (e.g. ?day=unsettled&t=14:00)
so mission control can send Felix exact setups.

RULES
- Root cause with evidence before fixes; ask before long rebuilds.
- No localStorage at all in this lab (panel state can live in the URL).
- Performance: must hold a steady frame rate on a phone; report fps from ?debug=1 at 390x844
  headless (swiftshader is slow; report it as relative, not absolute).
- Commits: author `Claude <noreply@anthropic.com>`; messages end with the Co-Authored-By /
  Claude-Session lines. Push only at gates/end; do not merge.
- Tests: cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done

BATCHES
1. weather.js + wind-field.js (+ tests: determinism, day rhythm, shifts within bounds, gust
   patch drift, lee calmer than open water at the same moment, override hand-back smooth).
   GATE 1: tests pass; print an ASCII or PNG map of windAt strength over the Skaftö area at
   14:00 on a sea-breeze day, so the lees and utomskärs boost are visible. Push.
2. The lab page: sailing, visible gusts/lulls, lees, luff flutter, speed feel, panel.
   GATE 2: 390x844 screenshots you have looked at: a gust patch ahead of the boat; a lee
   behind an island; the boat heeled in a gust. Push.
3. Swell + surfing utomskärs, squalls, mist, day types complete.
   GATE 3: screenshots: swell outside, an approaching squall line, misty morning. Push.

END
- Short doc games/windward/docs/SAIL-FEEL-LAB.md: what each toggle does, the numbers, URL params.
- Do not edit LAST_SESSION.md (other agents are); put your state lines in the report instead.
- Report: per batch what changed, fps notes, preview URL from the deployment record, and a phone
  checklist for Felix with exact URLs:
  1. Sea-breeze day 14:00: can you see gusts coming and steer for them?
  2. Same day, hug the coast vs go utomskärs: does outside feel faster and livelier, inside
     still pleasant?
  3. Broad reach outside: does surfing the swell feel good?
  4. Shift: does the sail's flutter tell you before the arrow?
  5. Unsettled day: does the squall give enough warning?
  6. Misty morning: is it clearly different from the "not yet" fog?
  7. Camera dip / spray / heel: which feel good, which too much?
