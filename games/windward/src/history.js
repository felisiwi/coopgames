// Pure year logic for the settlements layer (no DOM), so it can be tested in Node.
// Data shape: see data/settlements-history.json (phases, population[], firstRecorded).

export const YEAR_MAX = 2025;
export const GAP_MAX = 60;       // interpolate only between counts at most this many years apart
export const NEAR_MAX = 15;      // otherwise use the nearest count only if it is this close
export const KINDS = ['hamlet', 'herring-boom', 'decline', 'canning/industry', 'resort'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The phase covering year y. Several cover it: the latest-starting wins. "to": null = no end year stated (open to yearMax).
export function phaseAt(s, y, yearMax = YEAR_MAX) {
  let best = null;
  for (const p of s.phases || []) {
    const end = p.to ?? yearMax;
    if (p.from != null && p.from <= y && y <= end && (!best || p.from >= best.from)) best = p;
  }
  return best;
}

// Origin year used for showing a village: the exact first record, else the approximate one
// (firstRecordedApprox, e.g. "sedan 1500-talet" -> 1500), else null = unknown (drawn at every year).
export function originYear(s) {
  if (s.firstRecorded != null) return s.firstRecorded;
  return s.firstRecordedApprox?.year ?? null;
}

// Human label for an approximate origin: "~1500s", "by ~1600s", "~late 1500s", "by 1752", "by ~1900".
export function approxLabel(a) {
  if (!a) return null;
  const c = Math.floor(a.year / 100) * 100;
  let core;
  if (a.precision === 'century') core = `~${c}s`;
  else if (a.precision === 'half-century') core = a.year % 100 >= 50 && a.year % 100 !== 0 ? `~late ${c}s` : `~${a.year}`;
  else core = `${a.year}`;
  const label = a.atLeast ? `by ${core}` : core;
  return a.kind === 'legend' ? `${label} (legend)` : a.kind === 'name' ? `${label} (name)` : label;
}

// null before the origin; otherwise { kind, phase } (kind 'hamlet' = plain settled, a display default).
export function stateAt(s, y, yearMax = YEAR_MAX) {
  const o = originYear(s);
  if (o != null && y < o) return null;
  const ph = phaseAt(s, y, yearMax);
  return { kind: ph ? ph.kind : 'hamlet', phase: ph };
}

// Population at a year from COUNTED observations only.
//   exact year -> that count;  between two counts <= GAP_MAX years apart -> straight-line interpolation;
//   otherwise the nearest count if within NEAR_MAX years;  otherwise null (the house is "estimated").
// opts.useDdb = false leaves out rows tagged licence 'ddb-restricted'.
export function populationAt(s, y, { useDdb = true } = {}) {
  const obs = (s.population || []).filter((o) => useDdb || o.licence !== 'ddb-restricted').sort((a, b) => a.year - b.year);
  if (!obs.length) return null;
  const exact = obs.find((o) => o.year === y);
  if (exact) return { value: exact.value, mode: 'counted', year: y, counts: exact.counts };
  const before = [...obs].reverse().find((o) => o.year < y), after = obs.find((o) => o.year > y);
  if (before && after && after.year - before.year <= GAP_MAX) {
    const t = (y - before.year) / (after.year - before.year);
    return { value: Math.round(before.value + (after.value - before.value) * t), mode: 'interpolated', year: y, from: before, to: after, counts: before.counts };
  }
  const near = [before, after].filter(Boolean).sort((a, b) => Math.abs(a.year - y) - Math.abs(b.year - y))[0];
  if (near && Math.abs(near.year - y) <= NEAR_MAX) return { value: near.value, mode: 'nearest', year: near.year, counts: near.counts };
  return null;
}

// House width in CSS px for a population, on a log scale: 80 -> ~15, 1,000 -> ~25, 570,000 -> ~50.
export const houseWidth = (pop) => clamp(10 + 9 * Math.log10(Math.max(pop, 1) / 20), 11, 54);
