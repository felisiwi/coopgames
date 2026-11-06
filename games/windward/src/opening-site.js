// Where the opening happens (stage 1e, batch 2b): one house by the water in today's Fiskebäckskil, the jetty that runs from it into the sea, where Svalan lies at that
// jetty, and which moment of the ferry's timetable puts it coming in past the house. Pure: no THREE and no DOM (src/opening-stage.js draws it).
// It is Britta's house (the game does not say so yet): the chapter ends back there (batch 3), so the choice is exposed and deterministic.
import { vesselPose } from './busy-route.js';

export const SITE = Object.freeze({
  villageRadiusM: 130, // houses within this of Fiskebäckskil's village point are candidates
  minWaterM: 9,        // the sea is at least this far from the house (room for a front garden and the start of a jetty) ...
  maxWaterM: 26,       // ... and no further (a jetty longer than this is not a jetty)
  seaLevel: -0.3,      // ground below this height is water
  deepLevel: -1.2,     // the jetty ends where it is at least this deep
  jettyWidthM: 1.8,
  deckY: 0.42,         // the deck is a low flat boardwalk this far above the sea (not above the ground: it must not follow the slope of the land)
  shoreInM: 3,         // it starts this far up the shore ...
  endIntoWaterM: 11,    // ... and runs this far past the water's edge
  boatSideM: 2.7,      // Svalan lies this far to the side of the jetty axis (half the jetty + half her beam + a fender), broadside along its outer part
  boatHalfLenM: 4.2,   // Svalan is about 8 m: the water must be deep at her bow and her stern, not just amidships
  verticalWeight: 1.6, // how much a north-south jetty is preferred over a near one (see pickSite)
});

// Distance from (x, z) to the nearest ground below `level` along 48 compass directions, and that direction (radians, 0 = north = +z... heading convention: (sin a, cos a)).
export function nearestWater(heightAt, x, z, { level = SITE.seaLevel, maxM = 40 } = {}) {
  let best = { m: Infinity, dir: 0 };
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
    for (let r = 1; r <= maxM; r += 1) {
      if (heightAt(x + sx * r, z + sz * r) < level) { if (r < best.m) best = { m: r, dir: a }; break; }
    }
  }
  return best;
}

// houses: [{ x, z, y, facing }] (coast.summerHouses with summerShare 1); village: { x, z }. Returns the nearest house to the village that has open sea 9..26 m away in
// one direction and deep water at the end, or null. { house, dir (towards the water), waterM, jetty: { from, to, width }, boat: { x, z, heading } }.
export function pickSite({ houses, village, heightAt, c = SITE }) {
  const cands = houses.map((h) => ({ h, d: Math.hypot(h.x - village.x, h.z - village.z) })).filter((o) => o.d <= c.villageRadiusM).sort((a, b) => a.d - b.d);
  let best = null;
  for (const { h, d } of cands) {
    const w = nearestWater(heightAt, h.x, h.z);
    if (!(w.m >= c.minWaterM && w.m <= c.maxWaterM)) continue;
    const sx = Math.sin(w.dir), sz = Math.cos(w.dir);
    const endM = w.m + c.endIntoWaterM;
    if (heightAt(h.x + sx * endM, h.z + sz * endM) > c.deepLevel) continue; // too shallow at the end of the jetty
    // the sea beside the jetty must be open too (Svalan lies there)
    const px = Math.cos(w.dir), pz = -Math.sin(w.dir);
    const bm = endM - c.boatHalfLenM - 0.3; // her middle: her bow just short of the jetty end, her stern well out in the deep (the water shoals near the shore)
    const deepAt = (side, along) => heightAt(h.x + sx * along + px * c.boatSideM * side, h.z + sz * along + pz * c.boatSideM * side) < c.deepLevel;
    const open = (side) => [bm - c.boatHalfLenM, bm, bm + c.boatHalfLenM].every((a) => deepAt(side, a));
    const side = open(1) ? 1 : open(-1) ? -1 : 0;
    if (!side) continue;
    // The phone is held upright and north is up: a jetty that runs north-south shows house, jetty and boat in one column. East-west would not fit the width. Prefer
    // the former, then the nearer to the village point.
    const score = d / c.villageRadiusM + c.verticalWeight * Math.abs(Math.sin(w.dir));
    if (best && best.score <= score) continue;
    best = {
      score, house: h, dir: w.dir, waterM: w.m,
      jetty: { from: { x: h.x + sx * Math.max(1, w.m - c.shoreInM), z: h.z + sz * Math.max(1, w.m - c.shoreInM) }, to: { x: h.x + sx * endM, z: h.z + sz * endM }, width: c.jettyWidthM, y: c.deckY },
      boat: { x: h.x + sx * bm + px * c.boatSideM * side, z: h.z + sz * bm + pz * c.boatSideM * side, heading: w.dir }, // heading along the jetty: broadside to it
    };
  }
  if (!best) return null;
  const { score, ...site } = best;
  return site;
}

// How far to zoom the opening's camera so house, jetty and Svalan fit a screen `aspect` (width / height) wide, and where to aim: the centre of their box.
// Returns { x, z, zoom }. A zoom of 1 shows about 31 m across a portrait phone (aspect 0.46) and 85 m up it (the fixed camera: distance 125, fov 30, elevation 52).
export function frameSite(site, aspect = 0.46, { margin = 7 } = {}) {
  const pts = [site.house, site.jetty.to, site.boat];
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const spanX = Math.max(...xs) - Math.min(...xs) + 2 * margin, spanZ = Math.max(...zs) - Math.min(...zs) + 2 * margin;
  const acrossAt1 = 67 * aspect, upAt1 = 85; // metres visible at zoom 1 (width, height)
  return { x: (Math.max(...xs) + Math.min(...xs)) / 2, z: (Math.max(...zs) + Math.min(...zs)) / 2, zoom: Math.min(2, Math.max(0.45, spanX / acrossAt1, spanZ / upAt1)) };
}

// The ferry vessel from createBusyCoast ({ route, sched, phase, lag }). Which clock offset (seconds, within one cycle) puts it within `withinM` of `target` at `atS`
// seconds into the opening, moving? Scans the timetable in 2 s steps. null when it never comes that close.
export function ferryClockFor(ferry, target, { atS = 5, withinM = 110, stepS = 2 } = {}) {
  if (!ferry || !ferry.sched) return null;
  let best = null;
  for (let base = 0; base < ferry.sched.cycleS; base += stepS) {
    const p = vesselPose(ferry.route, ferry.sched, base + atS + (ferry.phase || 0));
    const d = Math.hypot(p.x - target.x, p.z - target.z);
    if (p.moving && d <= withinM && (!best || d < best.d)) best = { base, d };
  }
  return best ? best.base : null;
}
