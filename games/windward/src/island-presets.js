// Named ISLAND_* parameter presets for games/windward/island-lab.html.
// Each preset is a full snapshot of every ISLAND_* key from src/config.js at
// the time it was saved (Position through Colours, same order as that
// file). Load one in the lab as a starting point for further tuning, or
// copy `values` straight into config.js's own ISLAND_* block.
//
// Lives in the repo (not browser storage) on purpose: Felix and Kenny both
// need to read and hand these back to Claude across sessions/machines.
export const ISLAND_PRESETS = [
  {
    name: 'granite',
    // seed 933945 (Felix, 2026-09-16) — load this seed in island-lab.html to
    // reproduce the exact island these values were tuned against.
    values: {
      ISLAND_CENTER_X: 55,
      ISLAND_CENTER_Z: 145,
      ISLAND_RADIUS: 105,
      ISLAND_MESH_MARGIN: 22,
      ISLAND_COAST_NOISE_FREQ: 0.032,
      ISLAND_COAST_NOISE_AMPLITUDE: 40,
      ISLAND_FALLOFF_WIDTH: 32,
      ISLAND_PEAK_HEIGHT: 29,
      ISLAND_PEAK_SHAPE: 0.48,
      ISLAND_HEIGHT_NOISE_FREQ: 0.009,
      ISLAND_HEIGHT_NOISE_AMPLITUDE: 11,
      ISLAND_GRID_CELL_SIZE: 5,
      ISLAND_SAND_MAX_HEIGHT: 1,
      ISLAND_GRASS_MAX_HEIGHT: 25,
      ISLAND_ROCK_MIN_SLOPE_DEG: 25,
      ISLAND_TREE_MIN_HEIGHT: 1.8,
      ISLAND_TREE_MAX_HEIGHT: 23,
      ISLAND_TREE_MAX_SLOPE_DEG: 27,
      ISLAND_TREE_ATTEMPTS: 800,
      ISLAND_TREE_SCALE_MIN: 0.7,
      ISLAND_TREE_SCALE_MAX: 1.5,
      ISLAND_SHELF_WIDTH: 51,
      ISLAND_SHELF_DEPTH: 5.5,
      ISLAND_ABYSS_DEPTH: 37,
      ISLAND_ABYSS_TRANSITION_WIDTH: 125,
      ISLAND_COLOR_SAND: 0xd9c48a,
      ISLAND_COLOR_GRASS: 0x5da84a,
      ISLAND_COLOR_GRANITE: 0xeec0af,
      ISLAND_COLOR_GRANITE_PEAK: 0xa0afa3,
      ISLAND_COLOR_PINE: 0x176929,
      ISLAND_COLOR_TRUNK: 0x966c53,
    },
  },
];
