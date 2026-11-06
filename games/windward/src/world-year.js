// WORLD BY YEAR (felix/windward-1700-preview): the one place that says what the real coast is like in a given year.
//
// Data-driven and pure (no three.js, no DOM, no fetch of its own): data/world-years.json is the table of eras,
// data/world-1700.json holds the 1700 facts (docs/WORLD-1700.md). worldAtYear() turns (table, sources, year) into a
// plain description; src/world-year-build.js turns that into a scene. game.js does not use any of this yet; it is
// written so that game.js can adopt it with one call: `const spec = worldAtYear(years, sources, year)`.
//
// What a description (a "spec") carries:
//   era, year, label, kit          'today' | '1700' and the asset kit that fits (src/era-assets.js)
//   waterOffsetM                   the sea stands this much HIGHER than today (real metres); 0 for today
//   hiddenRockIds                  chart rocks that are just under the surface in this era (a Set of shoals.json ids)
//   lights, modernMarks            whether lighthouses / the modern buoys and beacons exist
//   settlements                    [{ id, name, lon, lat, cottages, exists, uncertain, label }] for eras that list them
//   marks                          [{ id, kind, lon, lat, invented, uncertain, status }] cairns and painted rocks
//   labels                         [{ id, lon, lat, text, year, uncertain, documented }] what to call each place
//   boats                          { kit, moored, sailing }
//   notes                          honesty lines the lab shows (what is estimated, what is invented)

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// The era whose [from, to] holds the year; else the nearest one (so any year gives a world).
export function eraRowFor(years, year) {
  const hit = years.eras.find((e) => year >= e.from && year <= e.to);
  if (hit) return hit;
  const dist = (e) => (year < e.from ? e.from - year : year - e.to);
  return years.eras.reduce((best, e) => (dist(e) < dist(best) ? e : best), years.eras[0]);
}
export const eraById = (years, id) => years.eras.find((e) => e.id === id) || null;
// The year an era is shown at (its `year`, else its middle): the lab's Today / 1700 toggle.
export const yearOfEra = (years, id) => { const e = eraById(years, id); return e ? (e.year ?? Math.round((e.from + e.to) / 2)) : years.defaultYear; };

// How many cottages a settlement gets. Three rules, tried in order, all set by the era's row in data/world-years.json:
//  1. a count of FAMILIES (Gullholmen 1700: "20 fishing families"): one cottage per `householdsPerCottage`;
//  2. a count of PEOPLE inside `countYears` (1950: Grundsund's inhabitants): one game house per `peoplePerCottage` people, between
//     `minCottages` and `maxCottages` (a real village has more houses than fit, so this is a stylised scale, not a headcount);
//  3. the size-class table. Counts of adults or people outside the years window are not used (they are the wrong year).
export function cottagesFor(settlement, rule) {
  const counts = settlement.counts || [];
  const families = counts.filter((c) => /famil/i.test(c.unit || '') && c.value > 0 && !rule.peoplePerCottage);
  if (families.length) return Math.max(1, Math.ceil(families[families.length - 1].value / (rule.householdsPerCottage || 2)));
  if (rule.peoplePerCottage) {
    // the data's units are descriptive strings ("tätort (SCB)", "parish incl. Härmanö"): anything that is not a count of houses, families or
    // households is a count of people
    const [y0, y1] = rule.countYears || [-Infinity, Infinity];
    const people = counts.filter((c) => c.value > 0 && !/house|hus\b|famil|household/i.test(c.unit || '') && c.year >= y0 && c.year <= y1);
    if (people.length) {
      const near = rule.nearYear ?? 1950;
      const nearest = people.reduce((best, c) => (Math.abs(c.year - near) < Math.abs(best.year - near) ? c : best));
      return Math.min(rule.maxCottages ?? 99, Math.max(rule.minCottages ?? 1, Math.ceil(nearest.value / rule.peoplePerCottage)));
    }
  }
  return rule.cottagesBySizeClass[settlement.sizeClass] ?? rule.cottagesBySizeClass.unknown ?? 2;
}

// years: data/world-years.json. sources: { world1700 } (the files an era names in `source`). year: any number.
export function worldAtYear(years, sources, year) {
  const row = eraRowFor(years, year);
  const src = row.source ? sources[row.source] : null;
  if (row.source && !src) throw new Error(`worldAtYear: era ${row.id} needs the data file ${row.source}`);
  const offsetRule = row.waterOffset || { from: 'value', value: 0 };
  const waterOffsetM = offsetRule.from === 'source' ? Number(get(src, offsetRule.path)) : Number(offsetRule.value || 0);
  if (!Number.isFinite(waterOffsetM)) throw new Error(`worldAtYear: no water offset for era ${row.id}`);
  const hidden = row.hiddenRocks;
  const hiddenRockIds = new Set(hidden ? (get(src, hidden.path) || []).filter((r) => Object.entries(hidden.where).every(([k, v]) => r[k] === v)).map((r) => r.id) : []);
  const spec = {
    era: row.id, year, label: row.label, kit: row.kit, epoch: row.epoch,
    waterOffsetM, hiddenRockIds,
    lights: !!row.lights, lighthouses: null, modernMarks: !!(row.seaMarks && row.seaMarks.modern), periodMarks: null, industry: [],
    settlements: [], marks: [], labels: [], notes: [], houseColours: null,
    boats: { kit: row.boats.kit, moored: row.boats.moored || 0, sailing: row.boats.sailing || 0, ferry: !!row.boats.ferry },
  };
  if (row.settlements && row.settlements.from === 'source') {
    const rule = { nearYear: row.year, ...row.settlements };
    if (rule.colours) spec.houseColours = { ...rule.colours };
    for (const s of get(src, rule.path) || []) {
      const exists = s[rule.existsKey || 'existsAround1700'];
      if (!rule.showIf.includes(exists)) continue;
      spec.settlements.push({
        id: s.id, name: s.name, lon: s.lon, lat: s.lat, sizeClass: s.sizeClass, cottages: cottagesFor(s, rule),
        exists, uncertain: !!s.uncertain || exists !== 'yes', sizeEstimated: !!s.sizeEstimated, hasCanningFactory: s.hasCanningFactory ?? null, livelihood: s.livelihood || [],
      });
    }
  }
  if (row.seaMarks && row.seaMarks.kinds && row.seaMarks.kinds.length && src) {
    for (const m of src.seaMarks.marks) {
      if (!row.seaMarks.kinds.includes(m.kind)) continue;
      spec.marks.push({ id: m.id, name: m.name, kind: m.kind, lon: m.lon, lat: m.lat, invented: !!m.invented, uncertain: !!m.uncertain, status: m.status });
    }
    spec.notes.push(`${spec.marks.filter((m) => m.invented).length} of ${spec.marks.length} marks are invented recommendations (docs/WORLD-1700.md section 2); only the Maseskar cairn and the Karingon name theory have a source, neither dated to 1700`);
  }
  // Lighthouses standing in this era (an era whose `lights` rule reads the source): who keeps them, whether they are lit.
  if (row.lights && typeof row.lights === 'object') {
    const rule = row.lights;
    const ov = rule.modelOverrides || {};
    spec.lighthouses = (get(src, rule.path) || []).filter((l) => Object.entries(rule.where || {}).every(([k, v]) => l[k] === v)).map((l) => ({
      id: l.id, name: l.name, lat: l.lat, lon: l.lon, lit: l.lit1950 !== false && l.manned1950 !== 'dark', manned: l.manned1950 || 'unknown', keeperHouse: !!(l.keeperBuildings && l.keeperBuildings.present),
      keeperWall: 'white', uncertain: !!l.uncertain, ...(ov[l.id] || {}), overridden: !!ov[l.id],
    }));
    for (const l of spec.lighthouses) if (l.overridden) spec.notes.push(`${l.name}: shown ${l.lit ? 'lit' : 'dark'}${l.manned === 'dark' ? ' (old light)' : ''} - model override: ${(ov[l.id].why || '').slice(0, 160)}`);
    spec.lights = spec.lighthouses.length > 0;
    spec.notes.push(`${spec.lighthouses.filter((l) => l.manned === 'keepers').length} of ${spec.lighthouses.length} lights in the window had keepers; the others: ${spec.lighthouses.filter((l) => l.manned !== 'keepers').map((l) => `${l.name} (${l.manned})`).join(', ') || 'none'}`);
  }
  // The period sea marks: which of today's OSM mark types existed, and the look of the lateral ones (colour, shape per side).
  if (row.seaMarks && row.seaMarks.period && src) {
    const sm = get(src, row.seaMarks.period.path) || {};
    const existed = {};
    // the data's `kind` is a descriptive string ("lateral (100: 53 red, 47 green...)", "leading lines (12...)"): the mark type is its first word
    for (const k of sm.todayKindsVs1950 || []) existed[String(k.kind).split(/[\s(]/)[0]] = k.existedIn1950;
    const lat = (sm.system && sm.system.lateral) || {};
    spec.periodMarks = { existed, lateral: { port: lat.port || null, starboard: lat.starboard || null }, system: sm.system ? sm.system.name : null, map: row.seaMarks.period.map || null };
  }
  // Industry: fish-canning factories that stood in this era (named only where the source names them).
  if (row.industry && row.industry.from === 'source' && src) {
    spec.industry = (get(src, row.industry.path) || []).filter((f) => !row.industry.include || row.industry.include.includes(f.id)).filter((f) => !f.to || f.to >= row.year).filter((f) => !f.from || f.from <= row.year).map((f) => ({ id: f.id, name: f.name ?? null, place: f.place, lat: f.lat ?? null, lon: f.lon ?? null, look: f.look || null, uncertain: /conflict|uncertain/i.test(f.status || '') }));
  }
  if (src && src.boats && src.boats.ferry) spec.ferry = { name: src.boats.ferry.name ?? null, route: src.boats.ferry.route || null, status: src.boats.ferry.status || null };
  if (spec.ferry && spec.ferry.name == null) spec.notes.push('the 1950 Lysekil-Fiskebäckskil ferry is not identified in any source read: unnamed, and its look is the designer\'s choice');
  if (row.names && row.names.from === 'settlements') for (const s of spec.settlements) spec.labels.push({ id: s.id, lon: s.lon, lat: s.lat, text: s.name, year: null, uncertain: false, documented: true, modern: s.name });
  // Names: an era with documented forms gets them; a place with none gets no name (honest), not a guess.
  if (row.names && row.names.from === 'source') {
    const forms = new Map(get(src, row.names.path).map((n) => [n.modern, n]));
    for (const s of spec.settlements) {
      const n = forms.get(s.name);
      spec.labels.push({ id: s.id, lon: s.lon, lat: s.lat, text: n ? n.form : null, year: n ? n.year : null, uncertain: n ? !!n.uncertain : true, documented: !!n, modern: s.name });
    }
    for (const m of spec.marks) { // the Karingon white cairn takes the island's old name
      const n = m.id === 'karingon-cairn' ? forms.get('Käringön') : null;
      if (n) spec.labels.push({ id: m.id, lon: m.lon, lat: m.lat, text: `${n.form} (white cairn?)`, year: n.year, uncertain: true, documented: true, modern: m.name, chartName: false }); // chartName false: the island's own name is already on the chart
    }
  }
  if (spec.hiddenRockIds.size) spec.notes.push(`${spec.hiddenRockIds.size} rocks that are awash today are just under the surface (sea ${waterOffsetM} m higher; our arithmetic on SMHI's rate)`);
  if (spec.settlements.some((s) => s.uncertain)) spec.notes.push(`uncertain places: ${spec.settlements.filter((s) => s.uncertain).map((s) => s.name).join(', ')}`);
  return spec;
}

// ---- the coast at another water level (pure; wraps the object loadCoast() returns) -------------------------------------
// buildCoastWorld() reads the coast only through isLand / heightM / depthM / classAt, so a coast with the sea `offsetM` real
// metres higher is the same coast seen through four functions: land lower than the offset goes under, the sea is deeper by it,
// and a pixel that was low land becomes shallow sea. Heights are real metres (the world builder multiplies by its own exaggeration).
export function coastAtWaterLevel(coast, offsetM) {
  if (!offsetM) return coast;
  const hm = (i, j) => coast.heightM(i, j) - offsetM;
  const stillLand = (i, j) => coast.isLand(i, j) && hm(i, j) > 0;
  return {
    ...coast,
    isLand: stillLand,
    heightM: (i, j) => Math.max(0, hm(i, j)),
    classAt: (i, j) => (stillLand(i, j) ? coast.classAt(i, j) : 0),
    depthM: (i, j) => {
      if (coast.isLand(i, j)) return Math.max(0.05, offsetM - coast.heightM(i, j)); // was low land: now a shallow, a rock-top just under
      const d = coast.depthM(i, j);
      return d == null ? null : d + offsetM;
    },
  };
}

// ---- shoals in an era ---------------------------------------------------------------------------------------------------
// A rock that is under the surface in this era but solid for a keel: the picture is a faint pale patch and the odd breaker,
// not the white surf ring of a rock awash (src/world-year-build.js draws it).
export const HIDDEN_LOOK = Object.freeze({ look: 'hidden', visualRadiusM: 3.4, innerRadiusM: 0, collisionRadiusM: 2.4, blocks: true, slow: 1, opacity: 0.2, why: 'rock just under the surface (the sea stood higher)' });
// rows: assets/coast/shoals.json `shoals`; look: shoalLook from shoal-look.js (passed in so this file stays pure);
// returns [{ shoal, x, z, look, hidden }] in game metres.
export function shoalsInEra(rows, spec, toGame, look) {
  return rows.map((shoal) => {
    const [x, z] = toGame(shoal.lon, shoal.lat);
    const hidden = spec.hiddenRockIds.has(shoal.id);
    return { shoal, x, z, look: hidden ? { ...HIDDEN_LOOK } : look(shoal), hidden };
  });
}
