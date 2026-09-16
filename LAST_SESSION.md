# Last session

**2026-09-16 — Windward I3: harmonise island tessellation** (commit
a21f9a1). Confirmed cause: `ISLAND_GRID_CELL_SIZE` and both noise FREQ
keys scaled with each island's own radius in `island-scatter.js`'s
`buildIslandParams` — a 10-22m skerry meshed at ~0.7m cells, a 120-150m
landmark at ~11m, same wild spread for noise wavelength. Fixed: moved
all three into `UNSCALED_KEYS` — one absolute world-space cell size and
noise wavelength shared by every island regardless of size; `island.js`
segment count switched `round`->`ceil` so a cell can't run locally
bigger than target. Default cell size 4m (was 5.5m); seed 1's full
scattered field (97 islands) measures 171,248 total vertices, under the
200k budget, no coarser-cell fallback needed. `?cell=` added to
index.html's A/B knobs; island-lab.html gets a "Preview radius" slider
(10-150m) that runs the real `buildIslandParams` scaling so
skerry/medium/large tessellation can be checked without leaving the lab.
island.test.js 6/6, island-scatter.test.js 14/14.

## Today's sessions

- Windward W0.8: sailing feel + HUD retune; visual reference docs.
- Windward: water tile edge fix at high zoom; golden-hour lighting pass.
- Windward I1: procedural granite island + island-lab.html tuning tool.
- Windward: split island/lighting presets, applied Sunset + Skerry tuning.
- Windward: island scattering (cluster rejection sampling, commit 5b30b6a).
- Windward I2: archipelago density, landmark-first grid.
- Windward I3: harmonise island tessellation (this session).
- Will It Fit? stage 1 signed off (Kenny, 2026-09-13) — 43/43 headless,
  not hub-launched; see its README.

## Next

1. Play-test the new landmark-first field for feel (97-104 islands at
   pitch=110 — right density, or tune further?).
2. Will It Fit? stage 2 (vessel tilt) — Kenny's next step, carried over.
3. Windward: gust telegraphing (W3); boat-island collision/grounding not
   built yet (heightAt is exposed per-island but game.js doesn't sample it).
