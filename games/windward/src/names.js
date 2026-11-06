// Names are discovered (GAME-DESIGN.md "Names are discovered", Q26 b). Islands, skerries, villages
// and natural harbours have no name until the boat has been near them; then the name is shown
// once and remembered on this device (localStorage, device-only: clearing site data forgets it).
// Pure apart from the storage handle, which is injectable, so it is testable without a browser.
export const STORAGE_KEY = 'windward.names.v1';
// "Within a sensible distance", game metres. The camera sees roughly +-150 m around the boat, and an
// island's label point is its centre, so islands get the widest reach. TODO(felix): tune by feel.
export const NAME_RADIUS_M = { island: 220, skerry: 110, harbour: 110, village: 150, light: 220 }; // a lighthouse is seen from afar, like an island
// A place with a description is "sighted" this much further out than it is named: its descriptive name
// ("the Hood") shows first, the real name only once the boat is close. Game metres.
export const SIGHT_EXTRA_M = 120;
// Two entries with the same name closer than this are one place (a village on an islet of the same name,
// a harbour that is also a skerry): the more important kind wins. Game metres (1:10, so 60 m = 600 m real).
export const SAME_PLACE_M = 60;
const KIND_RANK = { village: 0, harbour: 1, light: 1.5, island: 2, skerry: 3 };

// localStorage can be missing or throw (private mode, blocked site data): then names just are not remembered.
export function deviceStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(STORAGE_KEY); // throws in some blocked-storage browsers
    return s;
  } catch {
    return null;
  }
}

// names: assets/coast/names.json; villages: settlements-history.json's `settlements`;
// toGame(lon, lat) -> [x, z]; inside(x, z) -> true when the point is in the playable region.
// placeNames (optional): data/place-names.json, { descriptions: { name: 'the Hood' }, extraHarbours: [{ name, lat, lon }] }.
// Every entry gets `desc`: the descriptive name shown before discovery (null when there is none).
// A harbour that is also an OSM island/islet, or a village on a same-named skerry, appears once (SAME_PLACE_M).
// lights (optional, stage 1c): [{ name, lat, lon }] (src/lighthouses.js LIGHTHOUSES): a lighthouse is a place too (id "light:<name>"),
// and wins over a same-named skerry on its rock, so it is one entry with the lighthouse's own kind.
export function buildNameList({ names, villages, toGame, inside, placeNames = {}, lights = [] }) {
  const descriptions = placeNames.descriptions || {};
  const all = [];
  const add = (id, name, kind, lon, lat) => {
    if (typeof lon !== 'number' || typeof lat !== 'number') return;
    const [x, z] = toGame(lon, lat);
    if (inside(x, z)) all.push({ id, name, kind, x, z, radius: NAME_RADIUS_M[kind], desc: descriptions[name] || null });
  };
  for (const i of names.islands) add(i.osm, i.name, i.kind, i.lon, i.lat);
  for (const h of names.harbours) add(`harbour:${h.name}`, h.name, 'harbour', h.lon, h.lat);
  for (const h of placeNames.extraHarbours || []) add(`harbour:${h.name}`, h.name, 'harbour', h.lon, h.lat);
  for (const v of villages) add(`village:${v.name}`, v.name, 'village', v.lon, v.lat);
  for (const l of lights) add(`light:${l.name}`, l.name, 'light', l.lon, l.lat);
  // Most important kind first; a lesser entry of the same name close to a kept one is dropped.
  const kept = [];
  for (const e of [...all].sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9))) {
    if (!kept.some((k) => k.name === e.name && Math.hypot(k.x - e.x, k.z - e.z) < SAME_PLACE_M)) kept.push(e);
  }
  const keep = new Set(kept);
  return all.filter((e) => keep.has(e));
}

// What to write on the chart for a place: its description until it has been discovered, then the real
// name with the description kept underneath ("Grundsund" over "the shallow sound"). A place with no
// description has nothing to show before discovery: title null.
export function displayName(entry, known) {
  if (known) return { title: entry.name, sub: entry.desc || null };
  return { title: entry.desc || null, sub: null };
}

export function createNameBook(entries, storage = deviceStorage()) {
  const known = new Set();
  const sighted = new Set(); // this session only: descriptive names already shown once
  try {
    const saved = storage ? JSON.parse(storage.getItem(STORAGE_KEY) || '[]') : [];
    if (Array.isArray(saved)) for (const id of saved) known.add(id);
  } catch { /* unreadable: start fresh */ }
  const valid = new Set(entries.map((e) => e.id));
  for (const id of [...known]) if (!valid.has(id)) known.delete(id); // names that no longer exist
  const save = () => {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify([...known])); } catch { /* quota / blocked: carry on */ }
  };
  return {
    entries,
    isKnown: (id) => known.has(id),
    count: () => known.size,
    total: entries.length,
    // Descriptive names to show now: places with a description, not yet discovered, that the boat is
    // approaching (SIGHT_EXTRA_M beyond the discovery reach). Each is returned once per session.
    // canSee(entry) (optional, src/seen.js): the place's land must be revealed by the fog first; until then nothing shows.
    sight(x, z, canSee = null) {
      let seen = null;
      for (const e of entries) {
        if (!e.desc || known.has(e.id) || sighted.has(e.id)) continue;
        const reach = e.radius + SIGHT_EXTRA_M;
        const dx = e.x - x;
        const dz = e.z - z;
        if (dx * dx + dz * dz <= reach * reach && (!canSee || canSee(e))) {
          sighted.add(e.id);
          (seen ||= []).push(e);
        }
      }
      return seen || [];
    },
    // Call with the boat position each frame. Returns the entries discovered by THIS call. canSee as for sight():
    // a place the boat is near but whose land the fog still covers is not named yet; it is, the moment the fog lifts.
    update(x, z, canSee = null) {
      let found = null;
      for (const e of entries) {
        if (known.has(e.id)) continue;
        const dx = e.x - x;
        const dz = e.z - z;
        if (dx * dx + dz * dz <= e.radius * e.radius && (!canSee || canSee(e))) {
          known.add(e.id);
          (found ||= []).push(e);
        }
      }
      if (found) save();
      return found || [];
    },
  };
}
