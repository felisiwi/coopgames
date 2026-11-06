// THE GHOST CHART (felix/windward-1700-preview).
//
// After the jump to 1700 the player keeps what they learned (GAME-DESIGN "What crosses a jump": chart sections travel). The Today chart is
// still in their hands, but it is old: it draws the coast as it was, in faint PENCIL, land outlines only (no names, no marks, no harbours,
// no lights). As you sail in 1700, the sea you pass over is INKED in: the real 1700 shore (the sea stood higher, low land is gone)
// in dark ink, land and sea tinted like the game's chart. Pencil and ink disagree a little where the water level moved the shore.
//
//   shoreSegments(world)       the shoreline of a world's height field as line segments (marching squares, pure)
//   inkRaster(world, explored) the inked picture: land / sea tint, alpha from the explored cells (the game's fog smoothing)
//   demoExplored(...)          a stand-in "explored Today chart" for a device with no saved game
//   createGhostChart(...)      the model: both shore sets, both explored grids, a cached ink picture
//   drawGhostChart(ctx, ...)   draws it; the pencil and ink layers only ever stroke lines and fill areas, never text
//   revealedLabels / drawNames the one place text appears: a place's OLD name, once the ink covers it (the game's own 'seen' rule,
//                              src/seen.js: revealed land within 150 m of the label point), and only where a name is documented
//
// Pure apart from the 2D context passed to drawGhostChart (a recording stub in the tests). The explored grid is src/explored.js, the
// fog smoothing src/chart.js fogAlpha(): the same machinery as the game's chart, so the inking-in looks like the game's fog lifting.
import { createExplored } from './explored.js';
import { SEEN_MAX_REACH_M } from './seen.js';
import { fogAlpha, FOG_ALPHA, PAPER, INK, SEA_PAPER } from './chart.js';

export const INK_EXPLORED_KEY = 'windward.explored.1700.v1'; // the lab's own: never the game's `windward.explored.v1`
export const SHEET = '#ece1c9'; // the unexplored sheet: the game's fog colour (chart.js FOG_RGB), plain
export const PENCIL = { rgb: '78,72,66', alpha: 0.42, alphaInked: 0.2, width: 1 };
export const INK_LINE = { colour: INK, width: 1.5 };

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const LAND_RGB = hex(PAPER), SEA_RGB = hex(SEA_PAPER);

// ---- shoreline contours ---------------------------------------------------------------------------------------
// H: the world's height field (> iso is land), nx x nz cells, cell (a, b) centre at x0 + (a + 0.5) * pxM. Returns Float32Array [x0, z0, x1, z1, ...]
// in game metres. Marching squares with linear interpolation; saddles take the "two separate bits of land" reading.
export function shoreSegments(H, nx, nz, x0, z0, pxM, iso = 0) {
  const out = [];
  const t = (p, q) => (iso - p) / (q - p);
  const push = (ax, az, bx, bz) => out.push(x0 + ax * pxM, z0 + az * pxM, x0 + bx * pxM, z0 + bz * pxM);
  for (let b = 0; b < nz - 1; b++) {
    for (let a = 0; a < nx - 1; a++) {
      const k = b * nx + a;
      const v0 = H[k], v1 = H[k + 1], v2 = H[k + nx + 1], v3 = H[k + nx]; // TL, TR, BR, BL
      const m = (v0 > iso ? 1 : 0) | (v1 > iso ? 2 : 0) | (v2 > iso ? 4 : 0) | (v3 > iso ? 8 : 0);
      if (m === 0 || m === 15) continue;
      const px = a + 0.5, pz = b + 0.5;
      const T = [px + t(v0, v1), pz], R = [px + 1, pz + t(v1, v2)], B = [px + t(v3, v2), pz + 1], L = [px, pz + t(v0, v3)];
      const seg = (p, q) => push(p[0], p[1], q[0], q[1]);
      switch (m) {
        case 1: case 14: seg(L, T); break;
        case 2: case 13: seg(T, R); break;
        case 4: case 11: seg(R, B); break;
        case 8: case 7: seg(L, B); break;
        case 3: case 12: seg(L, R); break;
        case 6: case 9: seg(T, B); break;
        case 5: seg(L, T); seg(R, B); break;
        case 10: seg(T, R); seg(L, B); break;
        default: break;
      }
    }
  }
  return Float32Array.from(out);
}
export const worldShore = (world) => shoreSegments(world.H, world.nx, world.nz, world.x0, world.z0, world.pxM);

// ---- the explored grids ---------------------------------------------------------------------------------------
// A storage that can be read but never written: the lab shows the game's saved Today chart without ever touching it.
export const readOnlyStorage = (storage) => (storage ? { getItem: (k) => storage.getItem(k), setItem: () => {}, removeItem: () => {} } : null);

// A believable early-game Today chart for a device with no saved game: discs of fog lifted along a route from point to point
// (points: [{ x, z }]), stepped every `stepM` metres. Used for ?ghost=demo and when nothing is saved.
export function demoExplored(rect, points, { radius = 160, stepM = 40 } = {}) {
  const ex = createExplored(rect, { storage: null });
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / stepM));
    for (let k = 0; k <= n; k++) ex.reveal(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n, radius);
  }
  return ex;
}
export function fullExplored(rect) {
  const ex = createExplored(rect, { storage: null });
  ex.reveal((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2, Math.hypot(rect.x1 - rect.x0, rect.z1 - rect.z0));
  return ex;
}

// ---- the ink picture -------------------------------------------------------------------------------------------
// RGBA for the whole explored grid at `up` pixels per cell: land / sea tint of the 1700 world, alpha where the fog is lifted (smooth edge).
export function inkRaster(world, explored, up = 4) {
  const { alpha, w, h } = fogAlpha(explored.cells, explored.cols, explored.rows, up);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const r = explored.rect;
  const pw = (r.x1 - r.x0) / w, ph = (r.z1 - r.z0) / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fog = alpha[y * w + x]; // 0 where explored .. FOG_ALPHA * 255 where not
      const inked = 255 * (1 - fog / (FOG_ALPHA * 255)); // 255 where explored .. 0 in full fog
      const k = (y * w + x) * 4;
      if (inked <= 2) continue;
      const land = world.heightAt(r.x0 + (x + 0.5) * pw, r.z0 + (y + 0.5) * ph) > 0;
      const c = land ? LAND_RGB : SEA_RGB;
      rgba[k] = c[0]; rgba[k + 1] = c[1]; rgba[k + 2] = c[2]; rgba[k + 3] = Math.min(255, inked);
    }
  }
  return { rgba, w, h, rect: r };
}

// ---- the model ----------------------------------------------------------------------------------------------------
// today / era: { world } (the two built worlds); todayExplored: the old chart (read only); inkExplored: this era's, the one that grows.
export function createGhostChart({ today, era, todayExplored, inkExplored, source = 'saved' }) {
  const segsToday = worldShore(today.world);
  const segsEra = worldShore(era.world);
  let pic = null, picVersion = -1;
  return {
    segsToday, segsEra, todayExplored, inkExplored, source, rect: inkExplored.rect,
    // the ink picture, rebuilt only when the explored grid grew
    ink() {
      if (picVersion !== inkExplored.version || !pic) { pic = inkRaster(era.world, inkExplored); picVersion = inkExplored.version; }
      return { ...pic, version: picVersion };
    },
    stats() {
      const count = (segs, ex) => { let n = 0; for (let i = 0; i < segs.length; i += 4) if (ex.isExplored((segs[i] + segs[i + 2]) / 2, (segs[i + 1] + segs[i + 3]) / 2)) n++; return n; };
      return { pencilSegments: count(segsToday, todayExplored), inkSegments: count(segsEra, inkExplored), inkedCells: inkExplored.count(), todayCells: todayExplored.count(), source };
    },
  };
}

// ---- names: the old name of a place comes back once the inked chart covers it --------------------------------------------
// labels: the era's labels [{ id, x, z, text, year, uncertain }] (text null where no name is documented: never shown);
// seen: a src/seen.js createSeen() over the INK grid, so the rule is the game's: some revealed land within 150 m (SEEN_MAX_REACH_M) of
// the label point. Seen once = seen for good (until the ink is reset: call seen.setExplored again).
export function revealedLabels(labels, seen) {
  return labels.filter((l) => l.text && seen.isSeen({ id: l.id, x: l.x, z: l.z, radius: SEEN_MAX_REACH_M }));
}
export const NAME_STYLE = { font: '600 12px system-ui, sans-serif', fontUncertain: 'italic 600 12px system-ui, sans-serif', ink: INK, halo: 'rgba(236,225,201,0.92)' };
export function drawNames(ctx, view, W, H, names) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  for (const n of names) {
    const x = (n.x - view.cx) * view.scale + W / 2, y = (n.z - view.cz) * view.scale + H / 2 - 7;
    ctx.font = n.uncertain ? NAME_STYLE.fontUncertain : NAME_STYLE.font;
    ctx.strokeStyle = NAME_STYLE.halo; ctx.strokeText(n.text, x, y); // a paper halo so the name reads over the ink lines
    ctx.fillStyle = NAME_STYLE.ink; ctx.fillText(n.text, x, y);
  }
  return names.length;
}

// A view that fits the whole chart rectangle in W x H pixels with a margin: { cx, cz, scale } (px per game metre).
export function fitView(rect, W, H, margin = 18) {
  const scale = Math.min((W - 2 * margin) / (rect.x1 - rect.x0), (H - 2 * margin) / (rect.z1 - rect.z0));
  return { cx: (rect.x0 + rect.x1) / 2, cz: (rect.z0 + rect.z1) / 2, scale };
}

// The world rectangle that holds every lifted cell of the given explored grids (null if none): the chart opens on what there is to see.
export function exploredBounds(grids, pad = 60) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const g of grids) {
    for (let k = 0; k < g.cells.length; k++) {
      if (!g.cells[k]) continue;
      const i = k % g.cols, j = (k - i) / g.cols;
      x0 = Math.min(x0, g.rect.x0 + i * g.cell); x1 = Math.max(x1, g.rect.x0 + (i + 1) * g.cell);
      z0 = Math.min(z0, g.rect.z0 + j * g.cell); z1 = Math.max(z1, g.rect.z0 + (j + 1) * g.cell);
    }
  }
  return Number.isFinite(x0) ? { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad } : null;
}

const hash01 = (i) => (((i * 2654435761) >>> 0) % 10007) / 10007;

// Draws the chart. ctx: a 2D context (or the test stub); inkImage: a canvas / image of the ink picture (inkRaster) or null.
// boat: { x, z, heading } or null. north up (z grows southward = down the screen). Returns what it drew, for tests.
export function drawGhostChart(ctx, W, H, view, model, boat = null, inkImage = null, names = []) {
  const sx = (x) => (x - view.cx) * view.scale + W / 2;
  const sy = (z) => (z - view.cz) * view.scale + H / 2;
  ctx.fillStyle = SHEET;
  ctx.fillRect(0, 0, W, H);
  const r = model.rect;
  if (inkImage) { // the inked sea and land, soft-edged by the picture's own alpha
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(inkImage, sx(r.x0), sy(r.z0), (r.x1 - r.x0) * view.scale, (r.z1 - r.z0) * view.scale);
  }
  const stats = { pencil: 0, pencilInked: 0, ink: 0, names: 0 };
  // PENCIL: today's shore, only where the old chart was explored; fainter where the new ink already covers it. Two passes, the second
  // nudged a little with a lighter hand: a pencil line, not a vector one.
  const T = model.segsToday;
  const free = [], covered = [];
  for (let i = 0; i < T.length; i += 4) {
    const mx = (T[i] + T[i + 2]) / 2, mz = (T[i + 1] + T[i + 3]) / 2;
    if (!model.todayExplored.isExplored(mx, mz)) continue;
    (model.inkExplored.isExplored(mx, mz) ? covered : free).push(i);
  }
  const stroke = (list, alpha, dx, dy, wob) => {
    if (!list.length) return;
    ctx.strokeStyle = `rgba(${PENCIL.rgb},${alpha})`;
    ctx.lineWidth = PENCIL.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const i of list) { const j = wob ? (hash01(i) - 0.5) * 0.9 : 0; ctx.moveTo(sx(T[i]) + dx + j, sy(T[i + 1]) + dy - j); ctx.lineTo(sx(T[i + 2]) + dx + j, sy(T[i + 3]) + dy - j); }
    ctx.stroke();
  };
  stroke(free, PENCIL.alpha, 0, 0, true); stroke(free, PENCIL.alpha * 0.55, 0.6, 0.45, true);
  stroke(covered, PENCIL.alphaInked, 0, 0, true);
  stats.pencil = free.length; stats.pencilInked = covered.length;
  // INK: this era's shore where you have sailed
  const E = model.segsEra;
  ctx.strokeStyle = INK_LINE.colour;
  ctx.lineWidth = INK_LINE.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < E.length; i += 4) {
    if (!model.inkExplored.isExplored((E[i] + E[i + 2]) / 2, (E[i + 1] + E[i + 3]) / 2)) continue;
    ctx.moveTo(sx(E[i]), sy(E[i + 1])); ctx.lineTo(sx(E[i + 2]), sy(E[i + 3]));
    stats.ink++;
  }
  if (stats.ink) ctx.stroke();
  stats.names = names.length ? drawNames(ctx, view, W, H, names) : 0; // old names of places the ink has reached; none otherwise
  if (boat) { // you: a small ink triangle pointing the way you head
    const bx = sx(boat.x), by = sy(boat.z), s = 8;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-boat.heading); // heading 0 = south (down the screen), turning towards east: canvas rotation is clockwise, so negative
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(s * 0.6, -s * 0.7); ctx.lineTo(0, -s * 0.3); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return stats;
}
