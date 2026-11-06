// Fetch shallows + sea-marks for the Windward region from OpenStreetMap (Overpass) and write
//   games/windward/assets/coast/shoals.json
//   games/windward/assets/coast/seamarks.json
// Usage: node tools/fetch-seamarks.mjs            (needs network; retries when Overpass is busy)
//        node tools/fetch-seamarks.mjs raw.json   (re-process a saved Overpass response, no network)
// Data: (c) OpenStreetMap contributors, ODbL 1.0. Nothing here is invented: every row cites its OSM id.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'games', 'windward', 'assets', 'coast');
export const REGION = { s: 58.085, w: 11.25, n: 58.30, e: 11.50 };
const BB = `(${REGION.s},${REGION.w},${REGION.n},${REGION.e})`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// "båd/båden/bådan/både/flu/flut" are the Bohuslän words for a shoal; "grund/grynna" the standard ones.
const SHOAL_NAME = '(grund|grunden|grynna|grynnan|grynnor|grynnorna|båd|båden|bådan|bådarna|både|flu|fluen|fluet|flut)$';
// Overpass's regex is not reliably Unicode-aware (å), so the query uses a loose wildcard and build() re-checks with SHOAL_NAME.
const LOOSE = '(grund|gryn|b.{1,2}d(en|an|arna|e)?|flu(t|en|et)?)$';
const QUERY = `[out:json][timeout:120];
(
 nwr["seamark:type"]${BB};
 nwr["natural"~"^(shoal|reef)$"]${BB};
 nwr["historic"="wreck"]${BB};
 nwr["name"~"${LOOSE}",i]${BB};
 nwr["seamark:name"~"${LOOSE}",i]${BB};
);
out geom tags;`;

export const SHOAL_KINDS = ['rock', 'obstruction', 'wreck', 'named_shoal'];
export const ROCK_LEVELS = ['dry', 'awash', 'covers', 'submerged', 'unknown'];
export const MARK_TYPES = ['lateral', 'cardinal', 'isolated_danger', 'safe_water', 'special', 'light'];
const COLOUR_ABBR = { white: 'W', red: 'R', green: 'G', yellow: 'Y', blue: 'Bu', orange: 'Or', violet: 'Vi' };

async function overpass() {
  let last;
  for (let round = 0; round < 4; round++) {
    for (const url of ENDPOINTS) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'windward-seamarks-fetch/1.0' },
          body: 'data=' + encodeURIComponent(QUERY),
          signal: AbortSignal.timeout(130000),
        });
        if (r.ok) return await r.json();
        last = `${url} -> HTTP ${r.status}`;
      } catch (e) { last = `${url} -> ${e.message}`; }
      console.error('overpass busy:', last, '(retrying)');
      await new Promise((res) => setTimeout(res, 15000 * (round + 1)));
    }
  }
  throw new Error('Overpass unavailable after retries: ' + last);
}

const mDegLat = 111195, mDegLon = mDegLat * Math.cos(58.19 * Math.PI / 180);
export const distM = (a, b) => Math.hypot((a.lat - b.lat) * mDegLat, (a.lon - b.lon) * mDegLon);
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const inRegion = (p) => p.lat >= REGION.s && p.lat <= REGION.n && p.lon >= REGION.w && p.lon <= REGION.e;

function centre(e) {
  if (e.type === 'node') return { lat: e.lat, lon: e.lon, radiusM: null };
  const pts = [];
  for (const g of e.geometry ?? []) pts.push(g);
  for (const m of e.members ?? []) for (const g of m.geometry ?? []) pts.push(g);
  if (!pts.length && e.bounds) { // relations come back as a bounding box only: centre + half-diagonal = approximate radius
    const b = e.bounds, ctr = { lat: (b.minlat + b.maxlat) / 2, lon: (b.minlon + b.maxlon) / 2 };
    return { ...ctr, radiusM: Math.round(distM(ctr, { lat: b.maxlat, lon: b.maxlon })) };
  }
  if (!pts.length) return e.center ? { lat: e.center.lat, lon: e.center.lon, radiusM: null } : null;
  const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length, lon = pts.reduce((a, p) => a + p.lon, 0) / pts.length;
  const c = { lat, lon };
  return { lat, lon, radiusM: Math.round(Math.max(...pts.map((p) => distM(c, p)))) };
}

// seamark:light:* -> [{character, group, colour, period, range, height, sectorStart, sectorEnd, text}]
function lights(t) {
  const by = new Map();
  for (const [k, v] of Object.entries(t)) {
    const m = /^seamark:light:(?:(\d+):)?([a-z_]+)$/.exec(k);
    if (!m || m[2] === 'reference') continue;
    const idx = m[1] ?? '0';
    if (!by.has(idx)) by.set(idx, {});
    by.get(idx)[m[2]] = v;
  }
  return [...by.values()].filter((l) => l.character).map((l) => {
    const colour = (l.colour ?? '').split(';').map((c) => COLOUR_ABBR[c] ?? c).join('');
    const text = `${l.character}${l.group ? `(${l.group})` : ''}${colour ? ' ' + colour : ''}${l.period ? ' ' + l.period + 's' : ''}`;
    const num = (x) => (x === undefined ? undefined : Number(x));
    return {
      character: l.character, group: l.group ? Number(l.group) : undefined, colour: l.colour, period: num(l.period),
      range: num(l.range), height: num(l.height), sectorStart: num(l.sector_start), sectorEnd: num(l.sector_end), text,
    };
  });
}

export function build(osm) {
  const seen = new Set();
  const els = osm.elements.filter((e) => !seen.has(e.type + e.id) && seen.add(e.type + e.id));
  const T = (e) => e.tags ?? {};
  const shoals = [], marks = [], lines = [], harbours = [];

  for (const e of els) {
    const t = T(e), st = t['seamark:type'], id = `${e.type}/${e.id}`, nm = t.name ?? t['seamark:name'];
    const c = centre(e);
    if (!c) continue;
    const base = { id, lat: r5(c.lat), lon: r5(c.lon) };

    // ---- shallows ----
    if (st === 'rock') {
      const lvl = t['seamark:rock:water_level'];
      shoals.push({ ...base, kind: 'rock', level: ROCK_LEVELS.includes(lvl) ? lvl : 'unknown',
        ...(t['seamark:rock:depth'] ? { depthM: Number(t['seamark:rock:depth']) } : {}), ...(nm ? { name: nm } : {}) });
    } else if (st === 'obstruction' || st === 'wreck' || t.historic === 'wreck') {
      shoals.push({ ...base, kind: st === 'obstruction' ? 'obstruction' : 'wreck', ...(nm ? { name: nm } : {}),
        ...(c.radiusM ? { radiusM: c.radiusM } : {}) });
    } else if (nm && new RegExp(SHOAL_NAME, 'i').test(nm) && !st?.startsWith('light')) {
      // a named shoal: either a mark standing on it (Sverkerbådan) or an OSM islet/feature carrying the name
      shoals.push({ ...base, kind: 'named_shoal', name: nm, how: st ? `marked by ${st}` : `OSM ${t.natural ?? 'feature'} ${e.type}`,
        ...(c.radiusM ? { radiusM: c.radiusM } : {}) });
    } else if (t.natural === 'shoal' || t.natural === 'reef') {
      shoals.push({ ...base, kind: 'named_shoal', name: nm, how: `natural=${t.natural}`, ...(c.radiusM ? { radiusM: c.radiusM } : {}) });
    }

    // ---- marks ----
    const form = st?.startsWith('buoy_') ? 'buoy' : st?.startsWith('beacon_') ? 'beacon' : null;
    const key = (f) => t[`seamark:${st}:${f}`];
    let type = null, extra = {};
    if (form) {
      const kind = st.replace(/^(buoy|beacon)_/, '');
      if (kind === 'lateral') {
        type = 'lateral';
        extra = { side: key('category'), colours: (key('colour') ?? '').split(';'), shape: key('shape'), system: key('system') };
      } else if (kind === 'cardinal') {
        type = 'cardinal';
        extra = { direction: key('category'), colours: (key('colour') ?? '').split(';'), colourPattern: key('colour_pattern'), shape: key('shape') };
      } else if (kind === 'isolated_danger') {
        type = 'isolated_danger'; extra = { colours: (key('colour') ?? '').split(';'), shape: key('shape') };
      } else if (kind === 'safe_water') {
        type = 'safe_water'; extra = { colours: (key('colour') ?? '').split(';'), shape: key('shape') };
      } else if (kind === 'special_purpose') {
        type = 'special'; extra = { colours: (key('colour') ?? '').split(';'), shape: key('shape'), purpose: key('category') };
      }
      if (type && t['seamark:topmark:shape']) extra.topmark = { shape: t['seamark:topmark:shape'], colour: t['seamark:topmark:colour'] };
    } else if (st === 'light_minor' || st === 'light_major') {
      type = 'light'; extra = { rank: st === 'light_major' ? 'major' : 'minor' };
    }
    if (type) {
      const ls = lights(t);
      for (const k of Object.keys(extra)) if (extra[k] === undefined) delete extra[k];
      marks.push({ ...base, type, form: form ?? 'light', ...(nm ? { name: nm } : {}), ...extra, ...(ls.length ? { lights: ls } : {}) });
    }

    // ---- leading / clearing lines (ways) ----
    if (st === 'navigation_line' && e.geometry) {
      lines.push({ id, category: t['seamark:navigation_line:category'] ?? 'unknown',
        ...(t['seamark:navigation_line:orientation'] ? { bearingDeg: Number(t['seamark:navigation_line:orientation']) } : {}),
        points: e.geometry.map((p) => [r5(p.lon), r5(p.lat)]) });
    }

    // ---- harbours (reference points for coverage) ----
    if (st === 'harbour') harbours.push({ name: nm ?? 'Käringön fiskehamn', ...base, category: t['seamark:harbour:category'] });
  }

  // marks near each harbour (1.5 km): coverage numbers for the report and for stage 1d
  for (const h of harbours) {
    const near = marks.filter((m) => distM(h, m) <= 1500);
    h.within1500m = near.length;
    h.nearestMarkM = marks.length ? Math.round(Math.min(...marks.map((m) => distM(h, m)))) : null;
    h.byType = near.reduce((a, m) => ((a[m.type] = (a[m.type] ?? 0) + 1), a), {});
  }
  for (const m of marks) {
    const h = harbours.map((x) => ({ n: x.name, d: distM(x, m) })).sort((a, b) => a.d - b.d)[0];
    if (h && h.d <= 1500) m.nearHarbour = h.n;
  }
  const keep = (p) => inRegion(p);
  return {
    shoals: shoals.filter(keep).sort((a, b) => a.lat - b.lat || a.lon - b.lon),
    marks: marks.filter(keep).sort((a, b) => a.lat - b.lat || a.lon - b.lon),
    lines, harbours: harbours.filter(keep),
    timestamp: osm.osm3s?.timestamp_osm_base,
  };
}

const count = (arr, f) => arr.reduce((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const osm = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : await overpass();
  const { shoals, marks, lines, harbours, timestamp } = build(osm);
  const head = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'OpenStreetMap contributors, ODbL 1.0, via Overpass API (tools/fetch-seamarks.mjs)',
    credit: '© OpenStreetMap contributors',
    licence: 'ODbL 1.0',
    licenceUrl: 'https://www.openstreetmap.org/copyright',
    osmDataTimestamp: timestamp,
    region: REGION,
  };
  writeFileSync(join(OUT, 'shoals.json'), JSON.stringify({
    ...head,
    note: 'Real OSM positions only. kind=rock has level dry|awash|covers|submerged|unknown (Swedish chart wording). kind=named_shoal are shoals OSM names (-båd/-flu/-grund words) with a radiusM where OSM has an outline. No -grund/-grynna names exist in this box in OSM.',
    counts: { total: shoals.length, byKind: count(shoals, (s) => s.kind), rockByLevel: count(shoals.filter((s) => s.kind === 'rock'), (s) => s.level) },
    shoals,
  }, null, 1) + '\n');
  writeFileSync(join(OUT, 'seamarks.json'), JSON.stringify({
    ...head,
    note: 'IALA A (Sweden): red to port / green to starboard when entering from seaward. Cardinal colours: N black/yellow, E black/yellow/black, S yellow/black, W yellow/black/yellow. lights[].text is the standard abbreviation, e.g. "Q(3) W 10s".',
    counts: { total: marks.length, byType: count(marks, (m) => m.type), leadingLines: lines.length },
    harbours, marks, lines,
  }, null, 1) + '\n');
  console.log('shoals', shoals.length, count(shoals, (s) => s.kind));
  console.log('marks', marks.length, count(marks, (m) => m.type), 'lines', lines.length, 'harbours', harbours.length);
}
