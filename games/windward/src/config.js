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

  CAMERA_DISTANCE: 12,
  CAMERA_HEIGHT: 6,
  CAMERA_LOOKAHEAD: 6,
  CAMERA_DAMPING_RATE: 3, // 1/s, dt-based exponential smoothing (not a fixed per-frame lerp)

  BOAT_SPAWN_OFFSET: 10, // meters apart on X before any 'pos' has synced
};
