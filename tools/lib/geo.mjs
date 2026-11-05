// Coordinate maths for the coast build. Zero dependencies.

// Forward SWEREF99 TM (EPSG:3006): GRS80, Transverse Mercator, lon0 15 E,
// k0 0.9996, false easting 500000. Krueger series as published by Lantmateriet.
const A = 6378137, F = 1 / 298.257222101, K0 = 0.9996, LON0 = 15, FE = 500000;
const e2 = F * (2 - F), n = F / (2 - F);
const aHat = (A / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
const Ac = e2, Bc = (5 * e2 ** 2 - e2 ** 3) / 6, Cc = (104 * e2 ** 3 - 45 * e2 ** 4) / 120, Dc = 1237 * e2 ** 4 / 1260;
const b1 = n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180;
const b2 = 13 * n ** 2 / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440;
const b3 = 61 * n ** 3 / 240 - 103 * n ** 4 / 140;
const b4 = 49561 * n ** 4 / 161280;
const RAD = Math.PI / 180;

export function lonLatToSweref(lon, lat) {
  const phi = lat * RAD, dl = (lon - LON0) * RAD;
  const s = Math.sin(phi), c = Math.cos(phi);
  const phiS = phi - s * c * (Ac + Bc * s * s + Cc * s ** 4 + Dc * s ** 6);
  const xiP = Math.atan(Math.tan(phiS) / Math.cos(dl));
  const etaP = Math.atanh(Math.cos(phiS) * Math.sin(dl));
  let xi = xiP, eta = etaP;
  const bs = [b1, b2, b3, b4];
  for (let j = 1; j <= 4; j++) {
    xi += bs[j - 1] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
    eta += bs[j - 1] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
  }
  return { E: K0 * aHat * eta + FE, N: K0 * aHat * xi };
}

// Local flat game plane: equirectangular around the box centre. Over this box
// (0.6 deg lat) the longitude scale varies ~1.5 %, which is fine for a game map.
export const M_PER_DEG_LAT = 111195; // 6371008.8 m sphere
export function makePlane(bbox, mpp) {
  const latC = (bbox.s + bbox.n) / 2;
  const mLon = M_PER_DEG_LAT * Math.cos(latC * RAD);
  const W = Math.ceil(((bbox.e - bbox.w) * mLon) / mpp);
  const H = Math.ceil(((bbox.n - bbox.s) * M_PER_DEG_LAT) / mpp);
  return {
    W, H, mpp, mLon, latC,
    // lon/lat -> fractional pixel coords (x right, y down, 1 unit = 1 pixel)
    toPx: (lon, lat) => [((lon - bbox.w) * mLon) / mpp, ((bbox.n - lat) * M_PER_DEG_LAT) / mpp],
    toLonLat: (fx, fy) => [bbox.w + (fx * mpp) / mLon, bbox.n - (fy * mpp) / M_PER_DEG_LAT],
  };
}
