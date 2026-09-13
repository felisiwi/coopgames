// The simulation. Two regimes and one handoff, exactly as DESIGN.md sets
// out:
//
//   in flight  — ballistic droplets in WORLD space, fixed-point integers
//   settled    — CA cells in the vessel's LOCAL grid
//   handoff    — at the vessel mouth (risk 7: the most delicate seam here)
//
// Nothing in this file may use Math.random() or floating-point arithmetic
// in a decision the two peers must agree on. Every random choice comes from
// this object's own seeded PRNG, and every position is a fixed-point int.
// That is what makes lockstep possible (DESIGN.md risk 2).
//
// Stage 1 scope: the vessel is upright and static. The grid is already
// bottle-LOCAL, so stage 2 adds tilt by rotating gravity rather than by
// rewriting any of this.
import { FP, STAGE, SPOUT, PHYS, GRID, SOURCE, MATERIALS, TABLE_Y } from './config.js';
import { generateVessel, inside } from './vessel.js';

const WORLD_COLS = Math.floor(STAGE.W / STAGE.CELL);
const TABLE_ROW = Math.floor(TABLE_Y / STAGE.CELL);
const SPOUT_COL = Math.floor(SPOUT.X / STAGE.CELL);
const SPOUT_ROW = Math.floor(SPOUT.Y / STAGE.CELL);

// Integer sine/cosine tables, one entry per whole degree, scaled by FP.
// Precomputed so the sim never calls Math.sin at runtime — the tables are
// identical on every machine, a live trig call is not guaranteed to be.
const SIN = new Int32Array(360);
const COS = new Int32Array(360);
for (let d = 0; d < 360; d++) {
  SIN[d] = Math.round(Math.sin((d * Math.PI) / 180) * FP);
  COS[d] = Math.round(Math.cos((d * Math.PI) / 180) * FP);
}
const sinDeg = (d) => SIN[((d % 360) + 360) % 360];
const cosDeg = (d) => COS[((d % 360) + 360) % 360];

// xorshift32 — integer in, integer out, identical everywhere.
function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

// Launch velocity for an aim. Exported so the on-screen ghost arc and the
// real stream are computed by the SAME code — a preview with its own copy
// of this maths is a preview that eventually lies.
export function launchVelocity(angleDeg, pressure) {
  const speed = pressure * SPOUT.SPEED_PER_PRESSURE;
  return {
    vx: (speed * cosDeg(angleDeg)) / FP | 0,
    vy: (speed * -sinDeg(angleDeg)) / FP | 0,
  };
}

// Integrate one droplet forward, same arithmetic the sim uses. Mutates.
export function stepBallistic(d) {
  d.vy += PHYS.GRAVITY;
  if (d.vy > PHYS.MAX_FALL) d.vy = PHYS.MAX_FALL;
  d.x += d.vx;
  d.y += d.vy;
}

// The predicted flight path, in fixed-point world cells. Cheap: no Sim,
// no grid, no allocation beyond the points themselves.
export function traceArc(angleDeg, pressure, steps = 220, stopRow = Infinity) {
  const { vx, vy } = launchVelocity(angleDeg, pressure);
  const d = { x: SPOUT_COL * FP, y: SPOUT_ROW * FP, vx, vy };
  const pts = [];
  for (let i = 0; i < steps; i++) {
    stepBallistic(d);
    const col = d.x / FP | 0;
    const row = d.y / FP | 0;
    if (col < 0 || col >= WORLD_COLS || row > stopRow) break;
    pts.push({ x: d.x, y: d.y });
  }
  return pts;
}

export const OUTCOME = { CAUGHT: 'caught', SPILLED: 'spilled' };

export class Sim {
  constructor({ seed = 1, stage = 1, material = 'water', volume = SOURCE.VOLUME } = {}) {
    this.seed = seed >>> 0;
    this.stage = stage;
    this.material = MATERIALS[material] || MATERIALS.water;
    this.rand = makeRng((this.seed ^ (stage * 0x85ebca6b)) >>> 0);

    this.vessel = generateVessel(this.seed, stage);
    // Vessel sits centred on the table; its mouth row is `height` above it.
    this.col0 = (WORLD_COLS >> 1) - (GRID.W >> 1);
    this.mouthRow = TABLE_ROW - this.vessel.height;

    this.grid = new Uint8Array(GRID.W * GRID.H);
    this.drops = [];

    this.angle = SPOUT.ANGLE_DEFAULT;
    this.pressure = SPOUT.PRESSURE_DEFAULT;
    this.corked = true;

    this.startVolume = volume; // what the source held at stage start
    this.remaining = volume;   // droplets still in the source
    this.caught = 0;           // settled inside the vessel
    this.spilled = 0;          // lost to the abyss or over the rim
    this.ticks = 0;
    this.emitPhase = 0;
  }

  // ── controls ────────────────────────────────────────────────────────
  setAim(angleDeg, pressure) {
    this.angle = Math.max(SPOUT.ANGLE_MIN, Math.min(SPOUT.ANGLE_MAX, Math.round(angleDeg)));
    this.pressure = Math.max(
      SPOUT.PRESSURE_MIN,
      Math.min(SPOUT.PRESSURE_MAX, Math.round(pressure)),
    );
  }

  setCork(open) {
    this.corked = !open;
  }

  get flowing() {
    return !this.corked && this.remaining > 0;
  }

  get done() {
    return this.remaining <= 0 && this.drops.length === 0;
  }

  get fillRatio() {
    return this.caught / this.vessel.capacity;
  }

  // ── one simulation tick ─────────────────────────────────────────────
  tick() {
    this.ticks++;
    this.emit();
    this.stepDrops();
    this.stepCA();
  }

  emit() {
    if (!this.flowing) return;
    for (let i = 0; i < SPOUT.RATE && this.remaining > 0; i++) {
      this.remaining--;
      const { vx, vy } = launchVelocity(this.angle, this.pressure);
      // Spread the stream across the nozzle so it reads as a stream, not a
      // line of identical dots. Integer jitter only.
      const jitter = (this.rand() % (SPOUT.NOZZLE * FP)) - ((SPOUT.NOZZLE * FP) >> 1);
      this.drops.push({ x: SPOUT_COL * FP + jitter, y: SPOUT_ROW * FP, vx, vy });
    }
  }

  stepDrops() {
    const kept = [];
    for (const d of this.drops) {
      const prevRow = d.y / FP | 0;
      stepBallistic(d);
      const col = d.x / FP | 0;
      const row = d.y / FP | 0;

      // Off the sides, or past the table: gone to the abyss.
      if (col < 0 || col >= WORLD_COLS || row > TABLE_ROW + 6) {
        this.spilled++;
        continue;
      }

      // ── the handoff ──────────────────────────────────────────────
      // A droplet is admitted only on the tick it CROSSES the mouth
      // plane, and only if it is within the mouth span at that moment.
      // Testing the crossing rather than "is below the rim" is what stops
      // a fast droplet tunnelling through the rim in a single step.
      if (prevRow < this.mouthRow && row >= this.mouthRow) {
        const gx = col - this.col0;
        if (gx >= this.vessel.mouth.l && gx < this.vessel.mouth.r) {
          this.admit(gx);
          continue;
        }
        // Clipped the rim or the shoulder — lost.
        this.spilled++;
        continue;
      }

      kept.push(d);
    }
    this.drops = kept;
  }

  // Turn an in-flight droplet into a settled cell at the mouth. If the
  // neck is already full, the vessel has overflowed and it is lost.
  admit(gx) {
    const i = gx; // row 0
    if (this.grid[i] !== 0) {
      this.spilled++;
      return;
    }
    this.grid[i] = this.material.id;
    this.caught++;
  }

  // ── the cellular automaton ──────────────────────────────────────────
  // Bottom-up sweep so a falling cell cannot be moved twice in one tick.
  // Gravity is straight down in stage 1; stage 2 rotates this vector.
  stepCA() {
    const { spread, cohesion, flow } = this.material;
    const g = this.grid;
    const v = this.vessel;

    for (let y = v.height - 1; y >= 0; y--) {
      const row = v.rows[y];
      for (let x = row.l; x < row.r; x++) {
        const i = y * GRID.W + x;
        if (g[i] === 0) continue;

        if (cohesion > 0 && this.rand() % 100 < cohesion && this.neighbours(x, y) >= 2) {
          continue;
        }

        // Straight down.
        if (inside(v, x, y + 1) && g[(y + 1) * GRID.W + x] === 0) {
          g[(y + 1) * GRID.W + x] = g[i];
          g[i] = 0;
          continue;
        }

        if (spread === 0 || this.rand() % 100 >= spread) continue;

        // Diagonal, then flat. Direction chosen from the PRNG so a pile
        // does not lean systematically to one side.
        //
        // `flow` is how many cells a grain may travel sideways in ONE tick.
        // It has to exist: a grain that only ever moves one cell per tick
        // spreads at a rate set by the grid resolution, so halving the cell
        // size quartered how fast water levelled and it stopped reading as
        // a liquid at all. Flow rate is a property of the material, not of
        // how finely we happen to have diced the world.
        const dir = this.rand() & 1 ? 1 : -1;
        let moved = false;
        for (const d of [dir, -dir]) {
          let bestX = x;
          for (let k = 1; k <= flow; k++) {
            const nx = x + d * k;
            if (!inside(v, nx, y) || g[y * GRID.W + nx] !== 0) break;
            bestX = nx;
            // A gap below: fall into it immediately rather than sliding on.
            if (inside(v, nx, y + 1) && g[(y + 1) * GRID.W + nx] === 0) {
              g[(y + 1) * GRID.W + nx] = g[i];
              g[i] = 0;
              moved = true;
              break;
            }
          }
          if (moved) break;
          if (bestX !== x) {
            g[y * GRID.W + bestX] = g[i];
            g[i] = 0;
            moved = true;
            break;
          }
        }
      }
    }
  }

  neighbours(x, y) {
    const g = this.grid;
    let n = 0;
    if (x > 0 && g[y * GRID.W + x - 1]) n++;
    if (x < GRID.W - 1 && g[y * GRID.W + x + 1]) n++;
    if (y > 0 && g[(y - 1) * GRID.W + x]) n++;
    if (y < GRID.H - 1 && g[(y + 1) * GRID.W + x]) n++;
    return n;
  }

  // Cheap integer checksum of everything the peers must agree on. Compared
  // across the wire every N ticks so a desync fails loudly and early
  // instead of drifting into teleporting material (DESIGN.md risk 2).
  checksum() {
    let h = 2166136261 >>> 0;
    const mix = (n) => {
      h ^= n & 0xffffffff;
      h = Math.imul(h, 16777619) >>> 0;
    };
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) mix(i * 31 + this.grid[i]);
    for (const d of this.drops) { mix(d.x); mix(d.y); mix(d.vx); mix(d.vy); }
    mix(this.caught); mix(this.spilled); mix(this.remaining);
    return h >>> 0;
  }

  // Column heights, for rendering the surface and for tests.
  surface() {
    const out = new Int16Array(GRID.W).fill(-1);
    for (let x = 0; x < GRID.W; x++) {
      for (let y = 0; y < this.vessel.height; y++) {
        if (this.grid[y * GRID.W + x]) { out[x] = y; break; }
      }
    }
    return out;
  }
}
