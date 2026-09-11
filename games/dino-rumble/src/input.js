// Fighter input. Deliberately NOT shared/input.js: that module tracks four
// directions for one player on global listeners, and a fighting game needs
// attack/block buttons plus two independent schemes on one keyboard for
// couch play. Rather than widen a shared surface (which per
// docs/COLLABORATION.md would be a branch + PR), this game keeps its own.

// Scheme 1 is what you use online — it's the only scheme in a net match.
// Scheme 2 exists so two people can play on one keyboard at the same desk,
// and so the game is testable with zero networking.
export const SCHEMES = {
  p1: {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    chomp: ['KeyJ'],
    tail: ['KeyK'],
    block: ['KeyL'],
  },
  p2: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    chomp: ['Numpad1', 'Comma'],
    tail: ['Numpad2', 'Period'],
    block: ['Numpad3', 'Slash'],
  },
};

const ACTIONS = ['left', 'right', 'up', 'down', 'chomp', 'tail', 'block'];

// One keyboard listener drives every scheme, so holding a key never gets
// swallowed by whichever pad registered last. `pressed` is edge-triggered:
// it reports a key that went down since the previous consume() and is the
// right thing to read for attacks, which must not auto-repeat while held.
export function createInput(schemeNames = ['p1']) {
  const pads = {};
  const lookup = new Map(); // code -> [{pad, action}]

  for (const name of schemeNames) {
    const scheme = SCHEMES[name];
    if (!scheme) throw new Error(`unknown input scheme: ${name}`);
    const pad = { held: {}, pressed: {} };
    for (const action of ACTIONS) {
      pad.held[action] = false;
      pad.pressed[action] = false;
      for (const code of scheme[action] || []) {
        if (!lookup.has(code)) lookup.set(code, []);
        lookup.get(code).push({ pad, action });
      }
    }
    pads[name] = pad;
  }

  function onKeyDown(e) {
    const binds = lookup.get(e.code);
    if (!binds) return;
    e.preventDefault(); // arrows and space would scroll the page otherwise
    if (e.repeat) return;
    for (const { pad, action } of binds) {
      pad.held[action] = true;
      pad.pressed[action] = true;
    }
  }

  function onKeyUp(e) {
    const binds = lookup.get(e.code);
    if (!binds) return;
    e.preventDefault();
    for (const { pad, action } of binds) pad.held[action] = false;
  }

  // Losing focus mid-key (alt-tab, devtools) otherwise leaves a dino
  // walking into the wall forever.
  function onBlur() {
    for (const pad of Object.values(pads)) {
      for (const action of ACTIONS) pad.held[action] = false;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    pad: (name) => pads[name],
    // Call once per frame, after every pad has been read.
    clearPressed() {
      for (const pad of Object.values(pads)) {
        for (const action of ACTIONS) pad.pressed[action] = false;
      }
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}

// A neutral pad for a fighter nobody is driving (the remote dino, or a
// training dummy). Same shape, always false.
export function idlePad() {
  const pad = { held: {}, pressed: {} };
  for (const action of ACTIONS) {
    pad.held[action] = false;
    pad.pressed[action] = false;
  }
  return pad;
}
