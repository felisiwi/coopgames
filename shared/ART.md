# Windward — Art Direction

Directive reference for rendering Windward. Citations, legacy chase-cam config, and extraction notes live in ART-SOURCE.md — not here.

## Feel
Cosy and slow. Golden late-afternoon light, always — long warm sun, long
soft shadows. Handmade and a bit wonky, like Mulle Meck bygger båtar. Calm
Swedish archipelago in summer — friends pottering about, not an adventure.

## Palette
Bold storybook colours — saturated and clear, not muted or naturalistic.

- Sky / background `0x89c4f4` · Water `0x2f7fd6`
- Host sail `0xffcc66` · Guest sail `0x66ccff` (sail only — hull/flags share model colour)
- Wake foam `0xf2fbff` · Wind arrow `0xeaf6ff`
- Buoy floats `0xff5533` / `0xffcc33` · Buoy pole `0x333333` · Rocks `0x776f64`
- HUD ink `#eaf6ff` · wind bearing `#8fd3ff` · heading `#ffcc66` · trim-ok `#78dc96`

## Materials
Flat shading, pure flat shapes. No outlines. No PBR metalness, no specular
highlights, no reflections. Use `MeshLambertMaterial` or `MeshBasicMaterial`
with `flatShading: true`, not `MeshStandardMaterial`.

## Water
Toy-like: flat colour, no sparkle, no foam spray. Wave height and chop
scale with wind strength — the sea is how the player reads the wind. Calm
= glassy, strong wind = visible rolling waves.

- Colour `0x2f7fd6`; max displacement 0.4m; dominant wavelength 12m; dominant phase speed 1.2 rad/s
- amplitude = 0.4 × (0.3 + 0.7 × windStrength); speed = 1.2 × (0.4 + 0.6 × windStrength)
- Sun `0xffffff` @ 0.9 intensity, azimuth 55°, elevation 26° (kept low so flat facets actually shade)
- Fill (hemisphere): sky `0x89c4f4` / ground `0x1c4a70`, intensity 0.7

## Islands
Granite-and-pine (I1, `src/island.js`): noisy-radial-falloff heightfield,
coarse flat-shaded grid, vertex-coloured by height/slope — no textures.
Sandy/grass fringe at the waterline, grass on gentle mid-elevation slopes,
pink granite on steep slopes and near the peak, dark pine (instanced,
suitable slopes only). Colours (`src/config.js`'s `ISLAND_COLOR_*`):
sand `0xd9c48a` · grass `0x5da84a` · granite `0xb2c8ef` · granite (peak)
`0x809bb0` · pine `0x35694c` · trunk `0x928164`. Each island must read as
distinguishable from its neighbours at a distance — not yet checked, since
I1 is a single island; revisit once a second one exists (I2/I3).

## Sky and distance
A few soft scattered clouds. Light golden haze at distance so far islands
fade in rather than pop in. No fog exists yet — proposed once islands
exist: colour `0xd9b98a`, near 125, far 600.

## Readability
No outlines, so silhouettes separate by colour and brightness alone. Hulls
and sails must read clearly against glassy and choppy water alike at
gameplay camera distance. UI stays small, minimal, corner-only.

## Never
Never realistic — a toy world, not a simulation. Never realistic water: no
sparkle, no reflections, no foam spray. Never grim, tense, or dramatic
light — no storms as menace, no grey. Never so detailed it stops looking
handmade.

## Camera & scale
Fixed three-quarter camera: elevation 52°, azimuth 45°, FOV 30° (reads
almost isometric), distance 125m, zoom 0.5–2.5×. Boat ~6m long. Water
plane 800m/side (I1, raised from 320m — sized so its edge never enters the
fixed camera's frustum at any zoom, not to cover "the whole world"; see
`src/water.js`). Wind arrow 7m above boat, length 3–11m by strength.
