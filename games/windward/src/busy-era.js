// Era logic for the busy coast, pure: which profile applies to a year, is a profile complete and does its kit know every asset it names,
// and which boat a route or a berth gets (deterministic from the route's / berth's own seed, so both players see the same boats).
// Data: data/busy-eras.json (profiles) and data/busy-world.json (era-neutral geometry). Kits: src/busy-kits.js.

// The profile whose [from, to] holds `year`, or null (before the first or after the last: no busy coast yet for that year).
export function profileForYear(eras, year) {
  return eras.profiles.find((p) => year >= p.from && year <= p.to) ?? null;
}

// A deterministic number in [0, 1) from a seed in [0, 1) and a small integer salt.
export function frac(seed, salt = 0) {
  let h = Math.imul(Math.floor(seed * 4294967296) ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const lerp = (a, b, t) => a + (b - a) * t;
const pickWeighted = (list, r) => { const total = list.reduce((n, a) => n + (a.weight ?? 1), 0); let acc = r * total; for (const a of list) { acc -= a.weight ?? 1; if (acc < 0) return a; } return list[list.length - 1]; };
const round1 = (v) => Math.round(v * 10) / 10;

// The vessel a traffic route gets from its class block (profile.traffic.classes[class]): { asset, stripe, L, speed, dwellS }.
export function vesselFor(classBlock, seed) {
  const a = pickWeighted(classBlock.assets, frac(seed, 1));
  return {
    asset: a.id,
    stripe: a.stripes ? a.stripes[Math.floor(frac(seed, 2) * a.stripes.length)] : undefined,
    L: a.length ? round1(lerp(a.length[0], a.length[1], frac(seed, 3))) : undefined,
    speed: round1(lerp(classBlock.speed[0], classBlock.speed[1], frac(seed, 4))),
    dwellS: Math.round(lerp(classBlock.dwellS[0], classBlock.dwellS[1], frac(seed, 5))),
  };
}
// The boat a berth gets (profile.moorings.classes[class]); never longer than the length the berth was planned for (fitL).
export function berthBoat(classBlock, berth) {
  const a = pickWeighted(classBlock.assets, frac(berth.seed, 1));
  const want = a.length ? lerp(a.length[0], a.length[1], frac(berth.seed, 3)) : berth.fitL;
  return {
    asset: a.id,
    stripe: a.stripes ? a.stripes[Math.floor(frac(berth.seed, 2) * a.stripes.length)] : undefined,
    L: round1(Math.min(want, berth.fitL)),
    lit: frac(berth.seed, 6) < (classBlock.litShare ?? 0.5),
  };
}
// How many berths of a harbour an era fills: fill (0..1) of its berths, at most maxPerHarbour, never fewer than 0.
export const berthsToFill = (profile, n) => Math.max(0, Math.min(profile.moorings.maxPerHarbour, Math.round(profile.moorings.fill * n)));
// The routes an era runs, in the profile's order, at most traffic.maxBoats.
export function routesFor(profile, world) {
  const list = profile.traffic.routes === 'all' ? world.traffic : profile.traffic.routes.map((id) => world.traffic.find((r) => r.id === id)).filter(Boolean);
  return list.slice(0, profile.traffic.maxBoats);
}

// Problems with a profile (empty = fine). `kit` is a kit from src/busy-kits.js: every asset id the profile names must exist in it, with the
// right kind, and every stripe / colour must be one the asset knows.
export function validateProfile(profile, kit, world = null) {
  const bad = [];
  const need = (cond, msg) => { if (!cond) bad.push(`${profile.id}: ${msg}`); };
  need(profile.from <= profile.to, 'from must be <= to');
  need(!!kit, `kit "${profile.kit}" is not registered`);
  if (!kit) return bad;
  const asset = (id, kind, where) => {
    const a = kit.assets[id];
    need(!!a, `${where}: asset "${id}" is not in kit "${kit.id}"`);
    if (a) need(a.kind === kind, `${where}: asset "${id}" is a ${a.kind}, expected ${kind}`);
    return a;
  };
  for (const [cls, block] of Object.entries(profile.traffic.classes)) {
    need(block.speed[0] > 0 && block.speed[0] <= block.speed[1], `traffic ${cls}: speed range`);
    need(block.dwellS[0] >= 0 && block.dwellS[0] <= block.dwellS[1], `traffic ${cls}: dwell range`);
    for (const a of block.assets) { const k = asset(a.id, 'vessel', `traffic ${cls}`); if (k && a.stripes) for (const s of a.stripes) need(k.stripes?.includes(s), `traffic ${cls}: stripe "${s}" unknown to ${a.id}`); }
  }
  for (const [cls, block] of Object.entries(profile.moorings.classes)) for (const a of block.assets) { const k = asset(a.id, 'vessel', `moorings ${cls}`); if (k && a.stripes) for (const s of a.stripes) need(k.stripes?.includes(s), `moorings ${cls}: stripe "${s}" unknown to ${a.id}`); }
  need(profile.moorings.fill >= 0 && profile.moorings.fill <= 1, 'moorings.fill must be 0..1');
  need(profile.traffic.maxBoats >= 0 && profile.traffic.maxBoats <= 12, 'traffic.maxBoats must be 0..12 (the budget)');
  if (profile.ferry.enabled) {
    asset(profile.ferry.asset, 'ferry', 'ferry');
    need(profile.ferry.speed > 0, 'ferry speed');
    need(Array.isArray(profile.ferry.dwellS) && profile.ferry.dwellS.length === 3, 'ferry dwellS needs one number per stop (3)');
  }
  const h = asset(profile.houses.asset, 'house', 'houses');
  if (h) for (const c of profile.houses.colours) need(h.colours?.includes(c), `houses: colour "${c}" unknown to ${profile.houses.asset}`);
  need(profile.houses.share >= 0 && profile.houses.share <= 0.6, 'houses.share must be 0..0.6');
  if (world) {
    if (profile.traffic.routes !== 'all') for (const id of profile.traffic.routes) need(world.traffic.some((r) => r.id === id), `route "${id}" is not in busy-world.json`);
    for (const r of world.traffic) need(!!profile.traffic.classes[r.class], `no traffic class "${r.class}" for route ${r.id}`);
    for (const m of world.moorings) for (const b of m.berths) need(!!profile.moorings.classes[b.class], `no mooring class "${b.class}" for berth in ${m.id}`);
  }
  return bad;
}
