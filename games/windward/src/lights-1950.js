// The lights as they stood in 1950, as game entries (the same shape as src/lighthouses.js LIGHTHOUSES: name, lat, lon, built, realHeight, light, lit, lightNote).
// Pure data + one function; no THREE. Sources: data/world-1950.json `lighthouses.list` (read in docs/WORLD-1950.md B), assets/coast/seamarks.json (OSM), names.json (OSM).
//
// What is here, and what is not:
//  - the lights that have a hand-made tower in LIGHTHOUSES (Måseskär, Islandsberg, Hättan, Gäven, Stångehuvud) keep their model; their 1950 CHARACTER and lit / dark
//    state replace today's (Hättan was B(2) WRG 15 s in 1950, Måseskär was lit in 1950 and white, Islandsberg's old house was dark since 1938 ...);
//  - the small automatic lights (fyrkurar) that this game can PLACE get the generic fyrkur model (src/era-assets.js `fyrkur1950`): Stångholmen and Fredagsholmen, the two
//    chapter 1 uses. Their positions are sourced below. The other four fyrkurar the data lists (Grötö, Gulskåren, Oxskär, Hängdyn) stood in 1950 but the data has no
//    position for them, so they are NOT drawn: reported in `notDrawn`, never guessed.
//  - Interpretation: the data gives Swedish characters as text ("Bx(3) WRG 9 s", "K WRG 4 s", "B(2) WRG 15 s"). The structured `light` below reads Bx as a flash,
//    B(n) as n flashes, K ("kvick", quick) as one flash per period: an approximation, flagged `characterUncertain`. TODO(felix): confirm against a Swedish list of lights.

const WRG = 'white, with red and green sectors';

// The generic-model lights. Positions: where the data gives none, the source is named in `positionSource`.
export const FYRKURAR_1950 = {
  stangholmen: {
    name: 'Stångholmen', built: 1940, station: null, realHeight: 4, area: 'Lysekil',
    lat: 58.26662, lon: 11.42047, model: 'fyrkur', characterUncertain: true,
    positionSource: 'the OSM islet named Stångholmen (assets/coast/names.json). The data says only "an island just off Lysekil harbour"; the light\'s own coordinates are not in our data.',
    positionUncertain: true,
    description: 'White octagonal sheet-metal fyrkur on a base, about 4 m (replaced by a round plastic one in 1974). AGA light, 6th-order lens.',
    light: { pattern: 'quick flashing, 4 s period (K WRG 4 s)', colour: WRG, kind: 'flash', count: 1, period: 4 },
  },
  fredagsholmen: {
    name: 'Fredagsholmen', built: 1942, station: 1917, realHeight: 5.5, area: 'Gullholmen',
    lat: 58.18649, lon: 11.42178, model: 'fyrkur', characterUncertain: true,
    positionSource: 'the OSM node "Fredagsholmen fyr" (assets/coast/seamarks.json, node/1531134954); the data says "on the south point of an island about 1.5 km east of Gullholmen".',
    positionUncertain: false,
    description: 'White sheet-metal fyrkur on a concrete base (1942; the year is 1943 in one source). AGA light since 1917.',
    light: { pattern: 'one flash every 3 s (Bx WRG 3 s)', colour: WRG, kind: 'flash', count: 1, period: 3 },
  },
};

// Kråksundsgap Södra as it stood in 1950: the small octagonal iron AGA lantern of 1941 (the 13 m white tower came in 1954: docs/PEOPLE-1950.md section 5). Position: the same point
// the game already uses for the modern tower (src/lighthouses.js, Bråtö's NW point). Character: the 1941 dated entry "Bx(2) WRG 7 s" read as two flashes per 7 s; 1950 itself is not on
// record, so it is flagged. The lantern is ~6 m focal height. In the story it is what you see first; the tall tower appears only in the glimpse (game.js).
export const KRAKSUNDSGAP_1950 = {
  name: 'Kråksundsgap Södra', built: 1941, station: 1911, realHeight: 6, area: 'Orust', lat: 58.1005563, lon: 11.4404817, model: 'fyrkur', characterUncertain: true, positionUncertain: false,
  positionSource: 'src/lighthouses.js (the modern tower\'s position; Bråtö, NW point)',
  description: 'Small octagonal iron lantern with an AGA light (exchanged 1 Nov 1941). The 13 m white tower replaced it in 1954.',
  light: { pattern: 'two flashes every 7 s (Bx(2) WRG 7 s)', colour: WRG, kind: 'flash', count: 2, period: 7 },
};

// 1950 overrides for the lights that have a tower model: the character and the state then. By name.
export const LIGHT_1950 = {
  'Måseskär': { light: { pattern: 'three white flashes every 30 s (Bx(3) W 30 s)', colour: 'white', kind: 'flash', count: 3, period: 30 }, note: 'Lit and manned in 1950: three keepers. White, NOT red (the fixed red light was 1865-1887). Electric lamp from 1950.', characterUncertain: true },
  'Hättan': { light: { pattern: 'two flashes every 15 s (B(2) WRG 15 s)', colour: WRG, kind: 'flash', count: 2, period: 15 }, note: 'Unmanned AGA light since 1938. The character changed in 1973.', characterUncertain: true },
  'Gäven': { light: { pattern: 'three flashes every 9 s (Bx(3) WRG 9 s)', colour: WRG, kind: 'flash', count: 3, period: 9 }, note: 'Unmanned AGA light since 1917; the 1941 tower with its black band.', characterUncertain: true },
  'Islandsberg': { light: null, note: 'The game\'s tower is the old keeper\'s-house light, dark since 1938 (a new concrete tower 425 m north was lit in 1950 but has no model).' },
  'Stångehuvud': { light: null, note: 'Dark: the light was put out in 1940 (replaced by Stångholmen).' },
};

// The lights of a spec (worldAtYear(...).lighthouses) as game entries. Returns { entries, notDrawn }.
// entries: [{ ...LIGHTHOUSES-shaped, id, lit, manned, keeperHouse, model: 'tower' | 'fyrkur' }], notDrawn: [{ id, name, why }].
export function lightEntriesFor(spec, LIGHTHOUSES) {
  const entries = [], notDrawn = [];
  for (const l of spec.lighthouses || []) {
    const lit = !!l.lit && l.manned !== 'dark';
    const base = LIGHTHOUSES.find((e) => e.name === l.name);
    const fyr = FYRKURAR_1950[l.id];
    if (base) {
      const ov = LIGHT_1950[base.name] || {};
      entries.push({ ...base, id: l.id, lit, manned: l.manned, keeperHouse: !!l.keeperHouse, model: 'tower', light: ov.light !== undefined ? ov.light : base.light, lightNote: ov.note ?? base.lightNote ?? null, characterUncertain: !!ov.characterUncertain, uncertain: !!l.uncertain });
    } else if (fyr) {
      entries.push({ ...fyr, id: l.id, lit, manned: l.manned, keeperHouse: false, lightNote: null, uncertain: !!l.uncertain });
    } else {
      notDrawn.push({ id: l.id, name: l.name, why: l.lat == null ? 'stood in 1950 but the data has no position for it (never guessed)' : 'no model' });
    }
  }
  if (spec.era === '1950') entries.push({ ...KRAKSUNDSGAP_1950, id: 'kraksundsgap_sodra', lit: true, manned: 'unmanned', keeperHouse: false, lightNote: 'Octagonal iron fyrkur, AGA light. Exchanged 1941; the white concrete tower came in 1954.', uncertain: true });
  return { entries, notDrawn };
}
