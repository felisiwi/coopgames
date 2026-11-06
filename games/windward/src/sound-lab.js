// Sound Lab (sound-lab.html): one button per sound from src/sounds-1950.js, sliders for the main parameters, everything in the web address.
// Synthesised only (no sample files). Felix judges by ear; docs/SOUND-1950.md says what is documented and what is a guess.
// Nothing here touches game.js or the game's audio.js. URL keys: see DEFAULTS (a link carries the setup); ?cpu=1 measures on load.
import { createSounds1950, ENGINE, TYFON, AMBIENCE, AMBIENCE_LAYERS, RELIGHT_STEPS, analyse } from './sounds-1950.js';
import { lightGlyph } from './light-glyph.js';
import { LIGHTHOUSES } from './lighthouses.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  vol: 0.8, rpm: 330, cyl: 1, edist: 0, speed: 5, closest: 30, light: 'Måseskär', cycles: 2, level: 1, wind: 0.5, rain: 0.5, thunder: 2,
  gull: 'kyow', rate: 0.6, mist: 0, hal: 0.4, spm: 22, preset: 'calm', fade: 3,
};
// the lights: Maseskar's 1950 pattern (documented: three flashes in 30 s; the flash length is a guess); Hattan and Gaven are TODAY's patterns from the game's data
const LIGHTS = {
  'Måseskär': { light: { kind: 'flash', count: 3, period: 30, flashSeconds: 1.5 }, note: '1950, three flashes / 30 s (flash length a guess)' },
  Hättan: { light: (LIGHTHOUSES.find((l) => l.name === 'Hättan') || {}).light || { kind: 'flash', count: 2, period: 6 }, note: "today's pattern (the 1950 one is not documented)" },
  Gäven: { light: (LIGHTHOUSES.find((l) => l.name === 'Gäven') || {}).light || { kind: 'flash', count: 3, period: 9 }, note: "today's pattern (the 1950 one is not documented)" },
};
const glyphOf = (name) => lightGlyph(LIGHTS[name].light) || { flashes: [{ at: 0, len: 0.5 }], period: 12, glyph: '●', text: '' };

// ---- state, kept in the address ----
function readState() {
  const q = new URLSearchParams(window.location.search), s = { ...DEFAULTS, layers: {} };
  for (const [k, d] of Object.entries(DEFAULTS)) {
    if (!q.has(k)) continue;
    if (typeof d === 'number') { const n = Number(q.get(k)); if (Number.isFinite(n)) s[k] = n; } else s[k] = q.get(k);
  }
  for (const l of AMBIENCE_LAYERS) if (q.has(`l.${l}`) && Number.isFinite(Number(q.get(`l.${l}`)))) s.layers[l] = Math.min(1, Math.max(0, Number(q.get(`l.${l}`))));
  if (!LIGHTS[s.light]) s.light = DEFAULTS.light;
  if (!AMBIENCE[s.preset]) s.preset = DEFAULTS.preset;
  if (!['mew', 'kyow', 'long'].includes(s.gull)) s.gull = DEFAULTS.gull;
  s.cyl = s.cyl >= 2 ? 2 : 1;
  return s;
}
const S = readState();
function writeUrl() {
  const q = new URLSearchParams(window.location.search);
  for (const k of [...q.keys()]) if (k in DEFAULTS || k.startsWith('l.')) q.delete(k);
  for (const [k, d] of Object.entries(DEFAULTS)) if (S[k] !== d) q.set(k, typeof S[k] === 'number' ? String(Math.round(S[k] * 1000) / 1000) : S[k]);
  for (const [l, v] of Object.entries(S.layers)) q.set(`l.${l}`, String(Math.round(v * 1000) / 1000));
  const t = q.toString();
  window.history.replaceState(null, '', window.location.pathname + (t ? `?${t}` : ''));
}

// ---- audio, started on the first tap ----
let ctx = null, sounds = null;
const live = {}; // key -> running handle
function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
    sounds = createSounds1950(ctx, ctx.destination);
    sounds.setVolume(S.vol);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return sounds;
}
const say = (t) => { $('status').textContent = t; };

// ---- the UI, built from small helpers ----
const host = $('sections');
let section = null;
function sec(title, note) {
  section = document.createElement('section');
  const h = document.createElement('h2'); h.textContent = title; section.appendChild(h);
  if (note) { const p = document.createElement('p'); p.className = 'note'; p.innerHTML = note; section.appendChild(p); }
  host.appendChild(section);
}
function row(cls) { const d = document.createElement('div'); d.className = cls; section.appendChild(d); return d; }
function button(parent, label, onClick, cls = '') { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', onClick); parent.appendChild(b); return b; }
// a sound that runs until you tap it again
function toggle(parent, label, key, start, stop = (h) => h.stop()) {
  const b = button(parent, `▶ ${label}`, () => {
    if (live[key]) { stop(live[key]); delete live[key]; b.classList.remove('on'); b.textContent = `▶ ${label}`; say(`${label}: stopped`); return; }
    live[key] = start(audio()); b.classList.add('on'); b.textContent = `■ ${label}`; say(`${label}: playing`);
  });
  return b;
}
function slider(key, label, min, max, step, fmt, onInput) {
  const wrap = document.createElement('label'); wrap.className = 'slider';
  wrap.innerHTML = `<span class="top"><span>${label}</span><output></output></span><input type="range" min="${min}" max="${max}" step="${step}">`;
  const input = wrap.querySelector('input'), out = wrap.querySelector('output');
  const show = () => { input.value = S[key]; out.textContent = fmt(S[key]); };
  input.addEventListener('input', () => { S[key] = Number(input.value); show(); onInput?.(S[key]); writeUrl(); });
  show(); section.appendChild(wrap);
  return { show, input };
}
function chips(parent, items, get, set) {
  const els = items.map(([id, label]) => { const b = button(parent, label, () => { set(id); refresh(); writeUrl(); }); return [id, b]; });
  const refresh = () => els.forEach(([id, b]) => b.classList.toggle('on', get() === id));
  refresh(); return refresh;
}
const set = (key, fn) => (v) => { const h = live[key]; if (h) fn(h, v); };

// 1. the engine
sec('1 · Hot-bulb engine', 'The slow "dunk-dunk" of a wooden fishing boat. A two-stroke fires once a revolution: <b>375 rpm is documented</b> for a 1905 Bolinder; idle and cruise revs are our guess.');
{
  const r = row('btns');
  toggle(r, 'Engine', 'engine', (s) => s.engine({ rpm: S.rpm, cylinders: S.cyl, distance: S.edist }));
  button(r, 'Idle', () => { S.rpm = ENGINE.idleRpm; syncEngine(); });
  button(r, 'Cruise', () => { S.rpm = ENGINE.cruiseRpm; syncEngine(); });
  const rpm = slider('rpm', 'Revolutions', 120, ENGINE.maxRpm, 5, (v) => `${v} rpm · ${(v / 60).toFixed(1)} dunks/s`, set('engine', (h, v) => h.setRpm(v)));
  const dist = slider('edist', 'Distance (a boat that is further off)', 0, 400, 5, (v) => `${v} m`, set('engine', (h, v) => h.setDistance(v)));
  const c = row('chips'); chips(c, [[1, '1 cylinder'], [2, '2 cylinders (uneven)']], () => S.cyl, (v) => { S.cyl = v; live.engine?.setCylinders(v); });
  function syncEngine() { rpm.show(); live.engine?.setRpm(S.rpm); writeUrl(); }
  void dist;
  const p = row('btns');
  button(p, 'Passing boat', () => { const b = audio().passingBoat({ speedMs: S.speed, closestM: S.closest, cylinders: S.cyl, rpm: S.rpm }); say(`passing boat: ${Math.round(b.durationS)} s`); }, 'warm');
  slider('speed', 'Passing boat: speed', 2, 12, 0.5, (v) => `${v} m/s · ${(v * 1.944).toFixed(1)} kn`);
  slider('closest', 'Passing boat: closest distance', 8, 120, 1, (v) => `${v} m`);
}

// 2. the AGA light
sec('2 · AGA light relight', 'The flasher\'s <b>"pop" is documented</b> (1955 manual, same apparatus); the pilot flame is a blue, quiet flame. The hiss, the whump and the clunks are <b>guesses</b>.');
{
  const names = Object.keys(LIGHTS);
  const rl = row('chips'); const refreshLight = chips(rl, names.map((n) => [n, n]), () => S.light, (v) => { S.light = v; lightNote(); });
  const noteEl = document.createElement('p'); noteEl.className = 'note'; section.appendChild(noteEl);
  const lightNote = () => { const g = glyphOf(S.light); noteEl.textContent = `${g.text || ''}. ${LIGHTS[S.light].note}`; refreshLight(); };
  lightNote();
  const r = row('btns');
  button(r, 'Full relight', () => { const g = glyphOf(S.light); const x = audio().relight1950({ flashes: g.flashes, period: g.period, cycles: S.cycles }); live.pilot?.stop(); live.pilot = x.pilot; say(`relight: ${x.durationS.toFixed(0)} s, ${x.pops} pops (pilot keeps burning: Stop all)`); }, 'warm');
  button(r, 'Pop', () => audio().flasherPop());
  button(r, 'Pilot lights', () => audio().pilotWhump());
  button(r, 'Gas hiss', () => audio().gasHiss());
  button(r, 'Clunk', () => audio().cylinderClunk());
  button(r, 'Sun-valve snap', () => audio().sunValveSnap());
  button(r, 'Pattern only', () => { const g = glyphOf(S.light); const x = audio().flasherPattern({ flashes: g.flashes, period: g.period, cycles: S.cycles }); say(`${x.pops} pops over ${x.durationS.toFixed(0)} s`); });
  toggle(r, 'Pilot flame', 'pilot2', (s) => s.pilot());
  slider('cycles', 'Periods of the pattern', 1, 4, 1, (v) => `${v}`);
  const steps = document.createElement('p'); steps.className = 'note'; steps.innerHTML = `Steps: ${RELIGHT_STEPS.map((x) => `${x.at}s ${x.what}`).join(' → ')}`; section.appendChild(steps);
}

// 3. storm
sec('3 · Storm', 'Wind building, rain, thunder, for the opening scene. <b>All character is ours</b>: noise shaped by ear.');
{
  const r = row('btns');
  toggle(r, 'Storm', 'storm', (s) => s.storm({ level: S.level }));
  toggle(r, 'Wind', 'wind', (s) => s.wind({ strength: S.wind }));
  toggle(r, 'Rain', 'rain', (s) => s.rain({ intensity: S.rain }));
  button(r, 'Thunder', () => { const t = audio().thunder({ distanceKm: S.thunder }); say(`thunder: crack in ${t.atS.toFixed(1)} s, rolls to ${t.durationS.toFixed(0)} s`); }, 'warm');
  slider('level', 'Storm level', 0, 1, 0.01, (v) => v.toFixed(2), set('storm', (h, v) => h.setLevel(v)));
  slider('wind', 'Wind strength', 0, 1, 0.01, (v) => v.toFixed(2), set('wind', (h, v) => h.setStrength(v)));
  slider('rain', 'Rain', 0, 1, 0.01, (v) => v.toFixed(2), set('rain', (h, v) => h.setIntensity(v)));
  slider('thunder', 'Thunder distance', 0.3, 10, 0.1, (v) => `${v.toFixed(1)} km`);
}

// 4. harbour and coast
sec('4 · Harbour and coast', 'The tyfon (<b>210 + 260 Hz, 2+4+2+22 s, documented</b>), gulls, a hand bell, halyards on a wooden mast, oars in rowlocks. Gulls, bell, halyards and oars are <b>by ear, not sourced</b>.');
{
  const r = row('btns');
  button(r, 'Gull', () => audio().gull({ type: S.gull }));
  toggle(r, 'Gulls', 'gulls', (s) => s.gulls({ rate: S.rate }));
  button(r, 'Hand bell', () => audio().handBell({ strikes: [0, 0.55, 1.9, 2.45] }));
  toggle(r, 'Mist signal', 'mist', (s) => s.mistSignal({ distance: S.mist, hz: TYFON.hz }));
  toggle(r, 'Halyards', 'hal', (s) => s.halyards({ wind: S.hal }));
  toggle(r, 'Rowing', 'row', (s) => s.rowing({ spm: S.spm }));
  button(r, 'Rowlock clunk', () => audio().rowlockClunk());
  const c = row('chips'); chips(c, [['mew', 'mew'], ['kyow', 'kyow'], ['long', 'long call']], () => S.gull, (v) => { S.gull = v; });
  slider('rate', 'Gull rate', 0.05, 2, 0.05, (v) => v.toFixed(2), set('gulls', (h, v) => h.setRate(v)));
  slider('mist', 'Mist signal distance', 0, 6000, 50, (v) => `${v} m`, set('mist', (h, v) => h.setDistance(v)));
  slider('hal', 'Wind in the rigging', 0, 1, 0.01, (v) => v.toFixed(2), set('hal', (h, v) => h.setWind(v)));
  slider('spm', 'Strokes a minute', 8, 40, 1, (v) => `${v}`, set('row', (h, v) => h.setRate(v)));
}

// 5. the ambience mixer
sec('5 · Ambience mixer', 'Presets layer the sounds above; move any layer by hand. Fades take a few seconds.');
const layerSliders = {};
{
  const c = row('chips');
  const refreshPreset = chips(c, Object.entries(AMBIENCE).map(([k, v]) => [k, v.label]), () => S.preset, (v) => { S.preset = v; S.layers = {}; applyPreset(true); });
  const r = row('btns');
  const amb = button(r, '▶ Ambience', () => {
    if (live.amb) { live.amb.stop(); delete live.amb; amb.classList.remove('on'); amb.textContent = '▶ Ambience'; say('ambience: stopped'); return; }
    live.amb = audio().ambience(S.preset); for (const [l, v] of Object.entries(S.layers)) live.amb.setLayer(l, v);
    amb.classList.add('on'); amb.textContent = '■ Ambience'; say(`ambience: ${AMBIENCE[S.preset].label}`);
  });
  slider('fade', 'Fade time', 0, 8, 0.5, (v) => `${v} s`);
  for (const l of AMBIENCE_LAYERS) {
    const key = `layer.${l}`;
    Object.defineProperty(S, key, { get: () => S.layers[l] ?? AMBIENCE[S.preset][l], set: (v) => { S.layers[l] = v; }, enumerable: false });
    layerSliders[l] = slider(key, l, 0, 1, 0.01, (v) => v.toFixed(2), (v) => live.amb?.setLayer(l, v));
  }
  function applyPreset(fromChip) {
    refreshPreset();
    for (const l of AMBIENCE_LAYERS) layerSliders[l].show();
    if (live.amb && fromChip) live.amb.setPreset(S.preset, S.fade);
  }
}

// the rest: volume, stop, URL
const volOut = $('volOut'), vol = $('vol');
const showVol = () => { vol.value = S.vol; volOut.textContent = `${Math.round(S.vol * 100)}%`; };
vol.addEventListener('input', () => { S.vol = Number(vol.value); showVol(); sounds?.setVolume(S.vol); writeUrl(); });
showVol();
$('stopAll').addEventListener('click', () => {
  for (const [k, h] of Object.entries(live)) { try { h.stop(); } catch { /* already stopped */ } delete live[k]; }
  sounds?.stopAll(); document.querySelectorAll('button.on').forEach((b) => { b.classList.remove('on'); b.textContent = b.textContent.replace(/^■/, '▶'); });
  say('everything stopped');
});

// ---- CPU and levels: render each sound offline, time it, look at the peak ----
const SR = 44100;
const CASES = [
  ['engine, cruising (1 cyl)', 20, (s) => s.engine({ rpm: 330 })],
  ['engine, two cylinders', 20, (s) => s.engine({ rpm: 300, cylinders: 2 })],
  ['passing boat (a 56 s pass)', 56, (s) => s.passingBoat({})],
  ['AGA relight (Måseskär, 2 periods)', 70, (s) => { const g = glyphOf('Måseskär'); s.relight1950({ flashes: g.flashes, period: g.period, cycles: 2 }); }],
  ['wind + rain', 30, (s) => { s.wind({ strength: 1 }); s.rain({ intensity: 1 }); }],
  ['storm (wind, rain, sea, thunder)', 60, (s) => s.storm({ level: 1 })],
  ['mist signal (tyfon)', 62, (s) => s.mistSignal({})],
  ['halyards, windy', 20, (s) => s.halyards({ wind: 0.9 })],
  ['rowing', 20, (s) => s.rowing({})],
  ['gulls', 40, (s) => s.gulls({ rate: 1 })],
  ['ambience: calm', 30, (s) => s.ambience('calm')],
  ['ambience: evening', 60, (s) => s.ambience('evening')],
  ['ambience: storm', 60, (s) => s.ambience('storm')],
];
async function renderCase([name, secs, build], sampleRate = SR) {
  const O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const octx = new O(2, Math.round(secs * sampleRate), sampleRate);
  const s = createSounds1950(octx, octx.destination, { manual: true });
  s.setVolume(S.vol);
  build(s);
  s.pump(secs);
  const t0 = performance.now();
  const buf = await octx.startRendering();
  const ms = performance.now() - t0;
  const ch = buf.getChannelData(0);
  const a = analyse(ch, sampleRate);
  let clipped = 0; for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) >= 0.999) clipped++;
  const st = s.stats();
  return { name, audioS: secs, renderMs: Math.round(ms), cpuPct: +(ms / (secs * 1000) * 100).toFixed(2), peak: +a.peak.toFixed(3), rms: +a.rms.toFixed(4), clipped, nodesMade: st.nodesMade, centroidHz: Math.round(a.centroidHz), lowShare: +a.lowShare.toFixed(2) };
}
async function measureAll() {
  $('measure').disabled = true; say('rendering offline…');
  const rows = [];
  for (const c of CASES) { // best of two renders: the faster one is the honest cost (the other includes whatever else the page was doing)
    const a = await renderCase(c); await new Promise((r) => setTimeout(r, 0));
    const b = await renderCase(c); await new Promise((r) => setTimeout(r, 0));
    rows.push(a.renderMs <= b.renderMs ? a : b);
  }
  const t = $('report');
  t.innerHTML = '<tr><th>sound</th><th>s</th><th>ms</th><th>cpu %</th><th>peak</th><th>nodes</th></tr>' + rows.map((r) => `<tr class="${r.peak >= 1 || r.clipped ? 'bad' : ''}"><td>${r.name}</td><td>${r.audioS}</td><td>${r.renderMs}</td><td>${r.cpuPct}</td><td>${r.peak}</td><td>${r.nodesMade}</td></tr>`).join('');
  $('measure').disabled = false; say(`measured ${rows.length} sounds: worst cpu ${Math.max(...rows.map((r) => r.cpuPct))}%, highest peak ${Math.max(...rows.map((r) => r.peak))}`);
  return rows;
}
$('measure').addEventListener('click', measureAll);
if (new URLSearchParams(window.location.search).get('cpu') === '1') measureAll();

// a handle for the headless checks (not used by the page)
window.__soundLab = { ready: true, state: S, CASES: CASES.map((c) => c[0]), measureAll, renderCase: (i, sr) => renderCase(CASES[i], sr), get sounds() { return sounds; }, get ctx() { return ctx; }, audio, live };
