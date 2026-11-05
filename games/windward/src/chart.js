// The chart (stage 1c): granddad's chart, drawn on a 2D canvas over the 3D view. It takes over from the boat view as you
// zoom out (src/zoom.js gives the view transform so the two line up), and keeps zooming out to the whole coast.
//   - two pictures: the shaded detail round the start (assets/chart/detail.png) and the parchment overview of the
//     whole coast (overview.png), both extracted from the approved Map Lab (see assets/chart/chart.json)
//   - the 7 chart sections; only the start section is "granddad's", the rest are uncharted (greyed, named)
//   - fog over what you have not sailed (src/explored.js), lifted smoothly
//   - names by the discovery rules: the real name (+ description) once discovered, the description alone for a place
//     whose fog has lifted, nothing for an undescribed skerry you have not found. Lighthouses are always on the chart.
// Pure helpers first (testable in node), then createChart (needs a canvas).
import { worldToScreen } from './zoom.js';

export const PAPER = '#efe3c8';
export const INK = '#3d3226';
export const SEA_PAPER = '#d4e2e0';
export const FOG_RGB = [236, 225, 201];
export const FOG_ALPHA = 0.93;
export const FOG_UP = 4; // fog picture pixels per cell side
export const LABEL_MIN_SCALE = 0.2; // px per metre: names appear from here (zoomed in); sections names below SECTION_MAX_SCALE
export const SECTION_MAX_SCALE = 0.35;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Fog picture: alpha 0 where explored, FOG_ALPHA where not, with soft edges. cells: Uint8Array (cols x rows, 1 = lifted).
// A 3x3 blur of the cells, then bilinear up-sampling, then a smoothstep to keep the edge from going muddy.
export function fogAlpha(cells, cols, rows, up = FOG_UP) {
  const blur = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let sum = 0;
      let n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const x = i + a;
        const y = j + b;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        sum += cells[y * cols + x]; n++;
      }
      blur[j * cols + i] = sum / n;
    }
  }
  const w = cols * up;
  const h = rows * up;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) / up - 0.5;
    const j0 = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
    const j1 = Math.min(rows - 1, j0 + 1);
    const ty = Math.max(0, Math.min(1, fy - j0));
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / up - 0.5;
      const i0 = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
      const i1 = Math.min(cols - 1, i0 + 1);
      const tx = Math.max(0, Math.min(1, fx - i0));
      const v = (blur[j0 * cols + i0] * (1 - tx) + blur[j0 * cols + i1] * tx) * (1 - ty) + (blur[j1 * cols + i0] * (1 - tx) + blur[j1 * cols + i1] * tx) * ty;
      out[y * w + x] = Math.round((1 - smooth(0.2, 0.8, v)) * FOG_ALPHA * 255);
    }
  }
  return { alpha: out, w, h };
}

// World rectangle {x0, z0, x1, z1} of a picture from its lon/lat bounds, with the coast's own projection.
export const boundsRect = (toGame, b) => { const [x0, z0] = toGame(b.W, b.N); const [x1, z1] = toGame(b.E, b.S); return { x0, z0, x1, z1 }; };

// The chart sections as world bands across the overview: [{ ...section, z0, z1 }] (z grows southward).
export function sectionBands(toGame, cfg) {
  const lonW = cfg.overview.W;
  return cfg.sections.map((s) => ({ ...s, z0: toGame(lonW, s.N)[1], z1: toGame(lonW, s.S)[1] }));
}
export const sectionAt = (bands, z) => bands.find((b) => z >= b.z0 && z < b.z1) || null;

// What the chart writes for a place (the discovery rules). known: has the real name been discovered; explored: has the fog
// over it lifted. Returns { title, sub, marker } or null when the chart shows nothing there. A lighthouse always has a marker.
export function chartLabel(entry, known, explored) {
  if (known) return { title: entry.name, sub: entry.desc || null, marker: true };
  if (entry.desc && explored) return { title: entry.desc, sub: null, marker: true, faded: true };
  if (entry.kind === 'light') return { title: null, sub: null, marker: true };
  return null;
}

// Greedy label placement: nearest-to-centre first; a label that would overlap one already placed is dropped.
export function placeLabels(items, W, H) {
  const placed = [];
  const hit = (a, b) => a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1;
  const out = [];
  for (const it of items) {
    const r = { x: it.sx - it.w / 2, y: it.sy - it.h - 8, w: it.w, h: it.h };
    if (r.x < 4 || r.y < 4 || r.x + r.w > W - 4 || r.y + r.h > H - 4) continue;
    if (placed.some((p) => hit(p, r))) continue;
    placed.push(r);
    out.push({ ...it, rect: r });
  }
  return out;
}

// ---- the canvas part -----------------------------------------------------------------------------------------------
// opts: { canvas, cfg (chart.json), toGame, entries (name list), isKnown(id), explored, lights: [{ id, name, x, z, inWindow, entry }],
//         baseUrl (folder of the pictures), makeCanvas, loadImage }
export function createChart({ canvas, cfg, toGame, entries, isKnown, explored, lights, baseUrl, makeCanvas = () => document.createElement('canvas'), loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }) }) {
  const ctx = canvas.getContext('2d');
  const detailRect = boundsRect(toGame, cfg.detail);
  const overRect = boundsRect(toGame, cfg.overview);
  const bands = sectionBands(toGame, cfg);
  const images = { detail: null, overview: null };
  let loading = null;
  const fog = { canvas: makeCanvas(), version: -1 };
  let lastHits = []; // tappable things from the last draw: { type, id, x, y, r, ... }

  function ensureLoaded() {
    if (!loading) {
      loading = Promise.all([loadImage(baseUrl + cfg.overview.file), loadImage(baseUrl + cfg.detail.file)])
        .then(([o, d]) => { images.overview = o; images.detail = d; })
        .catch(() => { loading = null; }); // try again next time (offline)
    }
    return loading;
  }
  function buildFog() {
    if (fog.version === explored.version) return;
    const { alpha, w, h } = fogAlpha(explored.cells, explored.cols, explored.rows);
    fog.canvas.width = w; fog.canvas.height = h;
    const c = fog.canvas.getContext('2d');
    const img = c.createImageData(w, h);
    for (let k = 0; k < alpha.length; k++) { img.data[k * 4] = FOG_RGB[0]; img.data[k * 4 + 1] = FOG_RGB[1]; img.data[k * 4 + 2] = FOG_RGB[2]; img.data[k * 4 + 3] = alpha[k]; }
    c.putImageData(img, 0, 0);
    fog.version = explored.version;
  }

  const font = (px, italic = false) => `${italic ? 'italic ' : ''}${px}px "IM Fell English", Georgia, serif`;

  return {
    ensureLoaded, detailRect, overRect, bands,
    get loaded() { return !!images.detail; },
    // view: zoom.js chartView(); W, H: CSS px; dpr; state: { boat: { x, z, heading }, visitId }
    draw(view, W, H, dpr, state) {
      canvas.style.opacity = String(view.alpha);
      canvas.style.display = view.alpha > 0.003 ? 'block' : 'none';
      if (view.alpha <= 0.003) return;
      ensureLoaded();
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = SEA_PAPER;
      ctx.fillRect(0, 0, W, H);
      const s = view.scale;
      // --- the pictures, in world space
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(s, s * view.sq); // metres -> px (the zoom), and the 3D view's tilt squash on the vertical
      ctx.rotate(view.rot);
      ctx.translate(-view.cx, -view.cz);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (images.overview) ctx.drawImage(images.overview, overRect.x0, overRect.z0, overRect.x1 - overRect.x0, overRect.z1 - overRect.z0);
      for (const b of bands) { // uncharted sections: greyed out
        if (b.owned) continue;
        ctx.fillStyle = 'rgba(239,227,200,0.36)'; // light enough that the coast still reads; the section names say "uncharted"
        ctx.fillRect(overRect.x0, b.z0, overRect.x1 - overRect.x0, b.z1 - b.z0);
      }
      if (images.detail) {
        ctx.drawImage(images.detail, detailRect.x0, detailRect.z0, detailRect.x1 - detailRect.x0, detailRect.z1 - detailRect.z0);
        ctx.fillStyle = 'rgba(239,227,200,0.16)';
        ctx.fillRect(detailRect.x0, detailRect.z0, detailRect.x1 - detailRect.x0, detailRect.z1 - detailRect.z0);
        buildFog();
        ctx.drawImage(fog.canvas, explored.rect.x0, explored.rect.z0, explored.cols * explored.cell, explored.rows * explored.cell);
      }
      // section frames: a dashed line across the overview at every band edge, red round the owned one
      ctx.lineWidth = 1 / s;
      for (const b of bands) {
        ctx.strokeStyle = b.owned ? '#b8432f' : 'rgba(61,50,38,0.45)';
        ctx.lineWidth = (b.owned ? 2.5 : 1) / s;
        ctx.setLineDash(b.owned ? [] : [6 / s, 5 / s]);
        ctx.strokeRect(overRect.x0, b.z0, overRect.x1 - overRect.x0, b.z1 - b.z0);
      }
      ctx.setLineDash([]);
      ctx.restore();
      // --- text and markers, in screen space (upright, whatever the chart's turn)
      const hits = [];
      ctx.textBaseline = 'alphabetic';
      const secA = 1 - smooth(SECTION_MAX_SCALE * 0.6, SECTION_MAX_SCALE, s);
      if (secA > 0.02) {
        ctx.globalAlpha = secA;
        ctx.font = '15px "IM Fell English SC", Georgia, serif';
        ctx.textAlign = 'right'; // against the right edge of the band, clear of the buttons on the left
        for (const b of bands) {
          const [sx, sy] = worldToScreen(view, W, H, overRect.x1, b.z0);
          const x = Math.min(W - 8, sx - 8);
          ctx.fillStyle = b.owned ? '#8a2f20' : 'rgba(61,50,38,0.78)';
          ctx.fillText(b.lore + (b.owned ? '' : ' · uncharted'), x, sy + 18);
          hits.push({ type: 'section', id: b.id, section: b, x: W / 2, y: sy + 10, r: 0 });
        }
        ctx.globalAlpha = 1;
      }
      const labelA = smooth(LABEL_MIN_SCALE * 0.7, LABEL_MIN_SCALE * 1.3, s);
      const drawn = [];
      for (const e of entries) {
        const known = isKnown(e.id);
        const lab = chartLabel(e, known, explored.isExplored(e.x, e.z));
        if (!lab) continue;
        const [sx, sy] = worldToScreen(view, W, H, e.x, e.z);
        if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) continue;
        const isLight = e.kind === 'light';
        if (!isLight && labelA < 0.02) continue;
        drawn.push({ e, lab, sx, sy, isLight, known });
      }
      for (const d of drawn) { // markers
        const { sx, sy, lab, isLight } = d;
        ctx.save();
        ctx.globalAlpha = isLight ? 1 : labelA;
        if (isLight) {
          const m = Math.max(0.5, Math.min(1, s / 0.25)); // smaller on the whole-coast view, where lights crowd
          ctx.fillStyle = '#f2c46d'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(sx, sy - 9 * m); ctx.lineTo(sx + 6.5 * m, sy + 5 * m); ctx.lineTo(sx - 6.5 * m, sy + 5 * m); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (state.visitId === d.e.id) { ctx.strokeStyle = '#b8432f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.stroke(); }
          hits.push({ type: 'light', id: d.e.id, entry: d.e, x: sx, y: sy, r: Math.max(16, 24 * m) });
        } else if (d.e.kind === 'village' || d.e.kind === 'harbour') {
          ctx.fillStyle = lab.faded ? 'rgba(61,50,38,0.45)' : INK; ctx.fillRect(sx - 4, sy - 4, 8, 8);
        } else {
          ctx.fillStyle = lab.faded ? 'rgba(61,50,38,0.4)' : '#8a7a6a'; ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 4, sy); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      if (labelA > 0.02) { // names, nearest the middle first, no overlaps
        const items = [];
        for (const d of drawn) {
          if (!d.lab.title) continue;
          ctx.font = font(d.lab.sub ? 16 : 15, !!d.lab.faded);
          const w = Math.max(ctx.measureText(d.lab.title).width, d.lab.sub ? 0.8 * ctx.measureText(d.lab.sub).width : 0);
          items.push({ ...d, w, h: d.lab.sub ? 30 : 17, dist: Math.hypot(d.sx - W / 2, d.sy - H / 2) });
        }
        items.sort((a, b) => (b.isLight - a.isLight) || a.dist - b.dist);
        ctx.textAlign = 'center';
        ctx.globalAlpha = labelA;
        for (const it of placeLabels(items, W, H)) {
          ctx.font = font(it.lab.sub ? 16 : 15, !!it.lab.faded);
          ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(239,227,200,0.92)'; ctx.fillStyle = it.lab.faded ? 'rgba(61,50,38,0.62)' : INK;
          const y = it.rect.y + (it.lab.sub ? 14 : 13);
          ctx.strokeText(it.lab.title, it.sx, y); ctx.fillText(it.lab.title, it.sx, y);
          if (it.lab.sub) { ctx.font = '11px "IM Fell English SC", Georgia, serif'; ctx.fillStyle = 'rgba(61,50,38,0.75)'; ctx.fillText(it.lab.sub, it.sx, y + 13); }
        }
        ctx.globalAlpha = 1;
      }
      // the boat
      const [bx, by] = worldToScreen(view, W, H, state.boat.x, state.boat.z);
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = '#b8432f'; ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      lastHits = hits;
    },
    // A tap at (sx, sy) CSS px: { type: 'light', entry } | { type: 'section', section } | null. Lights first.
    hit(sx, sy, view, W, H) {
      let best = null;
      for (const h of lastHits) {
        if (h.type !== 'light') continue;
        const d = Math.hypot(h.x - sx, h.y - sy);
        if (d <= h.r && (!best || d < best.d)) best = { d, h };
      }
      if (best) return { type: 'light', entry: best.h.entry };
      if (view.scale < SECTION_MAX_SCALE) {
        const z = (sy - H / 2) / (view.scale * view.sq); // used only to find the band: undo the squash, and the turn (rot = 0 here)
        const world = view.cz + z;
        const b = sectionAt(bands, world);
        if (b) return { type: 'section', section: b };
      }
      return null;
    },
    get hits() { return lastHits; },
  };
}
