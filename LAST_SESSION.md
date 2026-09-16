# Last session

**2026-09-16 — Windward I2: archipelago density, landmark-first grid
placement** (commit 1bea785). Third rewrite of `island-scatter.js` this
session — the first two (cluster reservation, then a flat 75m grid with
weighted size tiers) measured as real failures on localhost (up to 93%
of grid cells placed nothing; 68-74% of 135m windows empty sea), both
because grid pitch was sized off a target spacing number instead of
measured off the camera/footprint sizes. Fixed: `cameraViewWidth()`
measures the fixed camera's real visible width at max zoom-out;
`gridPitch()` derives pitch from it, clamped to `[PITCH_MIN,
PITCH_MAX=110]` (110 is now the default, no `?pitch=` needed). 3 large +
10 medium landmarks reserved first (own cell-exclusion zones, large also
`LARGE_MIN_SPACING` apart), skerries fill every remaining cell
(no-overlap-by-construction). `?pitch=/?big=/?medium=/?span=/?count=` on
index.html for A/B. New coverage test (VIEW x VIEW windows, replacing a
mean-NN metric that hid the earlier failures): 0-6% empty at 135m scale,
down from 68-74%. Full suite: 50/50.

## Today's sessions

- Windward W0.8: sailing feel + HUD retune; visual reference docs.
- Windward: water tile edge fix at high zoom; golden-hour lighting pass.
- Windward I1: procedural granite island + island-lab.html tuning tool.
- Windward: split island/lighting presets, applied Sunset + Skerry tuning.
- Windward: island scattering (cluster rejection sampling, commit 5b30b6a).
- Windward I2: archipelago density, landmark-first grid (this session).
- Will It Fit? stage 1 signed off (Kenny, 2026-09-13) — 43/43 headless,
  not hub-launched; see its README.

## Next

1. Play-test the new landmark-first field for feel (97-104 islands at
   pitch=110 — right density, or tune further?).
2. Will It Fit? stage 2 (vessel tilt) — Kenny's next step, carried over.
3. Windward: gust telegraphing (W3); boat-island collision/grounding not
   built yet (heightAt is exposed per-island but game.js doesn't sample it).
