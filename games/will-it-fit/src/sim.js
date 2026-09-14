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
import { FP, STAGE, SPOUT, POUR, PHYS, GRID, SOURCE, MATERIALS, TABLE_Y, VESSEL } from './config.js';
import { generateVessel, inside } from './vessel.js';

const INSIDE_MAX_FALL = PHYS.INSIDE_MAX_FALL;

const WORLD_COLS = Math.floor(STAGE.W / STAGE.CELL);
const WORLD_ROWS = Math.floor(STAGE.H / STAGE.CELL);
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
export function launchFromSpeed(angleDeg, speedFP) {
  return {
    vx: (speedFP * cosDeg(angleDeg)) / FP | 0,
    vy: (speedFP * -sinDeg(angleDeg)) / FP | 0,
  };
}

// Pressure form, kept for tools and tests that want a coarse dial. The
// game itself no longer uses integer pressure — see POUR in config.
export function launchVelocity(angleDeg, pressure) {
  return launchFromSpeed(angleDeg, pressure * SPOUT.SPEED_PER_PRESSURE);
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
export function traceArcFromSpeed(angleDeg, speedFP, steps = 220, stopRow = Infinity) {
  const { vx, vy } = launchFromSpeed(angleDeg, speedFP);
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
  constructor({ seed = 1, stage = 1, material = 'water', volume = null } = {}) {
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

    this.tilt = 0;    // degrees, integer; rotates the world around the grid
    this.offset = 0;  // vessel travel along the plinth, in world cells

    this.angle = SPOUT.ANGLE_FIXED;
    this.corked = true;

    // Sized to this vessel unless the caller overrides it (tests do).
    const vol = volume ?? Math.round(this.vessel.capacity * SOURCE.FILL_RATIO);
    this.startVolume = vol;  // what the source held at stage start
    this.remaining = vol;    // grains still in the source
    this.caught = 0;           // settled inside the vessel
    this.spilled = 0;          // lost to the abyss or over the rim
    this.ticks = 0;
    this.pourTicks = 0;  // how long the pour has been running, for the ramp
    this.emitAcc = 0;    // fixed-point accumulator for fractional flow rate
    this.speedFP = POUR.SPEED_START; // exit speed, throttled by actual flow
  }

  // ── the rotating frame (stage 2) ────────────────────────────────────
  // The grid stays bottle-LOCAL and axis-aligned forever; tilting rotates
  // the world around it. The vessel pivots about the centre of its base,
  // which is where it actually rests on the plinth.
  //
  // Ballistic grains keep obeying WORLD gravity — that is real physics and
  // must not rotate. Only the settled material, which lives in the local
  // grid, sees the rotated gravity vector.
  get pivotCol() {
    return this.col0 + ((this.vessel.minL + this.vessel.maxR) >> 1) + this.offset;
  }

  get pivotRow() {
    return this.mouthRow + this.vessel.height;
  }

  worldToLocal(wxFP, wyFP) {
    const dx = wxFP - this.pivotCol * FP;
    const dy = wyFP - this.pivotRow * FP;
    const c = cosDeg(this.tilt);
    const s = sinDeg(this.tilt);
    // Rotate by -tilt.
    const lx = (dx * c + dy * s) / FP | 0;
    const ly = (-dx * s + dy * c) / FP | 0;
    return {
      x: lx + ((this.vessel.minL + this.vessel.maxR) >> 1) * FP,
      y: ly + this.vessel.height * FP,
    };
  }

  localToWorld(lxFP, lyFP) {
    const dx = lxFP - ((this.vessel.minL + this.vessel.maxR) >> 1) * FP;
    const dy = lyFP - this.vessel.height * FP;
    const c = cosDeg(this.tilt);
    const s = sinDeg(this.tilt);
    return {
      x: ((dx * c - dy * s) / FP | 0) + this.pivotCol * FP,
      y: ((dx * s + dy * c) / FP | 0) + this.pivotRow * FP,
    };
  }

  setVessel(offsetCols, tiltDeg) {
    this.offset = Math.round(offsetCols) | 0;
    this.tilt = Math.max(-VESSEL.MAX_TILT, Math.min(VESSEL.MAX_TILT, Math.round(tiltDeg))) | 0;
  }

  // ── controls ────────────────────────────────────────────────────────
  // Angle only. Exit speed is no longer anybody's choice — it comes from
  // how long the pour has been running (see POUR in config). A pressure
  // argument here would be a control that silently does nothing.
  setAim(angleDeg) {
    this.angle = Math.max(SPOUT.ANGLE_MIN, Math.min(SPOUT.ANGLE_MAX, Math.round(angleDeg)));
  }

  setCork(open) {
    const wasOpen = !this.corked;
    this.corked = !open;
    // Closing resets the ramp, so a tap is a careful splash and a long hold
    // is a torrent. That reset is what makes the cork worth touching.
    if (wasOpen && this.corked) {
      this.pourTicks = 0;
      this.emitAcc = 0;
      this.speedFP = POUR.SPEED_START;
    }
  }

  // 0 at the instant you open it, FP at full flow. Eased quadratically, so
  // it creeps and then runs away from you.
  get rampFP() {
    const t = Math.min(FP, (this.pourTicks * FP / POUR.RAMP_TICKS) | 0);
    return (t * t / FP) | 0;
  }

  // Equivalent coarse pressure, for display and for tests that think in
  // those units. The simulation itself uses speedFP.
  get pourPressure() {
    return Math.max(1, Math.round(this.speedFP / SPOUT.SPEED_PER_PRESSURE));
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
    if (!this.flowing) {
      return;
    }
    this.pourTicks++;

    // Fractional flow rate through a fixed-point accumulator, so a dribble
    // really is one grain every few ticks rather than the minimum of one
    // per tick that an integer rate would force.
    const r = this.rampFP;
    const rateFP = POUR.RATE_START + ((POUR.RATE_MAX - POUR.RATE_START) * r / FP | 0);
    this.emitAcc += rateFP;
    const n = (this.emitAcc / FP) | 0;
    this.emitAcc -= n * FP;

    // Throttle: the stream may only speed up in proportion to the grains
    // actually leaving the spout, so it can never outrun the flow of sand.
    // No grains this tick means no acceleration at all.
    const target = POUR.SPEED_START
      + ((POUR.SPEED_MAX - POUR.SPEED_START) * r / FP | 0);
    this.speedFP = Math.min(target, this.speedFP + n * POUR.SPEED_STEP_PER_GRAIN);

    for (let i = 0; i < n && this.remaining > 0; i++) {
      this.remaining--;
      const { vx, vy } = launchFromSpeed(this.angle, this.speedFP);
      // Spread the stream across the nozzle so it reads as a stream, not a
      // line of identical dots. Integer jitter only.
      const jitter = (this.rand() % (SPOUT.NOZZLE * FP)) - ((SPOUT.NOZZLE * FP) >> 1);
      this.drops.push({ x: SPOUT_COL * FP + jitter, y: SPOUT_ROW * FP, vx, vy, inside: 0, lost: 0 });
    }
  }

  stepDrops() {
    const kept = [];
    for (const d of this.drops) {
      const prevRow = d.y / FP | 0;
      const prevCol = d.x / FP | 0;

      if (d.inside) {
        // Inside the vessel the grain KEEPS its momentum and keeps
        // travelling. Converting it to a cell the instant it crossed the
        // mouth is what made the vessel feel like a wall: the stream
        // arrived beautifully and then stopped dead at the rim. A grain
        // should carry its arc down the neck and only become part of the
        // pile when it actually lands on something.
        //
        // Light drag while inside so it eases into the pile rather than
        // slamming. Integer arithmetic: >> is an arithmetic shift, so this
        // stays exact and identical on both peers.
        d.vx = (d.vx * 7) >> 3;
        stepBallistic(d);
        if (d.vy > INSIDE_MAX_FALL) d.vy = INSIDE_MAX_FALL;

        if (this.resolveInside(d, prevCol, prevRow)) continue; // it settled
        kept.push(d);
        continue;
      }

      // A grain already known to be lost still has to FALL. Deleting it the
      // moment it was doomed is the same mistake the mouth handoff made:
      // it vanished in mid-air instead of dropping away into the abyss.
      // It is counted as spilled when it actually leaves the frame, which
      // also makes the reserve tick down in time with what you can see.
      if (d.lost) {
        stepBallistic(d);
        this.deflectOffVessel(d);
        const lc = d.x / FP | 0;
        const lr = d.y / FP | 0;
        if (lc < -8 || lc > WORLD_COLS + 8 || lr > WORLD_ROWS + 8) {
          this.spilled++;
          continue;
        }
        kept.push(d);
        continue;
      }

      stepBallistic(d);
      const col = d.x / FP | 0;
      const row = d.y / FP | 0;

      // Off the sides entirely.
      if (col < -8 || col > WORLD_COLS + 8) {
        this.spilled++;
        continue;
      }
      // Fell past the whole scene without ever meeting the vessel.
      if (row > WORLD_ROWS + 8) {
        this.spilled++;
        continue;
      }

      // ── the handoff ──────────────────────────────────────────────
      // A grain is admitted only on the tick it CROSSES the mouth plane,
      // and only if it is within the mouth span at that moment. Testing
      // the crossing rather than "is below the rim" is what stops a fast
      // grain tunnelling through the rim in a single step.
      //
      // Admission no longer means landing — it flips `inside` and the
      // grain flies on. That is the whole difference between a stream
      // pouring into a vessel and a stream hitting a wall.
      // Crossing the rim plane, measured in the vessel's OWN frame so a
      // tilted mouth is a tilted opening rather than a horizontal line.
      const Lnow = this.worldToLocal(d.x, d.y);
      const Lprev = this.worldToLocal(prevCol * FP + (FP >> 1), prevRow * FP + (FP >> 1));
      if (Lprev.y < 0 && Lnow.y >= 0) {
        const gx = Lnow.x / FP | 0;
        if (gx >= this.vessel.mouth.l && gx < this.vessel.mouth.r) {
          d.inside = 1;
          kept.push(d);
          continue;
        }
        // Missed the mouth. It is lost, but nothing happens to it here: at
        // the mouth row the vessel is only as wide as its mouth, so a grain
        // just outside the rim is still in open air. The body flares out
        // BELOW this line, so the grain keeps its velocity and falls on
        // until it actually meets the shoulder — deflectOffVessel handles
        // that collision where it really happens. Nudging it aside here
        // instead was pushing grains clear of the very wall they should
        // have bounced off.
        d.lost = 1;
        kept.push(d);
        continue;
      }

      kept.push(d);
    }
    this.drops = kept;
  }

  // Bounce a missed grain off the OUTSIDE of the vessel. Without this a
  // grain that misses the mouth sails straight through the drawn bottle,
  // which looks like the vessel is not there at all. Every grain below the
  // mouth row has already been classified as inside or lost, so anything
  // lost that finds itself within the vessel silhouette has just clipped a
  // wall from outside — push it back out the nearer side and let it glance
  // away down the flank.
  deflectOffVessel(d) {
    const v = this.vessel;
    const L = this.worldToLocal(d.x, d.y);
    const gx = L.x / FP | 0;
    const gy = L.y / FP | 0;
    if (gy < 0 || gy >= v.height) return;
    if (!inside(v, gx, gy)) return;

    const row = v.rows[gy];
    const outward = gx < ((row.l + row.r) >> 1) ? -1 : 1;
    const edge = outward < 0 ? row.l - 1 : row.r;
    // Push back out along the vessel's own axis, then return to world.
    const w = this.localToWorld(edge * FP + (FP >> 1), L.y);
    d.x = w.x;
    d.y = w.y;
    // Glance off rather than stop dead: keep half the sideways speed in the
    // outward direction, plus a nudge so it always clears the wall, and
    // shed a quarter of the fall to the scrape.
    d.vx = outward * ((Math.abs(d.vx) >> 1) + (FP >> 3));
    d.vy = (d.vy * 3) >> 2;
  }

  // Move a grain that is inside the vessel, bouncing it off walls and
  // settling it when it meets the floor or the pile. Returns true if the
  // grain stopped being a grain this tick (settled or spilled).
  resolveInside(d, prevCol, prevRow) {
    const v = this.vessel;
    const L = this.worldToLocal(d.x, d.y);
    const P = this.worldToLocal(prevCol * FP + (FP >> 1), prevRow * FP + (FP >> 1));
    let gx = L.x / FP | 0;
    let gy = L.y / FP | 0;
    const pgx = P.x / FP | 0;
    const pgy = P.y / FP | 0;

    // Below the base: settle on the floor.
    if (gy >= v.height) {
      this.settleAt(gx, v.height - 1, pgx);
      return true;
    }
    if (gy < 0) return false; // still in the mouth plane, keep flying

    // Into a wall: slide down it, losing most of the sideways motion.
    // Grains should run down the inside of a narrowing neck, not stop.
    if (!inside(v, gx, gy)) {
      const row = v.rows[gy];
      const clamped = Math.max(row.l, Math.min(row.r - 1, gx));
      const w = this.localToWorld(clamped * FP + (FP >> 1), L.y);
      d.x = w.x;
      d.y = w.y;
      d.vx = -(d.vx >> 2);
      gx = clamped;
      if (!inside(v, gx, gy)) { this.settleAt(pgx, pgy, pgx); return true; }
    }

    // Into the pile: stop just above whatever it hit.
    if (this.grid[gy * GRID.W + gx] !== 0) {
      this.settleAt(gx, gy - 1, pgx);
      return true;
    }
    return false;
  }

  // Place a settled grain, climbing out of any occupied cell. A grain with
  // nowhere left to go has overflowed the vessel and is lost.
  settleAt(gx, gy, fallbackX) {
    const v = this.vessel;
    let x = gx;
    let y = gy;
    if (y >= v.height) y = v.height - 1;
    if (!inside(v, x, y)) x = fallbackX;

    while (y >= 0 && (!inside(v, x, y) || this.grid[y * GRID.W + x] !== 0)) y--;

    if (y < 0 || !inside(v, x, y)) {
      this.spilled++;
      return;
    }
    this.grid[y * GRID.W + x] = this.material.id;
    this.caught++;
  }

  // ── the cellular automaton ──────────────────────────────────────────
  // Bottom-up sweep so a falling cell cannot be moved twice in one tick.
  // Gravity is straight down in stage 1; stage 2 rotates this vector.
  stepCA() {
    const { spread, cohesion, flow } = this.material;
    const g = this.grid;
    const v = this.vessel;

    // Rotated gravity. World down is (0,1); rotated into the bottle's own
    // frame it becomes (sin tilt, cos tilt). Rather than quantising that to
    // one of eight compass directions — which makes material visibly snap
    // between angles — each cell samples it stochastically from the seeded
    // PRNG, so a 20° tilt really does drift sideways one step in five.
    // Integer throughout, so both peers sample identically.
    const gvx = sinDeg(this.tilt);
    const gvy = cosDeg(this.tilt);

    for (let y = v.height - 1; y >= 0; y--) {
      const row = v.rows[y];
      for (let x = row.l; x < row.r; x++) {
        const i = y * GRID.W + x;
        if (g[i] === 0) continue;

        if (cohesion > 0 && this.rand() % 100 < cohesion && this.neighbours(x, y) >= 2) {
          continue;
        }

        const sx = (this.rand() % FP) < Math.abs(gvx) ? (gvx < 0 ? -1 : 1) : 0;
        const sy = (this.rand() % FP) < Math.abs(gvy) ? (gvy < 0 ? -1 : 1) : 0;

        // Along gravity, then its two components separately — and, past 45°
        // of tilt, the CLIMB: a step to (sx, -1). That looks like moving up
        // the grid but under a steeply rotated gravity it is downhill, and
        // it is the only way liquid can reach a rim that leaning has
        // dropped below the surface. Without it a partly-filled vessel can
        // never pour, whatever the angle.
        const climbs = Math.abs(gvx) > Math.abs(gvy);
        const order = climbs
          ? [[sx, sy], [sx, 0], [sx, -1], [0, sy]]
          : [[sx, sy], [0, sy], [sx, 0]];
        let moved = false;
        for (const [dx, dy] of order) {
          if (dx === 0 && dy === 0) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (this.escapes(x, y, tx, ty)) { moved = true; break; }
          if (inside(v, tx, ty) && g[ty * GRID.W + tx] === 0) {
            g[ty * GRID.W + tx] = g[i];
            g[i] = 0;
            moved = true;
            break;
          }
        }
        if (moved) continue;

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
        let slid = false;
        for (const d of [dir, -dir]) {
          let bestX = x;
          for (let k = 1; k <= flow; k++) {
            const nx = x + d * k;
            // NO escape check here. Levelling is not pouring: a liquid
            // finding its own level slides sideways in both directions, and
            // letting that spill meant water at the rim leaked out at ANY
            // tilt including zero — the rim row could never hold anything.
            // Material leaves only when GRAVITY carries it over the lip,
            // which is the gravity-driven branch above.
            if (!inside(v, nx, y) || g[y * GRID.W + nx] !== 0) break;
            bestX = nx;
            // A gap along gravity: fall into it rather than sliding on.
            if (inside(v, nx, y + sy) && g[(y + sy) * GRID.W + nx] === 0 && sy !== 0) {
              g[(y + sy) * GRID.W + nx] = g[i];
              g[i] = 0;
              slid = true;
              break;
            }
          }
          if (slid) break;
          if (bestX !== x) {
            g[y * GRID.W + bestX] = g[i];
            g[i] = 0;
            slid = true;
            break;
          }
        }
      }
    }
  }

  // Pouring out. A cell sitting AT the rim (local row 0) that gravity drags
  // past the lip leaves the vessel — that is what tipping a full bottle
  // does, and it is why fullness is the thing that makes tilt dangerous:
  // only material that has reached the rim can escape, so an empty vessel
  // can be waved about freely and a brimming one cannot.
  //
  // It becomes a falling grain in WORLD space rather than being deleted.
  // Deleting it would be the same decide-and-delete mistake that made the
  // mouth feel like a wall and made misses vanish in mid-air.
  escapes(x, y, tx, ty) {
    if (y !== 0) return false;
    const rim = this.vessel.rows[0];
    if (tx >= rim.l && tx < rim.r && ty >= 0) return false;

    const i = y * GRID.W + x;
    const id = this.grid[i];
    if (!id) return false;
    this.grid[i] = 0;
    this.caught--;

    const w = this.localToWorld(tx * FP + (FP >> 1), ty * FP + (FP >> 1));
    const outward = tx < rim.l ? -1 : 1;
    this.drops.push({
      x: w.x,
      y: w.y,
      vx: outward * (FP >> 2),
      vy: FP >> 3,
      inside: 0,
      lost: 1,
    });
    return true;
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
    for (const d of this.drops) { mix(d.x); mix(d.y); mix(d.vx); mix(d.vy); mix(d.inside); mix(d.lost); }
    mix(this.pourTicks); mix(this.emitAcc); mix(this.speedFP); mix(this.tilt); mix(this.offset);
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
