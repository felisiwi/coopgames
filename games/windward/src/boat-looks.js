// What each boat of the busy coast looks like, drawn deterministically from the boat's own seed (both phones see the same boat), within what its ERA allows.
// Pure data and maths: no THREE, no DOM, no Math.random(). The research behind every table is docs/BOATS-BY-ERA.md ([doc] = a source says it, [designer] = a choice of the game).
//
//   lookFor(assetId, seed) -> { hull, hullName, ... }   the look a boat of that kit asset gets (the model builders read it as opts.look)
//   lookIssues(assetId, look) -> []                     problems with a look against its era's rules (empty = allowed); the tests check every seed
//   ERA_OF[assetId] -> 'today' | '1950'
//
// A look is a plain object: hull / sail / accent colours as hex numbers (with their names for the tests and the lab), a rig name, and a few yes/no details.
// The rules, in one place (the tables below), are: 1950 working boats get gaff or sprit rigs and tanbark sails, never a white Bermuda rig; Bermuda is for
// folkbåt-type yachts and "modernised" kosters; ekas are mostly rowed; no fibreglass colours or RIBs before the 1960s. Today is Bermuda only, white most often.
import { frac } from './busy-era.js';

const pick = (list, r) => { // list of [value, weight]
  const total = list.reduce((n, [, w]) => n + w, 0); let acc = r * total;
  for (const [v, w] of list) { acc -= w; if (acc < 0) return v; }
  return list[list.length - 1][0];
};
const named = (table) => Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v]));

// ---- colours: { name: hex } ------------------------------------------------------------------------------------------------------------------------------------
export const TODAY_HULLS = named({ white: 0xf4f2ea, navy: 0x6f8fb3, grey: 0xc9ced3, sand: 0xe0c48e, sage: 0x9fbf9c, coral: 0xe39a8a });
export const TODAY_SAILS = named({ white: 0xf7f4ec, cream: 0xefe6cf, grey: 0xdadee2 });
export const TUBES = named({ charcoal: 0x4a4d57, grey: 0xc9ced3, orange: 0xea9a68 }); // [designer] RIB tubes
export const Y1950_HULLS = named({ white: 0xeae6da, cream: 0xe3d8bc, paleblue: 0xa9bccb, green: 0x7fa08a, blue: 0x7f9bb8, tar: 0x4b3d34, tarbrown: 0x5b4636, yellowtar: 0xc9a24d, dark: 0x2f3b3a, workgreen: 0x5f7f6c });
export const Y1950_SAILS = named({ cotton: 0xeee3c8, cottonshade: 0xdfd2b3, tanbark: 0xa7714b });
export const STRAKES_1950 = named({ white: 0xf0ebdf, green: 0x4f6f5c, navy: 0x4d6784, redbrown: 0x8f4a3a }); // [designer] the sheer strake (top plank) of a 1950 yacht: painted or varnished

// ---- per type rules: [name, weight] lists. `era` decides what is allowed (checked by lookIssues) ------------------------------------------------------------------
export const RULES = {
  // TODAY (2000-2026; the 1980-1999 profile uses the same kit)
  sailboat: { era: 'today', hulls: [['white', 7], ['navy', 1.3], ['grey', 1], ['sage', 0.6]], sails: [['white', 8], ['cream', 1.2], ['grey', 1]], rigs: [['sloop', 8], ['main', 1.5]], flag: 0.6, hood: 0.55 },
  motorboat: { era: 'today', hulls: [['white', 6], ['grey', 1.5], ['navy', 1.5], ['sand', 1], ['coral', 0.6]], rigs: [['open', 1]], flag: 0.5, canopy: 0.35 },
  daysailer: { era: 'today', hulls: [['white', 6], ['navy', 1], ['sand', 1], ['sage', 1]], sails: [['white', 8], ['cream', 1.5], ['grey', 1]], rigs: [['sloop', 6], ['cat', 3]], flag: 0.3 },
  rib: { era: 'today', hulls: [['white', 4], ['grey', 2], ['navy', 2]], tubes: [['charcoal', 4], ['grey', 2], ['orange', 1]], rigs: [['single', 3], ['twin', 1]], flag: 0.3 },
  // 1950 (docs/BOATS-BY-ERA.md): wooden boats; no fibreglass, no RIBs
  sailboat1950: { era: '1950', hulls: [['white', 5], ['cream', 3], ['paleblue', 1], ['green', 1]], sails: [['cotton', 7], ['cottonshade', 2]], rigs: [['sloop', 8], ['main', 1.5]], flag: 0.5, doghouse: 0.6, strakes: [['white', 4], ['green', 1.5], ['navy', 1.5], ['redbrown', 1.2]] },
  snipa1950: { era: '1950', hulls: [['white', 4], ['green', 2], ['blue', 2], ['tar', 1], ['yellowtar', 0.7]], sails: [['tanbark', 4], ['cotton', 2]], rigs: [['motor', 8], ['sprit', 2]], flag: 0.4, shelter: 0.65 },
  fishboat1950: { era: '1950', hulls: [['white', 5], ['dark', 2], ['workgreen', 2], ['tarbrown', 1]], sails: [['tanbark', 5], ['cotton', 1.5]], rigs: [['steady', 6], ['none', 4]], house: [['white', 6], ['cream', 2], ['workgreen', 1]], floats: [0, 4] },
  eka1950: { era: '1950', hulls: [['tarbrown', 3], ['tar', 1.5], ['white', 2], ['green', 1.2], ['paleblue', 1.2]], sails: [['tanbark', 5], ['cotton', 2]], rigs: [['rowed', 7], ['sprit', 3]] },
  koster1950: { era: '1950', fishing: { hulls: [['tar', 3], ['white', 3], ['yellowtar', 1], ['workgreen', 1]], sails: [['tanbark', 6], ['cotton', 1]] }, yacht: { hulls: [['white', 4], ['cream', 3], ['paleblue', 1]], sails: [['cotton', 7], ['cottonshade', 2]] }, roles: [['fishing', 55], ['yacht', 45]], flag: 0.4 },
};
export const ERA_OF = Object.fromEntries(Object.entries(RULES).map(([id, r]) => [id, r.era]));
export const HULL_TABLE = { today: TODAY_HULLS, '1950': Y1950_HULLS };
export const SAIL_TABLE = { today: TODAY_SAILS, '1950': Y1950_SAILS };
// Rigs that are allowed per type (a second statement of the rules that lookIssues checks the draw against).
export const ALLOWED_RIGS = {
  sailboat: ['sloop', 'main'], motorboat: ['open'], daysailer: ['sloop', 'cat'], rib: ['single', 'twin'],
  sailboat1950: ['sloop', 'main'], snipa1950: ['motor', 'sprit'], fishboat1950: ['steady', 'none'], eka1950: ['rowed', 'sprit'], koster1950: ['gaff', 'bermuda'],
};

export const hasLook = (assetId) => assetId in RULES;

// The look for a boat of `assetId` with this seed in [0, 1). Salts 20.. keep these draws apart from vesselFor's (1-6) and berthBoat's.
export function lookFor(assetId, seed) {
  const R = RULES[assetId];
  if (!R) return null;
  const r = (salt) => frac(seed, 20 + salt);
  const hullName = R.hulls ? pick(R.hulls, r(1)) : null; // (the koster draws its hull inside its role below)
  const beamK = Math.round((0.94 + 0.12 * r(2)) * 100) / 100; // the beam varies 94-106 %: some boats are beamier
  const base = { era: R.era, beamK };
  switch (assetId) {
    case 'sailboat': case 'sailboat1950': {
      const hulls = HULL_TABLE[R.era], sails = SAIL_TABLE[R.era];
      const sailName = pick(R.sails, r(3));
      const strakeName = R.strakes ? pick(R.strakes, r(10)) : null;
      return { ...base, hullName, hull: hulls[hullName], sailName, sail: sails[sailName], rig: pick(R.rigs, r(4)), flag: r(5) < R.flag, hood: r(6) < (R.hood ?? 0), doghouse: r(6) < (R.doghouse ?? 1), accent: pick([['navy', 1], ['coral', 1], ['sage', 1], ['sand', 1]], r(7)), ...(strakeName ? { strakeName, strake: STRAKES_1950[strakeName] } : {}) };
    }
    case 'motorboat': {
      return { ...base, hullName, hull: TODAY_HULLS[hullName], rig: 'open', flag: r(5) < R.flag, canopy: r(6) < R.canopy, accent: pick([['navy', 1], ['coral', 1], ['sage', 1], ['sand', 1]], r(7)), outboard: pick([['charcoal', 4], ['white', 2]], r(8)) };
    }
    case 'daysailer': {
      const sailName = pick(R.sails, r(3));
      return { ...base, hullName, hull: TODAY_HULLS[hullName], sailName, sail: TODAY_SAILS[sailName], rig: pick(R.rigs, r(4)), flag: r(5) < R.flag, accent: pick([['navy', 1], ['coral', 1], ['sage', 1], ['sand', 1]], r(7)) };
    }
    case 'rib': {
      const tubeName = pick(R.tubes, r(3));
      return { ...base, hullName, hull: TODAY_HULLS[hullName], tubeName, tube: TUBES[tubeName], rig: pick(R.rigs, r(4)), flag: r(5) < R.flag };
    }
    case 'snipa1950': {
      const sailName = pick(R.sails, r(3));
      return { ...base, hullName, hull: Y1950_HULLS[hullName], sailName, sail: Y1950_SAILS[sailName], rig: pick(R.rigs, r(4)), flag: r(5) < R.flag, shelter: r(6) < R.shelter };
    }
    case 'fishboat1950': {
      const sailName = pick(R.sails, r(3)), houseName = pick(R.house, r(6));
      return { ...base, hullName, hull: Y1950_HULLS[hullName], sailName, sail: Y1950_SAILS[sailName], rig: pick(R.rigs, r(4)), houseName, house: Y1950_HULLS[houseName], floats: R.floats[0] + Math.floor(r(7) * (R.floats[1] - R.floats[0] + 1)) };
    }
    case 'eka1950': {
      const sailName = pick(R.sails, r(3));
      return { ...base, hullName, hull: Y1950_HULLS[hullName], sailName, sail: Y1950_SAILS[sailName], rig: pick(R.rigs, r(4)) };
    }
    case 'koster1950': {
      const role = pick(R.roles, r(9)), T = R[role];
      const hn = pick(T.hulls, r(1)), sn = pick(T.sails, r(3));
      return { ...base, role, hullName: hn, hull: Y1950_HULLS[hn], sailName: sn, sail: Y1950_SAILS[sn], rig: role === 'fishing' ? 'gaff' : 'bermuda', flag: r(5) < R.flag, jib: r(6) < 0.8 };
    }
    default: return null;
  }
}

// Problems with a look for this asset against its era's rules (empty = allowed).
export function lookIssues(assetId, look) {
  const R = RULES[assetId], bad = [];
  if (!R) return [`no rules for "${assetId}"`];
  if (!look) return ['no look'];
  const need = (c, m) => { if (!c) bad.push(`${assetId}: ${m}`); };
  need(look.era === R.era, `era ${look.era} != ${R.era}`);
  const hulls = HULL_TABLE[R.era], sails = SAIL_TABLE[R.era];
  const hullList = assetId === 'koster1950' ? [...R.fishing.hulls, ...R.yacht.hulls] : R.hulls;
  need(hullList.some(([n]) => n === look.hullName) && hulls[look.hullName] === look.hull, `hull ${look.hullName} is not allowed in ${R.era}`);
  need(ALLOWED_RIGS[assetId].includes(look.rig), `rig ${look.rig} is not allowed`);
  if (look.sailName !== undefined) need(!!sails[look.sailName] && sails[look.sailName] === look.sail, `sail ${look.sailName} is not an ${R.era} sail`);
  need(look.beamK >= 0.94 && look.beamK <= 1.06, 'beamK out of range');
  if (R.era === 'today') { need(!('role' in look), 'no koster roles today'); need(look.rig !== 'gaff' && look.rig !== 'sprit' && look.rig !== 'bermuda', 'old rigs have no place today'); if (look.sailName) need(look.sailName !== 'tanbark' && look.sailName !== 'cotton' && look.sailName !== 'cottonshade', 'no tanbark or cotton sails today'); }
  if (R.era === '1950') {
    need(!('tube' in look), 'no RIB tubes in 1950');
    need(!Object.keys(TODAY_HULLS).some((n) => TODAY_HULLS[n] === look.hull && !(n in Y1950_HULLS)), 'a Today-only hull colour in 1950');
    if (look.rig === 'bermuda') need(assetId === 'koster1950' && look.role === 'yacht', 'Bermuda only for a modernised koster yacht');
    if (assetId === 'sailboat1950') need(look.rig === 'sloop' || look.rig === 'main', 'folkbåt-type yachts are Bermuda sloops');
    if (assetId === 'koster1950' && look.role === 'fishing') { need(look.rig === 'gaff', 'a working koster is gaff-rigged'); need(look.sailName === 'tanbark' || look.sailName === 'cotton', 'a working koster has tanbark or cotton sails'); need(look.hullName !== 'paleblue' && look.hullName !== 'cream', 'a working koster is not pale-painted'); }
    if (assetId === 'fishboat1950') need(look.rig === 'steady' || look.rig === 'none', 'a fishing boat carries no Bermuda or gaff rig');
    if (assetId === 'eka1950' && look.rig === 'sprit') need(look.sailName === 'tanbark' || look.sailName === 'cotton', 'an eka\'s sprit sail is tanbark or cotton');
  }
  return bad;
}
