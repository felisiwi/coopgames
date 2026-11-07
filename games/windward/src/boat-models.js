// The boats the research said were missing (docs/BOATS-BY-ERA.md): in 1950 a KOSTER (a gaff-rigged working boat, or a Bermuda "modernised" yacht) and an EKA (rowed, or with a sprit sail);
// today a DAYSAILER and a RIB. Same add-function style as era-assets.js (addX(S, G, opts), local frame: y up, waterline y = 0, boats point +z), reusing its hull and sail helpers.
// Each reads an optional `look` (src/boat-looks.js: hull, sail, rig, flag, beam); with none it draws a sensible default. Shapes follow the research summaries, NOT drawings: designer's choices throughout.
import { STRIPES, F50, C, hullStations, loft, atZ, sail3, quadSail, shade, addFlag } from './era-assets.js';

// ---- 1950 -------------------------------------------------------------------------------------------------------------------------------------------------------------
// A KOSTER: broad, clinker, decked (sv.wikipedia Kosterbåt). role 'fishing': gaff mainsail, a bowsprit and a staysail, tanbark sails, a tarred or white hull. role 'yacht' (a "modernised koster"): Bermuda main + jib,
// white or cream hull, a deckhouse with windows. ~9 m (the engine's 10 m cap). Both ways the shape is the same broad hull; the rig and the house differ.
export function addKoster1950(S, G, { L = 9.2, lit = true, lod = false, look = null } = {}) {
  const role = look?.role ?? 'fishing', hullC = look?.hull ?? 0xeae6da, sailC = look?.sail ?? (role === 'yacht' ? F50.cotton : 0xa7714b);
  const dark = ['tar', 'tarbrown', 'dark'].includes(look?.hullName); // a tarred or dark hull has a lighter top strake, a pale one a red boot-top
  const st = hullStations({ L, B: L * 0.34 * (look?.beamK ?? 1), n: lod ? 6 : 9, sheer0: 0.78, riseBow: 0.62, riseStern: 0.2, keelD: 0.8, peak: 0.52, pBow: 1.25, pStern: 1.7, sternW0: 0.3 });
  loft(S, st, { bands: [[0.14, dark ? shade(hullC, 1.5) : hullC], [0.52, hullC], [0.6, dark ? shade(hullC, 0.85) : F50.falu], [1, F50.bottom]], deck: F50.deck, pf: 0.5 });
  const dy = (z) => atZ(st, z, 'sheer');
  if (role === 'yacht') {
    const cz = -L * 0.04, base = dy(cz), cl = L * 0.3, cw = st[4].w * 1.25;
    S.box(0, base + 0.3, cz, cw, 0.6, cl, F50.hullWhite); // the deckhouse
    S.box(0, base + 0.62, cz, cw * 0.9, 0.05, cl * 0.9, F50.deck);
    if (!lod) for (const side of [1, -1]) for (const z of [cz - cl * 0.22, cz + cl * 0.22]) (lit ? G.on : G.off).quad([side * (cw / 2 + 0.03), base + 0.22, z - 0.2], [side * (cw / 2 + 0.03), base + 0.22, z + 0.2], [side * (cw / 2 + 0.03), base + 0.48, z + 0.2], [side * (cw / 2 + 0.03), base + 0.48, z - 0.2], null);
    const mz = L * 0.14, top = base + L * 1.15;
    S.tube([0, base, mz], [0, top, mz], 0.07, 0.04, 5, F50.wood); // the mast
    const boomY = base + 1.0, boomLen = L * 0.36;
    S.tube([0, boomY, mz - 0.05], [0, boomY - 0.02, mz - boomLen], 0.045, 0.04, 4, F50.wood);
    sail3(S, [0, boomY + 0.05, mz - 0.07], [0, top - 0.4, mz - 0.07], [0, boomY + 0.05, mz - boomLen], 0.34, sailC); // Bermuda main
    if (look?.jib !== false && !lod) sail3(S, [0, dy(L / 2) + 0.2, L / 2 - 0.3], [0, top - 1.2, mz + 0.05], [0.07, base + 0.7, mz - 0.9], 0.24, shade(sailC, 0.96));
  } else {
    const hz = -L * 0.22, base = dy(hz);
    S.box(0, base + 0.5, hz, 1.2, 1.0, 1.4, F50.hullWhite); // a small wheel shelter aft (a little engine: the working koster had one by 1950)
    S.box(0, base + 1.02, hz, 1.35, 0.06, 1.55, F50.black);
    if (!lod) (lit ? G.on : G.off).quad([-0.4, base + 0.55, hz + 0.72], [0.4, base + 0.55, hz + 0.72], [0.4, base + 0.9, hz + 0.72], [-0.4, base + 0.9, hz + 0.72], null);
    S.box(0, base + 0.2, L * 0.02, 1.3, 0.36, 1.5, F50.grey); // hatch
    const mz = L * 0.28, mb = dy(mz), top = mb + L * 0.95;
    S.tube([0, mb, mz], [0, top, mz], 0.1, 0.06, 5, F50.wood); // mast
    const boomY = mb + 1.15, boomLen = L * 0.38, gaffY = mb + L * 0.62;
    S.tube([0, boomY, mz - 0.06], [0, boomY, mz - boomLen], 0.05, 0.04, 4, F50.wood); // boom
    S.tube([0, gaffY, mz - 0.06], [0, gaffY + 0.85, mz - L * 0.3], 0.04, 0.03, 4, F50.wood); // the gaff
    quadSail(S, [0, boomY + 0.05, mz - 0.08], [0, gaffY, mz - 0.08], [0, gaffY + 0.8, mz - L * 0.3 + 0.1], [0, boomY + 0.05, mz - boomLen + 0.05], 0.3, sailC, 2, 3); // the gaff mainsail, a trapezoid
    S.tube([0, dy(L / 2) + 0.1, L / 2 - 0.5], [0, dy(L / 2) + 0.45, L / 2 + 1.5], 0.07, 0.05, 4, F50.wood); // the bowsprit
    if (look?.jib !== false && !lod) sail3(S, [0, dy(L / 2) + 0.4, L / 2 + 1.4], [0, top - 1.3, mz + 0.06], [0.06, dy(L / 2) + 0.35, L / 2 - 0.4], 0.22, shade(sailC, 0.95)); // the jib on the bowsprit
  }
  if (look?.flag && !lod) addFlag(S, 0, st[0].sheer, -L / 2 + 0.2);
}

// An EKA of 1950 (docs/BOATS-BY-ERA.md): a small clinker rowing boat with a flat bow and a flat stern; mostly rowed (oars shipped inside), some with a sprit sail. Hull colours are a designer's choice
// (tarred brown, tar, or painted white / green / pale blue): no tarred Bohuslän eka was found. ~4.6 m. (The 1700 eka in era-assets.js is a separate, tarred model.)
export function addEka1950(S, G, { L = 4.6, lod = false, look = null } = {}) {
  const hullC = look?.hull ?? 0x5b4636, sailC = look?.sail ?? 0xa7714b;
  const st = hullStations({ L, B: L * 0.34 * (look?.beamK ?? 1), n: lod ? 5 : 7, sheer0: 0.4, riseBow: 0.2, riseStern: 0.1, keelD: 0.25, peak: 0.5, pBow: 1.5, pStern: 1.9, sternW0: 0.5 }); // flat stern (a transom), a blunter bow
  loft(S, st, { bands: [[0.18, shade(hullC, 1.3)], [0.4, hullC], [0.62, shade(hullC, 0.93)], [1, shade(hullC, 0.75)]], open: true, floorY: 0.12, floor: C.woodDark, pf: 0.5 });
  for (const z of [-0.9, 0, 0.9]) S.box(0, 0.26, z * (L / 4.6), st[3].w * 1.5, 0.04, 0.28, C.wood); // thwarts
  if (look?.rig === 'sprit') {
    const mz = L * 0.2;
    S.tube([0, 0.1, mz], [0, 3.1, mz], 0.055, 0.032, 4, C.woodDark);
    S.tube([0, 0.45, mz - 0.05], [0, 3.1, mz - 2.0], 0.036, 0.024, 4, C.wood); // the sprit
    quadSail(S, [0, 0.55, mz - 0.05], [0, 2.7, mz - 0.05], [0, 3.05, mz - 2.0], [0, 0.55, mz - 2.2], 0.3, sailC, 3, 3);
    S.tube([0.2, 0.3, -1.2], [0.2, 0.3, 1.1], 0.024, 0.024, 4, C.wood); // one oar lying inside
  } else {
    for (const [x, dir] of [[0.5, 1], [-0.5, -1]]) { // two oars out, resting in the rowlocks
      S.tube([x * 0.45, 0.42, 0.1], [x * 2.6, 0.2, -0.5 * dir], 0.028, 0.028, 4, C.wood);
      S.box(x * 2.9, 0.18, -0.58 * dir, 0.5, 0.02, 0.2, C.wood);
    }
  }
}

// ---- today ------------------------------------------------------------------------------------------------------------------------------------------------------------
// A DAYSAILER (en.wikipedia Day sailer: 14-25 ft, a small sailboat for trips of a day or less): an open cockpit with a small foredeck, a single mast. 'sloop' (main + jib) or 'cat' (a big main only). ~5.4 m.
export function addDaysailer(S, G, { L = 5.4, stripe = 'navy', sailsUp = true, lod = false, look = null } = {}) {
  const stripeC = STRIPES[stripe] ?? C.navy, hullC = look?.hull ?? C.white, sailC = look?.sail ?? C.sailWhite, coveC = !look || look.hullName === 'white' ? stripeC : C.white;
  const B = L * 0.4 * (look?.beamK ?? 1);
  const st = hullStations({ L, B, n: lod ? 5 : 7, sheer0: 0.5, riseBow: 0.3, riseStern: 0.06, keelD: 0.4, peak: 0.45, pBow: 1.3, pStern: 2.0, sternW0: 0.6 });
  loft(S, st, { bands: lod ? [[0.5, hullC], [1, C.antifoul]] : [[0.14, hullC], [0.22, coveC], [0.55, hullC], [1, C.antifoul]], open: true, floorY: 0.16, floor: C.wood, pf: 0.5 });
  const dy = (z) => atZ(st, z, 'sheer');
  S.box(0, dy(L * 0.28) + 0.12, L * 0.28, B * 0.46, 0.3, L * 0.22, hullC); // the little foredeck / cuddy
  S.box(0, 0.32, -L * 0.14, B * 0.7, 0.04, 0.4, C.wood); // a cockpit bench
  if (!lod) S.tube([0, 0.55, -L / 2 + 0.05], [0, 0.62, -L / 2 + 0.9], 0.03, 0.03, 3, C.wood); // the tiller
  const cat = look?.rig === 'cat', mz = cat ? L * 0.3 : L * 0.2, base = dy(mz), top = base + L * (cat ? 1.05 : 1.2);
  S.tube([0, base, mz], [0, top, mz], 0.06, 0.035, 4, C.silver);
  const boomY = base + 0.65, boomLen = L * (cat ? 0.52 : 0.4);
  S.at({ p: [0, 0, mz], ry: 0.3 }, () => {
    S.tube([0, boomY, -0.04], [0, boomY - 0.02, -boomLen], 0.045, 0.04, 4, sailsUp ? C.silver : stripeC);
    if (sailsUp) sail3(S, [0, boomY + 0.05, -0.06], [0, top - 0.3, -0.06], [0, boomY + 0.05, -boomLen], 0.34, sailC);
  });
  if (sailsUp && !cat && !lod) sail3(S, [0, base + 0.3, L / 2 - 0.2], [0, top - 0.9, mz + 0.05], [0.07, base + 0.55, mz - 1.0], 0.24, shade(sailC, 0.97));
  if (look?.flag && !lod) addFlag(S, 0, st[0].sheer, -L / 2 + 0.2, { h: 0.8, w: 0.42, fh: 0.27 });
}

// A RIB (en.wikipedia Rigid inflatable boat: from 1964, commercial from 1967-69): a shallow rigid hull ringed by fat inflatable tubes, a console with a windscreen, one or two outboards. 5-7 m.
export function addRib(S, G, { L = 6, lod = false, lit = true, look = null } = {}) {
  const hullC = look?.hull ?? C.white, tubeC = look?.tube ?? C.charcoal, B = L * 0.4 * (look?.beamK ?? 1), w = B / 2, r = 0.27;
  const st = hullStations({ L, B: B * 0.8, n: lod ? 5 : 7, sheer0: 0.42, riseBow: 0.34, riseStern: 0.02, keelD: 0.28, peak: 0.4, pBow: 1.1, pStern: 6, sternW0: 0.9 });
  loft(S, st, { bands: [[0.35, hullC], [1, C.antifoul]], open: true, floorY: 0.16, floor: C.grey, pf: 0.4 });
  for (const side of [1, -1]) { // the tubes: stern to mid, then curving in to meet at the bow
    S.tube([side * w, 0.4, -L / 2 + 0.12], [side * w, 0.46, L * 0.12], r, r, 6, tubeC);
    S.tube([side * w, 0.46, L * 0.12], [side * w * 0.18, 0.52, L / 2 - 0.1], r, r * 0.66, 6, tubeC);
  }
  S.tube([w * 0.18, 0.52, L / 2 - 0.1], [-w * 0.18, 0.52, L / 2 - 0.1], r * 0.62, r * 0.62, 6, tubeC); // the bow cap joining them
  const cz = -L * 0.05, base = 0.3;
  S.box(0, base + 0.3, cz, 0.7, 0.6, 0.7, hullC); // the console
  S.quad([-0.34, base + 0.6, cz + 0.3], [0.34, base + 0.6, cz + 0.3], [0.34, base + 1.0, cz + 0.18], [-0.34, base + 1.0, cz + 0.18], C.trim); // the windscreen frame
  if (!lod) (lit ? G.on : G.off).quad([-0.3, base + 0.64, cz + 0.305], [0.3, base + 0.64, cz + 0.305], [0.3, base + 0.96, cz + 0.195], [-0.3, base + 0.96, cz + 0.195], null);
  S.box(0, base + 0.2, cz - 0.9, 0.9, 0.34, 0.5, C.grey); // a seat behind it
  const twin = look?.rig === 'twin';
  for (const x of (twin ? [-0.45, 0.45] : [0])) { S.box(x, 0.72, -L / 2 + 0.05, 0.3, 0.8, 0.34, C.charcoal); S.box(x, 1.18, -L / 2 + 0.05, 0.34, 0.2, 0.38, C.grey); }
  if (look?.flag && !lod) addFlag(S, w * 0.7, 0.5, -L / 2 + 0.5, { h: 0.7, w: 0.4, fh: 0.25 });
}
