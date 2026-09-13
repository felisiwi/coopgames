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
  RATE: 2,       // grains emitted per tick while uncorked
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
  INSIDE_MAX_FALL: fp(1.0),
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
  MIN_COL: 30,              // travel limits, in world cells
  MAX_COL: 290,
  MAX_TILT: 34,             // degrees either way
  TILT_PER_SPEED: 5,        // degrees of lean per cell/tick of travel
  SPEED_FOR_MAX_TILT: 7,    // cells/tick that pins the lean at MAX_TILT
};

// The vessel's grid, in the finer cells.
export const GRID = { W: 70, H: 112 };

export const SOURCE = {
  VOLUME: 2800,  // grains available per stage; the stage ends when dry
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
