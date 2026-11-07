// The wind at a place and a moment: windAt(x, z, gameTimeS). Pure, no THREE, no clock inside: the same inputs
// give the same output on any phone (docs/ALIVE-SEA.md decisions 2, 7, 10, 11, 16).
//
// Layers, in the order they are applied (each can be switched off from the lab panel via field.layers):
//   1. the day's wind        weather.js: steady, slowly veering, strength follows the day's rhythm
//   2. shifts                direction +-10..20 degrees every 1 to 2 minutes: lifts and headers (they roll through at SHIFT_TRAVEL_MS)
//   3. gusts and lulls       patches in the air that drift downwind: gusts +30..50%, lulls ~-40%, 30..60 s life
//   4. island shadow         smooth calm in the lee of land (from heightAt upwind)
//   5. funnelling            stronger wind through a narrow sound that runs along the wind
//   6. utomskars boost       open water (long fetch upwind) is stronger AND steadier (smaller gusts and shifts)
//   7. squall                squall.js: a line that sweeps through on unsettled days
//   8. story override        setOverride()/clearOverride(): scripted wind that always hands back smoothly
//
// Layers 4 to 6 need the shape of the coast. The caller passes heightAt(x, z) (metres above sea; > ~0.7 is land)
// and the world's bounds. The expensive part is cached per 5 degrees of wind direction on a coarse grid and blended
// between the two nearest directions, so a wind turning slowly moves the lees smoothly (no popping).
//
// Conventions: dir is the game's wind direction in radians, the direction the wind comes FROM (x = sin, z = cos,
// north = -z; see weather.js). strength is 0..1 (sail.js boatSpeed). Time is gameTimeS (seconds since midnight of the
// game day; weather.js). All numbers below are tunable from the lab panel; after changing a GEOMETRY number
// (marked) call field.clearCaches().
import { weatherAt, windMs, lerpDir, WEATHER } from './weather.js';
import { squallPlanFor, squallAt, makeSquall } from './squall.js';
import { hash01, noise1s, clamp, smoothstep, lerp } from './weather-noise.js';

const DEG = Math.PI / 180;

export const WIND_FIELD = {
  STRENGTH_MAX: 1.25, // strength never exceeds this (a gust on a fresh day can exceed 1: a bit faster than "full")

  // --- shifts ---
  SHIFT_SLOW_PERIOD_S: 100, // a big lift or header every ~1.7 minutes ...
  SHIFT_SLOW_DEG: 14, // ... up to this size
  SHIFT_FAST_PERIOD_S: 55, // plus a smaller, quicker one ...
  SHIFT_FAST_DEG: 6, // ... up to this size
  SHIFT_MAX_DEG: 20, // hard cap, whatever the day's gustiness
  SHIFT_TRAVEL_MS: 8, // m/s a shift rolls through the area (so a header reaches you a moment after your neighbour)

  // --- gusts and lulls: patches that live in the air and drift with it ---
  GUST_CELL_M: 80, // patches are placed on a lattice this big (travelling with the air). With the radii/chance/stretch below: ~28% of the sea in a visible patch, and a phone-sized window has one in view >50% of the time
  GUST_SLOT_S: 60, // each lattice cell may host one patch per slot of this length
  GUST_CHANCE: 0.85, // chance a cell hosts a patch in a slot
  GUST_SHARE: 0.6, // of the patches, this share are gusts, the rest lulls
  GUST_MIN: 0.30, // gust strength gain, low end (+30%) ...
  GUST_MAX: 0.50, // ... high end (+50%)
  LULL: -0.40, // lull: -40% ...
  LULL_JITTER: 0.05, // ... +-5%
  GUST_LIFE_MIN_S: 30, // a patch lives 30 to 60 s (fades in and out like sin^2)
  GUST_LIFE_MAX_S: 60,
  GUST_RADIUS_MIN_M: 30, // size of a patch (full strength across the inner GUST_PLATEAU of it, then fading to the edge)
  GUST_RADIUS_MAX_M: 55,
  GUST_PLATEAU: 0.4,
  GUST_STRETCH: 1.6, // patches are this many times longer along the wind than across it (streaks, not polka-dots)
  GUST_DRIFT_FRACTION: 0.4, // patches drift downwind at this fraction of the wind's speed (real gusts move ~1.0; slower here so you SEE them coming on a small screen)
  GUST_SUM_MIN: -0.45, // overlapping patches never take more than this off ...
  GUST_SUM_MAX: 0.55, // ... or add more than this

  // --- island shadow (GEOMETRY numbers) ---
  LAND_H: 0.7, // above this height (m) is land
  SHADOW_RANGE_M: 360, // looks this far upwind
  SHADOW_STEP_M: 12,
  SHADOW_M_PER_M: 14, // a hill H metres high shades 14 x H metres downwind (12 m -> 168 m)
  SHADOW_REF_H: 8, // heights at or above this shade fully; lower land (skerries) shades less ...
  SHADOW_MIN_OCC: 0.3, // ... but never less than this
  SHADOW_SPREAD_DEG: 12, // extra rays this far either side, so the edge of a lee is soft
  SHADOW_MAX: 0.8, // the deepest calm in a lee: wind down by this fraction (not geometry)

  // --- funnelling (GEOMETRY numbers) ---
  FUNNEL_MAX_W_M: 180, // land on both sides across the wind closer than this counts as a sound
  FUNNEL_STEP_M: 10,
  FUNNEL_BOOST: 0.35, // +35% in the tightest sound (not geometry)

  // --- utomskars: open water outside the skerries (GEOMETRY numbers) ---
  FETCH_MAX_M: 1500, // open water upwind is measured up to this
  FETCH_STEP_M: 24,
  FETCH_MIN_M: 300, // fetch at or below this = sheltered (exposure 0) ...
  FETCH_FULL_M: 1200, // ... at or above this = fully open (exposure 1)
  OPEN_BOOST: 0.25, // fully open water: wind +25% (not geometry)
  OPEN_STEADY: 0.5, // fully open water: gusts and shifts half the size (not geometry)

  // --- the cache ---
  GRID_M: 32, // coarse grid spacing for the coast-dependent layers
  BUCKET_DEG: 5, // one grid per this many degrees of wind direction
};

// ---- the cached coast grid ---------------------------------------------------------------------------------------
// For each wind-direction bucket, three numbers per grid node: occlusion (0..1, how much land shades it from upwind),
// funnel (0..1, how narrow a sound along the wind), exposure (0..1, how open the water is upwind).
function createCoastGrid(heightAt, bounds) {
  const { minX, minZ, maxX, maxZ } = bounds;
  const cell = WIND_FIELD.GRID_M;
  const nx = Math.max(2, Math.ceil((maxX - minX) / cell) + 1);
  const nz = Math.max(2, Math.ceil((maxZ - minZ) / cell) + 1);
  const buckets = new Map();
  const nBuckets = Math.round(360 / WIND_FIELD.BUCKET_DEG);
  // outside the world there is only open sea
  const H = (x, z) => (x < minX || x > maxX || z < minZ || z > maxZ ? -5 : heightAt(x, z));

  function nodeValues(x, z, d, out, o) {
    const F = WIND_FIELD;
    if (H(x, z) > F.LAND_H) { out[o] = 1; out[o + 1] = 0; out[o + 2] = 0; return; } // on land: fully shaded, no funnel, no exposure

    // shadow: rays upwind (toward where the wind comes from); land of height h shades up to SHADOW_M_PER_M x h downwind of itself
    let occ = 0;
    const spread = F.SHADOW_SPREAD_DEG * DEG;
    const rays = [[0, 0.5], [spread, 0.25], [-spread, 0.25]];
    for (const [off, weight] of rays) {
      const ux = Math.sin(d + off);
      const uz = Math.cos(d + off);
      let best = 0;
      for (let dist = F.SHADOW_STEP_M; dist <= F.SHADOW_RANGE_M; dist += F.SHADOW_STEP_M) {
        const h = H(x + ux * dist, z + uz * dist);
        if (h <= F.LAND_H) continue;
        const reach = Math.min(F.SHADOW_RANGE_M, F.SHADOW_M_PER_M * h);
        if (dist >= reach) continue;
        const o2 = clamp(h / F.SHADOW_REF_H, F.SHADOW_MIN_OCC, 1) * (1 - dist / reach);
        if (o2 > best) best = o2;
      }
      occ += best * weight;
    }

    // funnel: land close on BOTH sides across the wind = a sound running along the wind
    const px = Math.cos(d);
    const pz = -Math.sin(d);
    const side = (sx) => {
      for (let dist = F.FUNNEL_STEP_M; dist <= F.FUNNEL_MAX_W_M; dist += F.FUNNEL_STEP_M) if (H(x + px * sx * dist, z + pz * sx * dist) > F.LAND_H) return dist;
      return Infinity;
    };
    const left = side(1);
    const right = left === Infinity ? Infinity : side(-1);
    const funnel = right === Infinity ? 0 : smoothstep(0, 1, 1 - (left + right) / F.FUNNEL_MAX_W_M);

    // exposure: how far the water runs open upwind (3 rays, so it is smooth)
    let fetch = 0;
    for (const off of [0, 8 * DEG, -8 * DEG]) {
      const ux = Math.sin(d + off);
      const uz = Math.cos(d + off);
      let hit = F.FETCH_MAX_M;
      for (let dist = F.FETCH_STEP_M; dist <= F.FETCH_MAX_M; dist += F.FETCH_STEP_M) if (H(x + ux * dist, z + uz * dist) > F.LAND_H) { hit = dist; break; }
      fetch += hit / 3;
    }
    out[o] = occ;
    out[o + 1] = funnel;
    out[o + 2] = smoothstep(F.FETCH_MIN_M, F.FETCH_FULL_M, fetch);
  }

  function bucket(b) {
    let g = buckets.get(b);
    if (g) return g;
    g = new Float32Array(nx * nz * 3);
    const d = b * WIND_FIELD.BUCKET_DEG * DEG;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) nodeValues(minX + i * cell, minZ + j * cell, d, g, (j * nx + i) * 3);
    buckets.set(b, g);
    return g;
  }

  // out = [occ, funnel, exposure] at (x, z) for wind-from direction dirRad, blended between the two nearest buckets.
  function sample(x, z, dirRad, out) {
    const step = WIND_FIELD.BUCKET_DEG * DEG;
    let f = (dirRad % (2 * Math.PI)) / step;
    if (f < 0) f += nBuckets;
    const b0 = Math.floor(f) % nBuckets;
    const t = f - Math.floor(f);
    const a = bucket(b0);
    const c = t > 1e-4 ? bucket((b0 + 1) % nBuckets) : a;
    const gx = clamp((x - minX) / cell, 0, nx - 1.0001);
    const gz = clamp((z - minZ) / cell, 0, nz - 1.0001);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    for (let k = 0; k < 3; k++) {
      const at = (g) => {
        const r0 = g[(j * nx + i) * 3 + k] * (1 - fx) + g[(j * nx + i + 1) * 3 + k] * fx;
        const r1 = g[((j + 1) * nx + i) * 3 + k] * (1 - fx) + g[((j + 1) * nx + i + 1) * 3 + k] * fx;
        return r0 * (1 - fz) + r1 * fz;
      };
      out[k] = at(a) * (1 - t) + (t > 1e-4 ? at(c) * t : 0);
    }
    return out;
  }

  return { sample, bucket, clear: () => buckets.clear(), size: () => buckets.size, nodes: nx * nz };
}

// ---- the wind field ----------------------------------------------------------------------------------------------
// opts: { daySeed, dayType (default: the seed's own), heightAt(x, z), bounds {minX, minZ, maxX, maxZ},
//         center {x, z} (where squalls cross; default the middle of bounds) }.
// Without heightAt the coast-dependent layers do nothing (open sea everywhere).
export function createWindField(opts) {
  const { daySeed } = opts;
  const bounds = opts.bounds ?? { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 };
  const center = opts.center ?? { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
  const dayType = opts.dayType ?? weatherAt(daySeed, 0).type;
  const grid = opts.heightAt ? createCoastGrid(opts.heightAt, bounds) : null;
  const plan = squallPlanFor(daySeed, dayType, center);
  const layers = { shifts: true, gusts: true, shadows: true, funnel: true, boost: true, squalls: true };

  // the day's wind at a time, cached for the last time asked (a texture refresh asks thousands of places at one time)
  let baseT = NaN;
  let baseW = null;
  const base = (t) => {
    if (t !== baseT) { baseW = weatherAt(daySeed, t, dayType); baseT = t; }
    return baseW;
  };

  // -- the air's drift: where a patch that was at the origin at time 0 is now. Integrated over the day once
  // (the weather repeats each day, so a later day is the same table plus whole-day offsets).
  let drift = null;
  function driftTable() {
    const frac = WIND_FIELD.GUST_DRIFT_FRACTION;
    if (drift && drift.frac === frac) return drift;
    const STEP = 2;
    const n = Math.ceil(WEATHER.GAME_DAY_S / STEP);
    const xs = new Float64Array(n + 1);
    const zs = new Float64Array(n + 1);
    let px = 0;
    let pz = 0;
    let vx0 = 0;
    let vz0 = 0;
    for (let k = 0; k <= n; k++) {
      const w = weatherAt(daySeed, k * STEP, dayType);
      const sp = frac * windMs(w.strength);
      const vx = -Math.sin(w.dir) * sp; // downwind
      const vz = -Math.cos(w.dir) * sp;
      if (k > 0) { px += ((vx + vx0) / 2) * STEP; pz += ((vz + vz0) / 2) * STEP; }
      xs[k] = px; zs[k] = pz; vx0 = vx; vz0 = vz;
    }
    drift = { frac, STEP, n, xs, zs, day: WEATHER.GAME_DAY_S };
    return drift;
  }
  function driftAt(t, out = { x: 0, z: 0 }) {
    const D = driftTable();
    const days = Math.floor(t / D.day);
    const tt = t - days * D.day;
    const f = clamp(tt / D.STEP, 0, D.n);
    const i = Math.min(D.n - 1, Math.floor(f));
    const u = f - i;
    out.x = D.xs[i] * (1 - u) + D.xs[i + 1] * u + days * D.xs[D.n];
    out.z = D.zs[i] * (1 - u) + D.zs[i + 1] * u + days * D.zs[D.n];
    return out;
  }

  // -- gusts and lulls: a lattice in the air's own frame; each cell may host one patch per slot
  const _drift = { x: 0, z: 0 };
  function gustAt(x, z, t) {
    const F = WIND_FIELD;
    driftAt(t, _drift);
    const qx = x - _drift.x;
    const qz = z - _drift.z;
    const i0 = Math.floor(qx / F.GUST_CELL_M);
    const j0 = Math.floor(qz / F.GUST_CELL_M);
    const slot = Math.floor(t / F.GUST_SLOT_S);
    const dw = base(t).dir;
    const ax = -Math.sin(dw); // downwind: the long axis of a patch
    const az = -Math.cos(dw);
    const reach = Math.ceil((F.GUST_RADIUS_MAX_M * Math.max(1, F.GUST_STRETCH)) / F.GUST_CELL_M); // how many cells away a patch can still touch us
    let sum = 0;
    for (let di = -reach; di <= reach; di++) {
      for (let dj = -reach; dj <= reach; dj++) {
        const i = i0 + di;
        const j = j0 + dj;
        const key = slot * 8;
        if (hash01(daySeed, i, j, key) >= F.GUST_CHANCE) continue;
        const life = lerp(F.GUST_LIFE_MIN_S, F.GUST_LIFE_MAX_S, hash01(daySeed, i, j, key + 2));
        const born = slot * F.GUST_SLOT_S + hash01(daySeed, i, j, key + 1) * (F.GUST_SLOT_S - life);
        const age = t - born;
        if (age < 0 || age > life) continue;
        const cx = (i + hash01(daySeed, i, j, key + 3)) * F.GUST_CELL_M;
        const cz = (j + hash01(daySeed, i, j, key + 4)) * F.GUST_CELL_M;
        const r = lerp(F.GUST_RADIUS_MIN_M, F.GUST_RADIUS_MAX_M, hash01(daySeed, i, j, key + 5));
        const ddx = qx - cx;
        const ddz = qz - cz;
        const along = (ddx * ax + ddz * az) / (r * F.GUST_STRETCH);
        const across = (-ddx * az + ddz * ax) / r;
        const d2 = along * along + across * across;
        if (d2 >= 1) continue;
        const pick = hash01(daySeed, i, j, key + 6);
        const amp = pick < F.GUST_SHARE
          ? lerp(F.GUST_MIN, F.GUST_MAX, hash01(daySeed, i, j, key + 7))
          : F.LULL + (hash01(daySeed, i, j, key + 7) - 0.5) * 2 * F.LULL_JITTER;
        const env = Math.sin((Math.PI * age) / life) ** 2;
        sum += amp * env * (1 - smoothstep(F.GUST_PLATEAU, 1, Math.sqrt(d2)));
      }
    }
    return sum;
  }

  // -- shifts: a slow and a quick wobble in direction, rolling downwind through the area
  function shiftAt(x, z, t, gustiness) {
    const F = WIND_FIELD;
    const w = base(t);
    const along = -x * Math.sin(w.dir) - z * Math.cos(w.dir);
    const tt = t - along / F.SHIFT_TRAVEL_MS;
    const raw = (noise1s(daySeed + 21, tt / F.SHIFT_SLOW_PERIOD_S) * F.SHIFT_SLOW_DEG + noise1s(daySeed + 22, tt / F.SHIFT_FAST_PERIOD_S) * F.SHIFT_FAST_DEG) * Math.sqrt(gustiness);
    return clamp(raw, -F.SHIFT_MAX_DEG, F.SHIFT_MAX_DEG) * DEG;
  }

  // -- story override: a scripted wind that blends in, and blends out when cleared. Events are replayed in order,
  // so the result is a pure function of the time asked. Replacing one override with another cross-fades.
  const events = [];
  const evalRamp = (r, t) => {
    const u = r.blend <= 0 ? 1 : smoothstep(0, r.blend, t - r.t0);
    const w = lerp(r.wFrom, r.to, u);
    let tgt;
    if (r.tgtTo) tgt = r.tgtFrom && r.wFrom > 0 ? { dir: lerpDir(r.tgtFrom.dir, r.tgtTo.dir, u), strength: lerp(r.tgtFrom.strength, r.tgtTo.strength, u) } : r.tgtTo;
    else tgt = r.tgtFrom;
    return { w, tgt };
  };
  function overrideAt(t) {
    let ramp = null;
    for (const e of events) {
      if (e.t0 > t) break;
      const now = ramp ? evalRamp(ramp, e.t0) : { w: 0, tgt: null };
      ramp = { t0: e.t0, blend: e.blend, wFrom: now.w, tgtFrom: now.tgt, to: e.target ? 1 : 0, tgtTo: e.target };
    }
    return ramp ? evalRamp(ramp, t) : null;
  }
  const addEvent = (e) => { events.push(e); events.sort((a, b) => a.t0 - b.t0); };

  const _g = [0, 0, 0];
  function windAt(x, z, t, out = {}) {
    const F = WIND_FIELD;
    const w = base(t);
    const shiftRaw = layers.shifts ? shiftAt(x, z, t, w.gustiness) : 0;

    let occ = 0;
    let funnelF = 0;
    let exposure = 0;
    if (grid) { grid.sample(x, z, w.dir + shiftRaw, _g); occ = _g[0]; funnelF = _g[1]; exposure = _g[2]; }
    const open = layers.boost ? exposure : 0;
    const steady = 1 - F.OPEN_STEADY * open; // open water is steadier

    const gust = layers.gusts ? clamp(gustAt(x, z, t) * w.gustiness, F.GUST_SUM_MIN, F.GUST_SUM_MAX) * steady : 0; // cap the overlaps first, then calm them in open water
    const shadow = layers.shadows ? 1 - F.SHADOW_MAX * occ : 1;
    const funnel = layers.funnel ? 1 + F.FUNNEL_BOOST * funnelF : 1;
    const boost = 1 + F.OPEN_BOOST * open;

    let dir = w.dir + shiftRaw * steady;
    let strength = w.strength * shadow * funnel * boost * (1 + gust);

    let sq = null;
    if (layers.squalls && plan.length) {
      sq = squallAt(plan, x, z, t);
      strength *= sq.strengthMul;
      dir += sq.swingRad;
    }

    const ov = events.length ? overrideAt(t) : null;
    if (ov && ov.w > 1e-4 && ov.tgt) {
      dir = lerpDir(dir, ov.tgt.dir, ov.w);
      strength = lerp(strength, ov.tgt.strength, ov.w);
    }

    strength = clamp(strength, 0, F.STRENGTH_MAX);
    out.dir = dir;
    out.strength = strength;
    out.baseStrength = w.strength; // the day's wind alone
    out.baseDir = w.dir;
    out.rel = strength / Math.max(0.05, w.strength); // vs the day's wind alone
    out.local = strength / Math.max(0.05, w.strength * boost); // vs the calm-air wind of THIS water (open sea's steady boost removed): > 1 gust or squall, < 1 lull or lee. What the sea paints
    out.gust = gust;
    out.shadow = shadow;
    out.funnel = funnel;
    out.exposure = exposure; // 0 = inside the skerries, 1 = utomskars
    out.squall = sq ? sq.intensity : 0;
    out.stormBand = sq ? sq.band : 0; // how dark the water is (the squall's dark line, then its body)
    out.override = ov ? ov.w : 0;
    return out;
  }

  return {
    daySeed, dayType, bounds, center, layers, squallPlan: plan,
    windAt,
    base,
    drift: driftAt, // where the air has carried a patch from the origin by time t (game metres)
    gustAt, // gust/lull gain alone, for tests and visuals
    shiftAt: (x, z, t) => shiftAt(x, z, t, base(t).gustiness),
    // Story hook: wind = a blend of the natural wind and `target` ({ dir (game radians, FROM), strength }); weight eases
    // 0 -> 1 over blendS seconds starting at game time t. clearOverride eases back to the natural wind over blendS.
    setOverride: (target, blendS, t) => addEvent({ t0: t, blend: Math.max(0, blendS), target: { dir: target.dir, strength: target.strength } }),
    clearOverride: (blendS, t) => addEvent({ t0: t, blend: Math.max(0, blendS), target: null }),
    overrideWeight: (t) => (events.length ? overrideAt(t)?.w ?? 0 : 0),
    // The lab's "squall now" button: a squall whose line crosses `at` at game time tArrive.
    addSquall: (tArrive, at = center) => { const e = makeSquall(daySeed, plan.length + 100, tArrive, at, base(tArrive).dirDeg); plan.push(e); plan.sort((a, b) => a.tArrive - b.tArrive); return e; },
    // build the coast grid for a wind direction (game radians) ahead of time, so the first sailing there does not hitch
    prewarm: (dirRad) => {
      if (!grid) return;
      const n = Math.round(360 / WIND_FIELD.BUCKET_DEG);
      const f = ((((dirRad / DEG) % 360) + 360) % 360) / WIND_FIELD.BUCKET_DEG;
      grid.bucket(Math.floor(f) % n);
      grid.bucket((Math.floor(f) + 1) % n);
    },
    clearCaches: () => { grid?.clear(); drift = null; },
    cachedBuckets: () => grid?.size() ?? 0,
  };
}
