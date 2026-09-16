// Single tuning point for Windward (games/windward/DESIGN.md decisions).
export const CONFIG = {
  // Sail speed/feel (W0.8). BOAT_MAX_SPEED is the target-speed formula's
  // ceiling (src/sail.js's boatSpeed, unchanged shape, ~1.75x the W0.6
  // value of 8 so full-wind/well-trimmed feels brisk). self.speed doesn't
  // snap to that target instantly any more — game.js eases it there at
  // SAIL_FORCE m/s^2 when speeding up, DRAG m/s^2 when shedding speed (a
  // gust dying, a bad tack), giving the boat some weight. TURN_RATE scaled
  // up by roughly the same ratio so turning radius (speed / angular rate)
  // doesn't balloon into "bathtub" territory now that top speed is higher.
  BOAT_MAX_SPEED: 14, // m/s, full strength + 100° peak, ideal trim
  SAIL_FORCE: 6, // m/s^2, accel toward target speed
  DRAG: 4, // m/s^2, decel toward target speed (slightly slower to shed than gain)
  TURN_RATE: (Math.PI / 2) * 1.5, // 135 deg/s (was 90 deg/s at BOAT_MAX_SPEED 8)
  TRIM_RATE: Math.PI / 3, // 60 deg/s
  TRIM_MIN: 0,
  TRIM_MAX: Math.PI / 2, // sheet range: 0 (full in) .. 90deg (full out)

  NET_SEND_HZ: 20,

  // Wind cadence (W0.8): hold steady for WIND_HOLD_*_S, then ease to a new
  // random target over WIND_TRANSITION_*_S (src/wind.js's stepWindController)
  // — never an instant snap. WIND_HEARTBEAT_S still bounds a late-join's
  // wait during a hold; WIND_TRANSITION_SEND_INTERVAL_S is how often the
  // host resends while actively transitioning, so the guest's view eases
  // too instead of jumping once every heartbeat.
  WIND_HOLD_MIN_S: 40,
  WIND_HOLD_MAX_S: 60,
  WIND_TRANSITION_MIN_S: 8,
  WIND_TRANSITION_MAX_S: 12,
  WIND_TRANSITION_SEND_INTERVAL_S: 0.5,
  WIND_NOISE_AMPLITUDE: 0.02, // +-2% strength wobble during a transition, never on direction
  WIND_NOISE_FREQ_HZ: 0.15, // slow (~6.7s period) so it reads as flutter, not jitter
  WIND_HEARTBEAT_S: 5, // resend current wind at least this often (late-join)

  // Wind strength (0..1) -> real m/s, for the HUD (W0.8). Honest numbers:
  // a light-ish breeze at strength 0 up to a strong breeze at strength 1.
  WIND_STRENGTH_MIN_MS: 2,
  WIND_STRENGTH_MAX_MS: 14,
  MS_TO_KNOTS: 1.943844, // 1 m/s = 1.943844 kn (1 nm = 1852m, kn = m/s * 3600/1852)

  // W0.5 default: fixed-orientation three-quarter camera (never rotates with
  // the boat, so wind/compass stay readable regardless of heading). Set to
  // 'chase' to A/B against the old behind-the-boat cam kept below.
  CAMERA_MODE: 'fixed',

  FIXED_CAMERA_ELEVATION_DEG: 52,
  FIXED_CAMERA_AZIMUTH_DEG: 45, // constant compass bearing from boat to camera
  FIXED_CAMERA_FOV_DEG: 30, // narrow => reads almost isometric
  // Straight-line camera-to-boat distance. At 30deg vertical FOV / 16:9 this
  // puts ~120m across the screen at the boat's position (120 / (2*tan(hFOV/2))).
  FIXED_CAMERA_DISTANCE: 125,
  FIXED_CAMERA_DAMPING_RATE: 3, // 1/s, dt-based exponential smoothing

  ZOOM_MIN: 0.5, // closer than default
  ZOOM_MAX: 2.5, // further than default
  ZOOM_WHEEL_SENSITIVITY: 0.0015, // multiplier change per wheel deltaY unit

  // Legacy chase cam (pre-W0.5), kept for comparison behind CAMERA_MODE.
  CAMERA_DISTANCE: 12,
  CAMERA_HEIGHT: 6,
  CAMERA_LOOKAHEAD: 6,
  CAMERA_DAMPING_RATE: 3, // 1/s, dt-based exponential smoothing (not a fixed per-frame lerp)
  CHASE_CAMERA_FOV_DEG: 60,

  BOAT_SPAWN_OFFSET: 10, // meters apart on X before any 'pos' has synced

  // --- Lighting & sky (golden-hour pass, 2026-09-16, shared/ART.md) ---
  // Single tuning point so island-lab.html can expose these as sliders,
  // same reason the ISLAND_* fields below live here instead of in
  // src/island.js. src/sky.js and src/sunGlow.js both read straight from
  // CONFIG (no local copies) so game.js and the lab can't drift apart.
  // Values below: "Sunset" lighting preset (src/light-presets.js), tuned at
  // seed 989370 in island-lab.html (Felix, 2026-09-16).
  SUN_COLOR: 0xffd9a6, // warm gold, was flat white
  SUN_INTENSITY: 1.4,
  LIGHT_AZIMUTH_DEG: 50, // matches FIXED_CAMERA_AZIMUTH_DEG-ish so grazing light rakes toward the camera
  LIGHT_ELEVATION_DEG: 10, // low, for long golden-hour shadows (was 26 pre-golden-hour-pass)
  SUN_SHADOW_BIAS: -0.0008, // reduce acne; loosened from -0.0005 for the lower elevation above

  HEMI_SKY_COLOR: 0xcbc9ad, // warm pale — ambient bounce off a golden sky
  HEMI_GROUND_COLOR: 0x21406a, // deep blue-indigo — cool shadow fill
  HEMI_INTENSITY: 0.45, // kept below the sun's contribution so lit/shadow contrast reads

  SKY_HORIZON_COLOR: 0xecf8f1,
  SKY_ZENITH_COLOR: 0x00faff,
  SKY_RADIUS: 1000, // world units — the dome (src/sky.js) is re-centred on the camera every frame, so this only needs to clear camera.far, not "cover the world"

  GLOW_COLOR: 0xffe5b8,
  GLOW_SIZE: 180, // world units, sprite scale (billboard, always faces camera)
  GLOW_DISTANCE: 340, // world units from the camera, along the sun's direction
  GLOW_OPACITY: 0.65,

  // Water tuning (WAVE_AMP, WAVE_LEN, WAVE_SPEED, SEG, SIZE, WATER_COLOR)
  // lives in src/water.js — self-contained so the JS boat-bob mirror and
  // the GLSL displacement can't drift apart (see that file).

  // Boat bob/tilt from the wave surface (W0.6). Gradient is a finite
  // difference of src/water.js's seaHeightCPU, sampled this many meters
  // ahead and to the side of the boat.
  BOAT_TILT_GRADIENT_EPS: 1, // meters
  BOAT_TILT_GAIN: 1.5, // radians of pitch/roll per (m/m) wave slope
  BOAT_TILT_MAX: 0.12, // radians (~7deg), clamp so a steep local slope can't flip the boat

  WIND_ARROW_HEIGHT: 7, // meters above the boat
  WIND_ARROW_MIN_LENGTH: 3,
  WIND_ARROW_LENGTH_SCALE: 8, // added length at full strength

  SCATTER_COUNT: 30,
  SCATTER_AREA: 600, // meters square, centred on world origin — throwaway, W1 replaces with islands

  WAKE_POOL_SIZE: 24,
  WAKE_SPAWN_INTERVAL_S: 0.12,
  WAKE_LIFETIME_S: 1.4,
  WAKE_STERN_OFFSET: 3, // meters behind the boat's position

  // --- Islands (I1, src/island.js) ---
  // ONE fixed granite-and-pine island for this stage. Position/size are
  // plain numbers (not seeded) so where it is stays put across sessions;
  // the coastline/terrain noise below IS seeded from the session `seed`
  // (offset per layer, same convention as scatter.js/wind.js) so its shape
  // still varies game to game while staying identical on both peers.
  //
  // Values below: "Skerry" island-shape preset (src/island-presets.js),
  // tuned at seed 989370 in island-lab.html (Felix, 2026-09-16).
  ISLAND_CENTER_X: 55, // metres, world space
  ISLAND_CENTER_Z: 145, // metres — far enough from the (+-10, 0) boat spawn for a real approach (Felix, 2026-09-16: was 220, moved out so the island isn't visible from spawn as a fixed point)
  ISLAND_RADIUS: 75, // metres, base coastline radius before noise wobble (~310m diameter) — targets a ~90-120s lap at typical (non-max) sailing speed
  ISLAND_MESH_MARGIN: 22, // 15-50m the mesh extends past the noisy coastline into shallow water, so it always overlaps the moving water tile with no seam regardless of wave phase

  ISLAND_COAST_NOISE_FREQ: 0.032, // 0.01-0.05 (1/m), higher = more jagged/noisy coastline, lower = smoother rounder island
  ISLAND_COAST_NOISE_AMPLITUDE: 40, // 10-40m, how far the coastline wobbles off the base circle — higher = more irregular
  ISLAND_FALLOFF_WIDTH: 32, // 20-80m, width of the land-to-water transition band — lower = cliff-like coast, higher = gradual beach taper

  ISLAND_PEAK_HEIGHT: 44, // 20-60m, terrain height at the island's centre before noise
  ISLAND_PEAK_SHAPE: 1, // 0.4-1.0, exponent on the radial dome — lower = broader granite massif with a flatter top, higher = one pointed peak
  ISLAND_HEIGHT_NOISE_FREQ: 0.018, // 0.008-0.03 (1/m), higher = smaller/choppier terrain bumps, lower = broad rolling hills
  ISLAND_HEIGHT_NOISE_AMPLITUDE: 9, // 3-15m, how much the height-noise layer perturbs the dome — higher = craggier

  ISLAND_GRID_CELL_SIZE: 5.5, // 4-10m, mesh cell size — bigger = chunkier flat-shaded facets ("handmade"), smaller = smoother but less stylised

  // Vertex-colour thresholds (slope from a finite-difference gradient, like
  // BOAT_TILT_GRADIENT_EPS above).
  ISLAND_SAND_MAX_HEIGHT: 1, // 1-5m, below this + gentle slope reads as sandy/grass fringe
  ISLAND_GRASS_MAX_HEIGHT: 25, // 15-30m, above this it leans rocky even on gentle slopes (bare upper-slope granite)
  ISLAND_ROCK_MIN_SLOPE_DEG: 35, // 25-45deg, slope steeper than this always reads as bare granite, regardless of height

  ISLAND_TREE_MIN_HEIGHT: 4.4, // 1-6m, no trees on the beach fringe below this
  ISLAND_TREE_MAX_HEIGHT: 34, // 20-40m, no trees above this (bare granite near the peak)
  ISLAND_TREE_MAX_SLOPE_DEG: 37, // 20-40deg, no trees on slopes steeper than this
  ISLAND_TREE_ATTEMPTS: 800, // candidate points tried; how many actually land in the valid height/slope band (and so get planted) varies with the terrain, not just this number
  ISLAND_TREE_SCALE_MIN: 0.7, // 0.5-1.5, per-tree random scale range, for a handmade/uneven look
  ISLAND_TREE_SCALE_MAX: 1.5,

  // Underwater shelf (I1 item 3) — never rendered (opaque water hides it),
  // only sampled later for keel/draught. Built into the same heightfield
  // now because retrofitting a depth model onto a mesh that only ever
  // defined height >= 0 would mean redoing the terrain function from
  // scratch.
  ISLAND_SHELF_WIDTH: 51, // 30-100m beyond the coastline — wider = gentler underwater slope
  ISLAND_SHELF_DEPTH: 5.5, // 3-10m, depth at the outer edge of the shelf (still "shallow" by boat-draught standards)
  ISLAND_ABYSS_DEPTH: 37, // 20-50m, depth the seabed eases toward well beyond the shelf
  ISLAND_ABYSS_TRANSITION_WIDTH: 125, // 80-250m, distance beyond the shelf over which depth eases from ISLAND_SHELF_DEPTH to ISLAND_ABYSS_DEPTH

  // Palette (mirrors shared/ART.md's Islands section) — pink granite with
  // dark pines, grassy green, low sandy scrub, per the mission brief.
  ISLAND_COLOR_SAND: 0xd9c48a,
  ISLAND_COLOR_GRASS: 0x5da84a,
  ISLAND_COLOR_GRANITE: 0xb2c8ef,
  ISLAND_COLOR_GRANITE_PEAK: 0x809bb0, // slightly deeper/duller than lower granite so peaks read as farther/higher
  ISLAND_COLOR_PINE: 0x35694c,
  ISLAND_COLOR_TRUNK: 0x928164,
};
