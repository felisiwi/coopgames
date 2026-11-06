// Save data per ERA. The game keeps its progress on the device (localStorage) under fixed keys such as `windward.lights.v1`. Chapter 1 now exists in two
// worlds, today's coast (the original chapter) and the 1950 coast (the new start), and their progress must not mix: restoring a light in 1950 must not light
// it in the Today game. Every progress module (chapter, light log, name book, task, deck, explored fog) already takes a `storage` object, so instead of
// changing them all this wrapper adds an era suffix to each key on the way through.
//
//   eraSuffix('today') -> ''        today's keys are EXACTLY as they were: nobody's saved progress breaks
//   eraSuffix('1950')  -> '.1950'   `windward.lights.v1` becomes `windward.lights.v1.1950`
//
// Pure apart from the injected `base` (a localStorage-like { getItem, setItem, removeItem }); a missing or blocked storage gives null, which every module
// already treats as "no memory".

export const eraSuffix = (era) => (!era || era === 'today' ? '' : `.${era}`);

export function scopedStorage(base, suffix) {
  if (!base) return null;
  if (!suffix) return base; // today: the real storage, untouched
  return {
    getItem: (k) => base.getItem(k + suffix),
    setItem: (k, v) => base.setItem(k + suffix, v),
    removeItem: (k) => base.removeItem(k + suffix),
  };
}

// The device's storage for an era, or null if the browser blocks it (private mode, blocked site data).
export function eraStorage(era, base = browserStorage()) {
  return scopedStorage(base, eraSuffix(era));
}

export function browserStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem('windward.probe'); // throws in some blocked-storage browsers
    return s;
  } catch { return null; }
}
