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
  // Single tuning point; src/sky.js and src/sunGlow.js both read straight
  // from CONFIG (no local copies) so game.js can't drift out of sync with
  // either.
  SUN_COLOR: 0xffd9a6, // warm gold, was flat white
  SUN_INTENSITY: 1.0,
  LIGHT_AZIMUTH_DEG: 55, // matches FIXED_CAMERA_AZIMUTH_DEG-ish so grazing light rakes toward the camera
  LIGHT_ELEVATION_DEG: 16, // low, for long golden-hour shadows (was 26 pre-golden-hour-pass)
  SUN_SHADOW_BIAS: -0.0008, // reduce acne; loosened from -0.0005 for the lower elevation above

  HEMI_SKY_COLOR: 0xffe3bf, // warm pale — ambient bounce off a golden sky
  HEMI_GROUND_COLOR: 0x22406b, // deep blue-indigo — cool shadow fill
  HEMI_INTENSITY: 0.55, // kept below the sun's contribution so lit/shadow contrast reads

  SKY_HORIZON_COLOR: 0xffd9a0,
  SKY_ZENITH_COLOR: 0x5b96d8,
  SKY_RADIUS: 1000, // world units — the dome (src/sky.js) is re-centred on the camera every frame, so this only needs to clear camera.far, not "cover the world"

  GLOW_COLOR: 0xffe6b8,
  GLOW_SIZE: 180, // world units, sprite scale (billboard, always faces camera)
  GLOW_DISTANCE: 900, // world units from the camera, along the sun's direction
  GLOW_OPACITY: 0.55,

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
};
