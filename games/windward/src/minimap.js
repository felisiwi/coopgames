// The minimap (stage 1c), tuned for short hops: the next few hundred metres. Harbour mouths, nearby rocks and the way
// out stay readable. Like the Map Lab: round or square, north-up or turning with the boat, or off.
//
// The picture comes from the game's own height field, not an image: depth in four shades of blue (so a channel reads),
// awash rocks hatched, land in parchment with low rock a shade darker, a dark coast line. It is built a few rows per
// frame into an off-screen canvas and re-built when the boat has moved 45 m, so sailing never hitches. The per-frame
// cost is one small drawImage plus a few dozen dots. Pure helpers first (testable in node), then the canvas part.
export const MINI_KEY = 'windward.minimap.v1';
export const MINI = {
  spanM: 320, // the circle (or square) shows this many metres across
  rasterPx: 192, // height samples per side of the off-screen picture
  rowsPerFrame: 24,
  rebuildM: 45, // re-centre the picture when the boat is this far from its centre
  markRangeM: 200,
};
// The picture must cover the circle at ANY rotation: its side is the span times the square root of two.
export const RASTER_M = MINI.spanM * Math.SQRT2;

export const MINI_DEFAULTS = { shape: 'round', rot: 'north' }; // shape: round | square | off; rot: north | heading
export function loadMiniSettings(storage = null) {
  const out = { ...MINI_DEFAULTS };
  try {
    const d = JSON.parse((storage && storage.getItem(MINI_KEY)) || 'null');
    if (d && ['round', 'square', 'off'].includes(d.shape)) out.shape = d.shape;
    if (d && ['north', 'heading'].includes(d.rot)) out.rot = d.rot;
  } catch { /* unreadable: defaults */ }
  return out;
}
export function saveMiniSettings(storage, s) {
  try { storage?.setItem(MINI_KEY, JSON.stringify({ shape: s.shape, rot: s.rot })); } catch { /* blocked: carry on */ }
}

// Colour (r, g, b) for a sea-floor / land height (game metres: negative = depth, positive = above the sea).
export const MINI_COLORS = {
  deep: [77, 125, 157], mid: [106, 151, 178], shelf: [143, 184, 200], shallow: [190, 221, 219],
  awash: [150, 166, 148], rock: [205, 191, 168], land: [233, 221, 190], high: [210, 194, 157], coast: [92, 78, 58],
};
export function miniColor(h) {
  const C = MINI_COLORS;
  if (h <= -8) return C.deep;
  if (h <= -3) return C.mid;
  if (h <= -1.2) return C.shelf;
  if (h <= -0.3) return C.shallow;
  if (h < 0.25) return C.awash; // breaking / awash: the hazard
  if (h < 1.7) return C.rock; // low rock and skerries
  return h > 8 ? C.high : C.land;
}
export const isLandHeight = (h) => h >= 0.25;

// Heights on a side x side grid centred on (cx, cz), `span` metres across, north-up (row = +z = south). rows [r0, r1).
export function bakeHeights(heightAt, cx, cz, span, side, out, r0 = 0, r1 = side) {
  const mpp = span / side;
  for (let j = r0; j < r1; j++) {
    const z = cz - span / 2 + (j + 0.5) * mpp;
    for (let i = 0; i < side; i++) out[j * side + i] = heightAt(cx - span / 2 + (i + 0.5) * mpp, z);
  }
  return out;
}

// RGBA pixels from a height grid: colour by height, and a dark 1 px coast line where land meets water.
export function colorize(heights, side, rgba = new Uint8ClampedArray(side * side * 4)) {
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const k = j * side + i;
      const h = heights[k];
      let c = miniColor(h);
      if (isLandHeight(h)) {
        const wet = (i > 0 && !isLandHeight(heights[k - 1])) || (i < side - 1 && !isLandHeight(heights[k + 1]))
          || (j > 0 && !isLandHeight(heights[k - side])) || (j < side - 1 && !isLandHeight(heights[k + side]));
        if (wet) c = MINI_COLORS.coast;
      } else if (h > -0.3 && ((i + j) & 1) === 0) {
        c = MINI_COLORS.shallow; // hatch the awash band: rocks you can hit
      }
      rgba[k * 4] = c[0]; rgba[k * 4 + 1] = c[1]; rgba[k * 4 + 2] = c[2]; rgba[k * 4 + 3] = 255;
    }
  }
  return rgba;
}

// Heading-up: rotate the north-up picture so the bow points up the screen. (Heading: the bow is (sin h, cos h) in
// (x east, z south); on screen, y is down.) And the boat arrow's angle when the map stays north-up.
export const headingRotation = (heading) => heading - Math.PI;
export const arrowAngle = (heading) => Math.PI - heading;

// Screen px inside the minimap (size px square) to the world point, for taps. boat: { x, z }.
export function miniToWorld(px, py, size, boat, heading, rot, spanM = MINI.spanM) {
  const k = size / spanM;
  let dx = (px - size / 2) / k;
  let dz = (py - size / 2) / k;
  if (rot === 'heading') { // undo the rotation of the picture
    const a = -headingRotation(heading);
    const c = Math.cos(a);
    const s = Math.sin(a);
    [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
  }
  return [boat.x + dx, boat.z + dz];
}
export function worldToMini(x, z, size, boat, heading, rot, spanM = MINI.spanM) {
  const k = size / spanM;
  let dx = (x - boat.x) * k;
  let dz = (z - boat.z) * k;
  if (rot === 'heading') {
    const a = headingRotation(heading);
    const c = Math.cos(a);
    const s = Math.sin(a);
    [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
  }
  return [size / 2 + dx, size / 2 + dz];
}

// ---- the canvas part -----------------------------------------------------------------------------------------------
// opts: { canvas, heightAt, inside(x, z), places: name-list entries, lights: [{ id, x, z, name }], marks: [{ x, z, kind }], settings }
export function createMinimap({ canvas, heightAt, places = [], lights = [], marks = [], settings = { ...MINI_DEFAULTS }, makeCanvas = () => document.createElement('canvas') }) {
  const ctx = canvas.getContext('2d');
  const side = MINI.rasterPx;
  const heights = new Float32Array(side * side);
  const off = makeCanvas();
  off.width = side; off.height = side;
  const offCtx = off.getContext('2d');
  const image = offCtx.createImageData(side, side);
  const raster = { cx: NaN, cz: NaN, ready: false };
  let job = null; // { cx, cz, row }
  const harbours = places.filter((p) => p.kind === 'village' || p.kind === 'harbour');
  const COLORS = { red: '#c2493d', green: '#4f9a6a', yellow: '#e0b84c' };

  function advance(boat) {
    if (!job && (!raster.ready || Math.hypot(boat.x - raster.cx, boat.z - raster.cz) > MINI.rebuildM)) job = { cx: boat.x, cz: boat.z, row: 0 };
    if (!job) return;
    const r1 = Math.min(side, job.row + MINI.rowsPerFrame);
    bakeHeights(heightAt, job.cx, job.cz, RASTER_M, side, heights, job.row, r1);
    job.row = r1;
    if (r1 >= side) {
      colorize(heights, side, image.data);
      offCtx.putImageData(image, 0, 0);
      raster.cx = job.cx; raster.cz = job.cz; raster.ready = true;
      job = null;
    }
  }

  return {
    settings,
    marks, // the buoy list: the controller fills it once the life system has placed them
    get visible() { return settings.shape !== 'off'; },
    // Call every frame. boat: { x, z }, heading in radians. Draws nothing when the minimap is off or hidden.
    update(boat, heading, { hidden = false } = {}) {
      const show = settings.shape !== 'off' && !hidden;
      canvas.style.display = show ? 'block' : 'none';
      canvas.style.borderRadius = settings.shape === 'square' ? '14px' : '50%';
      if (!show) return;
      advance(boat);
      const W = canvas.width;
      const k = W / MINI.spanM;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgb(${MINI_COLORS.deep.join(',')})`;
      ctx.fillRect(0, 0, W, W);
      ctx.save();
      ctx.translate(W / 2, W / 2);
      if (settings.rot === 'heading') ctx.rotate(headingRotation(heading));
      if (raster.ready) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, (raster.cx - boat.x) * k - (RASTER_M * k) / 2, (raster.cz - boat.z) * k - (RASTER_M * k) / 2, RASTER_M * k, RASTER_M * k);
      }
      const range = MINI.markRangeM;
      for (const m of marks) { // buoys: the way in and out
        if (Math.abs(m.x - boat.x) > range || Math.abs(m.z - boat.z) > range) continue;
        ctx.fillStyle = COLORS[m.kind] || '#fff';
        ctx.strokeStyle = 'rgba(20,34,48,.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc((m.x - boat.x) * k, (m.z - boat.z) * k, 3.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      for (const p of harbours) { // harbour mouths: a white square (village) or ring (natural harbour)
        if (Math.abs(p.x - boat.x) > range || Math.abs(p.z - boat.z) > range) continue;
        const x = (p.x - boat.x) * k;
        const y = (p.z - boat.z) * k;
        ctx.fillStyle = '#f4f6f2';
        ctx.strokeStyle = '#2b3b48';
        ctx.lineWidth = 1.5;
        if (p.kind === 'village') { ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10); }
        else { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke(); }
      }
      for (const l of lights) { // lighthouses: a gold triangle
        const x = (l.x - boat.x) * k;
        const y = (l.z - boat.z) * k;
        if (Math.abs(x) > W || Math.abs(y) > W) continue;
        ctx.fillStyle = '#f2c46d';
        ctx.strokeStyle = '#3d3226';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x - 7, y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); // the boat, always in the middle
      ctx.translate(W / 2, W / 2);
      ctx.rotate(settings.rot === 'heading' ? 0 : arrowAngle(heading));
      ctx.fillStyle = '#ffcc66';
      ctx.strokeStyle = '#14222f';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 11); ctx.lineTo(0, 6); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    // A tap on the minimap (CSS px inside it): the lighthouse under the finger, or null.
    hitLight(px, py, cssSize, boat, heading) {
      for (const l of lights) {
        const [x, y] = worldToMini(l.x, l.z, cssSize, boat, heading, settings.rot);
        if (Math.hypot(x - px, y - py) <= 20) return l;
      }
      return null;
    },
  };
}
