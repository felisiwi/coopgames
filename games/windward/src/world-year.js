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

// How many cottages a settlement gets: a count of FAMILIES from the end of the 1600s if the data has one (Gullholmen: "20 fishing
// families"), one cottage per `householdsPerCottage`; otherwise the size-class table. Counts of adults or people are not used
// (they are 1645 or 1750, not 1700).
export function cottagesFor(settlement, rule) {
  const per = rule.householdsPerCottage || 2;
  const families = (settlement.counts || []).filter((c) => /famil/i.test(c.unit || '') && c.value > 0);
  if (families.length) return Math.max(1, Math.ceil(families[families.length - 1].value / per));
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
    lights: !!row.lights, modernMarks: !!(row.seaMarks && row.seaMarks.modern),
    settlements: [], marks: [], labels: [], notes: [],
    boats: { kit: row.boats.kit, moored: row.boats.moored || 0, sailing: row.boats.sailing || 0 },
  };
  if (row.settlements && row.settlements.from === 'source') {
    const rule = row.settlements;
    for (const s of get(src, rule.path) || []) {
      if (!rule.showIf.includes(s.existsAround1700)) continue;
      spec.settlements.push({
        id: s.id, name: s.name, lon: s.lon, lat: s.lat, sizeClass: s.sizeClass, cottages: cottagesFor(s, rule),
        exists: s.existsAround1700, uncertain: !!s.uncertain || s.existsAround1700 !== 'yes', sizeEstimated: !!s.sizeEstimated,
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
  // Names: an era with documented forms gets them; a place with none gets no name (honest), not a guess.
  if (row.names && row.names.from === 'source') {
    const forms = new Map(get(src, row.names.path).map((n) => [n.modern, n]));
    for (const s of spec.settlements) {
      const n = forms.get(s.name);
      spec.labels.push({ id: s.id, lon: s.lon, lat: s.lat, text: n ? n.form : null, year: n ? n.year : null, uncertain: n ? !!n.uncertain : true, documented: !!n, modern: s.name });
    }
    for (const m of spec.marks) { // the Karingon white cairn takes the island's old name
      const n = m.id === 'karingon-cairn' ? forms.get('Käringön') : null;
      if (n) spec.labels.push({ id: m.id, lon: m.lon, lat: m.lat, text: `${n.form} (white cairn?)`, year: n.year, uncertain: true, documented: true, modern: m.name });
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
