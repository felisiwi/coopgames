// One door into the world for game.js: loadCoastForYear(year) returns the `coast` object the game already consumes (the same shape loadRealCoast makes),
// whatever the year. Stage 1e: chapter 1 starts in 1950, so the game asks for 1950 by default and ?year= still reaches any other era.
//
//   Today (the era row says 'today'): loadRealCoast, unchanged. It stays the oracle the tests compare the adapter against, so Today cannot drift.
//   Another era (1950, 1700):          the world-years builder (src/world-year-build.js) makes the world; this file reshapes it into a `coast`.
//
// What the reshaping covers (the builder is written for the lab and the game is written for Today, so they differ at the edges):
//   - names:    the name list (islands, harbours, villages, lights) for the era's own villages and lights;
//   - sea:      the shoal list for the game's shoal layer (so the builder's own copy is taken out of the scene: one layer, not two), NO modern sea marks
//               (the 1950 builder stamps its own period marks), the harbour list;
//   - lights:   each placed light with the lantern glow the builder already made (the game reuses it), and `lightList`, the era's light entries,
//               which replaces today's LIGHTHOUSES wherever the game looked a light up by name;
//   - update:   (x, z, dt, t, seaAt): terrain and trees round the view, plus the era's own animation (buoys bobbing, breakers);
//   - report:   the same keys the debug overlay reads;
//   - granddad: only Today has the chest chart; 1950 is before him.
// The boats are not built here (ownBoats:false): the busy coast (src/busy-coast.js, driven by data/busy-eras.json) is the one source of traffic.
import { loadRealCoast, findOpenWater, EDGE_FADE_M } from './coast-world.js';
import { loadWorldFiles, buildWorldForSpec, shoreSpot } from './world-year-build.js';
import { planWake, landConnectedTo } from './wake-plan.js';
import { eraRowFor, worldAtYear } from './world-year.js';
import { buildNameList } from './names.js';
import { LIGHTHOUSES } from './lighthouses.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// opts: what loadRealCoast takes ({ vex, step, smooth, seed, at, style, summerShare }) plus
//   io: { json(url), bytes(url) } (tests pass file readers; the browser default fetches), base: the folder URL of the game (default: this file's parent).
export async function loadCoastForYear(year, opts = {}) {
  const base = opts.base ?? new URL('../', import.meta.url).href;
  const bytes = { n: 0 };
  const io = opts.io ?? {
    json: async (u) => { const t = await (await fetch(u)).text(); bytes.n += t.length; return JSON.parse(t); },
    bytes: async (u) => { const b = new Uint8Array(await (await fetch(u)).arrayBuffer()); bytes.n += b.length; return b; },
  };
  const years = await io.json(base + 'data/world-years.json');
  const row = eraRowFor(years, year);
  if (row.id === 'today') {
    const coast = await loadRealCoast(opts);
    let granddad = null;
    try { granddad = await io.json(base + 'data/granddad-chart.json'); } catch { granddad = null; } // a missing file only means no extra marks
    return Object.assign(coast, { era: 'today', year, lightList: LIGHTHOUSES, granddad, spec: null });
  }
  return buildEraCoast(year, row, years, io, bytes, base, opts);
}

async function buildEraCoast(year, row, years, io, bytes, base, opts) {
  const T0 = now();
  const files = await loadWorldFiles({ coastUrl: base + 'assets/coast/', dataUrl: base + 'data/', chartUrl: base + 'assets/chart/', io });
  const [placeNames, placesJson] = await Promise.all([io.json(base + 'data/place-names.json'), io.json(base + 'assets/coast/places.json')]); // descriptions + the major places for the name list
  const loadDecodeMs = now() - T0;

  const spec = worldAtYear(files.years, files.sources, year);
  const e = buildWorldForSpec(files, spec, { seed: opts.seed ?? 1, ownBoats: false });
  if (e.shoalLayer) e.group.remove(e.shoalLayer.group); // the game builds its shoal layer from sea.shoalList: take the builder's copy out so there is one
  const world = e.world;
  const inside = (x, z) => world.inside(x, z, EDGE_FADE_M);

  const names = buildNameList({ names: files.names, villages: spec.settlements, toGame: world.toGame, inside, placeNames, lights: e.lightEntries || [],
    majorPlaces: placesJson.places.filter((p) => p.kind === 'village' || p.kind === 'town') });
  const lights = e.lights.map((l) => ({ name: l.name, id: l.id, x: l.x, y: l.y, z: l.z, group: l.group, fx: l.fx, entry: l.entry, info: l.info, movedM: l.movedM }));

  const [sx, sz] = world.toGame(...(opts.at || [files.names.spawn.lon, files.names.spawn.lat]));
  // 1950 starts on a beach on Skaftö (src/wake-plan.js): Svalan thrown up on the shore, the player in open water just off it. ?cat= (a testing start) skips it.
  const avoid = []; e.props.children.forEach((o) => { if (/^(house|boathouse|canning-factory|keeper-house)$/.test(o.name)) avoid.push({ x: o.position.x, z: o.position.z }); });
  // The wreck lies on Skaftö's own shore (the ground joined to Grundsund village), near a place a boatbuilder could have a yard: Grundsund or Fiskebäckskil. Never a skerry.
  const yardVillages = ['village:Grundsund', 'village:Fiskebäckskil'].map((id) => names.find((n) => n.id === id)).filter(Boolean).map((n) => ({ x: n.x, z: n.z }));
  const onMainland = yardVillages.length ? landConnectedTo({ heightAt: world.heightAt, from: yardVillages[0] }) : null;
  const wake = spec.era === '1950' && !opts.at && e.spawn ? planWake({ world, nears: yardVillages.length ? yardVillages : [e.spawn], onMainland, avoid, helpers: { shoreSpot, findOpenWater: (w, x, z, o) => findOpenWater(w, x, z, o) }, seed: opts.seed ?? 1 }) : null;
  const spawn = wake ? wake.spawn : opts.at ? findOpenWater(world, sx, sz) : e.spawn;
  const buildMs = now() - T0;
  const hard = e.shoalList.filter((s) => s.look.blocks).length; // the same rule as the shoal index (src/sea-truth.js)

  return {
    era: spec.era, year, spec, wake, world, group: e.group, depthMap: world.depthMap, spawn, trees: e.trees, terrain: e.terrain, terrainStyle: e.style, clamp: e.clamp, names,
    summerHouses: [], granddad: null, lights, lightList: e.lightEntries || [], lightsNotDrawn: e.lightsNotDrawn, labels: e.labels,
    findOpenWater: (x, z, o) => findOpenWater(world, x, z, o),
    heightAt: world.heightAt, sailHeightAt: e.sailHeightAt, shoalSlowAt: e.shoalSlowAt,
    sea: { shoalList: e.shoalList, marks: [], lines: [], harbours: files.seamarks.harbours, credit: files.seamarks.credit, licence: files.seamarks.licence },
    // per frame: terrain chunks and trees round the view, then the era's moving things. Returns true when the trees were rebuilt.
    update: (x, z, dt = 0, t = 0, seaAt) => e.update(x, z, dt, t, seaAt),
    setNight: (on) => e.setNight(on),
    report: {
      ...e.report, era: spec.era, passes: { carved: [], changedCells: 0 }, shoals: { hard, soft: e.shoalList.length - hard }, bytesDownloadedByLoader: bytes.n,
      timings: { loadDecodeMs, fieldMs: 0, depthMs: 0, passesMs: 0, terrainMs: 0, styleMs: 0, propsMs: 0, ...world.timings, buildMs },
      window: { cells: [world.nx, world.nz], metres: [Math.round(world.nx * world.pxM), Math.round(world.nz * world.pxM)], landPct: +world.landPct.toFixed(1) },
      terrain: e.terrain.stats, buildings: e.report.cottages + e.report.boathouses, summerHouses: 0, skerries: world.skerryCount,
      lighthouses: lights.map((l) => ({ name: l.name, movedM: l.movedM })),
      names: { hiddenNamesakes: [], total: names.length, byKind: names.reduce((o, n) => ((o[n.kind] = (o[n.kind] || 0) + 1), o), {}), unplacedHarbours: files.names.unplaced.map((u) => u.name) },
      spawn, spawnFrom: files.names.spawn, look: world.look,
    },
  };
}
