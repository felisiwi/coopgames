# Real-coast trial (spike) — results

Branch `felix/windward-coast-trial`, 2026-11-05. A spike, not the final build: it answers
"can the real Bohuslän coast run in the game on a phone?" with numbers. Everything is behind
`?coast=real`; without the flag the game is the procedural one, unchanged.

**Try it:** `…/games/windward/index.html?coast=real&debug=1` (add `&seed=1`). `debug=1` draws the
overlay (first frame, fps, draw calls, triangles, heap, download). Extra knobs: `&cstep=2` (half-resolution
terrain mesh), `&cvex=` (height scale), `&csmooth=` (coast blur passes), `&cat=lon,lat` (start at the open
water nearest that point).

## What it builds

- Window (widened at Felix's request): lon 11.27–11.46, lat 58.085–58.25 = about 11 × 18 km real =
  **1118 × 1838 m in game** at 1:10 (559 × 919 raster cells, 2 m each). From Käringön and Måseskär in the
  south up to Grundsund, Gåsö and Storön in the north; Gullholmen, Härmanö, Hälleviksstrand, Hättan inside too.
  (South edge is 58.085, not 58.10, so Måseskär keeps its fade margin.) Still one raster tile (`north`).
  Fiskebäckskil (58.2457) sits inside the 80 m fade zone at the north edge and is not placed.
- Terrain: one smooth vertex-coloured mesh in the Skagen palette (`groundColor` from `island-look.js`),
  tinted by land-cover class (heath, meadow, scrub, forest, village). Heights x 0.5 (`COAST_VEX`;
  uniform 1:10 would be 0.1 = flat), lifted 0.4 m so the shore clears the waves, blurred twice to
  remove the 20 m-pixel sawtooth.
- Water: depth map built from the raster depth and fed to the existing shader (`depthAndShoreFromSigned`,
  extracted from `bakeDepthMap`), so shallows and shore foam come from real coast shapes.
- Things: Måseskär and Hättan lighthouses at their real lat/lon; 5 villages (Käringön, Härmanö, Gullholmen, Hälleviksstrand, Grundsund) from
  `settlements-history.json` (15 buildings each); `treesNear()` around the boat only (re-asked every 30 m).
- Spawn 60 m outside Käringön's village origin (open water, >= 3 m deep, >= 30 m from land).
  TODO(felix): confirm the harbour mouth; the origin is approximate (sv.wikipedia).
- Edge: land sinks and sea deepens over the outer 80 m, the boat is held 30 m inside.

## Measured (headless Chrome, software GL: **fps is not a GPU number**)

| | procedural (today) | coast 10 x 12 km, full mesh | **coast 11 x 18 km, full mesh** | **11 x 18 km, `cstep=2`** |
|---|---|---|---|---|
| triangles per frame (incl. shadow pass) | 352–356k | 490–507k | 633k | 276k |
| draw calls | 93–98 | 72–154 | 34–157 | 140 |
| JS heap | 55 MB | 65–72 MB | 70–82 MB | 72 MB |
| downloaded | 2.28 MB | 5.18 MB | 5.18 MB (same tile) | 5.18 MB |
| terrain mesh | — | 94k verts, 178k tris | 129k verts, 243k tris | 36k verts, 64k tris |
| coast build (desktop) | — | ~0.33 s | ~0.36–0.39 s | ~0.36 s |

**Cost of the bigger window:** 1.7x the cells and 1.37x the terrain triangles of the 10 x 12 km window; whole frame
633k triangles = 1.8x today's procedural game (full mesh) or 0.8x (half-res). Build time +10%, download unchanged
(same tile), heap +10 MB. Not clearly too heavy, so the 10 km fallback was not needed. The whole terrain is drawn every
frame (no chunk culling), which is what streaming windows would fix.

- Coast build on desktop: fetch + PNG decode 250–300 ms, height field 15, depth map 10, terrain 38, villages +
  lighthouses 12 → **about 0.33 s**. First frame at 3.3–3.7 s from navigation start, of which 2.2–2.6 s is the first
  render itself (shader compile in software GL; the procedural game costs the same, 2.6–2.8 s).
- Download: +2.79 MB of PNGs (`north-land-height` 1.6 MB, `-classes` 0.7, `-depth` 0.5) + 103 KB
  villages file + ~40 KB code. Three.js is 2.1 MB of the baseline (unminified, uncompressed here).
- iPhone 13 emulation: same numbers, canvas 585 × 996 (the existing 1.5 pixel-ratio cap works).
  No page errors in either mode (only the browser's own `/favicon.ico` 404).
- Trees: 2–108 near the boat in the sampled spots; the busiest 250 m disc in 400 random points held 423
  (cap 3500). The forest is inland, out of reach: trees cost nothing here.

## Does sailing feel right at 1:10? (from the game's own sail model; feel itself needs a phone)

Speeds at ideal trim: 5–9.7 m/s (BOAT_MAX_SPEED 10; ~7 m/s typical). Crossing the 1118 x 1838 m window at 7 m/s:
2.7 min east–west, 4.4 min north–south, 5.1 min corner to corner. Hops: Käringön → Måseskär 37 s,
→ Hälleviksstrand 72 s, → Härmanö 81 s, → Gullholmen 117 s, → Grundsund 171 s, → Gåsö 203 s; Måseskär → Hättan 132 s.
Marstrand → Smögen (68.6 km): 16 min at 1:10, 20 min at 1:8 (GAME-DESIGN.md's "about 20 minutes" is 1:8).

## Whole coast

- Today's three PNG tiles are 10.4 MB and 83 MB decoded (5 B/px): too big to hold. Cut the raster
  at build time (`tools/build-coast.mjs`) into ~57 windows of this size. Measured on this window:
  133 KB gzipped in today's format; ~67 KB if heights and classes are packed as bytes and depth is rebuilt
  from distance-to-shore (it is a placeholder model). About 3.7 MB for the whole coast, ~70–130 KB as the
  boat arrives, and PNG decode drops to a few ms.
- Mesh: ~5.3 MB GPU per full window (1.4 MB at half-res). Keep ~2 × 2 windows loaded, outer ring at
  `cstep=2`; the existing haze (~400 m) hides the rest.
- Water: one depth texture today. Replace with a boat-centred ~1 km texture (1.2 MB) re-baked every
  ~200 m from the loaded windows (the bake measured 10 ms).
- Coordinates stay plane-origin (up to ~18 km, fine for float32); no floating origin needed.

## Gaps found

- The trial places **no skerries** (`skerries.json` has 5,537; many islets are under 20 m and not in the raster).
- Depth is the placeholder model (0.5 m + 0.04 per m from shore), not chart data: no real shoals.
- **No land collision** exists in the game (`discover.js`: "boats don't collide with islands"), so with real coast
  you can sail through Orust. Not touched here.
- Houses are the game's existing size (about 10 m wide), large against 2 m terrain cells.
- Net messages arriving during the async load are dropped (fine solo; register `onMessage` first in a real build).
- Real-phone GPU is unmeasured. Felix's overlay read is the real test.
