// The sail-feel lab's panel: one small pill (the live readout) that opens a paper card with the toggles, the day picker,
// the clock and a few sliders. Phone-first: every control is at least 44 px, the card scrolls, nothing is a dev wall.
// It builds DOM only; the lab owns the settings and passes callbacks. Style = the game's old paper (src/paper.js); paint lives in
// class rules (one injected <style>), not inline, so states work.
import { PAPER, SERIF, paperSurface } from './paper.js';
import { LAYERS } from './sail-feel-params.js';
import { DAY_TYPES, WEATHER } from './weather.js';

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compassName = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

const CSS = `
#sfl { position: fixed; z-index: 7; left: calc(8px + env(safe-area-inset-left, 0px)); top: calc(8px + env(safe-area-inset-top, 0px)); font-family: ${SERIF}; max-width: calc(100vw - 16px); }
#sfl * { box-sizing: border-box; }
#sfl .pill { display: flex; align-items: center; gap: 8px; min-height: 44px; max-width: 100%; padding: 6px 12px; ${paperSurface({ radius: 8, shadow: true })}; color: ${PAPER.ink}; font: 600 14px/1.2 ${SERIF}; cursor: pointer; touch-action: manipulation; text-align: left; }
#sfl .pill .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
#sfl .pill .car { color: ${PAPER.inkSoft}; }
#sfl .card { display: none; margin-top: 6px; width: min(calc(100vw - 16px), 372px); max-height: calc(100vh - 76px); max-height: calc(100dvh - 76px); overflow: auto; padding: 12px 14px 14px; ${paperSurface({ radius: 8, shadow: true })}; overscroll-behavior: contain; }
#sfl.open .card { display: block; }
#sfl h2 { font: italic 600 21px/1.2 ${SERIF}; color: ${PAPER.title}; margin: 0 0 6px; }
#sfl h3 { font: italic 600 14px/1.2 ${SERIF}; color: ${PAPER.title}; margin: 12px 0 4px; letter-spacing: .02em; }
#sfl .note { font: italic 12.5px/1.35 ${SERIF}; color: ${PAPER.inkSoft}; margin: 2px 0 6px; }
#sfl dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font: 14px/1.3 ${SERIF}; }
#sfl dt { color: ${PAPER.inkSoft}; font-style: italic; }
#sfl dd { margin: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
#sfl .row { display: flex; align-items: center; gap: 8px; min-height: 44px; font: 14px/1.25 ${SERIF}; }
#sfl .row.tog { cursor: pointer; touch-action: manipulation; }
#sfl .row .grow { flex: 1; min-width: 0; }
#sfl input[type=checkbox] { width: 22px; height: 22px; accent-color: ${PAPER.seal}; flex: none; }
#sfl input[type=range] { flex: 1; min-width: 0; height: 32px; accent-color: ${PAPER.seal}; }
#sfl input[type=number], #sfl select { min-height: 44px; font: 15px ${SERIF}; color: ${PAPER.ink}; background: rgba(255,250,235,.7); border: 1px solid ${PAPER.rule}; border-radius: 4px; padding: 4px 8px; }
#sfl input[type=number] { width: 92px; }
#sfl select { flex: 1; min-width: 0; }
#sfl .val { min-width: 54px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
#sfl button.btn { min-height: 44px; padding: 8px 12px; font: 600 14px ${SERIF}; color: ${PAPER.ink}; background: transparent; border: 1px solid ${PAPER.rule}; border-radius: 4px; cursor: pointer; touch-action: manipulation; flex: 1; }
#sfl button.btn.on { background: ${PAPER.seal}; color: ${PAPER.sealText}; border-color: ${PAPER.seal}; }
#sfl button.btn:active { transform: translateY(1px); }
#sfl .btns { display: flex; gap: 6px; flex-wrap: wrap; }
#sfl .toast { font: italic 13px ${SERIF}; color: ${PAPER.title}; min-height: 18px; }
#sfl .warn { color: #8a2a14; }
`;

// opts: { settings, layerOn(id) -> bool, onToggle(id, on), onSetting(key, value), onClock(hour), onStart(kind), onCopy() -> Promise<string>|string, dayLabels }
export function createPanel(opts) {
  const { settings } = opts;
  if (!document.getElementById('sfl-style')) { const st = document.createElement('style'); st.id = 'sfl-style'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div');
  root.id = 'sfl';
  root.innerHTML = `
    <button class="pill" type="button" aria-expanded="false" aria-controls="sfl-card"><span class="txt" id="sfl-pill">Weather lab</span><span class="car" aria-hidden="true">▾</span></button>
    <div class="card" id="sfl-card" role="region" aria-label="Weather and sail feel">
      <h2>Weather and sail feel</h2>
      <p class="note">Every layer has a switch. The link in the address bar always reproduces what you see.</p>
      <h3>Today's wind</h3>
      <dl id="sfl-read"></dl>
      <h3>The day</h3>
      <div class="row"><label for="sfl-day" class="grow">Day type</label><select id="sfl-day"></select></div>
      <div class="row"><label for="sfl-seed" class="grow">Day seed</label><input id="sfl-seed" type="number" min="0" max="99999" step="1" inputmode="numeric"><button class="btn" type="button" id="sfl-reseed" style="flex:none">Another</button></div>
      <div class="row"><label for="sfl-time" class="grow">Time of day</label><span class="val" id="sfl-time-val"></span></div>
      <div class="row"><input id="sfl-time" type="range" min="0" max="24" step="0.05"></div>
      <div class="btns"><button class="btn" type="button" id="sfl-freeze">Clock running</button><button class="btn" type="button" id="sfl-ff">Fast-forward ×10</button></div>
      <h3>Start from</h3>
      <div class="btns"><button class="btn" type="button" data-start="spawn">Grundsund</button><button class="btn" type="button" data-start="inside">Inside the skerries</button><button class="btn" type="button" data-start="outside">Utomskärs</button></div>
      <div id="sfl-layers"></div>
      <h3>Tune</h3>
      <div id="sfl-sliders"></div>
      <div class="btns" style="margin-top:10px"><button class="btn" type="button" id="sfl-copy">Copy this setup as a link</button></div>
      <div class="toast" id="sfl-toast" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector(`#${id}`);
  const pill = root.querySelector('.pill');

  // ---- open / close ----
  const setOpen = (on) => { root.classList.toggle('open', on); pill.setAttribute('aria-expanded', String(on)); pill.querySelector('.car').textContent = on ? '▴' : '▾'; opts.onSetting?.('panel', on ? 1 : 0); };
  pill.addEventListener('click', () => setOpen(!root.classList.contains('open')));
  if (settings.panel) setOpen(true);

  // ---- day type, seed, clock ----
  const day = $('sfl-day');
  day.innerHTML = [`<option value="auto">The seed's own</option>`, ...DAY_TYPES.map((d) => `<option value="${d}">${WEATHER.PROFILES[d].label}</option>`)].join('');
  day.value = settings.day;
  day.addEventListener('change', () => opts.onSetting('day', day.value));
  const seed = $('sfl-seed');
  seed.value = String(settings.seed);
  seed.addEventListener('change', () => { const n = Math.max(0, Math.min(99999, Math.round(Number(seed.value) || 0))); seed.value = String(n); opts.onSetting('seed', n); });
  $('sfl-reseed').addEventListener('click', () => { const n = (Number(seed.value) * 7919 + 13) % 100000; seed.value = String(n); opts.onSetting('seed', n); });
  const time = $('sfl-time');
  let dragging = false;
  time.value = String(settings.t);
  time.addEventListener('input', () => { dragging = true; opts.onClock(Number(time.value)); });
  time.addEventListener('change', () => { dragging = false; });
  const freeze = $('sfl-freeze');
  const ff = $('sfl-ff');
  const paintClock = () => { freeze.textContent = settings.freeze ? 'Clock stopped' : 'Clock running'; freeze.classList.toggle('on', !!settings.freeze); ff.classList.toggle('on', !!settings.ff); };
  freeze.addEventListener('click', () => { settings.freeze = settings.freeze ? 0 : 1; paintClock(); opts.onSetting('freeze', settings.freeze); });
  ff.addEventListener('click', () => { settings.ff = settings.ff ? 0 : 1; paintClock(); opts.onSetting('ff', settings.ff); });
  paintClock();
  for (const b of root.querySelectorAll('[data-start]')) b.addEventListener('click', () => opts.onStart(b.dataset.start));

  // ---- layer toggles, grouped ----
  const layersEl = $('sfl-layers');
  const checks = new Map();
  for (const group of [...new Set(LAYERS.map((l) => l.group))]) {
    const h = document.createElement('h3'); h.textContent = group; layersEl.appendChild(h);
    for (const l of LAYERS.filter((x) => x.group === group)) {
      const row = document.createElement('label'); row.className = 'row tog';
      row.innerHTML = `<input type="checkbox" id="sfl-l-${l.id}"><span class="grow">${l.label}</span>`;
      const box = row.querySelector('input');
      box.checked = opts.layerOn(l.id);
      box.addEventListener('change', () => opts.onToggle(l.id, box.checked));
      layersEl.appendChild(row);
      checks.set(l.id, box);
    }
  }

  // ---- sliders ----
  const sliders = $('sfl-sliders');
  const addSlider = (key, label, min, max, step, fmt) => {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<label class="grow" for="sfl-s-${key}">${label}</label><span class="val"></span>`;
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = `<input type="range" id="sfl-s-${key}" min="${min}" max="${max}" step="${step}">`;
    const input = r.querySelector('input'); const val = row.querySelector('.val');
    input.value = String(settings[key]); val.textContent = fmt(settings[key]);
    input.addEventListener('input', () => { const v = Number(input.value); val.textContent = fmt(v); opts.onSetting(key, v); });
    sliders.append(row, r);
    return { input, val };
  };
  addSlider('drift', 'Gust drift (share of the wind)', 0.1, 1.2, 0.05, (v) => `${Math.round(v * 100)}%`);
  addSlider('zoom', 'Camera distance', 0.5, 2.5, 0.05, (v) => `×${v.toFixed(2)}`);
  addSlider('spray', 'Spray', 0, 2, 0.1, (v) => `×${v.toFixed(1)}`);
  addSlider('heel', 'Heel', 0, 2, 0.1, (v) => `×${v.toFixed(1)}`);

  // ---- copy link ----
  $('sfl-copy').addEventListener('click', async () => {
    const link = await opts.onCopy();
    let ok = false;
    try { await navigator.clipboard.writeText(link); ok = true; } catch { ok = false; }
    $('sfl-toast').textContent = ok ? 'Link copied.' : 'Copy it from the address bar.';
    setTimeout(() => { $('sfl-toast').textContent = ''; }, 2600);
  });

  return {
    el: root,
    setOpen,
    layerChecks: checks,
    // r: { pill, rows: [[label, value, warn?], ...], hour }
    setReadout(r) {
      $('sfl-pill').textContent = r.pill;
      const dl = $('sfl-read');
      if (root.classList.contains('open')) dl.innerHTML = r.rows.map(([k, v, warn]) => `<dt>${k}</dt><dd${warn ? ' class="warn"' : ''}>${v}</dd>`).join('');
      if (!dragging && root.classList.contains('open')) time.value = String(r.hour);
      $('sfl-time-val').textContent = r.clock;
    },
    syncSeed(n) { seed.value = String(n); },
    syncDay(d) { day.value = d; },
    toast(text) { $('sfl-toast').textContent = text; setTimeout(() => { $('sfl-toast').textContent = ''; }, 2600); },
  };
}
