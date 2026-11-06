// node games/windward/src/britta-house.test.js: Britta's house in 1950 (src/britta-house.js, BRITTA_HOUSE in src/story-1950.js): it is the house the opening picks on the Today coast, it
// stands on land, its jetty runs into deep water, and the quay in front of it is sailable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

globalThis.fetch = async (u) => { const b = readFileSync(fileURLToPath(u)); return { text: async () => b.toString('utf8'), json: async () => JSON.parse(b.toString('utf8')), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCoastForYear } = await import('./coast-for-year.js');
const { pickSite, SITE } = await import('./opening-site.js');
const { createBrittaHouse } = await import('./britta-house.js');
const { BRITTA_HOUSE: B } = await import('./story-1950.js');

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const io = { json: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')), bytes: async (u) => new Uint8Array(readFileSync(fileURLToPath(u))) };
const today = await loadCoastForYear(2015, { seed: 1, io, summerShare: 1 });
const c1950 = await loadCoastForYear(1950, { seed: 1, io });

await check('it is the house the opening picks: BRITTA_HOUSE equals pickSite on the Today coast (so the house you leave is the house you come back to)', () => {
  const s = pickSite({ houses: today.summerHouses, village: today.names.find((n) => n.id === 'village:Fiskebäckskil'), heightAt: today.heightAt });
  const close = (a, b, what) => assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} vs ${b}`);
  close(B.house.x, s.house.x, 'house x'); close(B.house.z, s.house.z, 'house z'); close(B.dir, s.dir, 'bearing'); assert.equal(B.waterM, s.waterM);
  close(B.jetty.from.x, s.jetty.from.x, 'jetty from x'); close(B.jetty.from.z, s.jetty.from.z, 'jetty from z'); close(B.jetty.to.x, s.jetty.to.x, 'jetty to x'); close(B.jetty.to.z, s.jetty.to.z, 'jetty to z');
  assert.equal(B.jetty.y, SITE.deckY); assert.equal(B.jetty.width, SITE.jettyWidthM);
});

await check('in 1950 the house and the shed stand on land, the jetty starts at the shore and ends in deep water, and the quay is open sea', () => {
  const h = c1950.heightAt;
  assert.ok(h(B.house.x, B.house.z) > 1, `house ground ${h(B.house.x, B.house.z).toFixed(1)} m`);
  assert.ok(h(B.shed.x, B.shed.z) > 0.5, `the shed stands on land (${h(B.shed.x, B.shed.z).toFixed(1)} m)`);
  assert.ok(h(B.jetty.from.x, B.jetty.from.z) > -0.5 && h(B.jetty.from.x, B.jetty.from.z) < 3, 'the jetty starts at the shore');
  assert.ok(h(B.jetty.to.x, B.jetty.to.z) <= SITE.deepLevel, 'deep at the jetty end');
  assert.ok(h(B.quay.x, B.quay.z) <= -2, 'the quay is open water');
  assert.ok(c1950.sailHeightAt(B.quay.x, B.quay.z) < -1, 'and the boat can sail there');
  assert.ok(Math.hypot(B.quay.x - B.jetty.to.x, B.quay.z - B.jetty.to.z) < 8, 'just off the end of the jetty');
});

await check('the scene: a white house, a shed, a flat jetty at sea height; light enough for a village', () => {
  const sc = createBrittaHouse({ heightAt: c1950.heightAt });
  const names = []; sc.group.traverse((o) => o.name && names.push(o.name));
  for (const n of ['britta-house', 'gas-shed', 'jetty']) assert.ok(names.includes(n), n);
  const jetty = sc.group.getObjectByName('jetty'); let maxY = -1e9; jetty.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height < 0.2) maxY = Math.max(maxY, o.position.y); });
  assert.ok(maxY > 0 && maxY < 0.6, `the deck is at ${maxY} m: low and flat`);
  let tris = 0; sc.group.traverse((o) => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  assert.ok(tris < 2500, `${Math.round(tris)} triangles`);
});

console.log(`\n${passed} checks passed`);
