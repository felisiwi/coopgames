// WASD / arrow-key state tracker, shared across games. Not wired into any
// game yet (Stage 1 is scaffold-only, no movement) — this is the module a
// later "single-player movement" stage imports.
const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function createInputState() {
  const state = { up: false, down: false, left: false, right: false };

  function onKeyDown(e) {
    const dir = KEY_MAP[e.code];
    if (dir) state[dir] = true;
  }

  function onKeyUp(e) {
    const dir = KEY_MAP[e.code];
    if (dir) state[dir] = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  state.destroy = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };

  return state;
}
