# Windward — handover (2026-09-16)

Read this if you're picking up `games/windward/` — mission control (claude.ai)
prompting a terminal Claude Code agent, or Felix directly. Supersedes any
earlier same-day handover; `LAST_SESSION.md` (repo root) has the play-by-play
if you need it.

## Who you're working with

- Felix owns this folder (`game.json`'s `"owner": "felix"`) — commit straight
  to `main` here, per `docs/COLLABORATION.md`. Only `shared/`, the hub root
  files, `scripts/`, `AGENTS.md`, `docs/` need a branch + PR.
- Felix runs mission control from claude.ai (usually Fable): it plans/reviews,
  a terminal Claude Code session in `~/GitHub/coopgames` does the work. Kenny
  runs the same loop on his own machine, in his own folders (`games/will-it-fit/`).
- Read `AGENTS.md` (repo root) first — mission, audited risks, hub structure,
  tool economy. Then `DESIGN.md` (this folder) for sail/trim/camera/wind
  mechanics. This file is state, not mechanics.

## State

- Real max-zoom-out view width: **~298m** — measured (`cameraViewWidth(CONFIG.ZOOM_MAX)`
  in `src/island-scatter.js`), not assumed. Everything sized against "how much
  world is on screen" uses this, not a guess.
- Island density is solved: landmark-first jittered grid, pitch **110m** (not
  80 — raised after localhost review, see `src/config.js`'s scatter comment).
  Per seed: 3 large + 10 medium + skerries filling every remaining grid cell
  — measured **97-104 islands total** (seeds 1-5), skerries make up the
  bulk (~85-90 of that). A windowed-occupancy coverage test (VIEW x VIEW
  windows, not mean nearest-neighbour — that metric hid two earlier failed
  designs) passes for seeds 1-3: under 10% empty windows, median 2+ islands
  per window. First real two-player session is still the actual tuning
  pass — this is "right on paper," not yet confirmed in play.
- Facet-scale rule lives in `shared/ART.md`'s Materials section: target 4m
  facet, 2-6m acceptable range, nothing finer for being small or coarser for
  being big — small props (trunks, canopies, buoys) are exempt from the 2m
  floor since they can't physically carry it. Island terrain (absolute 4m
  `ISLAND_GRID_CELL_SIZE`), water tile (3.587m — closest to 4m the wave
  shader's own aliasing bound allows), and pine trunk/canopy (4 radial
  segments, still under 2m regardless) are all audited against it. The boat
  (CC0 `ship-small.glb`) is not — left as-is, hull median facet ~0.28m.
- `island-lab.html` has a **10-150m "Preview radius" slider** (Tessellation
  check fieldset) that runs the real `buildIslandParams` scaling, so
  skerry/medium/large tessellation can be checked without leaving the lab.
- `index.html` (solo dev entry, not the hub) URL overrides, mutate `CONFIG`
  before `start()`: `?seed=`, `?span=` (`ISLAND_SCATTER_AREA`), `?count=`
  (skerry cap), `?pitch=` (grid pitch override), `?big=` / `?medium=`
  (landmark counts), `?cell=` (`ISLAND_GRID_CELL_SIZE`), `?wire=1`
  (scene-wide wireframe + a true-4m-snapped reference grid on the water).

## Constraints

- Multiplayer contract: `game.json` declares `players: {min: 2, max: 2}` —
  exactly host + guest, via the hub's PeerJS `net` object. Windward never
  imports PeerJS itself (`games/README.md`'s contract).
- No TURN reliability guarantee: `shared/net.js`'s free TURN (Open Relay)
  doesn't relay for some carrier-NAT phones (`docs/MISSION-CONTROL.md`'s
  gotchas). Laptop-to-laptop across two networks is the tested baseline —
  don't assume mobile data works until it's actually tested.
- Fixed three-quarter camera never rotates with heading, by design (wind/
  compass readability) — `FIXED_CAMERA_AZIMUTH_DEG`/`ELEVATION_DEG` in
  `src/config.js`, zoom range 0.5-2.5x (`ZOOM_MIN`/`ZOOM_MAX`).
- Boat-island collision/grounding isn't built: `heightAt` is exposed per
  island (`src/island.js`) but `game.js` never samples it against the boat.
- Tests are headless, no CI: `node src/*.test.js` per file, run the full set
  by hand before every commit. Cheap tools first (node/curl/grep before the
  browser); visual/"does it feel good" calls go to Felix, not a screenshot.

## Documents, in reading order

1. `AGENTS.md` (repo root) — mission, audited risks, hub structure.
2. `LAST_SESSION.md` (repo root) — state pointer, most recent first.
3. `DESIGN.md` (this folder) — sail/trim/camera/wind mechanics, W0.8 retune.
4. This file — current density/facet/tooling state, what to play-test next.
