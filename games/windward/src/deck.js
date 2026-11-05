// The fish on the deck (stage 1b): a few visible slots, kept on this device. A harbour's gift lands in the
// next free slot; when the deck is full the oldest fish is replaced, so there is never a "you're full"
// message to show (no dialogue UI). Pure, with the storage handle injectable like src/names.js.
export const DECK_KEY = 'windward.deck.v1';
export const DECK_SLOTS = 4;

export function deckStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(DECK_KEY); // throws in some blocked-storage browsers
    return s;
  } catch {
    return null;
  }
}

export function createDeck(storage = deckStorage(), slots = DECK_SLOTS) {
  let items = []; // oldest first: [{ kind, from }]
  try {
    const saved = storage ? JSON.parse(storage.getItem(DECK_KEY) || '[]') : [];
    if (Array.isArray(saved)) {
      items = saved.filter((f) => f && typeof f.kind === 'string' && typeof f.from === 'string').slice(-slots);
    }
  } catch { /* unreadable: an empty deck */ }
  const save = () => {
    try { storage?.setItem(DECK_KEY, JSON.stringify(items)); } catch { /* quota / blocked: carry on */ }
  };
  return {
    slots,
    // Slot index -> fish or null. Slots fill in order; a replacement reuses the slot of the oldest fish.
    get fish() { return Array.from({ length: slots }, (_, i) => items[i] || null); },
    count: () => items.length,
    // Adds a fish; returns the slot it lands in (where the flying fish should aim).
    add(fish) {
      let slot;
      if (items.length < slots) { slot = items.length; items.push(fish); }
      else { items.shift(); items.push(fish); slot = slots - 1; }
      save();
      return slot;
    },
  };
}
