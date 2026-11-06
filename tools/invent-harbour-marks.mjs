// Generates the invented harbour-mouth gates (red port + green starboard spar buoys, IALA A) for harbours that have no
// real navigational mark nearby, and writes them into games/windward/assets/coast/seamarks.json with invented: true.
// Usage: node tools/invent-harbour-marks.mjs        (run AFTER tools/fetch-seamarks.mjs: that one rewrites the file)
// Re-running replaces every previous invented mark, so it is idempotent. Real OSM rows are never touched.
// Placement: games/windward/src/seamark-place.js (from the coast raster, in water the boat can reach).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadCoast } from '../games/windward/src/coast-data.js';
import { buildCoastWorld, COAST_TILES } from '../games/windward/src/coast-world.js';
import { findHarbourMouth, makeFromGame } from '../games/windward/src/seamark-place.js';
import { distM } from './fetch-seamarks.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'games', 'windward', 'assets', 'coast') + '/';
export const PRIORITY = ['Fiskebäckskils småbåtshamn', 'Käringön fiskehamn']; // Felix: these two first
const NAV = ['lateral', 'cardinal', 'isolated_danger', 'light'];
export const NEAR_M = 600; // a harbour with no real navigational mark within this (real m) gets a gate
export const SHARE_M = 600; // two harbours whose mouths are this close (real m) share one gate
const slug = (s) => s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const io = { json: async (u) => JSON.parse(readFileSync(u, 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(u)) };
const coast = await loadCoast(dir, io, COAST_TILES);
const skerries = JSON.parse(readFileSync(dir + 'skerries.json', 'utf8')).skerries;
const world = buildCoastWorld(coast, { skerries });
const fromGame = makeFromGame(coast.meta, world.pxM);

const file = JSON.parse(readFileSync(dir + 'seamarks.json', 'utf8'));
const real = file.marks.filter((m) => !m.invented);
const SCALE = 10; // game metres -> real metres

// who needs a gate: the two named ones, plus every harbour with no real navigational mark within NEAR_M
const needs = file.harbours.filter((h) => PRIORITY.includes(h.name) || !real.some((m) => NAV.includes(m.type) && distM(h, m) <= NEAR_M));
needs.sort((a, b) => (PRIORITY.indexOf(a.name) + 1 || 99) - (PRIORITY.indexOf(b.name) + 1 || 99) || a.nearestMarkM - b.nearestMarkM);

const invented = [], report = [];
const gates = []; // placed so far: { centre: [x, z], name }
for (const h of needs) {
  const [hx, hz] = world.toGame(h.lon, h.lat);
  const r = findHarbourMouth(world, [hx, hz]);
  if (!r.ok) { report.push({ harbour: h.name, placed: false, reason: r.reason }); h.inventedGate = null; continue; }
  const shared = gates.find((g) => Math.hypot(g.centre[0] - r.centre[0], g.centre[1] - r.centre[1]) * SCALE <= SHARE_M);
  if (shared) { report.push({ harbour: h.name, placed: false, reason: `shares the mouth gate of ${shared.name}` }); h.inventedGate = { sharedWith: shared.name }; continue; }
  const id = slug(h.name);
  const base = { type: 'lateral', form: 'buoy', shape: 'spar', system: 'iala-a', invented: true, nearHarbour: h.name,
    basis: { rule: 'harbour-mouth gate v1 (src/seamark-place.js)', harbour: h.name, mouthWidthM: Math.round(r.widthM * SCALE), reachedOpenWater: r.reachedOpen } };
  const [plon, plat] = fromGame(...r.port), [slon, slat] = fromGame(...r.starboard);
  invented.push(
    { id: `invented/${id}-port`, lat: +plat.toFixed(5), lon: +plon.toFixed(5), ...base, side: 'port', colours: ['red'] },
    { id: `invented/${id}-starboard`, lat: +slat.toFixed(5), lon: +slon.toFixed(5), ...base, side: 'starboard', colours: ['green'] },
  );
  // remember the entering heading so the game can orient a leading line / the boat arrival if it wants (degrees clockwise from north)
  const bearing = Math.round(((Math.atan2(r.heading[0], -r.heading[1]) * 180) / Math.PI + 360) % 360);
  gates.push({ centre: r.centre, name: h.name });
  const [clon, clat] = fromGame(...r.centre);
  h.inventedGate = { ids: [`invented/${id}-port`, `invented/${id}-starboard`], mouth: { lat: +clat.toFixed(5), lon: +clon.toFixed(5) }, enteringBearingDeg: bearing, mouthWidthM: Math.round(r.widthM * SCALE), gateSpacingM: Math.round(r.spacing * SCALE), mouthFromHarbourM: Math.round(r.mouthFromHarbourM * SCALE) };
  report.push({ harbour: h.name, placed: true, ...h.inventedGate });
}

file.marks = [...real, ...invented].sort((a, b) => a.lat - b.lat || a.lon - b.lon);
const by = (arr, f) => arr.reduce((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});
file.counts = { total: file.marks.length, real: real.length, invented: invented.length, byType: by(file.marks, (m) => m.type), leadingLines: file.lines.length };
file.note = file.note.replace(/ Invented marks:.*$/, '') + ' Invented marks (invented: true) are generated harbour-mouth gates for harbours with no real mark nearby (tools/invent-harbour-marks.mjs): the game draws them like real ones, only the chart / debug view shows the flag.';
writeFileSync(dir + 'seamarks.json', JSON.stringify(file, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
console.log(`invented ${invented.length} marks (${invented.length / 2} gates), real ${real.length}`);
