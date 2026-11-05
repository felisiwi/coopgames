# Last session

**Describes `d574f6a` — branch `felix/windward-look`, 2026-11-05, not merged.**
Windward L1 (code `bf928f6`) ported the Look Lab look; look pass 2 (`d574f6a`)
repaints it as a Skagen-painter palette and adds the `?tune=1` panel (sliders,
Before/Skagen, values mirrored into the URL). Islands were dark because of
light (three.js r155+ gives intensity/pi), so the fill went 0.45 -> 2.4.
Felix judges on his phone: add `?seed=1&tune=1` to /games/windward/ on the
branch preview (real URL: deployments API, see below).
`shared/ART.md` is its own PR: #5 (`felix/art-split-style`, not merged).

Where things are (why/deviations: `games/windward/DESIGN.md` "L1 port status"):
- `src/water.js` lab shader + gust/line marks; marks and foam accumulate in JS
- `src/depthmap.js` depth bake (1004x964 texels @ 1.5 m, ~150-180 ms in node)
- `src/island-look.js` Bohuslän palette + green rule; `src/island.js` terrain
- `game.js` fog and wiring; `src/settlements.js` houses prefer green

Unverified (node tests only, no browser was opened):
- Headless Chromium (swiftshader) rendered desktop + iPhone 13 with no page
  errors, so the shaders compile; a real phone GPU is still unchecked.
- `sun.shadow.normalBias = 0.25` in `game.js` is a guess against shadow stripes
  on smooth ground at the 10 degree sun. TODO(felix): confirm.
- Game lighting is untouched, so ground can look darker than the lab did.
- `island-lab.html` colour/threshold sliders no longer drive ground colour.

## Today's sessions

- Windward L1: Look Lab port.
- Windward look pass 2: Skagen palette, lights, `?tune=1` (this session).

## Next

1. Felix: pick a look with `?tune=1`, send the link back; bake it into
   `LOOK_*` and the lighting keys in `src/config.js`. Also tunable there:
   `SLOPE_CALIBRATION`, `HAZE_*`, `WATER_LIGHT_ELEVATION_DEG`.
2. Merge `felix/windward-look` then PR #5 (a trial merge into `main` at
   f3f1546 is clean). Remove the `../coopgames-windward-look` and
   `../coopgames-art-split` worktrees only with Felix's OK.
3. Carried over: play-test density (97-104 islands, pitch 110 m); Windward P1
   (Polyfork props) agreed, not started; boat-island collision not built;
   Will It Fit? stage 2 (Kenny); design-audit PR #3 unmerged (hub bug: the
   "Connection lost" panel sits in the hidden `#lobby`).
