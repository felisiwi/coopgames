// Every tunable number for Will It Fit?. See DESIGN.md for why each of
// these exists; this file is where you change how it feels.
//
// DETERMINISM RULE: the simulation must be reproducible bit-for-bit on two
// machines (DESIGN.md risk 2), so every value the sim reads is an INTEGER
// in fixed-point units. Floats are allowed only in rendering. If you add a
// number here that the sim touches, it must be an integer.

// Fixed-point: positions and velocities are integers scaled by FP.
// 256 gives sub-cell precision with a huge headroom before overflow.
export const FP = 256;
export const fp = (n) => Math.round(n * FP);

export const STAGE = {
  W: 960,        // logical canvas, letterboxed into whatever we're given
  H: 600,
  CELL: 6,       // pixels per CA cell; the sim works in cells, not pixels
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
  // Pour pressure -> exit speed, in fixed-point units per tick.
  PRESSURE_MIN: 1,
  PRESSURE_MAX: 10,
  PRESSURE_DEFAULT: 5,
  SPEED_PER_PRESSURE: fp(0.55), // exit speed = pressure * this
  NOZZLE: 3,                    // cells across the stream at the spout
  RATE: 2,                      // droplets emitted per tick while uncorked
};

export const PHYS = {
  GRAVITY: fp(0.055),   // per tick, applied to in-flight droplets only
  MAX_FALL: fp(6),      // terminal velocity, keeps the handoff tractable
};

export const TABLE_Y = 520; // where the vessel stands, in logical pixels

// The vessel's grid. Generous enough for a tall flask, cheap enough that a
// full CA sweep is nothing.
export const GRID = { W: 34, H: 56 };

export const SOURCE = {
  VOLUME: 900,   // droplets available per stage; the stage ends when dry
};

// Materials are ONE parameterised ruleset, not several (proven during
// design — see DESIGN.md). `spread` is sideways slide chance, `cohesion`
// is self-stickiness, `grain` is cells per grain. Probabilities are in
// PERCENT (integers) so the sim stays float-free.
export const MATERIALS = {
  water: {
    id: 1,
    name: 'Water',
    spread: 100,
    cohesion: 0,
    grain: 1,
    color: '#C2410C',      // deep orange; 4.34:1 on cream (Q22)
    shade: '#9A3208',
  },
  slush: {
    id: 2,
    name: 'Slush',
    spread: 30,
    cohesion: 45,
    grain: 2,
    color: '#D8643C',
    shade: '#A8452A',
  },
  magma: {
    id: 3,
    name: 'Magma',
    spread: 15,
    cohesion: 60,
    grain: 1,
    color: '#B02E12',
    shade: '#7C1D0A',
  },
};

export const MATERIAL_BY_ID = Object.fromEntries(
  Object.values(MATERIALS).map((m) => [m.id, m]),
);

// Paper cut-out palette. Pastel ground, vessel in darker two-tone.
export const PALETTE = {
  skyTop: '#EADCEC',
  skyBottom: '#F6E9DC',
  table: '#DFCDBC',
  vesselDark: '#4A4458',   // 7.79:1 on cream
  vesselLit: '#6B6480',    // 4.68:1 on cream
  spout: '#4A4458',
  ink: '#2E2A3A',
  abyss: 'rgba(74,68,88,0.10)',
};
