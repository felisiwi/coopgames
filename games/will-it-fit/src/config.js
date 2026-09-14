// Every tunable number for Will It Fit?. See DESIGN.md for why each of
// these exists; this file is where you change how it feels.
//
// DETERMINISM RULE: the simulation must be reproducible bit-for-bit on two
// machines (DESIGN.md risk 2), so every value the sim reads is an INTEGER
// in fixed-point units. Floats are allowed only in rendering. If you add a
// number here that the sim touches, it must be an integer.

// FEEL DIALS — the four numbers that set the pace, in the order you'll
// most likely want them:
//   STAGE.CELL            grain size. Smaller = finer grit.
//   PHYS.GRAVITY          how fast the arc drops. Lower = more hang time.
//   game.js TICKS_PER_FRAME   overall tempo. 1 is slow, 2 is brisk.
//   SOURCE.VOLUME         how long a stage lasts.
// Changing CELL rescales the world: if you halve it, halve SPEED_PER_
// PRESSURE's pixel effect and QUARTER gravity to keep the same reach
// (range goes as v²/g), and double every size in vessel.js.

// Fixed-point: positions and velocities are integers scaled by FP.
// 256 gives sub-cell precision with a huge headroom before overflow.
export const FP = 256;
export const fp = (n) => Math.round(n * FP);

export const STAGE = {
  W: 960,        // logical canvas, letterboxed into whatever we're given
  H: 600,
  // Pixels per CA cell. Halving this quarters the grain size, which is
  // what turns a chunky sand toy into raked-garden grit. It also doubles
  // the grid, so PHYS below is retuned to keep the same reach at half
  // speed rather than inheriting a faster world for free.
  CELL: 3,
};

// The source sits up and to the left; the vessel stands on the table.
export const SPOUT = {
  X: 150,
  Y: 110,
  // Aim angle in DEGREES from horizontal, measured toward the vessel.
  // POSITIVE is above horizontal (a lob), NEGATIVE is below (pouring
  // straight down at your feet). Whole degrees, so the sim never sees a
  // float. The range has to reach well above horizontal or there is no
  // arc to make — that is the whole point of the pourer's role.
  ANGLE_MIN: -60,
  ANGLE_MAX: 45,
  ANGLE_DEFAULT: -18,
  // Pour pressure -> exit speed, in fixed-point CELLS per tick.
  PRESSURE_MIN: 1,
  PRESSURE_MAX: 10,
  PRESSURE_DEFAULT: 5,
  SPEED_PER_PRESSURE: fp(0.5),
  NOZZLE: 5,     // cells across the stream at the spout
  ANGLE_FIXED: -14,
  // The pourer can carry the source along its own run, well to the left of
  // the bowl's. Kept clear of the bowl's travel on purpose: standing
  // directly over the vessel and dropping material straight in would make
  // the arc — and therefore the whole pourer's job — pointless.
  MIN_COL: 18,
  MAX_COL: 120,
};

// Pouring is not a trigger, it is a POUR: think hot milk off a steamer, or
// bronze out of a crucible. It starts as a dribble and accelerates the
// longer you hold, slowly at first and then quickly. Release and it resets,
// so a tap is a careful splash and a long hold is a torrent.
//
// The ramp is the whole skill: as the stream speeds up it also throws
// FURTHER, so the landing point walks away from you and you have to move
// the bowl to follow, or let go. That is why the source no longer sweeps on
// its own — the chase is caused by your own pour instead of by an arbitrary
// oscillation, which is what made it look like it was looping and juddering.
export const POUR = {
  RAMP_TICKS: 240,      // hold time to reach full flow
  RATE_START: fp(0.25), // grains per tick the moment you open it
  RATE_MAX: fp(5),

  // Exit speed in fixed-point CELLS PER TICK, not in integer "pressure".
  // Integer pressure made the landing point teleport: measured at the fixed
  // aim it went 97 -> 140 -> 177 -> 210 -> 238 -> 287, so every step opened
  // a 30-50 cell hole in the arc with nothing landing inside it, and where
  // that hole fell depended on exactly when the counter ticked over. A
  // continuous speed sweeps the landing point smoothly instead.
  SPEED_START: fp(0.5),
  SPEED_MAX: fp(3.5),   // was pressure 7; still arcs down inside the frame

  // THE THROTTLE. Speed may only rise in proportion to grains actually
  // emitted, so the stream can never accelerate faster than the sand is
  // flowing. Sized so the landing point walks at most about a cell per
  // grain: near the bottom of the range the landing point moves roughly 86
  // cells per cell/tick of speed, so ~1/86 of a cell/tick per grain keeps
  // the arc continuous. With no flow there is no acceleration at all.
  SPEED_STEP_PER_GRAIN: 3,
};

// Slowed deliberately. Halving exit speed and QUARTERING gravity (in pixel
// terms) keeps the same reach — range goes as v²/g — while roughly doubling
// time of flight. The arc hangs instead of snapping, which is the whole
// point: you should have time to watch it land and think about it.
export const PHYS = {
  GRAVITY: fp(0.0182),
  MAX_FALL: fp(2.27),      // terminal velocity in free flight
  // Terminal velocity once a grain is INSIDE the vessel. Lower, so the
  // stream eases into the pile instead of arriving at full speed — the
  // vessel should feel like it receives the pour, not like it blocks it.
  // Lowered again — the sand was too energetic. Grains arrive gently and
  // the pile absorbs them rather than the stream drilling into it.
  INSIDE_MAX_FALL: fp(0.7),
};

export const TABLE_Y = 520; // where the vessel stands, in logical pixels

// STAGE 2 — the catcher's seat.
//
// Tilt is NOT a free control. If it were, it would only ever cause spills,
// so the rational play would be to never tilt and the whole mechanic would
// be inert. Tilt is induced by MOVEMENT: you lean because you moved fast to
// catch something. It is still instant (no spring, no momentum, per Q2) —
// stop moving and you are upright again on the same frame — so it stays
// completely predictable. Move fast to reach the stream, lean, risk it.
export const VESSEL = {
  MIN_COL: 36,              // travel limits, in world cells
  MAX_COL: 284,
  // Must exceed 45°. Below that, a liquid parcel moving (+1,-1) — the only
  // way material can climb toward a lowered rim — is uphill, so a
  // partly-filled vessel can NEVER pour however hard you lean it. Above
  // 45° that same step is downhill and the bowl empties as it should.
  MAX_TILT: 62,             // degrees either way
  TILT_PER_SPEED: 5,        // degrees of lean per cell/tick of travel
  SPEED_FOR_MAX_TILT: 9,    // cells/tick that pins the lean at MAX_TILT
  // Raw per-frame mouse delta is far too noisy to drive a lean directly —
  // it made the bowl judder. Smoothed over roughly this many frames.
  TILT_SMOOTH: 7,
};

// The vessel's grid, in the finer cells.
// Wider and shallower than before: bowls are now broad and flat rather
// than cup-shaped, and roughly 2.5x the capacity so a stage lasts.
export const GRID = { W: 84, H: 64 };

export const SOURCE = {
  // Grains per stage, as a fraction of the vessel's capacity. Relative
  // rather than absolute because vessels now vary hugely in size: a fixed
  // count would drown a late shallow cup and barely wet an early bowl.
  // Below 1 so a clean pour nearly fills it and spilling really costs you.
  FILL_RATIO: 0.85,
};

// Materials are ONE parameterised ruleset, not several (proven during
// design — see DESIGN.md). `spread` is sideways slide chance, `cohesion`
// is self-stickiness, `grain` is cells per grain. Probabilities are in
// PERCENT (integers) so the sim stays float-free.
//
// Palette is spa/Japanese-garden rather than hot: deep celadon, soft
// slate, warm clay. Every tone clears WCAG 1.4.11's 3:1 non-text contrast
// against both background stops (measured, not guessed).
export const MATERIALS = {
  water: {
    id: 1,
    name: 'Water',
    spread: 100,
    cohesion: 0,
    grain: 1,
    flow: 5,      // cells of lateral travel per tick — water finds its level fast
    alpha: 0.8,   // liquids are translucent; you should see the vessel through them
    color: '#4F7A72',      // deep celadon — 3.96:1 on mist, 4.23:1 on paper
    shade: '#3E615B',
  },
  slush: {
    id: 2,
    name: 'Mist',
    spread: 30,
    cohesion: 45,
    grain: 2,
    flow: 2,
    alpha: 0.85,
    color: '#5F7E93',      // soft slate — 3.53:1 / 3.77:1
    shade: '#4B6675',
  },
  magma: {
    id: 3,
    name: 'Clay',
    spread: 15,
    cohesion: 60,
    grain: 1,
    flow: 1,      // clay barely creeps; it holds an angle
    alpha: 1,     // clay is opaque
    color: '#A9705A',      // warm clay — 3.35:1 / 3.58:1
    shade: '#8A5A47',
  },
};

export const MATERIAL_BY_ID = Object.fromEntries(
  Object.values(MATERIALS).map((m) => [m.id, m]),
);

// Paper cut-out palette: rice paper, raked sand, sumi-ink vessel.
export const PALETTE = {
  skyTop: '#E7EAE3',
  skyBottom: '#F3F0E8',
  table: '#DCD8CB',
  vesselDark: '#39443F',   // 8.34:1 on mist
  vesselLit: '#5D6B65',    // 4.60:1 on mist
  spout: '#39443F',
  ink: '#2F3733',
  abyss: 'rgba(57,68,63,0.09)',
};
