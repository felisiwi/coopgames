// The minimap (stage 1c), tuned for short hops: the next few hundred metres. Harbour mouths, nearby rocks and the way
// out stay readable. Fixed look (Felix's pick): a round map, north up.
//
// The picture comes from the game's own height field, not an image: depth in four shades of blue (so a channel reads),
// awash rocks hatched, land in parchment with low rock a shade darker, a dark coast line. It is built a few rows per
// frame into an off-screen canvas and re-built when the boat has moved 45 m, so sailing never hitches. The per-frame
// cost is one small drawImage plus a few dozen dots. Pure helpers first (testable in node), then the canvas part.
export const MINI = {
  spanM: 320, // the circle shows this many metres across
  rasterPx: 192, // height samples per side of the off-screen picture
  rowsPerFrame: 24,
  rebuildM: 45, // re-centre the picture when the boat is this far from its centre
  markRangeM: 200,
};
// The picture must cover the circle plus the rebuildM the boat may drift before it re-centres (with spare).
export const RASTER_M = MINI.spanM * Math.SQRT2;

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

// The boat arrow's angle on the north-up map. (Heading: the bow is (sin h, cos h) in (x east, z south); on screen, y is down; the
// arrow is drawn pointing up, so it is turned by pi - h.)
export const arrowAngle = (heading) => Math.PI - heading;

// Screen px inside the minimap (size px square) to the world point, for taps, and back. north-up, so no turn. boat: { x, z }.
export function miniToWorld(px, py, size, boat, spanM = MINI.spanM) {
  const k = size / spanM;
  return [boat.x + (px - size / 2) / k, boat.z + (py - size / 2) / k];
}
export function worldToMini(x, z, size, boat, spanM = MINI.spanM) {
  const k = size / spanM;
  return [size / 2 + (x - boat.x) * k, size / 2 + (z - boat.z) * k];
}

// ---- the canvas part -----------------------------------------------------------------------------------------------
// opts: { canvas, heightAt, inside(x, z), places: name-list entries, lights: [{ id, x, z, name }], marks: [{ x, z, kind }] }
export function createMinimap({ canvas, heightAt, places = [], lights = [], marks = [], makeCanvas = () => document.createElement('canvas') }) {
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
    marks, // the buoy list: the controller fills it once the life system has placed them
    // Call every frame. boat: { x, z }, heading in radians. Draws nothing when hidden (the chart is up).
    update(boat, heading, { hidden = false } = {}) {
      canvas.style.display = hidden ? 'none' : 'block';
      if (hidden) return;
      advance(boat);
      const W = canvas.width;
      const k = W / MINI.spanM;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgb(${MINI_COLORS.deep.join(',')})`;
      ctx.fillRect(0, 0, W, W);
      ctx.save();
      ctx.translate(W / 2, W / 2);
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
      ctx.rotate(arrowAngle(heading));
      ctx.fillStyle = '#ffcc66';
      ctx.strokeStyle = '#14222f';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 11); ctx.lineTo(0, 6); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    // A tap on the minimap (CSS px inside it): the lighthouse under the finger, or null.
    hitLight(px, py, cssSize, boat) {
      for (const l of lights) {
        const [x, y] = worldToMini(l.x, l.z, cssSize, boat);
        if (Math.hypot(x - px, y - py) <= 20) return l;
      }
      return null;
    },
  };
}
