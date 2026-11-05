# Windward — Art Direction

Directive reference for rendering Windward. Citations, legacy chase-cam config, and extraction notes live in ART-SOURCE.md — not here.

## Feel
Cosy and slow. The blue hour of the Skagen painters (Krøyer, the Anchers),
"den blå time": pastel, dreamy, slightly cold, high-key light, a silvery
sea, pink-lilac granite. Soft shadows, never harsh. Handmade and a bit
wonky, like Mulle Meck bygger båtar. Calm Swedish archipelago in summer —
friends pottering about, not an adventure.

## Palette
Pastel storybook colours — clear and soft, slightly cold; not neon, not muddy, not naturalistic.

- Sky horizon `#dfe6ee` → zenith `#a9c4dc` · Water by depth (see Water): shallow `#a9d3cf` (pale sea-glass, not turquoise) · open `#8fb4c9` · deep `#5f8fb0`
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
- **Colour by depth** — shallow `#a9d3cf` → open `#8fb4c9` (depth 0.3-3.5m) →
  deep `#5f8fb0` (3.5-9m), from a depth map baked once from the island height
  fields. Everything beyond ~10m is deep.
- **Painted light** — two soft bands on the wave normals (steps at 0.30-0.36
  and 0.52-0.58 of normal·sun), not a smooth gradient. The bands use the
  game's sun azimuth at a 25° elevation, so a flat sea sits between them.
- **Shore foam** — soft white `#f4f6f2`: an edge hugging the waterline
  (~1.2m) plus rings drifting off the land (~5m). Sized by distance to the
  shore, not by raw depth, so it looks the same on a gentle skerry and a sheer
  cliff. A little weaker in light wind (~60-70% in a calm, full in a breeze),
  following a low-passed wind state, never time. Small ponds inside islands
  get the same rim, not a solid fill.
- **Wind on the water** — gust patches (darker, finely ruffled, sliding
  downwind) with faint pale wind lines on top; both kept out of the shallows.
  No white crests. Marks drift on accumulated state, like the waves.

## Lighting
High-key and cool, with soft shadows. Values live in `src/config.js`:

| | before (golden hour) | Skagen (now) |
|---|---|---|
| Fill (hemisphere) intensity | 0.45 | **2.4** |
| Fill sky / ground | `0xcbc9ad` / `0x21406a` | `0xdfe6ee` / `0xa79fbd` (cool, lilac) |
| Sun colour | `0xffd9a6` | `0xfff1e0` (soft warm white) |
| Sun intensity | 1.4 | **2.4** |
| Sun elevation (azimuth 50°) | 10° | 18° |

**Why the fill is ~2.4, not ~1.** Islands first read "too dark" even with pale
paint, and the cause was the lights, not the colours. Since three.js r155
(physically-based light units) lights are no longer multiplied by π, so a
diffuse surface receives only `intensity ÷ π` of its colour. The old 0.45 fill
lit the ground at 14% of its colour. With the values above, a flat top gets
~81% of its colour (was 13%) and a slope facing away from the sun ~55% (was
6%); lit-to-shaded stays about 1.5 to 1, so shadows still read. When tuning,
think in `intensity ÷ π`: an intensity near 3 is "full colour". The painted
sea does not use scene lights (its bands come from its own shader), which is
why it did not darken.

## Islands
**Bohuslän** — the west coast of Sweden: smooth, pale pink-grey granite.
`src/island.js` builds a noisy-radial-falloff heightfield on a 1.5m grid with
smooth vertex normals; `src/island-look.js` holds the palette and rules. No
textures.

- **Granite leads.** Pink-lilac granite `#e3c9c1`, paler sun-bleached domes
  `#f1e1db`, lilac veins and shadow `#b7a3b3`.
- **Meadow only in low, flat-ish, sheltered hollows** — sage, not neon:
  `#b9cf8f` / `#9fbf7a`, about 8% of the ground on average. Never on a dome
  top, a steep face, or the waterline.
- **Pines only in those green pockets** (instanced, low-poly, sage-dark `#6f9170` on a
  `#a08c78` trunk). Houses prefer the same ground. Small skerries are mostly bare rock.
- **Soft heather tufts** `#c4aed0`, a **wet band** `#8e8197` right at the
  waterline, **barely any sand** (`#efe4cf`, the odd small cove).
- **Crisp zone edges.** Green never blends into pink — that makes brown, which
  read as "muted and sad". All-green islands are wrong for the coast.

Each island must read as distinguishable from its neighbours at a distance.

## Sky and distance
A few soft scattered clouds. Sand-coloured haze at distance so far islands fade in
rather than pop in: colour `0xefe4cf`. Meshes use scene fog (near 1.18×, far
3.3× the camera-to-boat distance); the sea mixes the same colour in its own
shader (1.0×-3.06×, up to 85%). Distances follow the camera, so the haze looks
the same at every zoom.

## Readability
No outlines, so silhouettes separate by colour and brightness alone. Hulls
and sails must read clearly against glassy and choppy water alike at
gameplay camera distance. UI stays small, minimal, corner-only.

## Never
Never realistic — a toy world, not a simulation. Never realistic water: no
sparkle, no reflections, no spray (the shore foam is painted rings, not spray).
Never grim, tense, or dramatic light — no storms as menace, no storm grey (a
silvery pastel sea is the look). Never so detailed it stops looking
handmade.

## Camera & scale
Fixed three-quarter camera: elevation 52°, azimuth 45°, FOV 30° (reads
almost isometric), distance 125m, zoom 0.5–2.5×. Boat ~6m long. Water
plane 800m/side (I1, raised from 320m — sized so its edge never enters the
fixed camera's frustum at any zoom, not to cover "the whole world"; see
`src/water.js`). Wind arrow 7m above boat, length 3–11m by strength.
