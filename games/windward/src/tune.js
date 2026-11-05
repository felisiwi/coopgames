// The ?tune=1 look-tuning panel (look pass 2, 2026-11-05). Loaded only when the
// URL has tune=1 (game.js imports it dynamically), so a normal session never
// sees it or pays for it. It owns no values: it reads and writes config.js's
// CONFIG, asks game.js to apply the change, and mirrors the current values
// into the URL so Felix can send a link back with his pick.
import { LOOK_SPECS, PRESETS, SKAGEN, applyValues, lookToSearch } from './look-presets.js';

// The sliders. Each edits one CONFIG key; ranges come from LOOK_SPECS.
export const SLIDERS = [
  { key: 'LOOK_SHALLOW_SAT', label: 'Shallow saturation', step: 0.01 },
  { key: 'LOOK_SEA_BRIGHTNESS', label: 'Sea brightness', step: 0.01 },
  { key: 'LOOK_ISLAND_BRIGHTNESS', label: 'Island brightness', step: 0.01 },
  { key: 'LOOK_GRANITE_TINT', label: 'Granite tint (pink to lilac)', step: 0.01 },
  { key: 'LOOK_MEADOW_TINT', label: 'Meadow tint (sage to cool)', step: 0.01 },
  { key: 'HEMI_INTENSITY', label: 'Fill light (hemisphere)', step: 0.01 },
  { key: 'LOOK_FOAM_WIND_AMOUNT', label: 'Foam vs wind', step: 0.01 },
];

const CSS = `
#tune{display:flex;flex-direction:column;align-items:flex-end;position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:30;font:600 13px/1.3 system-ui,sans-serif;color:#1c2a38;touch-action:manipulation}
#tune button{font:inherit;border:0;border-radius:999px;padding:7px 12px;background:rgba(255,255,255,.88);color:#1c2a38;cursor:pointer}
#tune button[aria-pressed="true"]{background:#1c2a38;color:#fff}
#tune .box{margin-top:6px;width:min(78vw,300px);max-height:62vh;overflow:auto;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.92);display:grid;gap:9px}
#tune .box[hidden]{display:none}
#tune .row{display:grid;gap:3px}
#tune .row span{display:flex;justify-content:space-between}
#tune input[type=range]{width:100%;margin:0}
#tune .btns{display:flex;gap:6px;flex-wrap:wrap}
#tune small{opacity:.7;font-weight:500}
`;

// `apply(key)`: game.js applies the change ('*' = everything, after a preset).
export function createTunePanel({ CONFIG, apply, doc = document, win = window }) {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const root = doc.createElement('div');
  root.id = 'tune';
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Tune';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'tune-box');
  const box = doc.createElement('div');
  box.className = 'box';
  box.id = 'tune-box';
  box.hidden = true;
  toggle.addEventListener('click', () => {
    box.hidden = !box.hidden;
    toggle.setAttribute('aria-expanded', String(!box.hidden));
  });

  const inputs = new Map();
  function writeUrl() {
    const values = Object.fromEntries(Object.keys(LOOK_SPECS).map((k) => [k, CONFIG[k]]));
    win.history.replaceState(null, '', win.location.pathname + lookToSearch(win.location.search, values, SKAGEN) + win.location.hash);
  }
  function show(key) {
    const row = inputs.get(key);
    if (!row) return;
    row.input.value = CONFIG[key];
    row.out.textContent = Number(CONFIG[key]).toFixed(2);
  }

  for (const s of SLIDERS) {
    const spec = LOOK_SPECS[s.key];
    const row = doc.createElement('label');
    row.className = 'row';
    const head = doc.createElement('span');
    const name = doc.createElement('span');
    name.textContent = s.label;
    const out = doc.createElement('span');
    head.append(name, out);
    const input = doc.createElement('input');
    input.type = 'range';
    input.min = spec.min;
    input.max = spec.max;
    input.step = s.step;
    input.addEventListener('input', () => {
      CONFIG[s.key] = Number(input.value);
      out.textContent = Number(input.value).toFixed(2);
      apply(s.key);
      writeUrl();
    });
    row.append(head, input);
    box.appendChild(row);
    inputs.set(s.key, { input, out });
    show(s.key);
  }

  const btns = doc.createElement('div');
  btns.className = 'btns';
  for (const [id, label] of [['before', 'Before'], ['skagen', 'Skagen']]) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.preset = id;
    b.addEventListener('click', () => {
      applyValues(CONFIG, PRESETS[id]);
      for (const s of SLIDERS) show(s.key);
      apply('*');
      writeUrl();
    });
    btns.appendChild(b);
  }
  const copy = doc.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy link';
  copy.addEventListener('click', () => {
    win.navigator.clipboard?.writeText(win.location.href).then(() => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy link'; }, 1500); }, () => {});
  });
  btns.appendChild(copy);
  const note = doc.createElement('small');
  note.textContent = 'The page address always holds your current values: send it back.';
  box.append(btns, note);

  // Nothing typed or touched in the panel may steer the boat.
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'wheel']) {
    root.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
  root.append(toggle, box);
  doc.body.appendChild(root);
  writeUrl();
  return { root, writeUrl, destroy: () => { root.remove(); style.remove(); } };
}
