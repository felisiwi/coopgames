// Land collision for the real coast (stage 1a). Pure: it only needs a height function.
//
// The coast height field is positive on land, negative at sea (minus the depth). The boat is
// "blocked" where the field rises above BLOCK_H. The rule is deliberately gentle, per Felix:
// no damage, no bounce. A move into the shore is not refused, it is bent: the part of the
// movement that points into the land is removed, so the boat slides along the shoreline, and
// `contact` (0 grazing .. 1 head-on) tells the caller how much to bleed speed (a head-on
// approach stops softly instead of bouncing).
export const HULL_RADIUS_M = 2.5; // the boat is ~6 m long and ~2 m wide: probe a little over the beam
export const BLOCK_H = -0.9; // field value above which the water is too shallow/solid to enter
export const SHALLOW_FULL_DEPTH_M = 3.0; // deeper than this: no slowdown
export const SHALLOW_MIN_FACTOR = 0.6; // speed multiplier at the shallowest sailable water
export const SHORE_BRAKE = 14; // m/s^2 of extra braking at full head-on contact (more than the 6 m/s^2 the sails add back): a soft stop, no bounce
const PROBES = 8; // 8 ring probes keep the effective hull radius within ~0.2 m of HULL_RADIUS_M at any heading

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Highest field value under the hull: centre plus a ring of probes.
export function hullHeight(heightAt, x, z, r = HULL_RADIUS_M) {
  let h = heightAt(x, z);
  for (let k = 0; k < PROBES; k++) {
    const a = (k / PROBES) * Math.PI * 2;
    h = Math.max(h, heightAt(x + Math.sin(a) * r, z + Math.cos(a) * r));
  }
  return h;
}
export const isBlocked = (heightAt, x, z) => hullHeight(heightAt, x, z) > BLOCK_H;

// Speed multiplier for very shallow water (a little slower, never stuck).
export function shallowFactor(heightAt, x, z) {
  const depth = -heightAt(x, z);
  return SHALLOW_MIN_FACTOR + (1 - SHALLOW_MIN_FACTOR) * smoothstep(-BLOCK_H, SHALLOW_FULL_DEPTH_M, depth);
}

// Moves (x, z) by (dx, dz) without entering land. Returns { x, z, contact }.
export function stepAlongShore(heightAt, x, z, dx, dz) {
  const nx = x + dx;
  const nz = z + dz;
  const here = hullHeight(heightAt, x, z);
  const there = hullHeight(heightAt, nx, nz);
  if (there <= BLOCK_H) return { x: nx, z: nz, contact: 0 };
  // Already inside the blocked band (spawn, a teleport): allow any move that gets shallower, so the boat can leave.
  if (here > BLOCK_H && there <= here) return { x: nx, z: nz, contact: 0 };

  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return { x, z, contact: 0 };
  // Shore normal = direction the field rises (toward land), from the point where we would have been.
  const e = 1.5;
  let gx = heightAt(nx + e, nz) - heightAt(nx - e, nz);
  let gz = heightAt(nx, nz + e) - heightAt(nx, nz - e);
  const gl = Math.hypot(gx, gz);
  if (gl < 1e-6) return { x, z, contact: 1 };
  gx /= gl;
  gz /= gl;
  const into = dx * gx + dz * gz; // movement along the normal (positive = into the land)
  const contact = Math.min(1, Math.max(0, into / len));
  if (into <= 0) return { x, z, contact: 0 }; // moving away from land but still blocked: stay put this step
  const sx = dx - into * gx;
  const sz = dz - into * gz;
  if (hullHeight(heightAt, x + sx, z + sz) <= BLOCK_H || hullHeight(heightAt, x + sx, z + sz) <= here) {
    return { x: x + sx, z: z + sz, contact };
  }
  return { x, z, contact }; // a corner: stop softly
}
