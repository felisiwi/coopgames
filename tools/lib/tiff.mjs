// Minimal GeoTIFF reader, zero dependencies. Reads a rectangular WINDOW of
// band 1 without loading the whole file (the NMD county raster is ~440 M px).
// Supports: striped or tiled, compression none / deflate / LZW,
// predictor 1 / 2 / 3, uint8 / int16 / uint16 / float32, little or big endian.
import fs from 'node:fs';
import zlib from 'node:zlib';

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };

export function openTiff(path) {
  const fd = fs.openSync(path, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const le = head.toString('latin1', 0, 2) === 'II';
  const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const f64 = (b, o) => (le ? b.readDoubleLE(o) : b.readDoubleBE(o));
  const magic = u16(head, 2);
  if (magic !== 42) throw new Error('not a classic TIFF (BigTIFF unsupported): ' + path);
  const ifdOff = u32(head, 4);

  const cnt = Buffer.alloc(2);
  fs.readSync(fd, cnt, 0, 2, ifdOff);
  const n = u16(cnt, 0);
  const ifd = Buffer.alloc(n * 12);
  fs.readSync(fd, ifd, 0, n * 12, ifdOff + 2);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const o = i * 12;
    const tag = u16(ifd, o), type = u16(ifd, o + 2), count = u32(ifd, o + 4);
    const size = (TYPE_SIZE[type] || 1) * count;
    let buf;
    if (size <= 4) buf = ifd.subarray(o + 8, o + 8 + size);
    else {
      buf = Buffer.alloc(size);
      fs.readSync(fd, buf, 0, size, u32(ifd, o + 8));
    }
    const vals = [];
    for (let k = 0; k < count; k++) {
      if (type === 3) vals.push(u16(buf, k * 2));
      else if (type === 4) vals.push(u32(buf, k * 4));
      else if (type === 12) vals.push(f64(buf, k * 8));
      else if (type === 2) { vals.push(buf.toString('latin1')); break; }
      else if (type === 1) vals.push(buf[k]);
    }
    tags[tag] = vals;
  }

  const t = {
    width: tags[256][0], height: tags[257][0],
    bits: tags[258] ? tags[258][0] : 8,
    compression: tags[259] ? tags[259][0] : 1,
    predictor: tags[317] ? tags[317][0] : 1,
    sampleFormat: tags[339] ? tags[339][0] : 1,
    spp: tags[277] ? tags[277][0] : 1,
    tiled: !!tags[322],
    tileW: tags[322] ? tags[322][0] : tags[256][0],
    tileH: tags[323] ? tags[323][0] : (tags[278] ? tags[278][0] : tags[257][0]),
    offsets: tags[324] || tags[273], counts: tags[325] || tags[279],
    pixelScale: tags[33550], tiepoint: tags[33922],
    geoKeys: tags[34735], nodata: tags[42113] ? parseFloat(tags[42113][0]) : null,
    planar: tags[284] ? tags[284][0] : 1,
  };
  if (t.spp !== 1) throw new Error('only single-band rasters supported, spp=' + t.spp);

  function lzw(src, expected) {
    // TIFF-flavoured LZW (MSB first, "early change"). Dictionary kept as
    // prefix-chains so each code costs O(string length), not O(table).
    const out = Buffer.alloc(expected);
    const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096), length = new Uint16Array(4096);
    for (let i = 0; i < 256; i++) { prefix[i] = -1; suffix[i] = i; first[i] = i; length[i] = 1; }
    let next = 258, bits = 9, buf = 0, nb = 0, prev = -1, ip = 0, op = 0;
    const write = (code) => {
      const len = length[code];
      let pos = op + len;
      for (let c = code; c >= 0; c = prefix[c]) { pos--; if (pos < expected) out[pos] = suffix[c]; }
      op += len;
    };
    for (;;) {
      while (nb < bits && ip < src.length) { buf = (buf << 8) | src[ip++]; nb += 8; }
      if (nb < bits) break;
      const code = (buf >>> (nb - bits)) & ((1 << bits) - 1);
      nb -= bits; buf &= (1 << nb) - 1;
      if (code === 257) break;
      if (code === 256) { next = 258; bits = 9; prev = -1; continue; }
      if (prev === -1) { write(code); prev = code; continue; }
      if (code < next) {
        prefix[next] = prev; suffix[next] = first[code]; first[next] = first[prev]; length[next] = length[prev] + 1;
        next++; write(code);
      } else {
        prefix[next] = prev; suffix[next] = first[prev]; first[next] = first[prev]; length[next] = length[prev] + 1;
        next++; write(next - 1);
      }
      prev = code < next - 1 ? code : next - 1;
      bits = next >= 2047 ? 12 : next >= 1023 ? 11 : next >= 511 ? 10 : 9;
      if (op >= expected) break;
    }
    return out;
  }

  function decodeBlock(idx, w, h) {
    const buf = Buffer.alloc(t.counts[idx]);
    fs.readSync(fd, buf, 0, buf.length, t.offsets[idx]);
    let raw;
    if (t.compression === 1) raw = buf;
    else if (t.compression === 8 || t.compression === 32946) raw = zlib.inflateSync(buf);
    else if (t.compression === 5) raw = lzw(buf, w * h * (t.bits / 8));
    else throw new Error('unsupported TIFF compression ' + t.compression);
    const bps = t.bits / 8;
    if (t.predictor === 2) {
      // horizontal differencing, per row
      if (bps === 1) for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) raw[y * w + x] = (raw[y * w + x] + raw[y * w + x - 1]) & 255;
      else if (bps === 2) {
        const v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) {
          const o = (y * w + x) * 2;
          v.setUint16(o, (v.getUint16(o, le) + v.getUint16(o - 2, le)) & 0xffff, le);
        }
      }
    } else if (t.predictor === 3) {
      // floating-point predictor: bytes of each row are de-interleaved (MSB plane first) then byte-differenced
      const rowBytes = w * bps;
      const out = Buffer.alloc(raw.length);
      for (let y = 0; y < h; y++) {
        const row = raw.subarray(y * rowBytes, (y + 1) * rowBytes);
        for (let i = 1; i < rowBytes; i++) row[i] = (row[i] + row[i - 1]) & 255;
        for (let x = 0; x < w; x++) for (let b = 0; b < bps; b++) {
          // plane b holds byte b of the big-endian value
          const val = row[b * w + x];
          out[y * rowBytes + x * bps + (le ? bps - 1 - b : b)] = val;
        }
      }
      raw = out;
    }
    const a = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    return Buffer.from(a);
  }

  function typed(buf, count) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const dv = new DataView(ab);
    const out = t.sampleFormat === 3 ? new Float32Array(count) : t.bits === 16 ? (t.sampleFormat === 2 ? new Int16Array(count) : new Uint16Array(count)) : new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      if (t.sampleFormat === 3) out[i] = dv.getFloat32(i * 4, le);
      else if (t.bits === 16) out[i] = t.sampleFormat === 2 ? dv.getInt16(i * 2, le) : dv.getUint16(i * 2, le);
      else out[i] = dv.getUint8(i);
    }
    return out;
  }

  // Window read: returns { data, w, h } for pixels x0..x1-1, y0..y1-1 (clipped).
  function readWindow(x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(t.width, x1); y1 = Math.min(t.height, y1);
    const w = x1 - x0, h = y1 - y0;
    const ctor = t.sampleFormat === 3 ? Float32Array : t.bits === 16 ? (t.sampleFormat === 2 ? Int16Array : Uint16Array) : Uint8Array;
    const data = new ctor(Math.max(0, w * h));
    if (w <= 0 || h <= 0) return { data, w: 0, h: 0, x0, y0 };
    const tilesAcross = Math.ceil(t.width / t.tileW);
    const ty0 = Math.floor(y0 / t.tileH), ty1 = Math.floor((y1 - 1) / t.tileH);
    const tx0 = t.tiled ? Math.floor(x0 / t.tileW) : 0, tx1 = t.tiled ? Math.floor((x1 - 1) / t.tileW) : 0;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const idx = ty * (t.tiled ? tilesAcross : 1) + tx;
      const bw = t.tiled ? t.tileW : t.width;                   // block pixel width in memory
      const bh = t.tiled ? t.tileH : Math.min(t.tileH, t.height - ty * t.tileH);
      const raw = decodeBlock(idx, bw, bh);
      const px = typed(raw, bw * bh);
      const bx = t.tiled ? tx * t.tileW : 0, by = ty * t.tileH;
      for (let yy = Math.max(by, y0); yy < Math.min(by + bh, y1); yy++) {
        for (let xx = Math.max(bx, x0); xx < Math.min(bx + bw, x1); xx++) {
          data[(yy - y0) * w + (xx - x0)] = px[(yy - by) * bw + (xx - bx)];
        }
      }
    }
    return { data, w, h, x0, y0 };
  }

  return { ...t, tags, readWindow, close: () => fs.closeSync(fd) };
}
