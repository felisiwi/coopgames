// node games/windward/src/wind-map.js [--day sea-breeze] [--seed 7] [--time 14:00] [--era 1950|today] [--cell 40] [--png path.png]
// Draws windAt() over the real coast window as ASCII (stdout) and, with --png, as a three-panel picture:
//   left   strength, every layer on          middle  strength vs the day's wind (blue = gust/stronger, orange = lee/lull/weaker)
//   right  coast layers only (no gusts, shifts): the lees behind islands, funnelled sounds and the utomskars boost, clean
// A node tool for mission control to check the field's look without opening a browser. Not used by the game.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { loadWorldFiles } from './world-year-build.js';
import { buildCoastWorld } from './coast-world.js';
import { worldAtYear, coastAtWaterLevel, yearOfEra } from './world-year.js';
import { createWindField } from './wind-field.js';
import { parseClock, timeOfHour, dirToCompass, formatClock } from './weather.js';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const day = arg('day', 'sea-breeze');
const seed = Number(arg('seed', 7));
const hour = parseClock(arg('time', '14:00'));
const era = arg('era', '1950');
const cell = Number(arg('cell', 40));
const pngPath = arg('png', null);

const io = { json: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(fileURLToPath(u))) };
const files = await loadWorldFiles({ coastUrl: new URL('../assets/coast/', import.meta.url).href, dataUrl: new URL('../data/', import.meta.url).href, chartUrl: new URL('../assets/chart/', import.meta.url).href, io });
const spec = worldAtYear(files.years, files.sources, yearOfEra(files.years, era));
const world = buildCoastWorld(coastAtWaterLevel(files.coast, spec.waterOffsetM), { skerries: files.skerries.skerries });
const { minX, minZ, maxX, maxZ } = world.bounds;
const t = timeOfHour(hour);

const full = createWindField({ daySeed: seed, dayType: day, heightAt: world.heightAt, bounds: world.bounds });
const coastOnly = createWindField({ daySeed: seed, dayType: day, heightAt: world.heightAt, bounds: world.bounds });
for (const k of ['shifts', 'gusts', 'squalls']) coastOnly.layers[k] = false;
const base = full.base(t);

const T0 = Date.now();
const grid = (field, step) => {
  const nx = Math.floor((maxX - minX) / step); const nz = Math.floor((maxZ - minZ) / step);
  const out = []; const o = {};
  for (let j = 0; j < nz; j++) { const row = []; for (let i = 0; i < nx; i++) { const x = minX + (i + 0.5) * step; const z = minZ + (j + 0.5) * step; const land = world.heightAt(x, z) > 0.7; const w = field.windAt(x, z, t, o); row.push({ land, s: w.strength, rel: w.rel, ex: w.exposure }); } out.push(row); }
  return out;
};

// ---- ASCII (coast layers only, so the lees and the open-water boost are the picture) ----
const RAMP = ' .:-=+*%@';
const A = grid(coastOnly, cell);
console.log(`windAt, ${day} seed ${seed} at ${formatClock(t)} (${era} coast), coast layers only. The day's wind: ${(base.strength).toFixed(2)} from ${dirToCompass(base.dir).toFixed(0)} deg.`);
console.log(`north is up, one character = ${cell} m, land = #, water ramp "${RAMP}" = strength 0 .. 1.25 (denser = stronger)`);
for (const row of A) console.log(row.map((c) => (c.land ? '#' : RAMP[Math.min(RAMP.length - 1, Math.floor((c.s / 1.25) * RAMP.length))])).join(''));
const water = A.flat().filter((c) => !c.land);
const stat = (f) => { const v = water.map(f).sort((a, b) => a - b); return `min ${v[0].toFixed(2)}  median ${v[v.length >> 1].toFixed(2)}  max ${v[v.length - 1].toFixed(2)}`; };
console.log(`strength over open water: ${stat((c) => c.s)}`);
console.log(`exposure (0 inside the skerries .. 1 utomskars): ${stat((c) => c.ex)}`);
const west = water.filter((_, i) => true);
console.log(`built in ${Date.now() - T0} ms; coast-grid buckets cached: ${full.cachedBuckets()}`);
void west;

// ---- PNG ----
if (pngPath) {
  const STEP = 6; const SCALE = 2;
  const F = grid(full, STEP); const C = grid(coastOnly, STEP);
  const w = F[0].length; const h = F.length; const W = w * SCALE * 3 + 8; const H = h * SCALE;
  const px = new Uint8Array(W * H * 4).fill(255);
  const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const strengthRGB = (s) => mix([232, 242, 246], [8, 44, 112], clamp01(s / 1.25));
  const relRGB = (r) => (r >= 1 ? mix([245, 245, 245], [20, 70, 190], clamp01((r - 1) / 0.5)) : mix([245, 245, 245], [235, 120, 30], clamp01((1 - r) / 0.7)));
  const landRGB = [150, 142, 112];
  const put = (panel, i, j, rgb) => { for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) { const X = panel * (w * SCALE + 4) + i * SCALE + dx; const Y = j * SCALE + dy; const k = (Y * W + X) * 4; px[k] = rgb[0]; px[k + 1] = rgb[1]; px[k + 2] = rgb[2]; px[k + 3] = 255; } };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const f = F[j][i]; const c = C[j][i];
    put(0, i, j, f.land ? landRGB : strengthRGB(f.s));
    put(1, i, j, f.land ? landRGB : relRGB(f.rel));
    put(2, i, j, c.land ? landRGB : strengthRGB(c.s));
  }
  // spawn (Grundsunds hamn) as a red dot on every panel
  const [sx, sz] = world.toGame(11.41577, 58.216);
  for (let p = 0; p < 3; p++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) { const X = p * (w * SCALE + 4) + Math.round(((sx - minX) / STEP) * SCALE) + dx; const Y = Math.round(((sz - minZ) / STEP) * SCALE) + dy; if (X >= 0 && X < W && Y >= 0 && Y < H) { const k = (Y * W + X) * 4; px[k] = 220; px[k + 1] = 30; px[k + 2] = 30; } }
  // PNG encode
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log(`wrote ${pngPath} (${W}x${H}): left = all layers, middle = vs the day's wind (blue stronger, orange weaker), right = coast layers only; red dot = Grundsunds hamn`);
}
