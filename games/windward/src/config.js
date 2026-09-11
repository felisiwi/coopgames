// Single tuning point for Windward (games/windward/DESIGN.md decisions).
export const CONFIG = {
  MAX_SPEED: 8, // m/s, full strength + 100° peak
  TURN_RATE: Math.PI / 2, // 90 deg/s
  TRIM_RATE: Math.PI / 3, // 60 deg/s
  TRIM_MIN: 0,
  TRIM_MAX: Math.PI / 2, // sheet range: 0 (full in) .. 90deg (full out)

  NET_SEND_HZ: 20,

  WIND_CHANGE_MIN_S: 25,
  WIND_CHANGE_MAX_S: 40,
  WIND_HEARTBEAT_S: 5, // resend current wind at least this often (late-join)

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

  // Water + wind readability (W0.5 Batch 3, games/windward/DESIGN.md).
  WATER_SIZE: 600, // meters, matches SCATTER_AREA so the sea fills the reference area
  WATER_SEGMENTS: 128,

  WIND_ARROW_HEIGHT: 7, // meters above the boat
  WIND_ARROW_MIN_LENGTH: 3,
  WIND_ARROW_LENGTH_SCALE: 8, // added length at full strength

  SCATTER_COUNT: 30,
  SCATTER_AREA: 600, // meters square, centred on world origin — throwaway, W1 replaces with islands

  WAKE_POOL_SIZE: 24,
  WAKE_SPAWN_INTERVAL_S: 0.12,
  WAKE_LIFETIME_S: 1.4,
  WAKE_STERN_OFFSET: 3, // meters behind the boat's position
};
