# Stage 1d: the dark lighthouses

Branch `felix/windward-lighthouse-task` (from main after 1c, the passes data and the seamarks data). Gated batches; screenshots in
`docs/lighthouse-task/`.

## Batch 1: the water tells the truth

- **Passes.** `loadRealCoast` carves `passes.json` (`applyPasses`, tiers `GAME_PASS_TIERS = ['ship', 'harbour']`) between building the world
  and building the terrain, so meshes and collision both see the carved coast. Today that is the 5 ship passes (689 cells). Any `harbour`
  tier rows added to `passes.json` later (the harbour approaches) are carved with no code change; the eye tier is never carved.
- **Shoals** (`src/sea-truth.js`, `src/shoal-look.js`, 292 rows). 210 are hard (awash / dry rocks and the 9 named båd / flu shoals): solid like
  land, with a soft white surf ring and a granite stub; the boat slides off, never through (a test sails at every one from four sides; in the
  game the boat stopped at 4.9 m = rock 2.4 + hull 2.5). 82 are soft (submerged, unknown, wreck, obstruction): faint darker water, the boat slows
  (0.5 to 0.7), never stops. Hard shoals enter a *sailing* height field (`coast.sailHeightAt`, spikes above `BLOCK_H`), so terrain, trees and
  names keep the plain coast and every shore rule (`stepAlongShore`, `hullHeight`) just works.
- **Marks** (`src/seamark-layer.js`, kit `src/seamark-meshes.js`): all 226 rows (80 laterals + the 20 invented gate marks, cardinals, isolated
  dangers, specials, lit beacons), built lazily within 420 m of the camera focus, buoys riding the real waves. **Invented gates are built exactly
  like real marks**; only the chart shows them, and only with `?debug=1` (dashed magenta ring; the 3D view rings them too in debug).
  Leading lines: OSM gives alignments anchored on an existing beacon (one end of each line coincides with a real mark), so there are no
  front/rear beacons to invent: they are a dashed chart overlay only.
- **No decorative buoys any more.** Stage 1b's life layer invented random red/green/yellow buoys near villages. `createLife({ marks })` now takes
  the real positions: gulls perch on real marks, the cones are not drawn, the minimap dots are the real laterals / specials (black for cardinals
  and dangers).
- **Chart:** marks, rock crosses, dotted submerged rings and leading lines appear from 0.22 px/m, only where the fog has lifted.
- **Credit:** "© OpenStreetMap contributors" in the 3D view (bottom left, above the speed line) and on the chart ("(ODbL)"); it is also in both
  data files and in `seamark-meshes.js`. ODbL is share-alike for the data.
- **Night hook (night is not built):** `setNight(on)` on the layer and `wantsReflectorGlint(spec, night)` (unlit buoys get a faint glint near the
  boat, `GLINT_RADIUS_M` 40). TODO(felix, night stage): draw the glint.

Performance at Fiskebäckskil (headless software GL: counts matter, fps does not), main vs this branch:

| pose | build | triangles | draw calls | main-thread ms/frame |
|---|---|---|---|---|
| quay (30 m from the village) | main | 324,284 | 227 | 2.26 to 2.52 |
| | branch | 345,362 | 272 | 2.19 to 2.50 |
| the mouth (63 marks in range) | main | 292,966 | 165 | 2.21 to 2.29 |
| | branch | 314,040 | 211 | 2.16 to 2.23 |

So +21k triangles (the shoal layer is 19k in three instanced draws) and +45 draw calls (the marks near the boat); CPU per frame unchanged.
TODO(felix): real-phone fps; the shoal radii (`shoal-look.js`) and the 420 m mark radius are first guesses.

![gate](lighthouse-task/b1-gate-fiskebackskil.png) ![rock](lighthouse-task/b1-surf-rock.png)
