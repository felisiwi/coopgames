// Single source of tunable numbers for the game.
export const CONFIG = {
  // World
  MAP_SIZE: 48, // tiles per side, square grid
  WATER_MARGIN: 3, // min tiles of water forced on every edge (Step 0 audit #2)

  // Multiplayer tuning (Step 0 audit #4)
  VISION_RADIUS: 5, // tiles a player can see around themselves
  SPAWN_DISTANCE: 18, // min Manhattan distance between spawnA and spawnB

  // Movement
  MOVE_SECONDS_PER_TILE: 0.18, // time to animate one grid step

  // Networking
  NET_SEND_HZ: 20, // own-position broadcast rate over net.send

  // Serendipity map (design audit, 2026-11-04) — see src/serendipity.js and
  // design-checks.md. A walkable tile further than this many WALKING steps
  // from anything discoverable is a "dead zone". 10 = 2x VISION_RADIUS: you
  // could walk a full screen of fog in any direction and find nothing.
  SERENDIPITY_DEAD_ZONE_TILES: 10,
  DISCOVERABLE_TYPES: ['landmark'], // tile types that count as "worth finding"

  // Photo spots for the visual changelog (?spot=N in the solo dev entry).
  // Fixed seed + fixed camera tile, fog off, no input — so before/after
  // screenshots compare the same view. Coordinates are absolute tiles, not
  // "wherever the landmark is", on purpose: a generator change that moves
  // the landmark should SHOW as a different picture.
  PHOTO_SPOTS: {
    1: { seed: 1, fit: true, label: 'seed 1, whole island' },
    2: { seed: 1, x: 25, y: 22, label: 'seed 1, landmark close-up' },
    3: { seed: 1, x: 7, y: 26, label: 'seed 1, host spawn' },
  },

  // Tile art — curated "Thick" 128x72 PNGs in assets/tiles/ (Batch 2,
  // Screaming Brain Studios CC0 pack). Each PNG is the full 128x72 cell:
  // a flat isometric diamond top face PLUS an 8px "thickness" skirt below
  // it (the Thick style's 3D side face) — the drawn image height is NOT
  // the grid step (AGENTS.md risk #6).
  //
  // Measured directly from the PNGs (scanned per-row opaque-pixel bounds
  // on deep_water.png and rock.png, identical mask on both): the diamond
  // widens from a single point at row 0 to full 128px width at row 31,
  // stays full-width through row 39 (the 8px skirt insertion), then
  // narrows back to a point at row 71. Discounting the 8px skirt, the true
  // top-face diamond is a standard 128x64 (2:1) rhombus, apex at row 0,
  // widest at row 32. So the grid step is half of THAT diamond, not half
  // of the full 72px image:
  TILE_WIDTH: 128,
  TILE_HEIGHT: 72,
  TILE_STEP_X: 64, // TILE_WIDTH / 2
  TILE_STEP_Y: 32, // half of the 64px true diamond height (not TILE_HEIGHT / 2 = 36)
};
