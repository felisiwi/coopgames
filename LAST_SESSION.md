# Last session

**2026-09-16 — Windward I3b: one facet scale for everything; ART.md
directive merged** (commit 26f4b40; `shared/ART.md` PR #2 merged as
4694e80: 4m target facet/2-6m acceptable, plus a small-props exemption
for trunks/canopies/buoys that can't physically carry a 2m facet).
Water tile SEG 256->223 (3.125m->3.587m spacing — the closest the wave
shader's own aliasing bound allows, not the full 4m); pine trunk/canopy
radial segments 5/6->4 (still under 2m regardless, capped by their own
radius); boat (CC0 `ship-small.glb`) reported, left as-is (hull median
facet ~0.28m). New `?wire=1` forces scene-wide wireframe + a
true-4m-snapped `GridHelper` on the water for one-screenshot comparison.
`main` had 3 unpushed commits carried over from the I3 session — pushed
and curl-verified live. `games/windward/HANDOVER.md` rewritten (density
solved, facet rule, lab slider, URL overrides).

## Today's sessions

- Windward W0.8: sailing feel + HUD retune; visual reference docs.
- Windward: water tile edge fix at high zoom; golden-hour lighting pass.
- Windward I1: procedural granite island + island-lab.html tuning tool.
- Windward: split island/lighting presets, applied Sunset + Skerry tuning.
- Windward: island scattering (cluster rejection sampling, commit 5b30b6a).
- Windward I2: archipelago density, landmark-first grid.
- Windward I3: harmonise island tessellation.
- Windward I3b: one facet scale for everything; ART.md directive merged
  (this session).
- Will It Fit? stage 1 signed off (Kenny, 2026-09-13) — 43/43 headless,
  not hub-launched; see its README.

## Next

1. Play-test the field for feel now density is settled (97-104 islands
   at pitch=110m) — first real multiplayer session is the actual tuning
   pass, per `games/windward/HANDOVER.md`.
2. Will It Fit? stage 2 (vessel tilt) — Kenny's next step, carried over.
3. Windward: gust telegraphing (W3); boat-island collision/grounding not
   built yet (heightAt is exposed per-island but game.js doesn't sample it).
