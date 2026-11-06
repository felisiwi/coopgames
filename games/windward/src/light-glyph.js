// The lights speak (stage 1d, batch B): a lighthouse's real flash pattern as a glyph, e.g. ●●●● · 12s, and the rhythm of a soft chime to match.
// Pure: derived from the same light data as the lantern's flashing (src/lantern.js lightPattern), so the glyph, the chimes and the light you see
// can never disagree.
//   ●  a short flash (under LONG_FLASH_S)      ▬  a long flash      ○  a short dark in an otherwise steady light (an occulting light)
// later: a codebook for clues, night navigation, era-jumping (GAME-DESIGN.md "End of chapter 1: the lights speak").
import { lightPattern } from './lantern.js';

export const LONG_FLASH_S = 1.2;
const fmtPeriod = (p) => `${Number.isInteger(p) ? p : +p.toFixed(1)}s`;

// light: a lighthouses.js `light` ({ kind, count, period, flashSeconds?, gap? }). Returns null when there is no stated pattern (a steady light has
// nothing to say). Otherwise { glyph, text, period, kind, flashes: [{ at, len, dark? }] } (times in seconds from the start of a period).
export function lightGlyph(light) {
  if (!light || !light.period) return null;
  const p = lightPattern(light);
  if (p.steady) return null;
  if (light.kind === 'occulting') {
    const glyph = '○'.repeat(p.dark.length);
    return { glyph, text: `${glyph} · ${fmtPeriod(p.period)}`, period: p.period, kind: 'occulting', flashes: p.dark.map(([a, b]) => ({ at: a, len: b - a, dark: true })) };
  }
  const flashes = p.on.map(([a, b]) => ({ at: a, len: b - a }));
  const glyph = flashes.map((f) => (f.len >= LONG_FLASH_S ? '▬' : '●')).join('');
  return { glyph, text: `${glyph} · ${fmtPeriod(p.period)}`, period: p.period, kind: light.kind, flashes };
}
