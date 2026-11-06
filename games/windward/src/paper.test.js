// node games/windward/src/paper.test.js: the paper look (src/paper.js): one serif, dark ink on light paper (readable), no image files, 44 px buttons.
import assert from 'node:assert/strict';
import { PAPER, SERIF, paperSurface, paperTitle, paperBody, paperQuote, paperNote, paperButton, paperLink } from './paper.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

check('ink on paper is readable: body ink, title ink and soft ink all pass contrast on the darkest paper tone (WCAG AA 4.5)', () => {
  for (const [name, ink] of [['ink', PAPER.ink], ['title', PAPER.title], ['inkSoft', PAPER.inkSoft]]) assert.ok(contrast(ink, PAPER.paperDark) >= 4.5, `${name} ${contrast(ink, PAPER.paperDark).toFixed(1)}:1 on the aged edge`);
  assert.ok(contrast(PAPER.sealText, PAPER.seal) >= 7, 'button text on the ink button');
  assert.ok(contrast('#bd9c68', PAPER.ink) >= 4.5, 'the darker dusk paper still takes the body ink');
});

check('one serif face everywhere: title, body, quote, note and buttons use the same family, no system sans', () => {
  for (const css of [paperSurface(), paperSurface({ tone: 'dusk' }), paperTitle(), paperBody(), paperQuote(), paperNote(), paperButton(), paperButton({ primary: false }), paperLink()]) {
    assert.ok(css.includes(SERIF) || css.includes('font:') === false, `serif in ${css.slice(0, 60)}`);
    assert.ok(!/system-ui|sans-serif|monospace|-apple-system/.test(css), `no sans in ${css.slice(0, 60)}`);
  }
  assert.ok(/^Georgia/.test(SERIF) && /serif$/.test(SERIF));
});

check('the paper is made from CSS only: gradients and an inline SVG grain, no image file; a printed double rule; dusk is a darker paper', () => {
  const s = paperSurface();
  assert.ok(/radial-gradient/.test(s) && /data:image\/svg\+xml/.test(s) && /feTurbulence/.test(decodeURIComponent(s.match(/utf8,([^")]+)/)[1])), 'gradient + grain');
  assert.ok(!/\.(png|jpe?g|gif|webp)|url\(["']?https?:|url\(["']?\//.test(s), 'no image file');
  assert.ok(/inset 0 0 0 4px/.test(s) && /inset 0 0 0 5px/.test(s), 'a printed double rule');
  assert.ok(paperSurface({ tone: 'dusk' }) !== s && /#d8bd8a/.test(paperSurface({ tone: 'dusk' })));
  assert.ok(/border-radius:5px/.test(s), 'modest corners, not pill-shaped');
});

check('phone-friendly: a 17 px body, buttons at least 44 px tall', () => {
  assert.ok(/font:17px/.test(paperBody())); assert.ok(/min-height:44px/.test(paperButton()) && /min-height:44px/.test(paperButton({ primary: false })));
});

console.log(`\n${passed} checks passed`);
