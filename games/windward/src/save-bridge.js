// Save bridge (split plan, phase 4): the OLD address (coopgames) packs the player's Windward saves into the URL fragment of the NEW address, so progress
// follows them. Saves are localStorage, which is per web address, so the new address cannot read them itself.
//
//   https://<new-address>/#import=<base64url (no padding) of UTF-8 JSON {"windward.lights.v1": "<raw string>", ...}>
//
// A fragment (after #) is never sent to a server. The receiving side is felisiwi/windward `src/save-import.js` (branch felix/save-import): it accepts only
// `windward.*.v<n>` keys, imports only into an empty storage, then clears the fragment. THE FORMAT MUST STAY IDENTICAL to that file's encodeImport();
// save-bridge.test.js pins a golden string produced by it.
//
// Pure (storage is injected: a localStorage-like { length, key(i), getItem(k) }). Nothing here imports the game. Off by default: see BRIDGE.md.

export const MAX_BYTES = 900 * 1024; // under the importer's 1 MB limit (decoded JSON), with headroom

export function encodeImport(saves) {
  const bytes = new TextEncoder().encode(JSON.stringify(saves));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Every `windward.*` key in storage -> { key: string }. Never throws (blocked storage gives {}).
export function readWindwardSaves(storage) {
  const saves = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (typeof k !== 'string' || !k.startsWith('windward.')) continue;
      const v = storage.getItem(k);
      if (typeof v === 'string') saves[k] = v;
    }
  } catch { /* blocked or broken storage: carry nothing */ }
  return saves;
}

// If everything does not fit the size limit, keep the smallest keys first (small flags and progress beat big fog maps) and report what was left out.
export function fitSaves(saves, maxBytes = MAX_BYTES) {
  const size = (o) => new TextEncoder().encode(JSON.stringify(o)).length;
  if (size(saves) <= maxBytes) return { saves, dropped: [] };
  const kept = {};
  const dropped = [];
  for (const [k, v] of Object.entries(saves).sort((a, b) => a[1].length - b[1].length)) {
    if (size({ ...kept, [k]: v }) <= maxBytes) kept[k] = v; else dropped.push(k);
  }
  return { saves: kept, dropped };
}

// `target` is the new address ('https://example.com/' or '.../play/'); any hash on it is replaced. No saves at all -> the bare address (no empty #import).
export function buildRedirectUrl(target, storage, maxBytes = MAX_BYTES) {
  const { saves, dropped } = fitSaves(readWindwardSaves(storage), maxBytes);
  const base = String(target).replace(/#.*$/, '');
  const carried = Object.keys(saves);
  const url = carried.length ? `${base}#import=${encodeImport(saves)}` : base;
  return { url, carried, dropped };
}
