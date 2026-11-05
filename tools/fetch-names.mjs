#!/usr/bin/env node
// Builds games/windward/assets/coast/names.json from OpenStreetMap (Overpass API):
//   - every named island / islet / archipelago inside the game region (what the player discovers),
//   - Felix's natural harbours, geocoded BY EXACT NAME inside the region (anything that is not an
//     exact match is listed as unplaced, with candidates: never guessed),
//   - the position of Grundsund's harbour (the start), from the OSM marina node.
// Map data © OpenStreetMap contributors (ODbL 1.0). Usage: node tools/fetch-names.mjs
import fs from 'node:fs';

export const REGION = { s: 58.085, w: 11.25, n: 58.30, e: 11.50 };
const WIDE = { s: 58.0, w: 11.1, n: 58.45, e: 11.65 }; // only to report near-misses outside the region
// Felix's harbours (GAME-DESIGN.md "Felix's inputs"), with the stem used to find near-miss candidates.
const HARBOURS = [
  ['Rammen', 'Rammen'], ['Bredholmen', 'Bredholm'], ['Skarvesäter', 'Skarvesäter'], ['Usholmen', 'Usholm'],
  ['Testholmarna-Usholmen', 'Testholm'], ['DammholmeSkären', 'Dammholm'], ['Porsholmen', 'Porsholm'],
  ['Västra Danholmen', 'Danholm'], ['Kråkesundsgap', 'Kråkesundsgap'], ['Altarholmen', 'Altarholm'],
  ['Skaboholmen', 'Skabo'], ['Smörasken', 'Smörask'], ['Assholmen', 'Assholm'], ['Jonsborg', 'Jonsborg'], ['Vasholmarna', 'Vasholm'],
];
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'windward-coast-trial/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
        const text = await res.text();
        if (res.ok && text.includes('"elements"')) return JSON.parse(text).elements;
        console.error(`overpass ${url} -> ${res.status}`);
      } catch (e) { console.error(`overpass ${url} failed: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 6000));
    }
  }
  throw new Error('Overpass unavailable');
}
const bb = (b) => `(${b.s},${b.w},${b.n},${b.e})`;
const pt = (e) => { const c = e.center || e; return { lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5) }; };
const inRegion = (p) => p.lat >= REGION.s && p.lat <= REGION.n && p.lon >= REGION.w && p.lon <= REGION.e;
const osmId = (e) => `${e.type}/${e.id}`;

const islandEls = await overpass(`[out:json][timeout:90];nwr["place"~"^(island|islet|archipelago)$"]["name"]${bb(REGION)};out center tags;`);
const stems = [...new Set(HARBOURS.flatMap(([n, s]) => [n, s]))].join('|');
const harbourEls = await overpass(`[out:json][timeout:60];nwr["name"~"${stems}"]${bb(WIDE)};out center tags;`);
const marinaEls = await overpass(`[out:json][timeout:60];nwr["leisure"="marina"]["name"="Grundsunds hamn"]${bb(WIDE)};out center tags;`);

const harbours = [];
const unplaced = [];
for (const [name, stem] of HARBOURS) {
  const exact = harbourEls.filter((e) => e.tags.name === name && inRegion(pt(e)));
  if (name === 'Kråkesundsgap') {
    // OSM has the gap only as its two named lights (Södra / Norra); the gap lies between them.
    const lights = harbourEls.filter((e) => /^Kråkesundsgap (Södra|Norra)$/.test(e.tags.name || '') && inRegion(pt(e)));
    if (lights.length === 2) {
      const a = pt(lights[0]), b = pt(lights[1]);
      harbours.push({ name, lat: +((a.lat + b.lat) / 2).toFixed(5), lon: +((a.lon + b.lon) / 2).toFixed(5), osm: lights.map(osmId), how: 'midpoint of the two OSM lights Kråkesundsgap Södra and Norra' });
      continue;
    }
  }
  if (exact.length === 1) { harbours.push({ name, ...pt(exact[0]), osm: [osmId(exact[0])], how: 'exact OSM name match' }); continue; }
  const candidates = harbourEls
    .filter((e) => (e.tags.name || '').includes(stem.replace('Testholmarna-Usholmen', 'Testholm')) && e.tags.name !== name)
    .map((e) => ({ name: e.tags.name, ...pt(e), osm: osmId(e), inRegion: inRegion(pt(e)) }));
  const outside = harbourEls.filter((e) => e.tags.name === name && !inRegion(pt(e))).map((e) => ({ name: e.tags.name, ...pt(e), osm: osmId(e), inRegion: false }));
  unplaced.push({
    name,
    reason: exact.length > 1 ? 'several exact matches' : outside.length ? 'exact match exists but outside the region' : candidates.length ? 'no exact OSM name; near-name candidates only (not guessed)' : 'no OSM match found',
    candidates: [...outside, ...candidates],
  });
}

const harbourIds = new Set(harbours.flatMap((h) => h.osm));
const islands = islandEls
  .map((e) => ({ name: e.tags.name, kind: e.tags.place === 'island' ? 'island' : 'skerry', ...pt(e), osm: osmId(e) }))
  .filter((i) => inRegion(i) && !harbourIds.has(i.osm))
  .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

const marina = marinaEls[0];
if (!marina) throw new Error('Grundsunds hamn not found in OSM');
const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap contributors, ODbL 1.0, via Overpass API (tools/fetch-names.mjs)',
  region: REGION,
  spawn: { name: 'Grundsunds hamn', ...pt(marina), osm: osmId(marina), note: 'OSM leisure=marina (guest harbour). The boat starts in open water just outside it.' },
  harbours, unplaced, islands,
};
const file = new URL('../games/windward/assets/coast/names.json', import.meta.url);
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`names.json: ${islands.length} islands/skerries, ${harbours.length} harbours placed, ${unplaced.length} unplaced`);
for (const u of unplaced) console.log(` unplaced: ${u.name} — ${u.reason}`);
