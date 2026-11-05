// Loader for the real-coast data in assets/coast/ (built by tools/build-coast.mjs).
// Pure browser/Node-18+ code: decodes the 16-bit PNGs itself, because drawing
// them on a <canvas> would squash them to 8 bits.

export async function decodePngBytes(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8, width = 0, height = 0, bitDepth = 8, colorType = 0;
  const idat = [];
  while (p < bytes.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (type === 'IHDR') { width = dv.getUint32(p + 8); height = dv.getUint32(p + 12); bitDepth = bytes[p + 16]; colorType = bytes[p + 17]; }
    else if (type === 'IDAT') idat.push(bytes.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (colorType !== 0) throw new Error('coast PNG must be greyscale');
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let o = 0; for (const c of idat) { joined.set(c, o); o += c.length; }
  const raw = new Uint8Array(await new Response(new Blob([joined]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const bpp = bitDepth / 8, rowBytes = width * bpp, out = new Uint8Array(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (rowBytes + 1)], src = y * (rowBytes + 1) + 1, dst = y * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? out[dst + i - bpp] : 0, b = y ? out[dst - rowBytes + i] : 0, c = y && i >= bpp ? out[dst - rowBytes + i - bpp] : 0;
      let v = raw[src + i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + i] = v & 255;
    }
  }
  let data = out;
  if (bitDepth === 16) { data = new Uint16Array(width * height); for (let i = 0; i < data.length; i++) data[i] = (out[2 * i] << 8) | out[2 * i + 1]; }
  return { width, height, bitDepth, data };
}

// baseUrl: folder holding the coast files, with trailing slash. fetchBytes/fetchJson injectable for tests.
export async function loadCoast(baseUrl, io = {}) {
  const getJson = io.json || (async (u) => (await fetch(u)).json());
  const getBytes = io.bytes || (async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer()));
  const [meta, places, skerries, route, trees, landH, depth, classes] = await Promise.all([
    getJson(baseUrl + 'meta.json'), getJson(baseUrl + 'places.json'), getJson(baseUrl + 'skerries.json'),
    getJson(baseUrl + 'route.json'), getJson(baseUrl + 'trees.json'),
    getBytes(baseUrl + 'land-height.png').then(decodePngBytes), getBytes(baseUrl + 'depth.png').then(decodePngBytes),
    getBytes(baseUrl + 'classes.png').then(decodePngBytes),
  ]);
  const { bbox, width, height, metersPerPixelReal: mpp } = meta;
  const mLat = meta.projection.metersPerDegLat, mLon = meta.projection.metersPerDegLon;
  return {
    meta, places: places.places, notFound: places.notFound, skerries: skerries.skerries, route, trees,
    width, height, mpp, land: landH.data, depth: depth.data, classes: classes.data,
    // lon/lat -> raster pixel coords (fractional; y down)
    toPx: (lon, lat) => [((lon - bbox.w) * mLon) / mpp, ((bbox.n - lat) * mLat) / mpp],
    isLand: (i, j) => landH.data[j * width + i] > 0,
    heightM: (i, j) => Math.max(0, (landH.data[j * width + i] - 1) / 10),
    depthM: (i, j) => depth.data[j * width + i] / 10,
  };
}

// Trip time for a route of `realMeters` at world scale 1:`scale` and an average game speed (m/s).
export function tripEstimate(realMeters, scale, speedMs) {
  const gameMeters = realMeters / scale;
  return { gameMeters, seconds: gameMeters / speedMs };
}
export function recommendScale(realMeters, scales, speedMs, targetSeconds = 20 * 60) {
  return scales.reduce((best, s) => (Math.abs(tripEstimate(realMeters, s, speedMs).seconds - targetSeconds) < Math.abs(tripEstimate(realMeters, best, speedMs).seconds - targetSeconds) ? s : best), scales[0]);
}
export const fmtDuration = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;
