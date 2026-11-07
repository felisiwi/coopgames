// Kits for the busy coast: a kit is a named set of ASSETS the engine (src/busy-coast.js) can stamp, plus the colour of its window glass.
// An era profile (data/busy-eras.json) names a kit and the asset ids it wants; nothing in the engine knows what a "sailboat" is.
//
// Two kits: 'today' (the modern leisure kit in src/era-assets.js, still the PLACEHOLDER for the 1980 profile) and '1950' (wooden sailboat, snipa with an engine,
// fishing boat, 1950s ferry, village house: the same file's 1950 section). To add one: write the add-functions (addX(S, G, opts), like era-assets.js), register a kit with registerKit(),
// and point the profile's `kit` and asset ids at it. The engine, the data and the tests do not change.
//
// A kit: { id, label, glass: { day, lit, off }, buoy?: colour of its mooring buoys, assets }.
// A vessel asset may also have look(seed) -> a look object (src/boat-looks.js: hull, sail, rig, details drawn from the boat's seed within its era's rules). buildAsset() below calls it and hands
// the result to build() as opts.look; an asset with no look() is built as before.
// An asset: { kind: 'vessel' | 'ferry' | 'house', build(S, G, opts), halfLen(opts) (vessels and the ferry, metres: the give-way circle),
//             nativeLength? (a ferry: the length it is modelled at; the engine passes opts.scale = profile length / nativeLength),
//             stripes?, colours?, doc }.  build() writes triangles into S (opaque) and G.on / G.off (lit / unlit window glass), in the
// local frame of era-assets.js: y up, waterline y = 0, boats point +z. The engine moves, rotates and merges them.
import { addSailboat, addMotorboat, addFerry, addSummerHouse, STRIPES, HOUSE_COLOURS, GLASS,
  addSailboat1950, addSnipa1950, addFishingBoat1950, addFerry1950, addHouse1950, SNIPA_COLOURS, FISHBOAT_COLOURS, HOUSE_1950_COLOURS } from './era-assets.js';
import { lookFor, RULES } from './boat-looks.js';

const kits = new Map();
export function registerKit(kit) {
  if (!kit?.id || !kit.assets || !kit.glass) throw new TypeError('registerKit: a kit needs { id, assets, glass: { day, lit, off } }');
  kits.set(kit.id, kit);
  return kit;
}
export const getKit = (id) => kits.get(id) ?? null;
// Build one asset into S / G (the engine's template() and the boats lab both come through here, so the game and the lab draw the SAME boat for a seed). opts.seed (a boat's own seed in [0, 1)) makes
// the asset's look(); opts.look overrides it (tests). Returns the look used (or null).
export function buildAsset(kit, assetId, opts, S, G) {
  const A = kit.assets[assetId];
  const look = opts.look !== undefined ? opts.look : (A.look && opts.seed != null ? A.look(opts.seed) : null);
  A.build(S, G, { ...opts, look });
  return look;
}
export const kitIds = () => [...kits.keys()];

registerKit({
  id: 'today',
  label: 'Today (modern leisure kit, era-assets.js)',
  glass: GLASS.today,
  buoy: 0xea9a68, // mooring buoy colour (era-assets.js palette orange); a kit without `buoy` draws no buoys
  assets: {
    sailboat: { kind: 'vessel', stripes: Object.keys(STRIPES), halfLen: (o) => (o.L ?? 9) / 2, look: (seed) => lookFor('sailboat', seed), build: (S, G, o) => addSailboat(S, G, { L: o.L ?? 9, stripe: o.look?.accent ?? o.stripe ?? 'navy', sailsUp: o.sailsUp ?? true, lod: !!o.lod, lit: o.lit !== false, look: o.look }), doc: 'white hull and sails, a pastel cove stripe, ~9 m' },
    motorboat: { kind: 'vessel', stripes: Object.keys(STRIPES), halfLen: (o) => (o.L ?? 6.2) / 2, look: (seed) => lookFor('motorboat', seed), build: (S, G, o) => addMotorboat(S, G, { L: o.L ?? 6.2, stripe: o.look?.accent ?? o.stripe ?? 'coral', lod: !!o.lod, lit: o.lit !== false, look: o.look }), doc: 'small open motorboat with an outboard, ~6 m' },
    ferry: { kind: 'ferry', nativeLength: 24, halfLen: (o) => 12 * (o.scale ?? 1), build: (S, G, o) => S.at({ s: o.scale ?? 1 }, () => addFerry(S, G, { lit: o.lit !== false })), doc: 'the Lysekil-Fiskebäckskil passenger ferry (line 847), natively 24 m; the profile sets its length (the engine scales it)' },
    summerhouse: { kind: 'house', colours: Object.keys(HOUSE_COLOURS), build: (S, G, o) => addSummerHouse(S, G, { colour: o.colour ?? 'cream', lit: o.lit !== false }), doc: 'painted board summer house with big sea-facing windows' },
  },
});

// The 1950 kit. The engine passes `stripe` (the colour name from the profile); the snipa and fishing boat call that their `variant`, so build() translates.
registerKit({
  id: '1950',
  label: '1950 (wooden boats, snipa + engine, village houses; era-assets.js)',
  glass: GLASS.y1950,
  buoy: 0xb54a3c, // a plain red mooring buoy (the 1950 sea-mark red); TODO(felix): confirm the colour of 1950 mooring buoys
  assets: {
    sailboat1950: { kind: 'vessel', stripes: ['white', 'cream', 'paleblue', 'green'], halfLen: (o) => (o.L ?? 8) / 2, look: (seed) => lookFor('sailboat1950', seed), build: (S, G, o) => addSailboat1950(S, G, { L: o.L ?? 8, sailsUp: o.sailsUp ?? true, lit: o.lit !== false, look: o.look }), doc: 'wooden sailboat, white hull, cotton sails, ~8 m' },
    snipa1950: { kind: 'vessel', stripes: Object.keys(SNIPA_COLOURS), halfLen: (o) => (o.L ?? 6.6) / 2, look: (seed) => lookFor('snipa1950', seed), build: (S, G, o) => addSnipa1950(S, G, { variant: o.look?.hullName ?? o.stripe ?? 'white', L: o.L ?? 6.6, lit: o.lit !== false, look: o.look }), doc: 'snipa (a small open boat) with an inboard-engine box, ~6.6 m' },
    fishboat1950: { kind: 'vessel', stripes: Object.keys(FISHBOAT_COLOURS), halfLen: (o) => (o.L ?? 11.5) / 2, look: (seed) => lookFor('fishboat1950', seed), build: (S, G, o) => addFishingBoat1950(S, G, { variant: o.look?.hullName ?? o.stripe ?? 'white', L: o.L ?? 11.5, lit: o.lit !== false, look: o.look }), doc: 'wooden fishing boat with a wheelhouse, modelled at 11.5 m' },
    ferry1950: { kind: 'ferry', nativeLength: 17, halfLen: (o) => 8.5 * (o.scale ?? 1), build: (S, G, o) => S.at({ s: o.scale ?? 1 }, () => addFerry1950(S, G, { L: 17, lit: o.lit !== false })), doc: 'a 1950s passenger ferry, natively 17 m; the profile sets its length' },
    house1950: { kind: 'house', colours: Object.keys(HOUSE_1950_COLOURS), build: (S, G, o) => addHouse1950(S, G, { colour: o.colour ?? 'red', lit: o.lit !== false }), doc: 'village house in 1950 paint (red, white or ochre)' },
  },
});
