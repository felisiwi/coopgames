// Coast Lab: top-down preview of the real-coast data at three world scales.
import { loadCoast, tripEstimate, recommendScale, fmtDuration } from './coast-data.js';

const SCALES = [6, 8, 10];
const MIN_SKERRY_GM = 2.5;      // smallest islet drawn, in GAME metres (= 15 m real at 1:6, 25 m real at 1:10)
const TARGET_S = 20 * 60;
const COVER_COL = {             // land-cover colours (Bohuslän palette from DESIGN.md: granite pink-grey, meadow greens, heather)
  bare_rock: [205, 183, 179], heath: [166, 122, 150], meadow: [168, 232, 81], scrub: [116, 170, 70], forest: [38, 96, 52], village: [232, 130, 60],
};
const $ = (id) => document.getElementById(id);
const canvas = $('map'), ctx = canvas.getContext('2d');
let C, S = 8, mode = 'terrain', zoom = 0.05, cx = 0, cy = 0, speed = 6;
const layers = { places: true, route: true, skerries: true };
const imgs = {};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c0, c1, t) => [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
function waterColor(depthM) {
  const SH = [118, 214, 214], MID = [47, 134, 192], DEEP = [18, 63, 120];
  return depthM < 12 ? mix(SH, MID, depthM / 12) : mix(MID, DEEP, Math.min(1, (depthM - 12) / 50));
}
function buildImage(kind) {
  const { width: W, height: H, land, depth, classes, meta } = C;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), id = x.createImageData(W, H), d = id.data;
  const names = meta.classes.map((c) => c.name);
  for (let p = 0; p < W * H; p++) {
    let c;
    if (land[p] > 0) {
      if (kind === 'cover') c = COVER_COL[names[classes[p]]] || [255, 0, 255];
      else c = mix([190, 160, 158], [238, 222, 214], Math.min(1, (land[p] - 1) / 10 / 70));
    } else c = waterColor(depth[p] / 10);
    d[p * 4] = c[0]; d[p * 4 + 1] = c[1]; d[p * 4 + 2] = c[2]; d[p * 4 + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return cv;
}

// world (game metres, origin = map top-left) <-> screen
const gm = () => C.mpp / S;                                  // game m per raster px
const toScreen = (gx, gy) => [(gx - cx) * zoom + canvas.width / 2, (gy - cy) * zoom + canvas.height / 2];
const toWorld = (sx, sy) => [(sx - canvas.width / 2) / zoom + cx, (sy - canvas.height / 2) / zoom + cy];
const lonLatToWorld = (lon, lat) => { const [px, py] = C.toPx(lon, lat); return [px * gm(), py * gm()]; };

function niceLength(maxGm) {
  let best = 1;
  for (const m of [1, 2, 5]) for (let k = 0; k < 6; k++) { const v = m * 10 ** k; if (v <= maxGm) best = Math.max(best, v); }
  return best;
}

function draw() {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b141b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!C) return;
  const k = zoom * gm();                                      // screen px per raster px
  const [ox, oy] = toScreen(0, 0);
  ctx.imageSmoothingEnabled = k < 1;
  ctx.drawImage((imgs[mode] ||= buildImage(mode)), ox, oy, C.width * k, C.height * k);
  const f = dpr;

  if (layers.skerries) {
    ctx.fillStyle = '#c4a8a3'; ctx.strokeStyle = '#7d625e'; ctx.lineWidth = 1 * f;
    for (const [lon, lat, wd] of C.skerries) {
      const [gx, gy] = lonLatToWorld(lon, lat), [sx, sy] = toScreen(gx, gy);
      if (sx < -10 || sy < -10 || sx > canvas.width + 10 || sy > canvas.height + 10) continue;
      const r = Math.max(Math.max(wd / S, MIN_SKERRY_GM) * zoom / 2, 0.9 * f);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); if (r > 2.5 * f) ctx.stroke();
    }
  }
  if (layers.route) {
    ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2.5 * f; ctx.setLineDash([8 * f, 5 * f]); ctx.beginPath();
    C.route.points.forEach(([lon, lat], i) => { const [sx, sy] = toScreen(...lonLatToWorld(lon, lat)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (layers.places) {
    ctx.font = `${12 * f}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
    const taken = [];
    const order = [...C.places].sort((a, b) => (a.kind === 'village') - (b.kind === 'village'));
    for (const p of order) {
      const [sx, sy] = toScreen(...lonLatToWorld(p.lon, p.lat));
      if (sx < -50 || sy < -20 || sx > canvas.width + 50 || sy > canvas.height + 20) continue;
      ctx.fillStyle = p.kind === 'lighthouse' ? '#ffd24a' : p.kind === 'fortress' ? '#ff9e6b' : p.kind === 'island' ? '#ffffff' : '#ff5d73';
      ctx.strokeStyle = '#000b'; ctx.lineWidth = 1.5 * f;
      ctx.beginPath();
      if (p.kind === 'lighthouse') { ctx.moveTo(sx, sy - 6 * f); ctx.lineTo(sx + 5 * f, sy + 4 * f); ctx.lineTo(sx - 5 * f, sy + 4 * f); ctx.closePath(); }
      else if (p.kind === 'fortress') { ctx.rect(sx - 4 * f, sy - 4 * f, 8 * f, 8 * f); }
      else ctx.arc(sx, sy, (p.kind === 'island' ? 3 : 4) * f, 0, 6.283);
      ctx.stroke(); ctx.fill();
      const tw = ctx.measureText(p.name).width, box = [sx + 8 * f, sy - 8 * f, tw + 4 * f, 16 * f];
      if (taken.some((b) => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1])) continue;
      taken.push(box);
      ctx.lineWidth = 3 * f; ctx.strokeStyle = '#000c'; ctx.strokeText(p.name, sx + 10 * f, sy);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name, sx + 10 * f, sy);
    }
  }
  // scale bar (game metres) + boat reference
  const bar = niceLength((canvas.width * 0.28) / zoom), bx = 16 * f, by = canvas.height - 40 * f;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000c'; ctx.lineWidth = 3 * f;
  ctx.beginPath(); ctx.moveTo(bx, by - 5 * f); ctx.lineTo(bx, by); ctx.lineTo(bx + bar * zoom, by); ctx.lineTo(bx + bar * zoom, by - 5 * f); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * f; ctx.stroke();
  ctx.font = `${12 * f}px system-ui, sans-serif`; ctx.textBaseline = 'alphabetic';
  const label = `${bar >= 1000 ? bar / 1000 + ' km' : bar + ' m'} game  =  ${((bar * S) / 1000).toFixed(bar * S < 1000 ? 2 : 1)} km real  (1:${S})`;
  ctx.lineWidth = 3 * f; ctx.strokeStyle = '#000c'; ctx.strokeText(label, bx, by - 9 * f); ctx.fillText(label, bx, by - 9 * f);
  if (6 * zoom >= 3 * f) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx, by + 8 * f, 6 * zoom, 4 * f); ctx.fillText('boat = 6 m', bx + 6 * zoom + 6 * f, by + 13 * f); }
}

function setScale(s) {
  const real = [cx * S, cy * S]; S = s; cx = real[0] / S; cy = real[1] / S;   // keep the same spot centred
  document.querySelectorAll('#scales button').forEach((b) => b.classList.toggle('on', +b.dataset.s === S));
  panels(); draw();
}
function fit() {
  const worldW = (C.width * C.mpp) / 6, worldH = (C.height * C.mpp) / 6;        // fit the BIGGEST world so all three fit
  zoom = Math.min(canvas.width / worldW, canvas.height / worldH) * 0.95;
  cx = (C.width * gm()) / 2; cy = (C.height * gm()) / 2; draw();
}

function panels() {
  const L = C.route.length_m, rec = recommendScale(L, SCALES, speed, TARGET_S);
  const mars = C.places.find((p) => p.name === 'Marstrand'), smog = C.places.find((p) => p.name === 'Smögen');
  const rad = (x) => (x * Math.PI) / 180, R = 6371008.8;
  const straight = 2 * R * Math.asin(Math.sqrt(Math.sin(rad(smog.lat - mars.lat) / 2) ** 2 + Math.cos(rad(mars.lat)) * Math.cos(rad(smog.lat)) * Math.sin(rad(smog.lon - mars.lon) / 2) ** 2));
  $('trip').innerHTML = '<tr><th>scale</th><th>game km</th><th>time</th><th>vs 20 min</th></tr>' + SCALES.map((s) => {
    const t = tripEstimate(L, s, speed), d = t.seconds - TARGET_S;
    return `<tr class="${s === rec ? 'rec' : ''}"><td>1:${s}${s === rec ? ' ★ closest' : ''}</td><td>${(t.gameMeters / 1000).toFixed(1)}</td><td>${fmtDuration(t.seconds)}</td><td>${d >= 0 ? '+' : '−'}${fmtDuration(Math.abs(d))}</td></tr>`;
  }).join('');
  const exact = L / (speed * TARGET_S);
  $('tripnote').textContent = `Route ${(L / 1000).toFixed(1)} km real along the outer islands (straight line ${(straight / 1000).toFixed(1)} km, open-sea alternative ${((C.route.offshoreLength_m || 0) / 1000).toFixed(1)} km), kept ≥ 100 m off land; its ends sit ${C.route.startSnap_m} m / ${C.route.endSnap_m} m outside Marstrand and Smögen where the harbours are too narrow for the clearance rule. Exactly 20 min at ${speed} m/s would be a scale of 1:${exact.toFixed(1)}. The pick between two scales flips if the real route is longer or shorter, so treat it as a guide.`;
  $('skerrynote').textContent = `Islets narrower than ${MIN_SKERRY_GM} game m are drawn ${MIN_SKERRY_GM} m wide (= ${MIN_SKERRY_GM * S} m real at 1:${S}; ${C.skerries.length} islets under 25 m wide in the data).`;

  const names = C.meta.classes.map((c) => c.name).slice(1);
  $('cover').innerHTML = '<tr><th>class</th><th>% of land</th><th>km² real</th></tr>' + names.map((n) =>
    `<tr><td><span class="sw" style="background:rgb(${COVER_COL[n]})"></span>${n.replace('_', ' ')}</td><td>${C.meta.classPercentOfLand[n]}</td><td>${C.meta.classKm2[n]}</td></tr>`).join('') +
    `<tr><td>land total</td><td>100</td><td>${C.meta.landKm2}</td></tr>`;

  const T = C.trees.totals['1:' + S];
  $('trees').innerHTML = '<tr><th>class</th><th>per 100 m²</th><th>trees</th></tr>' + names.map((n) =>
    `<tr><td>${n.replace('_', ' ')}</td><td>${C.trees.density[n]}</td><td>${T.byClass[n].toLocaleString()}</td></tr>`).join('') +
    `<tr><td><b>whole map</b></td><td></td><td><b>${T.total.toLocaleString()}</b></td></tr>`;
  const vd = C.trees.viewDisc.radii_m;
  $('treebox').innerHTML = T.total > C.trees.budget
    ? `<div class="box bad"><b>Too heavy for a phone.</b> ${T.total.toLocaleString()} trees is ${T.overBudgetBy}× the ${C.trees.budget.toLocaleString()} budget. Either scatter only around the boat (all-forest disc: ${vd[150]} trees at 150 m, ${vd[250]} at 250 m, ${vd[400]} at 400 m) or scale every density by ${T.densityScaleToFitBudget} for one map-wide pass.</div>`
    : `<div class="box ok">Within the ${C.trees.budget.toLocaleString()} tree budget.</div>`;
}

function hover(ev) {
  if (!C) return;
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  const [gx, gy] = toWorld((ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr);
  const i = Math.floor(gx / gm()), j = Math.floor(gy / gm());
  if (i < 0 || j < 0 || i >= C.width || j >= C.height) { $('status').textContent = 'outside the data'; return; }
  const m = C.meta, lon = m.bbox.w + (i + 0.5) * C.mpp / m.projection.metersPerDegLon, lat = m.bbox.n - (j + 0.5) * C.mpp / m.projection.metersPerDegLat;
  const where = C.isLand(i, j) ? `${m.classes[C.classes[j * C.width + i]].name.replace('_', ' ')} · ${C.heightM(i, j).toFixed(1)} m high` : `sea · depth ${C.depthM(i, j).toFixed(1)} m (placeholder model)`;
  $('status').textContent = `${lat.toFixed(4)} N  ${lon.toFixed(4)} E · ${where}`;
}

// pan / zoom
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx, cy }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
canvas.addEventListener('pointermove', (e) => {
  hover(e);
  if (!drag) return; const dpr = devicePixelRatio || 1;
  cx = drag.cx - ((e.clientX - drag.x) * dpr) / zoom; cy = drag.cy - ((e.clientY - drag.y) * dpr) / zoom; draw();
});
canvas.addEventListener('pointerup', () => { drag = null; canvas.classList.remove('drag'); });
function zoomAt(factor, sx, sy) {
  const [wx, wy] = toWorld(sx, sy); zoom = Math.max(0.005, Math.min(12, zoom * factor));
  cx = wx - (sx - canvas.width / 2) / zoom; cy = wy - (sy - canvas.height / 2) / zoom; draw();
}
canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1; zoomAt(Math.exp(-e.deltaY * 0.0015), (e.clientX - r.left) * d, (e.clientY - r.top) * d); }, { passive: false });
$('zin').onclick = () => zoomAt(1.5, canvas.width / 2, canvas.height / 2);
$('zout').onclick = () => zoomAt(1 / 1.5, canvas.width / 2, canvas.height / 2);
$('zfit').onclick = fit;
addEventListener('resize', draw);
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { mode = r.value; draw(); }));
for (const [id, key] of [['chkPlaces', 'places'], ['chkRoute', 'route'], ['chkSkerries', 'skerries']]) $(id).addEventListener('change', (e) => { layers[key] = e.target.checked; draw(); });
$('speed').addEventListener('input', (e) => { speed = Math.max(1, +e.target.value || 6); panels(); });
$('scales').innerHTML = SCALES.map((s) => `<button data-s="${s}">1:${s}</button>`).join('');
$('scales').addEventListener('click', (e) => { if (e.target.dataset.s) setScale(+e.target.dataset.s); });

try {
  C = await loadCoast(new URL('../assets/coast/', import.meta.url).href);
  $('loading').remove();
  canvas.width = canvas.clientWidth * (devicePixelRatio || 1); canvas.height = canvas.clientHeight * (devicePixelRatio || 1);
  setScale(8); fit();
} catch (err) {
  $('loading').textContent = 'Could not load coast data: ' + err.message;
  console.error(err);
}
