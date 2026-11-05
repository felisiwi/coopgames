// Pull ONE file out of a (non-zip64) .zip, zero dependencies.
import fs from 'node:fs';
import zlib from 'node:zlib';

export function extractFromZip(zipPath, wantName, outPath) {
  const buf = fs.readFileSync(zipPath);
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip: end-of-central-directory not found');
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (name.endsWith(wantName)) {
      const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28);
      const start = lho + 30 + ln + lx;
      const comp = buf.subarray(start, start + csize);
      const out = method === 0 ? comp : zlib.inflateRawSync(comp);
      fs.writeFileSync(outPath, out);
      return name;
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error('zip: ' + wantName + ' not found in ' + zipPath);
}
