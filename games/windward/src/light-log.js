// The light log (stage 1d, batch B): the lights you have heard, in order, kept on this device (localStorage `windward.lightlog.v1`) and listed on the
// chart. An entry is just a lighthouse id; its name and glyph come from the light data, so the log can never drift from what the light does.
// Pure apart from the storage handle (injectable; missing or blocked storage means no memory, never a crash).
export const LOG_KEY = 'windward.lightlog.v1';

export function logStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(LOG_KEY);
    return s;
  } catch { return null; }
}

export function createLightLog(storage = logStorage()) {
  let entries = []; // [{ id, at }] in the order you heard them
  try {
    const d = JSON.parse((storage && storage.getItem(LOG_KEY)) || 'null');
    if (d && Array.isArray(d.entries)) entries = d.entries.filter((e) => e && typeof e.id === 'string').map((e) => ({ id: e.id, at: +e.at || 0 }));
  } catch { /* unreadable: an empty log */ }
  const save = () => { try { storage?.setItem(LOG_KEY, JSON.stringify({ v: 1, entries })); } catch { /* blocked: carry on */ } };
  return {
    get ids() { return entries.map((e) => e.id); },
    get count() { return entries.length; },
    has: (id) => entries.some((e) => e.id === id),
    // Adds a light (once). Returns true when it is new.
    add(id, at = Date.now()) {
      if (entries.some((e) => e.id === id)) return false;
      entries.push({ id, at });
      save();
      return true;
    },
    reset() { entries = []; save(); },
  };
}

// The rows the chart shows: [{ id, name, glyph, text }] for the logged lights. lookup(id) -> { name, light } or null (an unknown id is skipped).
export function logRows(log, lookup, glyphOf) {
  return log.ids.map((id) => {
    const l = lookup(id);
    if (!l) return null;
    const g = glyphOf(l.light);
    const steady = l.light && l.light.colour ? `steady ${l.light.colour}` : 'steady'; // no flash pattern: a steady light, with its colour when the data gives one
    return { id, name: l.name, glyph: g ? g.glyph : '', text: g ? g.text : steady, note: l.note || null };
  }).filter(Boolean);
}
