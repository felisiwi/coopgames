# Windward — Art Direction

Directive reference for rendering Windward. Citations, legacy chase-cam config, and extraction notes live in ART-SOURCE.md — not here.

## Feel
Cosy and slow. Golden late-afternoon light, always — long warm sun, long
soft shadows. Handmade and a bit wonky, like Mulle Meck bygger båtar. Calm
Swedish archipelago in summer — friends pottering about, not an adventure.

## Palette
Bold storybook colours — saturated and clear, not muted or naturalistic.

- Sky / background `0x89c4f4` · Water by depth (see Water): shallow `#5cd1d1` · mid `#298ccc` · deep `#1c66b8`
- Host sail `0xffcc66` · Guest sail `0x66ccff` (sail only — hull/flags share model colour)
- Wake foam `0xf2fbff` · Wind arrow `0xeaf6ff`
- Buoy floats `0xff5533` / `0xffcc33` · Buoy pole `0x333333` · Rocks `0x776f64`
- HUD ink `#eaf6ff` · wind bearing `#8fd3ff` · heading `#ffcc66` · trim-ok `#78dc96`

## Materials
**Split style.** Objects are low-poly and flat-shaded; the ground and the sea
are smooth and painted. No outlines, no PBR metalness, no specular highlights,
no reflections anywhere.

- **Objects** — boats, houses, pines, buoys, rocks, anything added later:
  `MeshLambertMaterial` or `MeshBasicMaterial` with `flatShading: true`, not
  `MeshStandardMaterial`. Pure flat shapes.
- **Ground (islands)** — `MeshLambertMaterial` with smooth vertex normals and
  per-vertex colour from the Bohuslän palette (see Islands). Not faceted.
- **Sea** — a custom shader: analytic wave normals, painted light bands,
  colour by depth, shore foam (see Water). Not faceted.

One facet scale **for objects**: every flat-shaded mesh is built so its
polygons read at roughly the same world-space size on screen. Target facet
size **4m**, acceptable range **2-6m**. Nothing is subdivided finer because
it's small, nothing coarser because it's big — a facet-scale mismatch is a
bug to fix, not a size-appropriate choice. The facet scale does **not** apply
to ground or sea: their grids (terrain 1.5m cells, water tile ~3m) are
sampling resolution, not a visible facet size.

Exception: props physically smaller than the facet size itself (tree
trunks, canopies, buoys) can't carry a 2m+ facet without ceasing to read as
their shape — they're exempt from the 2m floor. Keep the lowest segment
count that still reads (a trunk, a cone, a float), never finer than that
floor requires.

## Water
Smooth and painted, never realistic: no sparkle, no reflections, no spray.
Wave height and chop scale with wind strength — the sea is how the player
reads the wind. Calm = glassy, strong wind = visible rolling waves.

- **Waves** — max displacement 0.4m; dominant wavelength 12m; dominant phase
  speed 1.2 rad/s; amplitude = 0.4 × (0.3 + 0.7 × windStrength); speed =
  1.2 × (0.4 + 0.6 × windStrength). Wave phases are accumulated per frame,
  never `strength × absoluteTime` (that is what made the sea wobble).
- **Colour by depth** — shallow `#5cd1d1` → mid `#298ccc` (depth 0.3-3.5m) →
  deep `#1c66b8` (3.5-9m), from a depth map baked once from the island height
  fields. Everything beyond ~10m is deep.
- **Painted light** — two soft bands on the wave normals (steps at 0.30-0.36
  and 0.52-0.58 of normal·sun), not a smooth gradient. The bands use the
  game's sun azimuth at a 25° elevation, so a flat sea sits between them.
- **Shore foam** — white edge `#f5fcff` hugging the waterline (~1.2m) plus
  rings drifting off the land (~5m). Sized by distance to the shore, not by
  raw depth, so it looks the same on a gentle skerry and a sheer cliff.
- **Wind on the water** — gust patches (darker, finely ruffled, sliding
  downwind) with faint pale wind lines on top; both kept out of the shallows.
  No white crests. Marks drift on accumulated state, like the waves.
- **Game lighting** (`src/config.js`): sun `0xffd9a6` @ 1.4, azimuth 50°,
  elevation 10° (low, for long golden shadows); fill (hemisphere) sky
  `0xcbc9ad` / ground `0x21406a`, intensity 0.45.

## Islands
**Bohuslän** — the west coast of Sweden: smooth, pale pink-grey granite.
`src/island.js` builds a noisy-radial-falloff heightfield on a 1.5m grid with
smooth vertex normals; `src/island-look.js` holds the palette and rules. No
textures.

- **Granite leads.** Granite `#f0d3cd`, paler sun-bleached domes `#fdeee9`,
  darker veins `#ddb6ad`.
- **Meadow only in low, flat-ish, sheltered hollows** — Summer-meadow green
  `#a8e851` / `#74d24b`, about 8% of the ground on average. Never on a dome
  top, a steep face, or the waterline.
- **Pines only in those green pockets** (instanced, low-poly, `0x35694c` on a
  `0x928164` trunk). Houses prefer the same ground. Small skerries are mostly bare rock.
- **Soft heather tufts** `#c9a0d4`, a **dark wet band** `#9a7f7a` right at
  the waterline, **barely any sand** (`#fbe9a8`, the odd small cove).
- **Crisp zone edges.** Green never blends into pink — that makes brown, which
  read as "muted and sad". All-green islands are wrong for the coast.

Each island must read as distinguishable from its neighbours at a distance.

## Sky and distance
A few soft scattered clouds. Golden haze at distance so far islands fade in
rather than pop in: colour `0xe9d3a6`. Meshes use scene fog (near 1.18×, far
3.3× the camera-to-boat distance); the sea mixes the same colour in its own
shader (1.0×-3.06×, up to 85%). Distances follow the camera, so the haze looks
the same at every zoom.

## Readability
No outlines, so silhouettes separate by colour and brightness alone. Hulls
and sails must read clearly against glassy and choppy water alike at
gameplay camera distance. UI stays small, minimal, corner-only.

## Never
Never realistic — a toy world, not a simulation. Never realistic water: no
sparkle, no reflections, no spray (the shore foam is painted rings, not spray). Never grim, tense, or dramatic
light — no storms as menace, no grey. Never so detailed it stops looking
handmade.

## Camera & scale
Fixed three-quarter camera: elevation 52°, azimuth 45°, FOV 30° (reads
almost isometric), distance 125m, zoom 0.5–2.5×. Boat ~6m long. Water
plane 800m/side (I1, raised from 320m — sized so its edge never enters the
fixed camera's frustum at any zoom, not to cover "the whole world"; see
`src/water.js`). Wind arrow 7m above boat, length 3–11m by strength.
