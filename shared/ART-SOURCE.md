# Windward — Art Source Reference

Extraction detail behind ART.md: file:line citations, the legacy chase-cam
config (unused by default), and notes from the original read-only source
extraction (2026-09-15). ART.md is the directive version an agent should
render from; this file is provenance, not instructions.

## Lighting

- Sun: `THREE.DirectionalLight(0xffffff, 0.9)` — `game.js:73`
- Sun angle: azimuth 55°, elevation 26° (`LIGHT_AZIMUTH_DEG` /
  `LIGHT_ELEVATION_DEG`, `water.js:28-29`) — chosen low on purpose so
  flat-shaded water facets actually vary in brightness (`water.js:1-11`,
  `game.js:68-71`)
- Fill: `THREE.HemisphereLight(0x89c4f4, 0x1c4a70, 0.7)` (`game.js:72`)
- No `castShadow` is set on the sun light in `game.js` — no shadows
  currently render at all, despite "long soft shadows" in the direction.
  TODO(felix): confirm this is worth implementing.

## Palette (verbatim from code)

- Scene background: `0x89c4f4` (`game.js:62`)
- Water: `0x2f7fd6`, `MeshLambertMaterial`, `flatShading: true`
  (`water.js:27,103-106`)
- Self boat sail tint: `0xffcc66` (host) / `0x66ccff` (guest) — `game.js:89`
- Other boat sail tint: swapped, `game.js:90`. Only the sail is tinted;
  hull/flags keep the model's own colours (`boat.js:64-65`)
- Wake foam disks: `0xf2fbff`, `MeshBasicMaterial`, `transparent`, peak
  `opacity` 0.5 fading to 0 over lifetime (`wake.js:13,51`)
- Wind arrow: `0xeaf6ff` (`windArrow.js:11-16`)
- Buoy pole: `0x333333`, `MeshStandardMaterial` (`scatter.js:23-26`)
- Buoy floats: `0xff5533` / `0xffcc33` alternating, `MeshStandardMaterial`,
  `flatShading: true` (`scatter.js:19,28-31`)
- Rocks: `0x776f64`, `MeshStandardMaterial`, `flatShading: true`
  (`scatter.js:37-41`)
- HUD: text/rose-label `#eaf6ff`, wind-bearing arrow `#8fd3ff`,
  boat-heading arrow `#ffcc66`, trim dot in-window `#78dc96` /
  out-of-window `#ffcc66`, panel backgrounds `rgba(10,26,42,0.55)`
  (`hud.js:46-75,140,169,174-175`)

## Materials — implementation note

`scatter.js` rocks and buoy floats use `MeshStandardMaterial` (a PBR
material with `metalness`/`roughness`) rather than `MeshLambertMaterial`/
`MeshBasicMaterial` used everywhere else. Neither property is set
explicitly, so three.js defaults apply (`metalness` 0.5, `roughness` 1).
Flagging since the direction says "no PBR metalness" — this is a fact
about current code, not a judgement call on whether to change it.

Boat hull/sail material comes from the vendored glTF (`assets/ship-small.glb`,
`boat.js:25`); only the sail's material is cloned and its `color`
overridden per-instance (`boat.js:66-67`). TODO(felix): confirm the glTF's
own material settings — not inspectable from source text alone.

No outline/toon shader or post-processing pass exists anywhere in
`game.js` or `src/`.

## Water — full tuning (`water.js`)

- `WATER_COLOR = 0x2f7fd6`
- `WAVE_AMP = 0.4` — metres, max displacement at full wind strength (boat
  ~6m long, "stays well clear of swallowing the hull" per comment)
- `WAVE_LEN = 12` — metres, dominant wavelength (~2 boat lengths; DESIGN.md
  target is 1-3x per comment)
- `WAVE_SPEED = 1.2` — rad/s, dominant component's phase speed
- `SEG = 160` — plane subdivisions per side
- `SIZE = 320` — metres per side (sized to cover the fixed camera at max
  zoom, not the whole world; the plane follows the boat)
- Wind-strength scaling: `amp = WAVE_AMP * (0.3 + 0.7 * windStrength)`,
  `speedScale = WAVE_SPEED * (0.4 + 0.6 * windStrength)` (`water.js:50-51`)
  — floored at 30%/40% rather than going fully flat at zero wind
- Four summed sine components, each at its own angle off the wind axis and
  its own wavelength/speed multiplier, so crests cross rather than reading
  as parallel stripes (`WAVE_COMPONENTS`, `water.js:35-40`)

## Islands

`scatter.js` is explicitly labelled a placeholder: "throwaway
reference-object scatter ... W1 replaces this with real islands"
(`scatter.js:1-5`). It scatters seeded buoys/rocks across a flat
`SCATTER_AREA = 600` × 600m square (`config.js:83-84`) — not islands. No
island palette/material values exist to extract yet.

## Fog

No fog, no cloud objects, and no distance-fade of any kind exist in
`game.js` or any `src/` module — confirmed by grepping for `fog`/`Fog`
across the game's source (zero matches outside `vendor/`). Scene
background is a flat, unfading `0x89c4f4` (`game.js:62`). ART.md's
proposed fog values (colour `0xd9b98a`, near 125, far 600) are grounded in
`FIXED_CAMERA_DISTANCE` (125, `config.js:52`) and `SCATTER_AREA` (600,
`config.js:84`) so they're at least self-consistent with existing scale —
not measured or settled design.

## Camera — current + legacy (`config.js`)

Current (`CAMERA_MODE: 'fixed'`, default):
- `FIXED_CAMERA_ELEVATION_DEG: 52`
- `FIXED_CAMERA_AZIMUTH_DEG: 45`
- `FIXED_CAMERA_FOV_DEG: 30` — "narrow => reads almost isometric" (comment)
- `FIXED_CAMERA_DISTANCE: 125` — comment notes this puts ~120m across the
  screen at the boat's position at 30° vertical FOV / 16:9
- `FIXED_CAMERA_DAMPING_RATE: 3` (1/s, dt-based exponential smoothing)
- `ZOOM_MIN: 0.5`, `ZOOM_MAX: 2.5`, `ZOOM_WHEEL_SENSITIVITY: 0.0015`

Legacy chase cam, kept in `config.js` for comparison, not used by default
(`CAMERA_MODE` would need to be set to `'chase'`):
- `CAMERA_DISTANCE: 12`
- `CAMERA_HEIGHT: 6`
- `CAMERA_LOOKAHEAD: 6`
- `CAMERA_DAMPING_RATE: 3`
- `CHASE_CAMERA_FOV_DEG: 60`

## World scale anchors

- Boat ~6m long: `MODEL_SCALE = 6 / 8.8` applied to a source hull that
  measures ~8.8m bow-stern (`boat.js:26-28`)
- Wind arrow: 7m above the boat, length 3 (min) to 11 (min + scale) metres
  (`WIND_ARROW_HEIGHT/MIN_LENGTH/LENGTH_SCALE`, `config.js:79-81`)

## Readability — implementation detail

- Boat differentiation is sail-tint only (`0xffcc66` vs `0x66ccff`,
  `game.js:89-90`) against water `0x2f7fd6` — both are notably
  lighter/more saturated than the water colour.
- HUD: single right-anchored column (compass rose 96×96px, text block,
  trim bar), `top: 80px`, `right: 8px` (`hud.js:17-27`).
