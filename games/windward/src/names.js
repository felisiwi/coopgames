// Names are discovered (GAME-DESIGN.md "Names are discovered", Q26 b). Islands, skerries, villages
// and natural harbours have no name until the boat has been near them; then the name is shown
// once and remembered on this device (localStorage, device-only: clearing site data forgets it).
// Pure apart from the storage handle, which is injectable, so it is testable without a browser.
export const STORAGE_KEY = 'windward.names.v1';
// "Within a sensible distance", game metres. The camera sees roughly +-150 m around the boat, and an
// island's label point is its centre, so islands get the widest reach. TODO(felix): tune by feel.
export const NAME_RADIUS_M = { island: 220, skerry: 110, harbour: 110, village: 150 };

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
// A harbour that is also an OSM island/islet appears once, as a harbour (names.json already drops the duplicate).
export function buildNameList({ names, villages, toGame, inside }) {
  const out = [];
  const add = (id, name, kind, lon, lat) => {
    if (typeof lon !== 'number' || typeof lat !== 'number') return;
    const [x, z] = toGame(lon, lat);
    if (inside(x, z)) out.push({ id, name, kind, x, z, radius: NAME_RADIUS_M[kind] });
  };
  for (const i of names.islands) add(i.osm, i.name, i.kind, i.lon, i.lat);
  for (const h of names.harbours) add(`harbour:${h.name}`, h.name, 'harbour', h.lon, h.lat);
  for (const v of villages) add(`village:${v.name}`, v.name, 'village', v.lon, v.lat);
  return out;
}

export function createNameBook(entries, storage = deviceStorage()) {
  const known = new Set();
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
    // Call with the boat position each frame. Returns the entries discovered by THIS call.
    update(x, z) {
      let found = null;
      for (const e of entries) {
        if (known.has(e.id)) continue;
        const dx = e.x - x;
        const dz = e.z - z;
        if (dx * dx + dz * dz <= e.radius * e.radius) {
          known.add(e.id);
          (found ||= []).push(e);
        }
      }
      if (found) save();
      return found || [];
    },
  };
}
