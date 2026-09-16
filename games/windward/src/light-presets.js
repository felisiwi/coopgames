// Named lighting presets (LIGHT_*, SUN_*, HEMI_*, SKY_*, GLOW_* keys only)
// for games/windward/island-lab.html. Island shape (ISLAND_*, including
// ISLAND_COLOR_*) is a separate preset kind — see src/island-presets.js —
// so the two can be picked and tuned independently in the lab.
//
// Each preset is a full snapshot of every lighting key from src/config.js
// at the time it was saved (same order as that file's Lighting & sky
// section). Load one in the lab as a starting point for further tuning, or
// copy `values` straight into config.js's own lighting block.
//
// Lives in the repo (not browser storage) on purpose: Felix and Kenny both
// need to read and hand these back to Claude across sessions/machines.
export const LIGHT_PRESETS = [
  {
    name: 'Sunset',
    // seed 989370 (Felix, 2026-09-16) — load this seed in island-lab.html to
    // reproduce the exact scene these values were tuned against.
    values: {
      LIGHT_AZIMUTH_DEG: 50,
      LIGHT_ELEVATION_DEG: 10,
      SUN_INTENSITY: 1.4,
      HEMI_INTENSITY: 0.45,
      GLOW_SIZE: 180,
      GLOW_DISTANCE: 340,
      GLOW_OPACITY: 0.65,
      SUN_COLOR: 0xffd9a6,
      HEMI_SKY_COLOR: 0xcbc9ad,
      HEMI_GROUND_COLOR: 0x21406a,
      SKY_HORIZON_COLOR: 0xecf8f1,
      SKY_ZENITH_COLOR: 0x00faff,
      GLOW_COLOR: 0xffe5b8,
    },
  },
];
