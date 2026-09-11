// Minimal seedable 2D simplex noise. Vendored (no CDN, no npm dep) —
// algorithm follows Stefan Gustavson's public-domain reference
// implementation; permutation table is built from CONFIG's seed via a
// small deterministic PRNG so the same seed always produces the same
// island.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD3 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [1, 0], [-1, 0],
  [0, 1], [0, -1], [0, 1], [0, -1],
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class SimplexNoise2D {
  constructor(seed = 1) {
    const rand = mulberry32(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = perm[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise2D(xin, yin) {
    const { perm, permMod12 } = this;
    let n0, n1, n2;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    n0 = t0 < 0 ? 0 : ((t0 *= t0), t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0));

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    n1 = t1 < 0 ? 0 : ((t1 *= t1), t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1));

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    n2 = t2 < 0 ? 0 : ((t2 *= t2), t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2));

    return 70 * (n0 + n1 + n2);
  }
}
