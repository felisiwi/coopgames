// Minimal PNG encoder, zero dependencies. Greyscale 8/16-bit or RGB 8-bit.
// Adaptive row filtering (None/Sub/Up/Paeth, smallest sum of |bytes| wins)
// keeps smooth rasters small.
import zlib from 'node:zlib';

function chunk(type, data) {
  const t = Buffer.from(type, 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}

export function encodePng({ width, height, bitDepth = 8, colorType = 0, data }) {
  const channels = colorType === 2 ? 3 : 1;
  const bpp = (bitDepth / 8) * channels;
  const rowBytes = width * bpp;
  const rows = new Array(height);
  for (let y = 0; y < height; y++) {
    const r = Buffer.alloc(rowBytes);
    if (bitDepth === 16) for (let x = 0; x < width; x++) { const v = data[y * width + x]; r[x * 2] = v >> 8; r[x * 2 + 1] = v & 255; }
    else for (let i = 0; i < rowBytes; i++) r[i] = data[y * rowBytes + i];
    rows[y] = r;
  }
  const raw = Buffer.alloc(height * (rowBytes + 1));
  const cand = [0, 1, 2, 3].map(() => Buffer.alloc(rowBytes));
  const zero = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y++) {
    const cur = rows[y], up = y ? rows[y - 1] : zero;
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = up[i], c = i >= bpp ? up[i - bpp] : 0;
      cand[0][i] = cur[i];
      cand[1][i] = (cur[i] - a) & 255;
      cand[2][i] = (cur[i] - b) & 255;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      cand[3][i] = (cur[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
    const filterId = [0, 1, 2, 4];
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 4; f++) {
      let s = 0; const cf = cand[f];
      for (let i = 0; i < rowBytes; i++) { const v = cf[i]; s += v < 128 ? v : 256 - v; }
      if (s < bestSum) { bestSum = s; best = f; }
    }
    raw[y * (rowBytes + 1)] = filterId[best];
    cand[best].copy(raw, y * (rowBytes + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
