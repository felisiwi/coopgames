// Every tunable number in the game lives here, so Kenny can rebalance the
// whole feel in one file without reading the state machine. Times are in
// seconds, distances in logical pixels, speeds in px/sec.

export const STAGE = {
  W: 960,          // logical canvas size; the real canvas is scaled to fit
  H: 540,
  GROUND_Y: 430,   // y of the dirt line the dinos stand on
  WALL_PAD: 60,    // how close to the screen edge a dino may get
};

export const PHYS = {
  GRAVITY: 2200,
  WALK_SPEED: 260,
  CROUCH_SPEED: 110,
  JUMP_VELOCITY: -790,
  AIR_CONTROL: 0.55,   // fraction of walk speed you steer with mid-jump
  FRICTION: 12,        // knockback decay, per second (exponential)
};

// A dino is a capsule for collision purposes: BODY_W wide, BODY_H tall,
// anchored at its feet. Hitboxes below are all relative to that anchor,
// in "facing" space (+x is always forward), and get mirrored when facing
// left.
// PUSH_W is the push-box: narrower than the hurtbox, so you can get right
// in each other's face to chomp, but never occupy the same space. Without
// it two dinos walk straight through one another and the whole spacing
// game — the actual substance of a fighter — disappears.
export const BODY = { W: 74, H: 96, CROUCH_H: 62, PUSH_W: 58 };

// PEP is the play-fighting stand-in for health: you don't lose hit points,
// you get tuckered out. At zero you flop over, catch your breath, and the
// round resets. Nothing bleeds, nothing dies.
export const PEP = {
  MAX: 100,
  REGEN: 3.5,          // per second, only while idle/walking on the ground
  REGEN_DELAY: 1.6,    // seconds after being hit before regen resumes
};

export const ROUNDS = {
  TO_WIN: 3,
  FLOP_TIME: 2.2,      // lying on your back, legs wiggling
  RESET_PAUSE: 1.0,    // beat between rounds
};

// The two attacks. `startup` is windup frames (whiffable), `active` is the
// window where the hitbox exists, `recovery` is the punish window after.
// Chomp is fast and chip-y; tail is slow, wide and sends you flying.
export const MOVES = {
  chomp: {
    name: 'chomp',
    startup: 0.08,
    active: 0.07,
    recovery: 0.15,
    damage: 8,
    knockback: 150,
    lift: -60,
    // hitbox relative to feet anchor, facing-space
    box: { x: 34, y: -86, w: 62, h: 38 },
  },
  tail: {
    name: 'tail',
    startup: 0.21,
    active: 0.11,
    recovery: 0.32,
    damage: 19,
    knockback: 380,
    lift: -280,
    box: { x: 18, y: -56, w: 96, h: 46 },
  },
};

export const BLOCK = {
  DAMAGE_SCALE: 0.2,    // a blocked hit still chips a little
  KNOCKBACK_SCALE: 0.4,
  PEP_COST: 1.5,        // per second held, so turtling is not free
};

export const HURT = {
  STUN: 0.26,
  BLOCK_STUN: 0.12,
};

export const NET = {
  BROADCAST_HZ: 30,
  LERP_RATE: 18,        // how fast the remote dino eases toward its last
                        // known position; higher = snappier but jitterier
};

// Host is the green Rex, guest is the clay-coloured Tri. Purely cosmetic —
// the two are mechanically identical, so neither side gets a matchup edge.
export const SKINS = {
  host: {
    id: 'rex',
    name: 'Rex',
    body: '#4e9e6a',
    belly: '#9fd8ab',
    dark: '#2f6b47',
    accent: '#f2c14e',
    eye: '#22303a',
  },
  guest: {
    id: 'tri',
    name: 'Tri',
    body: '#d08149',
    belly: '#f0c39a',
    dark: '#9c5730',
    accent: '#6fa8c9',
    eye: '#22303a',
  },
};
