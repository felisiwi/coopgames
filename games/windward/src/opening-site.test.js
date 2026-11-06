// node games/windward/src/opening-site.test.js: the house, jetty and Svalan's berth of the opening, and the ferry's moment, on the real Today coast (src/opening-site.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

globalThis.fetch = async (u) => { const b = readFileSync(fileURLToPath(u)); return { text: async () => b.toString('utf8'), json: async () => JSON.parse(b.toString('utf8')), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCoastForYear } = await import('./coast-for-year.js');
const { pickSite, nearestWater, ferryClockFor, frameSite, SITE } = await import('./opening-site.js');
const { createBusyCoast } = await import('./busy-coast.js');
const { vesselPose } = await import('./busy-route.js');
const { profileForYear } = await import('./busy-era.js');

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const io = { json: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(fileURLToPath(u))) };
const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const eras = rd('../data/busy-eras.json'), busyWorld = rd('../data/busy-world.json');
const profile = profileForYear(eras, 2015);
const coast = await loadCoastForYear(2015, { seed: 1, io, summerShare: 1 });
const village = coast.names.find((n) => n.id === 'village:Fiskebäckskil');

await check('nearestWater finds the sea on a made-up slope, and nothing where there is none', () => {
  const slope = (x) => 5 - x; // sea (< -0.3) from x = 5.3 on
  const w = nearestWater((x) => slope(x), 0, 0);
  assert.ok(w.m === 6 && Math.abs(w.dir - Math.PI / 2) < Math.PI / 6, `${w.m} m @ ${w.dir} rad: east-ish, 6 m`); // the scan is 48 directions, so a tie may pick a neighbour of due east
  assert.equal(nearestWater(() => 3, 0, 0).m, Infinity);
});

await check('a house by the water in Fiskebäckskil: 9-26 m from the sea, deep water at the end of the jetty, open water beside it for Svalan', () => {
  const s = pickSite({ houses: coast.summerHouses, village, heightAt: coast.heightAt });
  assert.ok(s, 'a site was found');
  assert.ok(Math.hypot(s.house.x - village.x, s.house.z - village.z) <= SITE.villageRadiusM, 'in the village');
  assert.ok(s.waterM >= SITE.minWaterM && s.waterM <= SITE.maxWaterM);
  assert.ok(coast.heightAt(s.house.x, s.house.z) > 0.3, 'the house is on land');
  assert.ok(coast.heightAt(s.jetty.to.x, s.jetty.to.z) <= SITE.deepLevel, 'deep at the jetty end');
  assert.ok(coast.heightAt(s.boat.x, s.boat.z) <= SITE.deepLevel, 'Svalan lies in the water');
  const len = Math.hypot(s.jetty.to.x - s.jetty.from.x, s.jetty.to.z - s.jetty.from.z);
  assert.ok(len > 8 && len < 32, `jetty ${len.toFixed(1)} m`);
  assert.deepEqual(pickSite({ houses: coast.summerHouses, village, heightAt: coast.heightAt }), s, 'deterministic: the same house every time (the chapter ends back here)');
  assert.equal(pickSite({ houses: [], village, heightAt: coast.heightAt }), null);
  console.log(`   house at (${s.house.x.toFixed(0)}, ${s.house.z.toFixed(0)}), sea ${s.waterM} m away, jetty ${len.toFixed(0)} m`);
});

await check('the jetty runs north-south when a house allows it (a portrait phone shows it in one column), and the framing fits house, jetty end and Svalan on a 390 x 844 screen', () => {
  const s = pickSite({ houses: coast.summerHouses, village, heightAt: coast.heightAt });
  const f = frameSite(s, 390 / 844);
  const across = 67 * (390 / 844) * f.zoom, up = 85 * f.zoom;
  for (const p of [s.house, s.jetty.to, s.boat]) { assert.ok(Math.abs(p.x - f.x) < across / 2, `x ${Math.abs(p.x - f.x).toFixed(1)} within ${(across / 2).toFixed(1)}`); assert.ok(Math.abs(p.z - f.z) < up / 2); }
  assert.ok(f.zoom >= 0.45 && f.zoom <= 2);
  console.log(`   jetty bearing ${(s.dir * 180 / Math.PI).toFixed(0)} deg, zoom ${f.zoom.toFixed(2)}`);
  const all = coast.summerHouses.filter((h) => Math.hypot(h.x - village.x, h.z - village.z) <= SITE.villageRadiusM).map((h) => ({ h, w: nearestWater(coast.heightAt, h.x, h.z) })).filter((o) => o.w.m >= SITE.minWaterM && o.w.m <= SITE.maxWaterM);
  const bestVertical = Math.min(...all.map((o) => Math.abs(Math.sin(o.w.dir))));
  assert.ok(Math.abs(Math.sin(s.dir)) <= bestVertical + 0.35, 'no clearly better vertical candidate was passed over');
});

await check('the ferry can be put coming in past the house: some clock offset brings it within 110 m, moving', () => {
  const s = pickSite({ houses: coast.summerHouses, village, heightAt: coast.heightAt });
  const busy = createBusyCoast({ world: busyWorld, profile, toGame: coast.world.toGame, houses: coast.summerHouses, seaY: () => 0, blocked: () => false, night: true });
  const ferry = busy.vessels.find((v) => v.kind === 'ferry');
  assert.ok(ferry, 'the Today profile has the ferry');
  const base = ferryClockFor(ferry, s.house, { atS: 2.5, withinM: 80 }); // the stage asks for exactly this: in the wide first shot it is already close
  assert.ok(base !== null && base >= 0 && base < ferry.sched.cycleS, `clock offset ${base}`);
  const p = vesselPose(ferry.route, ferry.sched, base + 2.5 + (ferry.phase || 0));
  assert.ok(p.moving && Math.hypot(p.x - s.house.x, p.z - s.house.z) <= 80, 'moving, within 80 m of the house at 2.5 s');
  assert.equal(ferryClockFor(null, s.house), null);
  assert.equal(ferryClockFor(ferry, { x: 1e7, z: 1e7 }), null, 'never that close to a far-away point');
});

console.log(`\n${passed} checks passed`);
