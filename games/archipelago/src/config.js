// Single source of tunable numbers for the game. Stage 1 scaffold only —
// generator/render-specific values (diamond footprint step, water margin
// usage, etc.) get wired up in later stages per AGENTS.md.
export const CONFIG = {
  // World
  MAP_SIZE: 48, // tiles per side, square grid
  WATER_MARGIN: 3, // min tiles of water forced on every edge (Step 0 audit #2)

  // Multiplayer tuning (Step 0 audit #4)
  VISION_RADIUS: 5, // tiles a player can see around themselves
  SPAWN_DISTANCE: 18, // min Manhattan distance between spawnA and spawnB

  // Tile art — source PNG size for the curated palette (Batch 2).
  // TILE_STEP_X/Y (the actual drawn diamond footprint, measured from the
  // PNGs, not assumed 2:1 — AGENTS.md risk #6) is added when the tileset
  // lands in Batch 2. TODO(felix): confirm once assets/tiles/ exists.
  TILE_WIDTH: 128,
  TILE_HEIGHT: 72,
};
