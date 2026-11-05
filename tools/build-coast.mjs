#!/usr/bin/env node
// Windward R0: build the real west-coast map data (Smogen .. Marstrand).
//
//   node tools/build-coast.mjs [--cache DIR] [--out DIR] [--debug]
//
// Zero npm dependencies; Node 22+ (uses fetch, zlib.crc32). Downloads are cached
// in --cache (default: <tmp>/windward-coast-cache), so re-runs are offline.
//
// Sources (see assets/coast/SOURCES.md):
//   coastline  OpenStreetMap natural=coastline via Overpass   (ODbL)
//   height     Copernicus DEM GLO-30 (AWS open bucket)         (Copernicus licence)
//   land cover Naturvardsverket NMD 2018 basskikt v1.1, 10 m  (open data)
//   places     OpenStreetMap via Overpass                      (ODbL)
// Sea charts (Sjofartsverket) are restricted and NOT used: depth is a made-up
// function of distance to shore.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { openTiff } from './lib/tiff.mjs';
import { encodePng } from './lib/png.mjs';
import { extractFromZip } from './lib/zip.mjs';
import { lonLatToSweref, makePlane, M_PER_DEG_LAT } from './lib/geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg('--out', path.join(HERE, '../games/windward/assets/coast'));
const CACHE = arg('--cache', path.join(os.tmpdir(), 'windward-coast-cache'));
const DEBUG = argv.includes('--debug');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// ---------------------------------------------------------------- config
// One plane for the whole box (so distance fields have no seams), cropped into two tiles on output.
const BBOX = { s: 57.33, n: 58.45, w: 11.0, e: 12.1 };
const TILE_DEFS = [
  { id: 'north', s: 57.85, n: 58.45, w: 11.0, e: 11.8 },   // Smogen .. Marstrand (pass 1 area)
  { id: 'south', s: 57.33, n: 57.85, w: 11.5, e: 12.1 },   // Goteborg archipelago .. Gottskar
];
const MPP = 20;                      // real metres per raster pixel
const SKERRY_MAX_W = 25;             // closed coastline rings narrower than this (m) go to skerries.json
const DEPTH_MAX_M = 90, DEPTH_BASE_M = 0.5, DEPTH_PER_M = 0.04; // depth = base + 0.04 * distance-to-shore, capped
const CLASSES = ['water', 'bare_rock', 'heath', 'meadow', 'scrub', 'forest', 'village'];
const [WATER, ROCK, HEATH, MEADOW, SCRUB, FOREST, VILLAGE] = [0, 1, 2, 3, 4, 5, 6];
const UNRESOLVED = 250;
// trees per 100 m^2 of GAME ground (design density: what reads as forest/scrub)
const TREE_DENSITY = { bare_rock: 0, heath: 0.05, meadow: 0.02, scrub: 0.5, forest: 1.0, village: 0.1 };
const SCALES = [6, 8, 10];
const TREE_BUDGET = 3000;
const SHORE_SCRUB_M = 60;            // forest this close to water counts as wind-trimmed scrub
const MEADOW_MAX_SLOPE = 6, MEADOW_MAX_H = 25, MEADOW_MIN_INLAND_M = 100;

const UA = 'coopgames-windward-build-coast/0.1 (hobby game; one-off data build)';
const log = (...a) => console.log(...a);
const t0 = Date.now();
const lap = (s) => log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

// ---------------------------------------------------------------- downloads
async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  log('  downloading', url);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file));
}
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(query, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let attempt = 1; attempt <= 8; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[(attempt - 1) % OVERPASS_ENDPOINTS.length];
    log('  Overpass request', path.basename(file), 'attempt', attempt, new URL(endpoint).host);
    try {
      const r = await fetch(endpoint, {
        method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(300000),
      });
      if (r.ok) { const txt = await r.text(); fs.writeFileSync(file, txt); return JSON.parse(txt); }
      if (r.status < 500 && r.status !== 429) throw new Error('Overpass HTTP ' + r.status);
      log('    HTTP', r.status, '- will retry');
    } catch (e) {
      if (/^Overpass HTTP/.test(e.message)) throw e;
      log('    network error:', e.cause?.code || e.message, '- will retry');
    }
    await new Promise((res) => setTimeout(res, 30000 * Math.min(attempt, 4)));
  }
  throw new Error('Overpass gave up after 8 attempts');
}

// ---------------------------------------------------------------- places
const WANT = [
  ['Hållö', 'lighthouse', ['Hållö']], ['Måseskär', 'lighthouse'], ['Pater Noster', 'lighthouse', ['Pater Noster', 'Hamneskär']],
  ['Smögen', 'village'], ['Lysekil', 'village'], ['Fiskebäckskil', 'village'], ['Grundsund', 'village'],
  ['Gullholmen', 'village'], ['Käringön', 'village'], ['Mollösund', 'village'], ['Hälleviksstrand', 'village'],
  ['Kyrkesund', 'village'], ['Klädesholmen', 'village'], ['Åstol', 'village'], ['Skärhamn', 'village'],
  ['Marstrand', 'village'], ['Carlstens fästning', 'fortress', ['Carlstens Fästning', 'Carlstens fästning']],
  ['Kornö', 'island', ['Kornö', 'Stora Kornö']], ['Gåsö', 'island'], ['Storön', 'island'], ['Härmanö', 'island'], ['Härön', 'island'],
  // pass 2: south of Marstrand, plus Kungshamn
  ['Gottskär', 'village'], ['Vrångö', 'village'], ['Hönö', 'village'], ['Öckerö', 'village'], ['Donsö', 'village'], ['Styrsö', 'village'],
  ['Rörö', 'village'], ['Göteborg', 'village'], ['Kungshamn', 'village'],
];
function placeScore(kind, tags) {
  const p = tags.place;
  if (kind === 'lighthouse') return tags.man_made === 'lighthouse' ? 0 : (tags['seamark:type'] || '').startsWith('light') ? 1 : (p === 'island' || p === 'islet') ? 3 : 99; // island fallback: the lighthouse is not always its own named object
  if (kind === 'fortress') return ['castle', 'fort'].includes(tags.historic) ? 0 : tags.historic || tags.tourism ? 2 : 5;
  if (kind === 'village') return ['city', 'town', 'village', 'hamlet', 'suburb', 'locality', 'neighbourhood', 'isolated_dwelling'].includes(p) ? 0 : p === 'island' || p === 'islet' ? 1 : 99;
  if (kind === 'island') return p === 'island' ? 0 : p === 'islet' ? 1 : 99;
  return 99;
}
async function fetchPlaces() {
  const names = [...new Set(WANT.flatMap(([n, , alts]) => alts || [n]))];
  const variants = names.flatMap((n) => [n, n + ' fyr']);
  const box = `(${BBOX.s - 0.05},${BBOX.w - 0.05},${BBOX.n + 0.05},${BBOX.e + 0.05})`;
  const q = `[out:json][timeout:120];(` + variants.map((n) => `nwr["name"="${n}"]${box};`).join('') + `);out center tags;`;
  const j = await overpass(q, path.join(CACHE, 'places-raw.json'));
  const places = [], notFound = [];
  for (const [name, kind, alts] of WANT) {
    const nameSet = alts || [name];
    const cands = j.elements
      .filter((e) => e.tags && nameSet.some((n) => e.tags.name.toLowerCase() === n.toLowerCase() || e.tags.name.toLowerCase().startsWith(n.toLowerCase() + ' ')))
      .map((e) => ({ e, score: placeScore(kind, e.tags), exact: nameSet.some((n) => n.toLowerCase() === e.tags.name.toLowerCase()) ? 0 : 1 }))
      .filter((c) => c.score < 99)
      .sort((a, b) => a.score - b.score || a.exact - b.exact);
    if (!cands.length) { notFound.push(name); continue; }
    const { e } = cands[0];
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const inside = lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e;
    places.push({
      name, kind, lat: +lat.toFixed(5), lon: +lon.toFixed(5), osm: `${e.type}/${e.id}`,
      osmName: e.tags.name, candidates: cands.length, inside,
    });
  }
  return { places, notFound };
}

// ---------------------------------------------------------------- raster helpers
// Felzenszwalb exact Euclidean distance transform. src: Uint8Array, 1 = source.
// Returns squared distance (pixels^2) to the nearest source pixel.
function edt(src, W, H) {
  const INF = 1e20, f = new Float32Array(W * H);
  for (let i = 0; i < f.length; i++) f[i] = src[i] ? 0 : INF;
  const n = Math.max(W, H), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1);
  function pass(len, get, set) {
    for (let i = 0; i < len; i++) d[i] = get(i);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      for (;;) {
        s = ((d[q] + q * q) - (d[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        if (s <= z[k] && k > 0) k--; else break;
      }
      if (s <= z[k]) { v[0] = q; z[0] = -INF; z[1] = INF; k = 0; continue; }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      set(q, (q - v[k]) * (q - v[k]) + d[v[k]]);
    }
  }
  for (let x = 0; x < W; x++) pass(H, (y) => f[y * W + x], (y, val) => { f[y * W + x] = val; });
  for (let y = 0; y < H; y++) pass(W, (x) => f[y * W + x], (x, val) => { f[y * W + x] = val; });
  return f;
}

// ================================================================= MAIN
log('Windward coast build');
const plane = makePlane(BBOX, MPP);
const { W, H } = plane;
log(`  plane ${W} x ${H} px at ${MPP} m/px  (${((W * MPP) / 1000).toFixed(1)} x ${((H * MPP) / 1000).toFixed(1)} km real)`);
// tile pixel rects on the plane; the south tile starts exactly where the north one ends
const tiles = TILE_DEFS.map((t) => ({
  id: t.id,
  x0: Math.floor(((t.w - BBOX.w) * plane.mLon) / MPP), x1: Math.min(W, Math.ceil(((t.e - BBOX.w) * plane.mLon) / MPP)),
  y0: Math.floor(((BBOX.n - t.n) * M_PER_DEG_LAT) / MPP), y1: Math.min(H, Math.ceil(((BBOX.n - t.s) * M_PER_DEG_LAT) / MPP)),
}));
tiles[1].y0 = tiles[0].y1;
const tileOf = new Uint8Array(W * H);                 // 0 = not in any tile, 1 = north, 2 = south
tiles.forEach((t, k) => { for (let j = t.y0; j < t.y1; j++) tileOf.fill(k + 1, j * W + t.x0, j * W + t.x1); });
for (const t of tiles) log(`  tile ${t.id}: x ${t.x0}..${t.x1}, y ${t.y0}..${t.y1}  (${t.x1 - t.x0} x ${t.y1 - t.y0})`);

// ---- 1. downloads
log('1. sources');
const coastQuery = (s, w, n, e) => `[out:json][timeout:240];way["natural"="coastline"](${s},${w},${n},${e});out geom;`;
const coastParts = [
  await overpass(coastQuery(57.85, 11.0, 58.45, 11.8), path.join(CACHE, 'coastlines.json')),        // north tile (pass 1 file)
  await overpass(coastQuery(57.85, 11.8, 58.45, 12.1), path.join(CACHE, 'coastlines-east.json')),   // strip east of it: keeps distance fields honest at the tile edge
  await overpass(coastQuery(57.33, 11.0, 57.85, 12.1), path.join(CACHE, 'coastlines-south.json')),  // pass 2: south extension
];
const coastJson = { elements: [...new Map(coastParts.flatMap((j) => j.elements).map((e) => [e.id, e])).values()] }; // de-duplicated by OSM way id
await download('https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N58_00_E011_00_DEM/Copernicus_DSM_COG_10_N58_00_E011_00_DEM.tif', path.join(CACHE, 'dem-N58E011.tif'));
await download('https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N57_00_E011_00_DEM/Copernicus_DSM_COG_10_N57_00_E011_00_DEM.tif', path.join(CACHE, 'dem-N57E011.tif'));
await download('https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N57_00_E012_00_DEM/Copernicus_DSM_COG_10_N57_00_E012_00_DEM.tif', path.join(CACHE, 'dem-N57E012.tif'));
await download('https://geodata.naturvardsverket.se/nedladdning/marktacke/NMD2018/bas_lan_ogen/O_lan_nmd2018bas_ogeneraliserad_v1_1.zip', path.join(CACHE, 'nmd-O.zip'));
await download('https://geodata.naturvardsverket.se/nedladdning/marktacke/NMD2018/bas_lan_ogen/N_lan_nmd2018bas_ogeneraliserad_v1_1.zip', path.join(CACHE, 'nmd-N.zip'));
const NMD_COUNTIES = ['O', 'N'];                     // O = Vastra Gotaland, N = Halland (Gottskar is in Kungsbacka)
for (const c of NMD_COUNTIES) if (!fs.existsSync(path.join(CACHE, `nmd-${c}.tif`))) extractFromZip(path.join(CACHE, `nmd-${c}.zip`), '.tif', path.join(CACHE, `nmd-${c}.tif`));
const { places, notFound } = await fetchPlaces();
lap(`coastline ways: ${coastJson.elements.length}, places found: ${places.length}, not found: ${notFound.length}`);

// ---- 2. land mask: even-odd crossing count from the west edge (open sea)
log('2. land mask');
const ways = coastJson.elements.filter((e) => e.geometry && e.geometry.length > 1).map((e) => {
  const g = e.geometry, px = new Float64Array(g.length * 2);
  g.forEach((p, i) => { const [x, y] = plane.toPx(p.lon, p.lat); px[2 * i] = x; px[2 * i + 1] = y; });
  const closed = g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
  return { px, closed, n: g.length };
});
const rowCount = new Int32Array(H + 1);
function eachSeg(fn) {
  for (const w of ways) for (let i = 0; i < w.n - 1; i++) fn(w.px[2 * i], w.px[2 * i + 1], w.px[2 * i + 2], w.px[2 * i + 3]);
}
eachSeg((x1, y1, x2, y2) => {
  const lo = Math.max(0, Math.ceil(Math.min(y1, y2) - 0.5)), hi = Math.min(H - 1, Math.floor(Math.max(y1, y2) - 0.5));
  for (let j = lo; j <= hi; j++) { const yc = j + 0.5; if ((y1 <= yc) !== (y2 <= yc)) rowCount[j]++; }
});
const rowStart = new Int32Array(H + 1);
for (let j = 0; j < H; j++) rowStart[j + 1] = rowStart[j] + rowCount[j];
const xs = new Float32Array(rowStart[H]), fillPos = rowStart.slice(0, H);
eachSeg((x1, y1, x2, y2) => {
  const lo = Math.max(0, Math.ceil(Math.min(y1, y2) - 0.5)), hi = Math.min(H - 1, Math.floor(Math.max(y1, y2) - 0.5));
  for (let j = lo; j <= hi; j++) {
    const yc = j + 0.5;
    if ((y1 <= yc) !== (y2 <= yc)) xs[fillPos[j]++] = x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1);
  }
});
const land = new Uint8Array(W * H);
for (let j = 0; j < H; j++) {
  const row = xs.subarray(rowStart[j], rowStart[j + 1]).sort();
  let state = 0, k = 0;
  for (let i = 0; i < W; i++) {
    while (k < row.length && row[k] < i + 0.5) { if (row[k] >= 0) state ^= 1; k++; }
    land[j * W + i] = state;
  }
}
let westLand = 0; for (let j = 0; j < H; j++) westLand += land[j * W];
if (westLand) log(`  WARNING: ${westLand} land pixels in column 0: west edge is not all open sea`);

// ---- 3. skerries (tiny closed rings): list them, and burn one pixel if the ring vanished
const skerries = [];
const burned = new Uint8Array(W * H);
let burnedCount = 0;
for (const w of ways) {
  if (!w.closed) continue;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < w.n; i++) { const x = w.px[2 * i], y = w.px[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (cx < 0 || cy < 0 || cx >= W || cy >= H || !tileOf[Math.floor(cy) * W + Math.floor(cx)]) continue;
  const dx = (x1 - x0) * MPP, dy = (y1 - y0) * MPP, width = Math.min(dx, dy), len = Math.max(dx, dy);
  let any = false;
  for (let j = Math.max(0, Math.floor(y0)); j <= Math.min(H - 1, Math.floor(y1)) && !any; j++)
    for (let i = Math.max(0, Math.floor(x0)); i <= Math.min(W - 1, Math.floor(x1)); i++) if (land[j * W + i]) { any = true; break; }
  if (!any) { const p = Math.floor(cy) * W + Math.floor(cx); land[p] = 1; burned[p] = 1; burnedCount++; }
  if (width < SKERRY_MAX_W) {
    const [lon, lat] = plane.toLonLat(cx, cy);
    skerries.push([+lon.toFixed(5), +lat.toFixed(5), Math.max(1, Math.round(width)), Math.max(1, Math.round(len))]);
  }
}
let landPx = 0, tilePx = 0; for (let i = 0; i < land.length; i++) if (tileOf[i]) { tilePx++; landPx += land[i]; }
lap(`land ${(100 * landPx / tilePx).toFixed(1)} % of tile area; skerries (<${SKERRY_MAX_W} m wide): ${skerries.length}; vanished islets re-burned as 1 px: ${burnedCount}`);

// ---- 4. distance fields
log('3. distance fields');
const d2Land = edt(land, W, H);                                   // for water px: distance to nearest land
const water = new Uint8Array(W * H); for (let i = 0; i < water.length; i++) water[i] = land[i] ? 0 : 1;
const d2Water = edt(water, W, H);                                 // for land px: distance to nearest water
const shoreM = (d2) => Math.max(0, (Math.sqrt(d2) - 0.5) * MPP);
lap('done');

// ---- 5. heights from Copernicus GLO-30
log('4. heights');
const dem = {};
for (const key of ['N57E011', 'N57E012', 'N58E011']) {
  const t = openTiff(path.join(CACHE, `dem-${key}.tif`));
  dem[key] = { w: t.width, h: t.height, lat0: +key.slice(1, 3), lon0: +key.slice(4, 7), data: t.readWindow(0, 0, t.width, t.height).data };
  t.close();
}
function demAt(lon, lat) {
  const tile = dem[`N${Math.floor(lat)}E${String(Math.floor(lon)).padStart(3, '0')}`];   // tiles are named like N57E011
  if (!tile) return 0;
  const u = (lon - tile.lon0) * tile.w - 0.5, v = (tile.lat0 + 1 - lat) * tile.h - 0.5;
  const u0 = Math.max(0, Math.min(tile.w - 2, Math.floor(u))), v0 = Math.max(0, Math.min(tile.h - 2, Math.floor(v)));
  const fu = Math.max(0, Math.min(1, u - u0)), fv = Math.max(0, Math.min(1, v - v0));
  const a = tile.data, i = v0 * tile.w + u0;
  return (a[i] * (1 - fu) + a[i + 1] * fu) * (1 - fv) + (a[i + tile.w] * (1 - fu) + a[i + tile.w + 1] * fu) * fv;
}
const hgt = new Float32Array(W * H);          // metres, land only
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const p = j * W + i;
  if (!land[p] || !tileOf[p]) continue;
  if (burned[p]) { hgt[p] = 0.5; continue; }
  const [lon, lat] = plane.toLonLat(i + 0.5, j + 0.5);
  hgt[p] = Math.max(0.3, demAt(lon, lat));
}
let maxH = 0; for (const h of hgt) if (h > maxH) maxH = h;
lap(`max height ${maxH.toFixed(0)} m`);

// ---- 6. land cover from NMD
log('5. land cover (NMD)');
let eMin = Infinity, eMax = -Infinity, nMin = Infinity, nMax = -Infinity;
for (let u = 0; u <= 4; u++) for (let v = 0; v <= 4; v++) {
  const [lon, lat] = plane.toLonLat((W * u) / 4, (H * v) / 4); const { E, N } = lonLatToSweref(lon, lat);
  eMin = Math.min(eMin, E); eMax = Math.max(eMax, E); nMin = Math.min(nMin, N); nMax = Math.max(nMax, N);
}
const nmdLayers = [];
for (const c of NMD_COUNTIES) {                      // first layer with a value wins (county borders)
  const t = openTiff(path.join(CACHE, `nmd-${c}.tif`));
  const E0 = t.tiepoint[3], N0 = t.tiepoint[4], res = t.pixelScale[0];
  const win = t.readWindow(Math.floor((eMin - E0) / res) - 20, Math.floor((N0 - nMax) / res) - 20, Math.ceil((eMax - E0) / res) + 20, Math.ceil((N0 - nMin) / res) + 20);
  t.close();
  if (win.w > 0 && win.h > 0) { nmdLayers.push({ E0, N0, res, win }); lap(`NMD ${c} window ${win.w} x ${win.h}`); }
}
const nmdAt = (E, N) => {
  for (const { E0, N0, res, win } of nmdLayers) {
    const c = Math.floor((E - E0) / res) - win.x0, r = Math.floor((N0 - N) / res) - win.y0;
    if (c < 0 || r < 0 || c >= win.w || r >= win.h) continue;
    const v = win.data[r * win.w + c]; if (v) return v;
  }
  return 0;
};
const nmdPriority = (c) => (c === 51 || c === 52 ? 9 : c >= 111 ? 8 : c === 3 ? 6 : c === 42 ? 5 : c === 41 ? 4 : c === 2 ? 3 : c === 53 ? 2 : 1);

// slope (degrees) from the height raster, land px only
function slopeAt(i, j) {
  const g = (x, y) => { const p = Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x)); return land[p] ? hgt[p] : hgt[j * W + i]; };
  const dzdx = (g(i + 1, j) - g(i - 1, j)) / (2 * MPP), dzdy = (g(i, j + 1) - g(i, j - 1)) / (2 * MPP);
  return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
}
const cls = new Uint8Array(W * H);
const nmdRawHist = {};
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const p = j * W + i;
  if (!land[p] || !tileOf[p]) continue;
  if (burned[p]) { cls[p] = ROCK; continue; }
  const [lon, lat] = plane.toLonLat(i + 0.5, j + 0.5);
  const { E, N } = lonLatToSweref(lon, lat);
  const s = [nmdAt(E - 5, N - 5), nmdAt(E + 5, N - 5), nmdAt(E - 5, N + 5), nmdAt(E + 5, N + 5)];
  const counts = new Map(); for (const c of s) counts.set(c, (counts.get(c) || 0) + 1);
  let code = s[0], bestN = 0, bestP = -1;
  for (const [c, n] of counts) { const pr = nmdPriority(c); if (n > bestN || (n === bestN && pr > bestP)) { code = c; bestN = n; bestP = pr; } }
  nmdRawHist[code] = (nmdRawHist[code] || 0) + 1;
  const dW = shoreM(d2Water[p]);
  let k;
  if (code === 41) k = ROCK;
  else if (code === 42) k = (slopeAt(i, j) < MEADOW_MAX_SLOPE && hgt[p] < MEADOW_MAX_H && dW >= MEADOW_MIN_INLAND_M) ? MEADOW : HEATH;
  else if (code === 2 || code === 3) k = MEADOW;
  else if (code === 51 || code === 52) k = VILLAGE;
  else if (code >= 111 && code <= 128) k = (code === 118 || code === 128 || dW <= SHORE_SCRUB_M) ? SCRUB : FOREST;
  else k = UNRESOLVED;                                           // roads (53), NMD water/no-data on OSM land
  cls[p] = k;
}
// unresolved px take the majority class of their resolved 8-neighbours (a few passes), else bare rock
for (let pass = 0; pass < 8; pass++) {
  let left = 0; const upd = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = j * W + i;
    if (cls[p] !== UNRESOLVED) continue;
    const c = new Uint8Array(7);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const v = cls[y * W + x]; if (v >= 1 && v <= 6) c[v]++;
    }
    let best = 0, bn = 0; for (let v = 1; v <= 6; v++) if (c[v] > bn) { bn = c[v]; best = v; }
    if (best) upd.push(p, best); else left++;
  }
  for (let q = 0; q < upd.length; q += 2) cls[upd[q]] = upd[q + 1];
  if (!left) break;
}
for (let p = 0; p < cls.length; p++) if (cls[p] === UNRESOLVED) cls[p] = ROCK;
const classPx = new Array(7).fill(0); for (let p = 0; p < cls.length; p++) if (land[p] && tileOf[p]) classPx[cls[p]]++;
let landTotal = classPx.reduce((a, b) => a + b, 0);
const classPct = {}, classKm2 = {};
CLASSES.slice(1).forEach((n, i) => { classPct[n] = +(100 * classPx[i + 1] / landTotal).toFixed(1); classKm2[n] = +((classPx[i + 1] * MPP * MPP) / 1e6).toFixed(1); });
lap('land classes: ' + JSON.stringify(classPct));

// ---- 7. write rasters
log('6. rasters');
const landH = new Uint16Array(W * H);
for (let p = 0; p < landH.length; p++) if (land[p]) landH[p] = Math.min(65535, Math.round(hgt[p] * 2) * 5 + 1);   // 0.5 m steps (stored as decimetres): far finer than a 30 m model deserves, and it halves the file
const depthDm = new Uint16Array(W * H);
for (let p = 0; p < depthDm.length; p++) if (!land[p]) depthDm[p] = Math.round(Math.min(DEPTH_MAX_M, DEPTH_BASE_M + DEPTH_PER_M * shoreM(d2Land[p])) * 2) * 5;   // 0.5 m steps
const classOut = new Uint8Array(W * H); for (let p = 0; p < classOut.length; p++) classOut[p] = land[p] ? cls[p] : 0;
const files = {};
function writeOut(name, buf) { fs.writeFileSync(path.join(OUT, name), buf); files[name] = buf.length; }
const crop = (arr, t) => { const w = t.x1 - t.x0, out = new arr.constructor(w * (t.y1 - t.y0)); for (let j = t.y0; j < t.y1; j++) out.set(arr.subarray(j * W + t.x0, j * W + t.x1), (j - t.y0) * w); return out; };
for (const t of tiles) {
  const w = t.x1 - t.x0, h = t.y1 - t.y0;
  t.files = { landHeight: `${t.id}-land-height.png`, depth: `${t.id}-depth.png`, classes: `${t.id}-classes.png` };
  writeOut(t.files.landHeight, encodePng({ width: w, height: h, bitDepth: 16, data: crop(landH, t) }));
  writeOut(t.files.depth, encodePng({ width: w, height: h, bitDepth: 16, data: crop(depthDm, t) }));
  writeOut(t.files.classes, encodePng({ width: w, height: h, bitDepth: 8, data: crop(classOut, t) }));
}
lap('PNGs written');

// ---- 8. places + skerries
writeOut('places.json', Buffer.from(JSON.stringify({ generated: new Date().toISOString().slice(0, 10), notFound, places }, null, 1)));
writeOut('skerries.json', Buffer.from(JSON.stringify({ note: '[lon, lat, width_m, length_m] of closed OSM coastline rings narrower than ' + SKERRY_MAX_W + ' m', skerries })));

// ---- 9. routes (clearance-weighted Dijkstra on 100 m cells, then line-of-sight smoothing)
log('7. routes');
const CELL = 5, CW = Math.ceil(W / CELL), CH = Math.ceil(H / CELL);
const clearM = (i, j) => (i < 0 || j < 0 || i >= W || j >= H || land[j * W + i] ? 0 : shoreM(d2Land[j * W + i]));
const cellClear = new Float32Array(CW * CH);
for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) cellClear[cy * CW + cx] = clearM(cx * CELL + 2, cy * CELL + 2);
const MIN_CLEAR = 100, LOS_CLEAR = 90, PREFER_CLEAR = 400;
// inner=true: stay among the islands (open water > OPEN_FROM m from land is expensive and never cut across)
const OPEN_FROM = 300, OPEN_SPAN = 500, MAX_LOS_CLEAR = 1000;
const ROUTES = [
  { id: 'marstrand-smogen', from: 'Marstrand', to: 'Smögen' },
  { id: 'gottskar-marstrand', from: 'Gottskär', to: 'Marstrand' },
];
function snapToWater(p) {
  const [fx, fy] = plane.toPx(p.lon, p.lat); const cx0 = Math.floor(fx / CELL), cy0 = Math.floor(fy / CELL);
  let best = -1, bd = Infinity;
  for (let cy = Math.max(0, cy0 - 50); cy < Math.min(CH, cy0 + 50); cy++) for (let cx = Math.max(0, cx0 - 50); cx < Math.min(CW, cx0 + 50); cx++) {
    if (cellClear[cy * CW + cx] < MIN_CLEAR) continue;
    const d = (cx - fx / CELL) ** 2 + (cy - fy / CELL) ** 2; if (d < bd) { bd = d; best = cy * CW + cx; }
  }
  return { cell: best, distM: Math.sqrt(bd) * CELL * MPP };
}
function findRoute(a, b, inner) {
  const dist = new Float64Array(CW * CH).fill(Infinity), from = new Int32Array(CW * CH).fill(-1);
  const heap = [[0, a.cell]];
  const push = (k, v) => { heap.push([k, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  dist[a.cell] = 0;
  while (heap.length) {
    const [dcur, cur] = pop(); if (dcur > dist[cur]) continue; if (cur === b.cell) break;
    const cx = cur % CW, cy = (cur / CW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
      const n = ny * CW + nx, c = cellClear[n]; if (c < MIN_CLEAR) continue;
      const open = inner ? 6 * Math.min(1, Math.max(0, (c - OPEN_FROM) / OPEN_SPAN)) : 0;
      const step = Math.hypot(dx, dy) * (1 + 4 * Math.max(0, (PREFER_CLEAR - c) / PREFER_CLEAR) + open);
      if (dcur + step < dist[n]) { dist[n] = dcur + step; from[n] = cur; push(dist[n], n); }
    }
  }
  if (!Number.isFinite(dist[b.cell])) return null;
  const cells = []; for (let c = b.cell; c !== -1; c = from[c]) cells.push(c); cells.reverse();
  const pts = cells.map((c) => [(c % CW) * CELL + 2.5, ((c / CW) | 0) * CELL + 2.5]);
  const los = (p, q) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 2); for (let s = 0; s <= n; s++) { const cl = clearM(Math.floor(p[0] + (q[0] - p[0]) * s / n), Math.floor(p[1] + (q[1] - p[1]) * s / n)); if (cl < LOS_CLEAR || (inner && cl > MAX_LOS_CLEAR)) return false; } return true; };
  const sm = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; sm.push(pts[j]); i = j; }
  let len = 0; for (let k = 1; k < sm.length; k++) len += Math.hypot(sm[k][0] - sm[k - 1][0], sm[k][1] - sm[k - 1][1]) * MPP;
  return { len, sm };
}
const routes = [];
for (const r of ROUTES) {
  const pf = places.find((p) => p.name === r.from), pt = places.find((p) => p.name === r.to);
  if (!pf || !pt) { log(`  WARNING: ${r.id}: place missing, skipped`); continue; }
  const a = snapToWater(pf), b = snapToWater(pt);
  if (a.cell < 0 || b.cell < 0) { log(`  WARNING: ${r.id}: no open water within 5 km of an end`); continue; }
  const inner = findRoute(a, b, true), offshore = findRoute(a, b, false);
  if (!inner) { log(`  WARNING: ${r.id}: no route found`); continue; }
  routes.push({
    id: r.id, from: r.from, to: r.to,
    note: 'Among the islands: Dijkstra on 100 m cells, >=' + MIN_CLEAR + ' m clearance, extra cost for open water more than ' + OPEN_FROM + ' m from land, straightened only where a line keeps ' + LOS_CLEAR + '..' + MAX_LOS_CLEAR + ' m from land',
    length_m: Math.round(inner.len), offshoreLength_m: offshore ? Math.round(offshore.len) : null,
    startSnap_m: Math.round(a.distM), endSnap_m: Math.round(b.distM),
    points: inner.sm.map(([x, y]) => plane.toLonLat(x, y).map((v) => +v.toFixed(5))),
  });
  lap(`${r.id}: ${(inner.len / 1000).toFixed(1)} km real, offshore alternative ${offshore ? (offshore.len / 1000).toFixed(1) : '-'} km (ends snapped ${Math.round(a.distM)} m / ${Math.round(b.distM)} m)`);
}
writeOut('routes.json', Buffer.from(JSON.stringify({ routes })));

// ---- 10. tree rule + totals
log('8. trees');
const trees = { unit: 'trees per 100 m^2 of GAME ground', density: TREE_DENSITY, budget: TREE_BUDGET, totals: {} };
for (const S of SCALES) {
  const gamePxArea = (MPP / S) ** 2;          // game m^2 per raster px
  const byClass = {}; let total = 0;
  CLASSES.slice(1).forEach((n, i) => { const v = Math.round((classPx[i + 1] * gamePxArea / 100) * TREE_DENSITY[n]); byClass[n] = v; total += v; });
  trees.totals['1:' + S] = { total, byClass, landKm2Game: +((landTotal * gamePxArea) / 1e6).toFixed(2), overBudgetBy: +(total / TREE_BUDGET).toFixed(1), densityScaleToFitBudget: +(Math.min(1, TREE_BUDGET / total)).toFixed(4) };
}
// worst-case instanced trees in a view disc of radius R game metres on pure forest
trees.viewDisc = { note: 'trees inside a disc around the boat if the whole disc were forest', radii_m: {} };
for (const R of [150, 250, 400]) trees.viewDisc.radii_m[R] = Math.round(Math.PI * R * R / 100 * TREE_DENSITY.forest);
writeOut('trees.json', Buffer.from(JSON.stringify(trees, null, 1)));
for (const S of SCALES) lap(`1:${S}: ${trees.totals['1:' + S].total} trees map-wide (${trees.totals['1:' + S].overBudgetBy}x budget)`);

// ---- 11. meta
const meta = {
  generated: new Date().toISOString().slice(0, 10),
  bbox: BBOX, metersPerPixelReal: MPP, width: W, height: H,
  tiles: tiles.map((t) => ({ id: t.id, x0: t.x0, y0: t.y0, width: t.x1 - t.x0, height: t.y1 - t.y0, files: t.files })),
  projection: {
    kind: 'equirectangular around box centre', latCentre: plane.latC, metersPerDegLat: M_PER_DEG_LAT, metersPerDegLon: plane.mLon,
    pixelToLonLat: 'lon = bbox.w + x*mpp/metersPerDegLon ; lat = bbox.n - y*mpp/metersPerDegLat   (x,y = pixel coords, y down)',
  },
  rasters: {
    '<tile>-land-height.png': '16-bit grey. 0 = water. Land = round(height_m*10)+1 (decimetres + 1), stored in 0.5 m steps. Copernicus GLO-30 is a surface model (tree tops count).',
    '<tile>-depth.png': `16-bit grey, decimetres in 0.5 m steps. 0 = land. Placeholder model: min(${DEPTH_MAX_M}, ${DEPTH_BASE_M} + ${DEPTH_PER_M} * metres-to-shore). NOT sea-chart data.`,
    '<tile>-classes.png': '8-bit grey, 0 = water, 1..6 = land classes below. Tiles sit on one shared plane: pixel (x,y) of a tile is plane pixel (x0+x, y0+y)',
  },
  classes: CLASSES.map((name, value) => ({ value, name })),
  classPercentOfLand: classPct, classKm2, landKm2: +((landTotal * MPP * MPP) / 1e6).toFixed(1),
  nmdRawCodeHistogram: nmdRawHist,
  rules: { SHORE_SCRUB_M, MEADOW_MAX_SLOPE, MEADOW_MAX_H, MEADOW_MIN_INLAND_M },
  skerryCount: skerries.length, vanishedIsletsBurned: burnedCount,
};
writeOut('meta.json', Buffer.from(JSON.stringify(meta, null, 1)));

if (DEBUG) {
  const rgb = new Uint8Array(W * H * 3);
  const col = [[20, 70, 120], [200, 170, 175], [150, 120, 130], [170, 215, 90], [110, 160, 60], [40, 100, 50], [220, 120, 60]];
  for (let p = 0; p < W * H; p++) { const c = classOut[p] ? col[classOut[p]] : (() => { const t = Math.min(1, depthDm[p] / 300); return [60 - 40 * t, 170 - 100 * t, 200 - 80 * t]; })(); rgb.set(c, p * 3); }
  fs.writeFileSync(path.join(CACHE, 'debug-classes.png'), encodePng({ width: W, height: H, bitDepth: 8, colorType: 2, data: rgb }));
}

log('\nOUTPUT FILES');
let sum = 0; for (const [n, s] of Object.entries(files)) { sum += s; log(`  ${n.padEnd(18)} ${(s / 1024).toFixed(0).padStart(6)} KB`); }
log(`  ${'TOTAL'.padEnd(18)} ${(sum / 1024 / 1024).toFixed(2).padStart(6)} MB`);
log('PLACES NOT FOUND:', notFound.length ? notFound.join(', ') : 'none');
log('PLACES OUTSIDE BOX:', places.filter((p) => !p.inside).map((p) => p.name).join(', ') || 'none');
