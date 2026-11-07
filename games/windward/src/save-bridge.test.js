// node games/windward/src/save-bridge.test.js: the save-bridge fragment builder (src/save-bridge.js). Must stay byte-compatible with felisiwi/windward's save-import.js.
import assert from 'node:assert/strict';
import { encodeImport, readWindwardSaves, fitSaves, buildRedirectUrl, MAX_BYTES } from './save-bridge.js';

function memStorage(initial) {
  const m = new Map(Object.entries(initial));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null) };
}
// Independent decoder (does not share code with the encoder): base64url -> UTF-8 -> JSON.
const decode = (frag) => {
  const b64 = frag.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8'));
};

// --- golden vector: produced by windward's own encodeImport (felix/save-import @ 8e2d5bb). If this breaks, the two repos no longer agree. ---
const GOLD_SAVES = {
  'windward.lights.v1': '{"lit":["Hattan"]}',
  'windward.lights.v1.1950': '{"lit":["Gaven"]}',
  'windward.names.v1': '{"a":"Åsa å ö ✓"}',
};
const GOLD = 'eyJ3aW5kd2FyZC5saWdodHMudjEiOiJ7XCJsaXRcIjpbXCJIYXR0YW5cIl19Iiwid2luZHdhcmQubGlnaHRzLnYxLjE5NTAiOiJ7XCJsaXRcIjpbXCJHYXZlblwiXX0iLCJ3aW5kd2FyZC5uYW1lcy52MSI6IntcImFcIjpcIsOFc2Egw6Ugw7Yg4pyTXCJ9In0';
assert.equal(encodeImport(GOLD_SAVES), GOLD, 'byte-identical to the windward encoder');
assert.deepEqual(decode(GOLD), GOLD_SAVES);
assert.ok(/^[A-Za-z0-9_-]+$/.test(GOLD), 'base64url only, no padding');

// --- every windward.* key carried, era suffixes kept, foreign keys left behind ---
const REAL = {
  'windward.lights.v1': 'a', 'windward.lights.v1.1950': 'b', 'windward.chapter1.v1': 'c', 'windward.beats1950.v1': 'd', 'windward.task1950.v1': 'e',
  'windward.lightlog.v1': 'f', 'windward.explored.v1': 'g', 'windward.explored.1700.v1': 'h', 'windward.names.v1': 'i', 'windward.deck.v1': 'j',
  'windward.intro.v1': '1', 'windward.opening.v1': '1', 'windward.start.v1': '1',
};
{
  const s = memStorage({ ...REAL, 'other.site.key': 'x', 'hub.lastGame': 'y' });
  assert.deepEqual(readWindwardSaves(s), REAL);
  const { url, carried, dropped } = buildRedirectUrl('https://new.example/', s);
  assert.equal(carried.length, Object.keys(REAL).length);
  assert.deepEqual(dropped, []);
  assert.ok(url.startsWith('https://new.example/#import='));
  assert.deepEqual(decode(url.split('#import=')[1]), REAL, 'every key, exact values, era suffixes kept');
}

// --- target handling: an existing hash is replaced; no saves -> bare address, no empty #import ---
assert.equal(buildRedirectUrl('https://new.example/play/#old', memStorage({})).url, 'https://new.example/play/');
assert.ok(buildRedirectUrl('https://new.example/play/#old', memStorage({ 'windward.a.v1': '1' })).url.startsWith('https://new.example/play/#import='));

// --- blocked / throwing storage never throws ---
{
  const broken = { get length() { throw new Error('SecurityError'); }, key() { throw new Error('x'); }, getItem() { throw new Error('x'); } };
  assert.deepEqual(readWindwardSaves(broken), {});
  assert.equal(buildRedirectUrl('https://new.example/', broken).url, 'https://new.example/');
  assert.deepEqual(readWindwardSaves(null), {});
}

// --- size limit: smallest keys are kept first, the rest reported; the result stays under the importer's limit ---
{
  const big = { 'windward.explored.v1': 'x'.repeat(2000), 'windward.lights.v1': 'small', 'windward.chapter1.v1': 'tiny' };
  const r = fitSaves(big, 500);
  assert.deepEqual(Object.keys(r.saves).sort(), ['windward.chapter1.v1', 'windward.lights.v1']);
  assert.deepEqual(r.dropped, ['windward.explored.v1']);
  assert.deepEqual(fitSaves(REAL).dropped, []);
  assert.ok(MAX_BYTES < 1024 * 1024, 'below the importer cap (1 MB)');
}

// --- unicode survives (non-ASCII names) ---
assert.deepEqual(decode(buildRedirectUrl('https://x/', memStorage({ 'windward.names.v1': 'Åsa ✓ 😀' })).url.split('#import=')[1]), { 'windward.names.v1': 'Åsa ✓ 😀' });

console.log('save-bridge: all checks passed');
