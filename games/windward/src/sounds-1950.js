// SOUNDS OF 1950 (felix/windward-sound-lab): the hot-bulb engine, the AGA relight, storm, harbour and coast, and an ambience mixer, all
// SYNTHESISED with WebAudio at run time. No sample files and nothing third-party (the same rule as src/audio.js, docs/LURE.md).
// Research, sources and what is documented vs a guess: docs/SOUND-1950.md. Felix judges by ear in sound-lab.html.
//
//   const s = createSounds1950(ctx, destination);        // ctx: any (Offline)AudioContext; destination: where to plug in (default ctx.destination)
//   const e = s.engine({ rpm: 330, cylinders: 1 });       // a hot-bulb engine: handle { setRpm, setDistance, setGain, setDoppler, stop }
//   s.passingBoat({ speedMs: 5, closestM: 30 });          // an engine that comes, passes and goes (distance falloff, Doppler, pan)
//   s.relight1950({ flashes });                           // the AGA relight: clunk, gas, pilot, the flasher's pop, then the light's own pattern
//   s.storm({ level: 1 });  s.thunder({ distanceKm: 2 }); // wind building, rain, thunder
//   s.mistSignal({ distance: 0 });  s.handBell();  s.halyards({ wind: 0.4 });  s.rowing({ spm: 22 });  s.gull();   // harbour and coast
//   s.ambience('evening');                                // calm / evening / storm presets that layer the above
//   s.stats();  s.stopAll();
//
// Cheap on purpose: shared noise buffers, the engine's "dunk" is made once as a small buffer and each beat just plays it (no per-beat
// oscillators), handles keep a handful of nodes, and event streams are scheduled a fraction of a second ahead from one timer each.
// `manual: true` skips the timers and lets a test or an offline render call `s.pump(untilSeconds)` to schedule everything up front.

// ======================================================================================================
//  Pure recipes: data and maths, so they can be tested without a browser
// ======================================================================================================

// ---- the hot-bulb engine (tandkulemotor) -------------------------------------------------------------
// Sources (docs/SOUND-1950.md): sv.wikipedia Tandkulemotor: mostly single-cylinder two-stroke, bigger Bohuslän boats often two cylinders, low
// revs (so a heavy flywheel), the origin of the classic "dunk-dunk" of old fishing boats; tandkulemotorer.se: low revs plus big cylinder
// volume give the sound, "lunkande" (plodding); Powerhouse Museum: a 1905 Bolinder, 9 hp at 375 rpm; a muffler on the exhaust.
// A two-stroke fires once per revolution, so 375 rpm is 6.25 beats a second. The idle and cruise figures are GUESSES within "low revs".
export const ENGINE = {
  idleRpm: 170, cruiseRpm: 330, maxRpm: 430, // idle and cruise: our guess; max a little over the documented 375
  jitter: 0.045, // beat timing wobble (a fraction of the interval): a hand-fed, heavy engine is not a metronome
  twoCylinderSplit: 0.42, // two cylinders fire unevenly: a short gap then a long one ("dunk-dunk ... dunk-dunk")
  level: 0.55, // the engine at 0 m is a background sound, not the main event (the game's bell peaks near 0.22)
  refM: 14, // distance at which the falloff has halved the gain, and the low-pass starts to close
  maxCutoffHz: 2600, minCutoffHz: 200,
  bufferS: 0.36, variants: 3,
};
// seconds from one firing to the next. A single-cylinder two-stroke: once a revolution. Two cylinders: two firings a revolution, uneven.
export function beatInterval(rpm, cylinders = 1, index = 0) {
  const rev = 60 / Math.max(30, rpm);
  if (cylinders < 2) return rev;
  return index % 2 === 0 ? rev * ENGINE.twoCylinderSplit : rev * (1 - ENGINE.twoCylinderSplit);
}
export const engineGain = (distanceM) => (ENGINE.refM / (ENGINE.refM + Math.max(0, distanceM))) ** 1.15;
export const engineCutoff = (distanceM) => Math.min(ENGINE.maxCutoffHz, Math.max(ENGINE.minCutoffHz, ENGINE.maxCutoffHz / (1 + Math.max(0, distanceM) / 55)));
// pitch ratio from a source moving at radialMs (positive = receding) past a still listener
export const dopplerRate = (radialMs, c = 343) => c / (c + radialMs);
// where a boat is when passing: it travels along a straight track at speedMs, closest to you at closestM, starting startM before that point.
export function passingState(t, { speedMs = 5, closestM = 30, startM = 140 } = {}) {
  const x = -startM + speedMs * t; // along the track, 0 at the closest point
  const d = Math.hypot(x, closestM);
  return { x, distance: d, radialMs: (speedMs * x) / d, doppler: dopplerRate((speedMs * x) / d), pan: Math.max(-1, Math.min(1, x / Math.max(1, startM))), done: x > startM };
}
export const passingDuration = ({ speedMs = 5, startM = 140 } = {}) => (2 * startM) / speedMs;

// One "dunk": the exhaust pulse of a big slow cylinder through a muffler, as a mono buffer, made by maths. The body is a low sine falling
// from ~95 Hz to ~55 Hz (the pulse), a stronger second partial, a brief lowpassed pressure thud at the start, a softer muffler puff just after,
// and a small tail pulse (the scavenge "a" in dunk-a). Returns a Float32Array, peak 0.9. variant 0..2 changes level and tuning a little.
export function generateDunk(sampleRate, variant = 0) {
  const n = Math.floor(ENGINE.bufferS * sampleRate);
  const out = new Float32Array(n);
  const detune = [1, 1.05, 0.96][variant % 3];
  const a = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / sampleRate); // one-pole coefficient for a cutoff in Hz: the sound is the same at any sample rate
  const aThud = a(950), aPuff = a(280);
  let lp1 = 0, lp2 = 0, seed = 1234567 + variant * 7919;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f1 = (55 + 40 * Math.exp(-t / 0.05)) * detune; // the pulse: a low note that falls as the pressure drops
    p1 += (2 * Math.PI * f1) / sampleRate;
    p2 += (2 * Math.PI * f1 * 2.02) / sampleRate;
    p3 += (2 * Math.PI * f1 * 3.1) / sampleRate; // upper partials: a muffled exhaust is not a pure low sine, and a phone speaker cannot play 70 Hz
    p4 += (2 * Math.PI * f1 * 4.6) / sampleRate;
    p5 += (2 * Math.PI * 62 * detune) / sampleRate;
    const body = 0.55 * Math.sin(p1) * Math.exp(-t / 0.085) + 1.0 * Math.sin(p2) * Math.exp(-t / 0.07) + 0.85 * Math.sin(p3) * Math.exp(-t / 0.055) + 0.5 * Math.sin(p4) * Math.exp(-t / 0.04); // the harmonics carry the energy: the ear hears the low pitch, a small speaker plays the rest
    const nz = rnd();
    lp1 += aThud * (nz - lp1);
    lp2 += aPuff * (nz - lp2);
    const thud = lp1 * 4.0 * Math.exp(-t / 0.016); // the pressure thud of the exhaust port opening
    const puff = t > 0.005 ? lp2 * 3.2 * Math.exp(-(t - 0.005) / 0.05) : 0; // the muffler's soft puff just after
    const tail = t > 0.07 ? 0.22 * Math.sin(p5) * Math.exp(-(t - 0.07) / 0.05) : 0; // a small tail pulse (the scavenge "a" in dunk-a)
    out[i] = Math.tanh(1.5 * (body + 0.7 * thud + 0.4 * puff + tail)); // a little drive adds the odd harmonics of a hard-working exhaust
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const lvl = [0.9, 1.0, 0.82][variant % 3] * 0.9 / (peak || 1);
  for (let i = 0; i < n; i++) out[i] *= lvl * (i > n - 200 ? (n - i) / 200 : 1); // a short fade so the buffer ends at zero
  return out;
}

// Looping noise beds, made once as small buffers with the filtering and the slow movement BAKED IN, so that a running layer is a source, a filter and
// a gain instead of a chain of live filters and modulators (that is most of the CPU of a storm). kind: 'wind' | 'rain' | 'sea' | 'bed'. All periodic (the end
// is crossfaded into the start), RMS about 0.25, deterministic. Returns a Float32Array.
export function generateBed(kind, sampleRate) {
  const secs = { wind: 5, rain: 4, sea: 8, bed: 2 }[kind];
  const N = Math.floor(secs * sampleRate), M = Math.floor(0.25 * sampleRate);
  const g = new Float32Array(N + M);
  let seed = { wind: 11, rain: 23, sea: 37, bed: 41 }[kind] * 7919;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  const a = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / sampleRate); // one-pole coefficient for a cutoff in Hz
  let l1 = 0, l2 = 0, l3 = 0, h1 = 0, env = 0.5, envT = 0.5, envN = 0;
  const cutLow = { wind: 1400, rain: 9000, sea: 480, bed: 700 }[kind], cutHigh = { wind: 140, rain: 2000, sea: 0, bed: 220 }[kind];
  const aL = a(cutLow), aH = cutHigh ? a(cutHigh) : 0, aB = a(60);
  for (let i = 0; i < N + M; i++) {
    const x = rnd();
    l1 += aL * (x - l1); l2 += aL * (l1 - l2); // two poles: a steeper low-pass
    let y = l2;
    if (kind === 'wind') { l3 += aB * (x - l3); y = y * 0.7 + l3 * 5; } // a rumble of low "brown" noise under the band (wind has weight at the bottom)
    if (aH) { h1 += aH * (y - h1); y -= h1; } // high-pass
    const t = i / sampleRate;
    if (kind === 'rain') { // drops in handfuls: a smoothed random loudness, a few times a second
      if (i % Math.floor(sampleRate / 9) === 0) envT = 0.35 + 0.65 * Math.abs(rnd());
      env += 0.0015 * (envT - env); envN += 0; y *= env * 1.6;
    }
    if (kind === 'sea') y *= 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / secs * 1)) * (0.75 + 0.25 * Math.sin((2 * Math.PI * t) / secs * 3 + 1)); // swells that come and go
    g[i] = y;
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) { if (i < M) { const k = (Math.PI / 2) * (i / M); out[i] = g[i] * Math.sin(k) + g[N + i] * Math.cos(k); } else out[i] = g[i]; } // periodic: tail crossfaded into the head
  let sum = 0; for (let i = 0; i < N; i++) sum += out[i] * out[i];
  const k = 0.25 / (Math.sqrt(sum / N) || 1);
  for (let i = 0; i < N; i++) out[i] *= k;
  return out;
}

// A crude spectrum summary for tests and the lab (not an FFT: Goertzel at a few bands). { peak, rms, lowShare: energy below 300 Hz, phoneShare: energy from 150 Hz up (what a phone speaker can play), centroidHz }
export function analyse(samples, sampleRate) {
  let peak = 0, sum = 0;
  for (const v of samples) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const bands = [40, 70, 110, 170, 250, 400, 700, 1200, 2000, 3500, 6000];
  // the bands come from ONE contiguous window (up to 16384 samples from the middle): skipping samples would alias high frequencies into the low bands
  const win = samples.length > 16384 ? samples.subarray((samples.length - 16384) >> 1, ((samples.length - 16384) >> 1) + 16384) : samples;
  const e = bands.map((f) => {
    const w = (2 * Math.PI * f) / sampleRate, c = 2 * Math.cos(w);
    let s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < win.length; i++) { s0 = win[i] + c * s1 - s2; s2 = s1; s1 = s0; }
    return Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2);
  });
  const total = e.reduce((a, b) => a + b, 0) || 1;
  return { peak, rms, lowShare: e.filter((_, i) => bands[i] < 300).reduce((a, b) => a + b, 0) / total, phoneShare: e.filter((_, i) => bands[i] >= 150).reduce((a, b) => a + b, 0) / total, centroidHz: bands.reduce((a, f, i) => a + f * e[i], 0) / total };
}

// ---- the mist signal: a tyfon -------------------------------------------------------------------------
// Sources: fyrwiki Tyfon: invented 1920 (H Rydberg, Kockums), a metal diaphragm set vibrating by steam, later compressed air, theoretical range
// about 5 nautical miles; fyrwiki Tyfon / Mistsignal ljud: Swedish tyfons often two-tone, about 210 Hz and 260 Hz (Draghallan "supertyfon":
// 2 blasts per 30 s, 2.5+2.5+2.5+22.5), one at 255 Hz; fyrwiki Maseskar: from 1950 a tyfon, 2 blasts per 30 s (2+4+2+22).
// "2 + 4 + 2 + 22" reads: 2 s blast, 4 s silence, 2 s blast, 22 s silence.
export const TYFON = { hz: [210, 260], pattern: [2, 4, 2, 22], attackS: 0.16, releaseS: 0.55, cutoffHz: 1500, gain: 0.11, raspHz: 38 };
// pattern [on, off, on, off, ...] in seconds -> [{ at, len }] of the sounding parts; period = the sum
export function blastTimes(pattern) {
  const out = []; let at = 0;
  pattern.forEach((len, i) => { if (i % 2 === 0) out.push({ at, len }); at += len; });
  return out;
}
export const patternPeriod = (pattern) => pattern.reduce((a, b) => a + b, 0);
// a far-off signal is quieter and duller; the real range is about 5 nautical miles = 9 km
export const mistGain = (distanceM) => 1 / (1 + Math.max(0, distanceM) / 700) ** 1.1;
export const mistCutoff = (distanceM) => Math.max(260, TYFON.cutoffHz / (1 + Math.max(0, distanceM) / 1800));

// ---- the AGA light --------------------------------------------------------------------------------------
// Sources (docs/PEOPLE-1950.md section 2, from fyr.org and the 1955 US Coast Guard manual for the same apparatus): a "pop" is heard each time the
// flasher functions; the flame is a clear, soot-free flame lit from a permanent pilot (a large blue flame when right); the sun valve's seat is
// magnetised for a clear open/closed "snap"; the gas smells faintly of garlic. The hiss, the ignition "whump" and the tank clunk are our guesses.
export const AGA = { popHz: 150, popGain: 0.32, puffHz: 700, pilotHiss: 0.022, clunkGain: 0.26, snapGain: 0.16 };
// flashes: src/light-glyph.js lightGlyph().flashes [{ at, len, dark? }] for one period. The flasher pops when the flame is let in (a flash start) and, for an
// occulting light, the pops are the starts of each eclipse's end (the gas comes back). Returns [{ at, len, dark }] sorted.
export function flasherSchedule(flashes) {
  return [...(flashes || [])].map((f) => ({ at: f.dark ? f.at + f.len : f.at, len: f.dark ? 0.35 : f.len, dark: !!f.dark })).sort((a, b) => a.at - b.at);
}
// the relight in order (seconds from the start): what the player hears when they get one burning again. Documented steps are marked.
export const RELIGHT_STEPS = [
  { at: 0.0, what: 'clunk', note: 'a full cylinder set down / the nut on the nipple (guess)' },
  { at: 0.45, what: 'clunk', note: 'the wrench on the brass nut (guess)' },
  { at: 1.2, what: 'gas', len: 1.5, note: 'the valve opened gently: a rising hiss (guess; the smell is documented, a hiss is not)' },
  { at: 2.8, what: 'whump', note: 'the pilot catches (guess)' },
  { at: 3.2, what: 'pilot', note: 'a steady, quiet pilot flame (guess); it stays lit by day (documented)' },
  { at: 4.1, what: 'snap', note: 'the sun valve: a clear snap as it opens (documented that the seat snaps)' },
  { at: 5.0, what: 'pattern', note: 'the flasher pops each flash (documented)' },
];

// ---- the ambience presets ---------------------------------------------------------------------------------
// level 0..1 per layer. Kept so that the loudest preset (storm) still leaves headroom.
export const AMBIENCE_LAYERS = ['sea', 'wind', 'rain', 'thunder', 'gulls', 'bell', 'mist', 'halyards', 'engine'];
export const AMBIENCE = {
  calm: { label: 'Calm day', sea: 0.45, wind: 0.12, rain: 0, thunder: 0, gulls: 0.55, bell: 0, mist: 0, halyards: 0.3, engine: 0.3 },
  evening: { label: 'Evening', sea: 0.5, wind: 0.08, rain: 0, thunder: 0, gulls: 0.12, bell: 0.35, mist: 0.45, halyards: 0.2, engine: 0.14 },
  storm: { label: 'Storm', sea: 0.75, wind: 1, rain: 0.85, thunder: 0.6, gulls: 0, bell: 0, mist: 0.5, halyards: 1, engine: 0 },
};
export const AMBIENCE_FADE_S = 3;

// ======================================================================================================
//  The sound maker
// ======================================================================================================
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function createSounds1950(ctx, destination = ctx && ctx.destination, opts = {}) {
  const rand = opts.random || Math.random;
  const manual = !!opts.manual;
  const timers = opts.timers || { setInterval: globalThis.setInterval && globalThis.setInterval.bind(globalThis), clearInterval: globalThis.clearInterval && globalThis.clearInterval.bind(globalThis) };
  const made = { total: 0, byKind: {} };
  let voices = 0;
  const count = (k) => { made.total++; made.byKind[k] = (made.byKind[k] || 0) + 1; };
  const streams = new Set(), handles = new Set();
  const sr = ctx.sampleRate || 44100;

  // ---- node helpers (all counted: the lab reports them) ----
  const gainNode = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; count('gain'); return g; };
  const filterNode = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (b.Q) b.Q.value = q; count('filter'); return b; };
  const bufferSource = (buffer, { loop = false, rate = 1 } = {}) => {
    const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = loop; s.playbackRate.value = rate; count('source'); voices++;
    s.onended = () => { voices--; };
    return s;
  };
  const oscNode = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; count('osc'); voices++; o.onended = () => { voices--; }; return o; };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  const now = () => (ctx.currentTime || 0);
  const makeBuffer = (data) => { const b = ctx.createBuffer(1, data.length, sr); const ch = b.getChannelData(0); for (let i = 0; i < data.length; i++) ch[i] = data[i]; return b; };

  // master: a gain, then a soft limiter (a waveshaper: linear to 0.7, then a smooth knee that never reaches 1) so that layers can never clip together.
  // Much cheaper than a DynamicsCompressor. opts.compressor: true adds one as well.
  const out = gainNode(0.85);
  let tail = out;
  if (ctx.createWaveShaper) {
    const sh = ctx.createWaveShaper(); const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) { const x = (i / 512) - 1, ax = Math.abs(x); curve[i] = Math.sign(x) * (ax <= 0.7 ? ax : 0.7 + 0.28 * Math.tanh((ax - 0.7) / 0.28)); }
    sh.curve = curve; sh.oversample = 'none'; count('limiter'); tail.connect(sh); tail = sh;
  }
  if (opts.compressor && ctx.createDynamicsCompressor) {
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25; count('compressor'); tail.connect(comp); tail = comp;
  }
  tail.connect(destination);

  // ---- shared buffers, made once ----
  const noiseData = new Float32Array(sr * 2); // 2 s of white noise, looped
  { let seed = 987654321; for (let i = 0; i < noiseData.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; noiseData[i] = (seed / 4294967296) * 2 - 1; } }
  const noise = makeBuffer(noiseData);
  const dunks = Array.from({ length: ENGINE.variants }, (_, v) => makeBuffer(generateDunk(sr, v)));
  // a wooden "tock" (a halyard slapping a mast, an oar in its rowlock) and a metallic "tink" (a block, a fitting, a bell's clapper)
  const tockData = new Float32Array(Math.floor(0.12 * sr)), tinkData = new Float32Array(Math.floor(0.25 * sr));
  for (let i = 0; i < tockData.length; i++) { const t = i / sr; tockData[i] = (Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t / 0.016) * 0.8 + noiseData[i] * Math.exp(-t / 0.003) * 0.6) * 0.9; }
  for (let i = 0; i < tinkData.length; i++) { const t = i / sr; tinkData[i] = (Math.sin(2 * Math.PI * 2400 * t) * 0.6 + Math.sin(2 * Math.PI * 3610 * t) * 0.35 + Math.sin(2 * Math.PI * 5230 * t) * 0.15) * Math.exp(-t / 0.045) * 0.7; }
  const tock = makeBuffer(tockData), tink = makeBuffer(tinkData);
  const beds = { wind: makeBuffer(generateBed('wind', sr)), rain: makeBuffer(generateBed('rain', sr)), sea: makeBuffer(generateBed('sea', sr)), bed: makeBuffer(generateBed('bed', sr)) };
  // a looped bed voice, started now at a random point so layers do not breathe together
  const bedLoop = (kind, rate = 1) => { const s = bufferSource(beds[kind], { loop: true, rate }); s.start(0, rand() * (beds[kind].length / sr) * 0.9); return s; };

  // ---- a stream: events scheduled a little ahead from one timer (or pumped by hand) ----
  function stream(step, { intervalMs = 40, ahead = 0.25, start = 0.05 } = {}) {
    let next = now() + start, id = null, alive = true;
    const s = {
      pump(until) { if (!alive) return; next = step(next, until); if (next === Infinity) s.stop(); }, // a stream with nothing more to schedule retires itself
      stop() { alive = false; if (id !== null && timers.clearInterval) timers.clearInterval(id); id = null; streams.delete(s); },
      get running() { return alive; },
    };
    streams.add(s);
    if (!manual && timers.setInterval) { s.pump(now() + ahead); if (alive) id = timers.setInterval(() => s.pump(now() + ahead), intervalMs); }
    return s;
  }
  const track = (h) => { handles.add(h); const stop = h.stop; h.stop = (...a) => { handles.delete(h); return stop(...a); }; return h; };
  // a looped noise voice with its own start offset so layers do not breathe together
  const noiseLoop = (rate = 1, when = 0) => { const s = bufferSource(noise, { loop: true, rate }); s.start(when, rand() * 1.5); return s; };
  const fadeOut = (g, t, secs) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + secs); };

  // ====================================================================================================
  //  1. The hot-bulb engine
  // ====================================================================================================
  function engine({ rpm = ENGINE.cruiseRpm, cylinders = 1, distance = 0, gain = 1, doppler = 1, pan = 0, dopplerAt = null, endAt = Infinity, fadeS = 0.8 } = {}) {
    const st = { rpm, cylinders, distance, gain, doppler, index: 0, bedRpm: -1, done: false };
    const lp = filterNode('lowpass', engineCutoff(distance), 0.7);
    const g = gainNode(engineGain(distance) * gain * ENGINE.level);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = pan; count('panner'); chain(lp, g, panner, out); } else chain(lp, g, out);
    // the mechanical bed: flywheel, gears and the whisper of the bulb, a quiet low-passed noise that follows the revs
    const bed = bedLoop('bed'); const bedG = gainNode(0.05);
    chain(bed, bedG, lp);
    const fire = (t) => {
      const v = Math.floor(rand() * dunks.length);
      const norm = clamp((st.rpm - 120) / (ENGINE.maxRpm - 120), 0, 1);
      const second = st.cylinders > 1 && st.index % 2 === 1;
      const s = bufferSource(dunks[v], { rate: (0.88 + 0.26 * norm) * (second ? 1.07 : 1) * (dopplerAt ? dopplerAt(t) : st.doppler) * (0.99 + rand() * 0.02) });
      s.connect(lp); s.start(t);
    };
    const s = stream((next, until) => {
      while (next < until && next < endAt) {
        fire(next);
        const gap = beatInterval(st.rpm, st.cylinders, st.index) * (1 + (rand() * 2 - 1) * ENGINE.jitter);
        st.index++;
        next += gap;
      }
      if (st.bedRpm !== st.rpm) { st.bedRpm = st.rpm; bedG.gain.setTargetAtTime(0.03 + 0.05 * clamp(st.rpm / ENGINE.maxRpm, 0, 1), now(), 0.2); }
      if (next >= endAt && !st.done) { st.done = true; fadeOut(g, endAt, fadeS); try { bed.stop(endAt + fadeS + 0.05); } catch { /* ended */ } return Infinity; } // a boat that has gone by
      return next;
    });
    const h = {
      get rpm() { return st.rpm; }, get cylinders() { return st.cylinders; }, get distance() { return st.distance; },
      setRpm(v) { st.rpm = clamp(v, 60, ENGINE.maxRpm); },
      setCylinders(n) { st.cylinders = n >= 2 ? 2 : 1; },
      setDistance(d) { st.distance = d; lp.frequency.setTargetAtTime(engineCutoff(d), now(), 0.05); g.gain.setTargetAtTime(engineGain(d) * st.gain * ENGINE.level, now(), 0.05); },
      setGain(v) { st.gain = v; g.gain.setTargetAtTime(engineGain(st.distance) * v * ENGINE.level, now(), 0.05); },
      setDoppler(r) { st.doppler = r; },
      setPan(p) { if (panner) panner.pan.setTargetAtTime(p, now(), 0.05); },
      pump: (until) => s.pump(until),
      stop(fadeS2 = 0.6) { s.stop(); fadeOut(g, now(), fadeS2); try { bed.stop(now() + fadeS2 + 0.05); } catch { /* already stopped */ } },
      _lp: lp, _g: g, _panner: panner,
    };
    return track(h);
  }
  // an engine that comes up the water, passes at closestM and goes away: distance falloff, a Doppler glide, and a pan from side to side. All the movement is
  // scheduled up front (gain, low-pass and pan every 0.1 s, Doppler per beat), so it needs no timer and renders the same offline.
  function passingBoat({ speedMs = 5, closestM = 30, startM = 140, rpm = ENGINE.cruiseRpm, cylinders = 1, gain = 1, delayS = 0 } = {}) {
    const p = { speedMs, closestM, startM };
    const t0 = now() + delayS, dur = passingDuration(p);
    const s0 = passingState(0, p);
    const e = engine({ rpm, cylinders, gain, distance: s0.distance, pan: s0.pan, dopplerAt: (t) => passingState(clamp(t - t0, 0, dur), p).doppler, endAt: t0 + dur, fadeS: 0.3 });
    e._schedule = (stepS = 0.1) => { // gain, low-pass and pan along the track
      for (let t = 0; t <= dur + 1e-9; t += stepS) {
        const s = passingState(t, p);
        e._lp.frequency.setValueAtTime(engineCutoff(s.distance), t0 + t);
        e._g.gain.setValueAtTime(engineGain(s.distance) * gain * ENGINE.level, t0 + t);
        if (e._panner) e._panner.pan.setValueAtTime(s.pan, t0 + t);
      }
    };
    e._schedule();
    e.durationS = dur; e.update = (t) => passingState(t, p);
    return e;
  }

  // ====================================================================================================
  //  2. The AGA light
  // ====================================================================================================
  function flasherPop(t = now(), gain = 1) { // the documented "pop": a small diaphragm flipping, a soft thump with a dry click
    const s = bufferSource(tock, { rate: 1.55 }); const g = gainNode(AGA.popGain * gain); const f = filterNode('bandpass', 1300, 0.9);
    chain(s, f, g, out); s.start(t);
    const o = oscNode('sine', AGA.popHz); const og = gainNode(0); chain(o, og, out);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(AGA.popGain * 0.8 * gain, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.frequency.setValueAtTime(AGA.popHz * 1.6, t); o.frequency.exponentialRampToValueAtTime(AGA.popHz * 0.7, t + 0.06);
    o.start(t); o.stop(t + 0.1);
  }
  function gasPuff(t, len, gain = 1) { // the gas let in for a flash: a soft breath of noise as long as the flash
    const s = noiseLoop(1, t); const f = filterNode('lowpass', AGA.puffHz, 0.7); const g = gainNode(0);
    chain(s, f, g, out);
    const l = clamp(len, 0.12, 2.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08 * gain, t + 0.03); g.gain.setValueAtTime(0.08 * gain, t + Math.max(0.04, l - 0.1)); g.gain.linearRampToValueAtTime(0, t + l + 0.1);
    s.stop(t + l + 0.2);
  }
  function cylinderClunk(t = now(), gain = 1) { // metal on metal: a heavy cylinder, a wrench on a brass nut
    const a = bufferSource(tink, { rate: 0.42 }); const ag = gainNode(AGA.clunkGain * gain); chain(a, ag, out); a.start(t);
    const b = bufferSource(tock, { rate: 0.55 }); const bg = gainNode(AGA.clunkGain * 1.3 * gain); chain(b, bg, out); b.start(t);
  }
  function gasHiss(t = now(), len = 1.5, gain = 1) { // the valve opened gently: a hiss that rises and settles
    const s = noiseLoop(1, t); const hp = filterNode('highpass', 2200, 0.7); const g = gainNode(0);
    chain(s, hp, g, out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * gain, t + len * 0.7); g.gain.linearRampToValueAtTime(0.02 * gain, t + len + 0.6); g.gain.linearRampToValueAtTime(0, t + len + 1.2);
    s.stop(t + len + 1.4);
  }
  function pilotWhump(t = now(), gain = 1) { // the pilot catching: a soft low "whump" as the gas lights
    const s = noiseLoop(1, t); const f = filterNode('lowpass', 260, 0.8); const g = gainNode(0);
    chain(s, f, g, out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.42 * gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    s.stop(t + 0.45);
    const o = oscNode('sine', 70); const og = gainNode(0); chain(o, og, out);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.26 * gain, t + 0.04); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.start(t); o.stop(t + 0.4);
  }
  function pilot({ gain = 1 } = {}) { // the pilot flame burning: a quiet, steady, slightly airy hiss
    const s = noiseLoop(); const f = filterNode('bandpass', 1900, 0.5); const g = gainNode(0);
    chain(s, f, g, out);
    g.gain.setTargetAtTime(AGA.pilotHiss * gain, now(), 0.4);
    return track({ stop(fadeS = 0.8) { fadeOut(g, now(), fadeS); try { s.stop(now() + fadeS + 0.05); } catch { /* ended */ } } });
  }
  function sunValveSnap(t = now(), gain = 1) { // the magnetised valve seat: a clear, dry snap
    const s = bufferSource(tink, { rate: 1.9 }); const f = filterNode('highpass', 1500, 0.7); const g = gainNode(AGA.snapGain * gain);
    chain(s, f, g, out); s.start(t);
  }
  // the light's own rhythm: pops (and soft puffs of gas) for `cycles` periods of the light's pattern. flashes: lightGlyph().flashes; period: its period.
  function flasherPattern({ flashes, period = 12, cycles = 2, delayS = 0, gain = 1 } = {}) {
    const sched = flasherSchedule(flashes);
    const t0 = now() + delayS;
    for (let c = 0; c < cycles; c++) for (const f of sched) {
      const t = t0 + c * period + f.at;
      flasherPop(t, gain);
      if (!f.dark && f.len > 0.2) gasPuff(t + 0.01, f.len, gain);
    }
    return { durationS: delayS + cycles * period, pops: sched.length * cycles };
  }
  // the whole relight moment (RELIGHT_STEPS). Returns { durationS, pilot } (the pilot hiss keeps going: stop it when the scene ends)
  function relight1950({ flashes = [{ at: 0, len: 0.5 }], period = 12, cycles = 2, gain = 1 } = {}) {
    const t = now() + 0.05;
    cylinderClunk(t, gain); cylinderClunk(t + 0.45, gain * 0.8);
    gasHiss(t + 1.2, 1.5, gain);
    pilotWhump(t + 2.8, gain);
    const p = pilot({ gain });
    sunValveSnap(t + 4.1, gain);
    const pat = flasherPattern({ flashes, period, cycles, delayS: 5.0 + 0.05, gain });
    return { durationS: pat.durationS + 0.2, pops: pat.pops, pilot: p };
  }

  // ====================================================================================================
  //  3. Storm: wind, rain, thunder, and the sea under them
  // ====================================================================================================
  function wind({ strength = 0.5, gain = 1 } = {}) {
    const st = { strength };
    const s = bedLoop('wind'); const bp = filterNode('lowpass', 400, 0.6); const whistle = filterNode('peaking', 900, 7); whistle.gain.value = 0; const g = gainNode(0); const gust = gainNode(1);
    chain(s, bp, whistle, gust, g, out);
    // gusts: two slow oscillators move the gain, so the wind breathes and never repeats exactly
    const l1 = oscNode('sine', 0.11), l2 = oscNode('sine', 0.29); const d1 = gainNode(0.3), d2 = gainNode(0.15);
    chain(l1, d1, gust.gain); chain(l2, d2, gust.gain); l1.start(); l2.start();
    const apply = () => {
      const k = clamp(st.strength, 0, 1);
      bp.frequency.setTargetAtTime(380 + 2600 * k * k, now(), 0.4);
      whistle.frequency.setTargetAtTime(700 + 1100 * k, now(), 0.4);
      whistle.gain.setTargetAtTime(16 * k * k * k, now(), 0.4); // the wail only in a real blow
      g.gain.setTargetAtTime(0.3 * gain * k ** 1.3, now(), 0.5);
    };
    apply();
    return track({
      get strength() { return st.strength; },
      setStrength(v) { st.strength = v; apply(); },
      stop(fadeS = 1.5) { fadeOut(g, now(), fadeS); for (const n of [s, l1, l2]) { try { n.stop(now() + fadeS + 0.05); } catch { /* ended */ } } },
    });
  }
  function rain({ intensity = 0.5, gain = 1 } = {}) {
    const st = { intensity };
    // the patter (drops in handfuls) is baked into the bed; one low-pass dulls a light rain
    const s = bedLoop('rain'); const lp = filterNode('lowpass', 8000, 0.5); const g = gainNode(0);
    chain(s, lp, g, out);
    const apply = () => { const k = clamp(st.intensity, 0, 1); g.gain.setTargetAtTime(0.2 * gain * k ** 1.2, now(), 0.5); lp.frequency.setTargetAtTime(3500 + 6000 * k, now(), 0.5); };
    apply();
    return track({
      get intensity() { return st.intensity; },
      setIntensity(v) { st.intensity = v; apply(); },
      stop(fadeS = 1.5) { fadeOut(g, now(), fadeS); try { s.stop(now() + fadeS + 0.05); } catch { /* ended */ } },
    });
  }
  function seaLap({ level = 0.5, gain = 1 } = {}) { // water against the hull and the rocks: low noise swelling slowly
    const st = { level };
    const s = bedLoop('sea'); const lp = filterNode('lowpass', 700, 0.5); const g = gainNode(0); // the swell is baked into the bed
    chain(s, lp, g, out);
    const apply = () => { const k = clamp(st.level, 0, 1); g.gain.setTargetAtTime(0.2 * gain * k, now(), 0.5); lp.frequency.setTargetAtTime(350 + 900 * k, now(), 0.5); };
    apply();
    return track({ setLevel(v) { st.level = v; apply(); }, stop(fadeS = 1.5) { fadeOut(g, now(), fadeS); try { s.stop(now() + fadeS + 0.05); } catch { /* ended */ } } });
  }
  // thunder: a crack if near, then a long rumble that falls and rolls. distanceKm sets the delay (sound travels ~0.34 km/s; shortened so a game need not wait
  // twenty seconds), how bright the crack is, and how long the roll goes on.
  function thunder({ distanceKm = 2, power = 1, delayS = null } = {}) {
    const wait = delayS ?? Math.min(6, distanceKm * 1.4);
    const t = now() + wait;
    const near = clamp(1 - distanceKm / 6, 0, 1);
    if (near > 0.15) { // the crack
      const c = noiseLoop(1, t); const hp = filterNode('highpass', 900, 0.7); const cg = gainNode(0); chain(c, hp, cg, out);
      cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.3 * near * power, t + 0.006); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2 + 0.25 * near);
      c.stop(t + 0.6);
    }
    const len = 3.5 + distanceKm * 0.9;
    const r = noiseLoop(0.5, t); const lp = filterNode('lowpass', 700, 0.9); const rg = gainNode(0); chain(r, lp, rg, out);
    lp.frequency.setValueAtTime(260 + 600 * near, t); lp.frequency.exponentialRampToValueAtTime(55, t + len);
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.4 * power, t + 0.12 + 0.2 * (1 - near));
    const bumps = 3 + Math.floor(rand() * 3); // the roll: several swells as it echoes round the skerries
    for (let i = 1; i <= bumps; i++) { const at = t + (len * i) / (bumps + 1); rg.gain.linearRampToValueAtTime((0.4 * power) * (0.9 - i * 0.12) * (0.7 + rand() * 0.5), at); rg.gain.linearRampToValueAtTime((0.4 * power) * 0.25, at + len * 0.08); }
    rg.gain.linearRampToValueAtTime(0, t + len);
    r.stop(t + len + 0.1);
    return { atS: wait, durationS: wait + len };
  }
  // a whole storm: wind and rain follow `level`, with thunder now and then (every 8-25 s when level is high)
  function storm({ level = 1, gain = 1 } = {}) {
    const w = wind({ strength: 0.15 + 0.85 * level, gain }), r = rain({ intensity: level, gain }), sea = seaLap({ level: 0.4 + 0.5 * level, gain });
    let lvl = level;
    const str = stream((next, until) => {
      while (next < until) { if (lvl > 0.35) thunderAt(next, lvl); next += (8 + rand() * 17) / Math.max(0.35, lvl); }
      return next;
    }, { start: 4 + rand() * 6, ahead: 0.5, intervalMs: 250 });
    function thunderAt(t, l) { thunder({ distanceKm: 0.8 + rand() * 5, power: 0.5 + 0.5 * l, delayS: Math.max(0, t - now()) }); }
    return track({
      get level() { return lvl; },
      setLevel(v) { lvl = v; w.setStrength(0.15 + 0.85 * v); r.setIntensity(v); sea.setLevel(0.4 + 0.5 * v); },
      pump: (until) => str.pump(until),
      stop(fadeS = 2) { str.stop(); w.stop(fadeS); r.stop(fadeS); sea.stop(fadeS); },
    });
  }

  // ====================================================================================================
  //  4. Harbour and coast
  // ====================================================================================================
  // a gull: 'mew' (one short high cry), 'kyow' (the falling two-part cry), 'long' (the laughing call: a run of pulses that slows). A formant filter and a fast vibrato.
  function gull({ type = 'kyow', gain = 1, pitch = 1, delayS = 0 } = {}) {
    const t = now() + delayS;
    const o = oscNode('sawtooth', 1500 * pitch), lfo = oscNode('sine', 22), lg = gainNode(70 * pitch), f = filterNode('bandpass', 2200 * pitch, 3.5), g = gainNode(0);
    chain(lfo, lg, o.frequency); chain(o, f, g, out);
    const peak = 0.28 * gain; // the formant filter takes most of a saw's energy away, so the drive is high for a modest result
    let end;
    if (type === 'mew') {
      o.frequency.setValueAtTime(2300 * pitch, t); o.frequency.linearRampToValueAtTime(1700 * pitch, t + 0.28);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); end = t + 0.35;
    } else if (type === 'long') {
      o.frequency.setValueAtTime(1500 * pitch, t);
      g.gain.setValueAtTime(0, t);
      let at = t;
      for (let i = 0; i < 6; i++) { // ha-ha-ha-ha, each a little lower and slower
        const len = 0.17 + i * 0.03;
        o.frequency.setValueAtTime(2000 * pitch * (1 - i * 0.05), at); o.frequency.linearRampToValueAtTime(1500 * pitch * (1 - i * 0.05), at + len);
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak * (1 - i * 0.08), at + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
        at += len + 0.06 + i * 0.015;
      }
      end = at + 0.1;
    } else { // 'kyow'
      o.frequency.setValueAtTime(1450 * pitch, t); o.frequency.linearRampToValueAtTime(2350 * pitch, t + 0.12); o.frequency.exponentialRampToValueAtTime(1250 * pitch, t + 0.55);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.05); g.gain.setValueAtTime(peak * 0.8, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); end = t + 0.65;
    }
    o.start(t); lfo.start(t); o.stop(end); lfo.stop(end);
    return { durationS: end - t + delayS };
  }
  // gulls in the background: a call every 3-12 s at rate 1, any of the three kinds, from slightly different birds
  function gulls({ rate = 0.5, gain = 1 } = {}) {
    const st = { rate };
    const s = stream((next, until) => {
      while (next < until) {
        const kinds = ['kyow', 'mew', 'kyow', 'long'];
        gull({ type: kinds[Math.floor(rand() * kinds.length)], gain: gain * (0.45 + rand() * 0.55), pitch: 0.85 + rand() * 0.35, delayS: Math.max(0, next - now()) });
        next += (3 + rand() * 9) / Math.max(0.05, st.rate);
      }
      return next;
    }, { start: 0.5 + rand() * 2, ahead: 0.5, intervalMs: 250 });
    return track({ setRate(v) { st.rate = v; }, pump: (until) => s.pump(until), stop() { s.stop(); } });
  }
  // a hand bell: brighter and shorter than the harbour bell in audio.js; `strikes` are offsets in seconds (a ship's bell: pairs)
  function handBell({ strikes = [0, 0.55], gain = 1, delayS = 0, base = 780 } = {}) {
    const t0 = now() + delayS;
    const partials = [[1, 1, 1.5], [2.01, 0.5, 0.95], [2.76, 0.38, 0.65], [4.07, 0.16, 0.38], [5.43, 0.08, 0.22]];
    for (const at of strikes) {
      for (const [ratio, g0, decay] of partials) {
        const o = oscNode('sine', base * ratio); const g = gainNode(0);
        chain(o, g, out);
        const t = t0 + at;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * g0 * gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        o.start(t); o.stop(t + decay + 0.05);
      }
      const c = bufferSource(tink, { rate: 1.1 }); const cg = gainNode(0.07 * gain); chain(c, cg, out); c.start(t0 + at); // the clapper's tick
    }
    return { durationS: delayS + (strikes[strikes.length - 1] || 0) + 1.6 };
  }
  // the mist signal: a tyfon, two blasts a period at ~210 + ~260 Hz (see TYFON). distance in metres dulls and quietens it. loop repeats the pattern.
  function mistSignal({ pattern = TYFON.pattern, hz = TYFON.hz, distance = 0, gain = 1, loop = true } = {}) {
    const st = { distance, gain };
    const lp = filterNode('lowpass', mistCutoff(distance), 0.8); const g = gainNode(mistGain(distance) * gain); chain(lp, g, out);
    const blasts = blastTimes(pattern), period = patternPeriod(pattern);
    const blast = (t, len) => {
      const env = gainNode(0); chain(env, lp);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(TYFON.gain, t + TYFON.attackS); env.gain.setValueAtTime(TYFON.gain, t + len); env.gain.exponentialRampToValueAtTime(0.0001, t + len + TYFON.releaseS);
      const rasp = oscNode('sine', TYFON.raspHz); const rg = gainNode(TYFON.gain * 0.35); chain(rasp, rg, env.gain); rasp.start(t); rasp.stop(t + len + TYFON.releaseS + 0.05); // the diaphragm's buzz
      for (const f of hz) for (const [type, det] of [['sawtooth', 1], ['square', 1.004]]) {
        const o = oscNode(type, f * det); o.connect(env);
        o.frequency.setValueAtTime(f * det * 0.93, t); o.frequency.linearRampToValueAtTime(f * det, t + TYFON.attackS); // it leans up into its note
        o.start(t); o.stop(t + len + TYFON.releaseS + 0.05);
      }
    };
    let cycle = 0;
    const s = stream((next, until) => {
      // `next` is the start of the next period; schedule that period's blasts when it comes within reach
      while (next < until) {
        for (const b of blasts) blast(next + b.at, b.len);
        cycle++;
        if (!loop) return Infinity; // one period only: nothing more to schedule
        next += period;
      }
      return next;
    }, { start: 0.1, ahead: 1, intervalMs: 250 });
    return track({
      setDistance(d) { st.distance = d; lp.frequency.setTargetAtTime(mistCutoff(d), now(), 0.1); g.gain.setTargetAtTime(mistGain(d) * st.gain, now(), 0.1); },
      setGain(v) { st.gain = v; g.gain.setTargetAtTime(mistGain(st.distance) * v, now(), 0.1); },
      get cycles() { return cycle; },
      pump: (until) => s.pump(until),
      stop(fadeS = 0.5) { s.stop(); fadeOut(g, now(), fadeS); },
    });
  }
  // halyards slapping a mast in a harbour: dull wooden "tock"s at random, with the odd bright "tink" of a block. The busier, the more wind.
  function halyards({ wind: w = 0.4, gain = 1 } = {}) {
    const st = { wind: w };
    const s = stream((next, until) => {
      while (next < until) {
        const k = clamp(st.wind, 0, 1);
        const isTink = rand() < 0.12 + 0.1 * k;
        const src = bufferSource(isTink ? tink : tock, { rate: isTink ? 0.55 + rand() * 0.5 : 0.7 + rand() * 0.7 });
        const pg = gainNode((isTink ? 0.1 : 0.22) * gain * (0.45 + rand() * 0.55) * (0.5 + 0.7 * k));
        chain(src, pg, out); src.start(next);
        next += -Math.log(1 - rand()) / (0.4 + 7 * k ** 1.5); // random (Poisson) timing: the rate climbs with the wind
      }
      return next;
    }, { start: 0.1, ahead: 0.4, intervalMs: 120 });
    return track({ setWind(v) { st.wind = v; }, pump: (until) => s.pump(until), stop() { s.stop(); } });
  }
  // an oar in its rowlock: a dip and splash, the creak of the pull, the clunk of the release, a few drips
  function stroke(t, gain = 1, side = 0) {
    const sp = noiseLoop(1, t); const sf = filterNode('bandpass', 1900, 0.8); const sg = gainNode(0); chain(sp, sf, sg, out);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.07 * gain, t + 0.02); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); sp.stop(t + 0.22); // the catch
    const o = oscNode('sawtooth', 430 + side * 25); const of = filterNode('bandpass', 760, 11); const og = gainNode(0); chain(o, of, og, out);
    o.frequency.setValueAtTime(430 + side * 25, t + 0.1); o.frequency.linearRampToValueAtTime(380 + side * 25, t + 0.62);
    og.gain.setValueAtTime(0, t + 0.1); og.gain.linearRampToValueAtTime(0.028 * gain, t + 0.22); og.gain.linearRampToValueAtTime(0.012 * gain, t + 0.5); og.gain.linearRampToValueAtTime(0, t + 0.66); o.start(t + 0.1); o.stop(t + 0.7); // the creak
    const c = bufferSource(tock, { rate: 0.62 - side * 0.05 }); const cg = gainNode(0.2 * gain); chain(c, cg, out); c.start(t + 0.66); // the release
    for (let i = 0; i < 3; i++) { const d = bufferSource(tink, { rate: 1.6 + rand() * 0.9 }); const dg = gainNode(0.014 * gain * rand()); chain(d, dg, out); d.start(t + 0.75 + i * (0.06 + rand() * 0.08)); } // drips
  }
  function rowing({ spm = 22, gain = 1 } = {}) {
    const st = { spm }; let side = 0;
    const s = stream((next, until) => {
      while (next < until) { stroke(next, gain, side); side = 1 - side; next += 60 / Math.max(6, st.spm) * (1 + (rand() * 2 - 1) * 0.04); }
      return next;
    }, { start: 0.1, ahead: 0.6, intervalMs: 150 });
    return track({ setRate(v) { st.spm = v; }, pump: (until) => s.pump(until), stop() { s.stop(); } });
  }
  const rowlockClunk = (delayS = 0, gain = 1) => { const c = bufferSource(tock, { rate: 0.6 }); const g = gainNode(0.22 * gain); chain(c, g, out); c.start(now() + delayS); };

  // ====================================================================================================
  //  5. The ambience mixer
  // ====================================================================================================
  function ambience(start = 'calm', { gain = 1 } = {}) {
    const levels = Object.fromEntries(AMBIENCE_LAYERS.map((k) => [k, 0]));
    const live = {}; // layer -> handle(s)
    const LAYERS = {
      sea: { on: (l) => seaLap({ level: l, gain }), set: (h, l) => h.setLevel(l) },
      wind: { on: (l) => wind({ strength: l, gain }), set: (h, l) => h.setStrength(l) },
      rain: { on: (l) => rain({ intensity: l, gain }), set: (h, l) => h.setIntensity(l) },
      gulls: { on: (l) => gulls({ rate: l * 1.2, gain }), set: (h, l) => h.setRate(l * 1.2) },
      halyards: { on: (l) => halyards({ wind: l, gain: gain * 0.8 }), set: (h, l) => h.setWind(l) },
      engine: { on: (l) => engine({ rpm: 300, distance: 220 - 150 * l, gain: gain * 0.8 }), set: (h, l) => { h.setDistance(220 - 150 * l); } },
      mist: { on: (l) => mistSignal({ distance: 2200 - 1900 * l, gain }), set: (h, l) => h.setDistance(2200 - 1900 * l) },
    };
    // events with their own timers: thunder (rolls now and then) and the bell (a few strikes every while)
    const eventStream = (rateOf, fire) => stream((next, until) => { while (next < until) { fire(next); next += rateOf(); } return next; }, { start: 6 + rand() * 6, ahead: 0.6, intervalMs: 250 });
    const events = {};
    const startEvent = (name) => {
      if (name === 'thunder') events.thunder = eventStream(() => (7 + rand() * 18) / Math.max(0.3, levels.thunder), (t) => thunder({ distanceKm: 0.8 + rand() * 5, power: 0.4 + 0.6 * levels.thunder, delayS: Math.max(0, t - now()) }));
      if (name === 'bell') events.bell = eventStream(() => (28 + rand() * 40) / Math.max(0.2, levels.bell), (t) => handBell({ strikes: [0, 0.6, 1.9, 2.5], gain: 0.7 * levels.bell + 0.3, delayS: Math.max(0, t - now()) }));
    };
    function setLayer(name, level) {
      level = clamp(level, 0, 1);
      levels[name] = level;
      if (name === 'thunder' || name === 'bell') {
        if (level > 0 && !events[name]) startEvent(name);
        if (level === 0 && events[name]) { events[name].stop(); delete events[name]; }
        return;
      }
      const L = LAYERS[name];
      if (!L) return;
      if (level > 0.001 && !live[name]) live[name] = L.on(level);
      else if (level > 0.001) L.set(live[name], level);
      else if (live[name]) { live[name].stop(); delete live[name]; }
    }
    let fadeTimer = null;
    function setPreset(name, fadeS = AMBIENCE_FADE_S) {
      const p = AMBIENCE[name]; if (!p) throw new TypeError(`ambience: unknown preset "${name}" (use ${Object.keys(AMBIENCE).join(' | ')})`);
      const from = { ...levels }, steps = Math.max(1, Math.round(fadeS * 4));
      if (fadeTimer !== null && timers.clearInterval) timers.clearInterval(fadeTimer);
      const apply = (k) => { for (const layer of AMBIENCE_LAYERS) setLayer(layer, from[layer] + (p[layer] - from[layer]) * k); };
      if (manual || !timers.setInterval || fadeS <= 0) { apply(1); return; }
      let i = 0;
      fadeTimer = timers.setInterval(() => { i++; apply(Math.min(1, i / steps)); if (i >= steps) { timers.clearInterval(fadeTimer); fadeTimer = null; } }, 250);
    }
    setPreset(start, 0);
    return track({
      levels, setLayer, setPreset,
      get live() { return Object.keys(live).concat(Object.keys(events)); },
      pump(until) { for (const h of Object.values(live)) if (h.pump) h.pump(until); for (const e of Object.values(events)) e.pump(until); },
      stop(fadeS = 1.5) { if (fadeTimer !== null && timers.clearInterval) timers.clearInterval(fadeTimer); for (const h of Object.values(live)) h.stop(fadeS); for (const e of Object.values(events)) e.stop(); },
    });
  }

  const api = {
    out, ctx, engine, passingBoat, flasherPop, gasPuff, cylinderClunk, gasHiss, pilotWhump, pilot, sunValveSnap, flasherPattern, relight1950,
    wind, rain, seaLap, thunder, storm, gull, gulls, handBell, mistSignal, halyards, rowing, rowlockClunk, ambience,
    setVolume(v) { out.gain.setTargetAtTime(clamp(v, 0, 1.2), now(), 0.05); },
    // schedule every running stream up to `until` seconds (manual mode: tests and offline renders)
    pump(until) { for (const s of [...streams]) s.pump(until); },
    stopAll(fadeS = 0.4) { for (const h of [...handles]) h.stop(fadeS); for (const s of [...streams]) s.stop(); },
    stats() { return { nodesMade: made.total, byKind: { ...made.byKind }, voices, streams: streams.size, handles: handles.size }; },
  };
  return api;
}
