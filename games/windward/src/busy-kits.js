// Kits for the busy coast: a kit is a named set of ASSETS the engine (src/busy-coast.js) can stamp, plus the colour of its window glass.
// An era profile (data/busy-eras.json) names a kit and the asset ids it wants; nothing in the engine knows what a "sailboat" is.
//
// Today: the only kit so far, the modern leisure kit in src/era-assets.js. It stands in as a PLACEHOLDER for the 1950 and 1980 profiles
// until a 1950s kit exists. To add one: write the add-functions (addX(S, G, opts), like era-assets.js), register a kit with registerKit(),
// and point the profile's `kit` and asset ids at it. The engine, the data and the tests do not change.
//
// A kit: { id, label, glass: { day, lit, off }, buoy?: colour of its mooring buoys, assets }.
// An asset: { kind: 'vessel' | 'ferry' | 'house', build(S, G, opts), halfLen(opts) (vessels and the ferry, metres: the give-way circle),
//             nativeLength? (a ferry: the length it is modelled at; the engine passes opts.scale = profile length / nativeLength),
//             stripes?, colours?, doc }.  build() writes triangles into S (opaque) and G.on / G.off (lit / unlit window glass), in the
// local frame of era-assets.js: y up, waterline y = 0, boats point +z. The engine moves, rotates and merges them.
import { addSailboat, addMotorboat, addFerry, addSummerHouse, STRIPES, HOUSE_COLOURS, GLASS } from './era-assets.js';

const kits = new Map();
export function registerKit(kit) {
  if (!kit?.id || !kit.assets || !kit.glass) throw new TypeError('registerKit: a kit needs { id, assets, glass: { day, lit, off } }');
  kits.set(kit.id, kit);
  return kit;
}
export const getKit = (id) => kits.get(id) ?? null;
export const kitIds = () => [...kits.keys()];

registerKit({
  id: 'today',
  label: 'Today (modern leisure kit, era-assets.js)',
  glass: GLASS.today,
  buoy: 0xea9a68, // mooring buoy colour (era-assets.js palette orange); a kit without `buoy` draws no buoys
  assets: {
    sailboat: { kind: 'vessel', stripes: Object.keys(STRIPES), halfLen: (o) => (o.L ?? 9) / 2, build: (S, G, o) => addSailboat(S, G, { L: o.L ?? 9, stripe: o.stripe ?? 'navy', sailsUp: o.sailsUp ?? true, lod: !!o.lod, lit: o.lit !== false }), doc: 'white hull and sails, a pastel cove stripe, ~9 m' },
    motorboat: { kind: 'vessel', stripes: Object.keys(STRIPES), halfLen: (o) => (o.L ?? 6.2) / 2, build: (S, G, o) => addMotorboat(S, G, { L: o.L ?? 6.2, stripe: o.stripe ?? 'coral', lod: !!o.lod, lit: o.lit !== false }), doc: 'small open motorboat with an outboard, ~6 m' },
    ferry: { kind: 'ferry', nativeLength: 24, halfLen: (o) => 12 * (o.scale ?? 1), build: (S, G, o) => S.at({ s: o.scale ?? 1 }, () => addFerry(S, G, { lit: o.lit !== false })), doc: 'the Lysekil-Fiskebäckskil passenger ferry (line 847), natively 24 m; the profile sets its length (the engine scales it)' },
    summerhouse: { kind: 'house', colours: Object.keys(HOUSE_COLOURS), build: (S, G, o) => addSummerHouse(S, G, { colour: o.colour ?? 'cream', lit: o.lit !== false }), doc: 'painted board summer house with big sea-facing windows' },
  },
});
