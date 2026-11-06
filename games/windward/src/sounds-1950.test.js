// node games/windward/src/sounds-1950.test.js — the 1950 sounds: pure recipes (engine beat, falloff, Doppler, mist pattern, flasher schedule, presets),
// the synthesised "dunk" buffer, what gets scheduled when (on a recording fake AudioContext, no browser), that nothing leaks or dangles, the node budgets,
// and the lab page's wiring. Felix judges the sound by ear in sound-lab.html; this keeps the machinery honest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENGINE, beatInterval, engineGain, engineCutoff, dopplerRate, passingState, passingDuration, generateDunk, analyse,
  TYFON, blastTimes, patternPeriod, mistGain, mistCutoff, AGA, flasherSchedule, RELIGHT_STEPS, AMBIENCE, AMBIENCE_LAYERS,
  createSounds1950, generateBed,
} from './sounds-1950.js';
import { lightGlyph } from './light-glyph.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }

// ---- a recording fake AudioContext: nodes, params, connections, start / stop times ----
function fakeContext({ sampleRate = 8000, stereoPanner = true } = {}) {
  const nodes = [];
  class Param {
    constructor(v = 0, owner = null) { this.value = v; this.events = []; this.owner = owner; }
    setValueAtTime(v, t) { this.events.push({ type: 'set', v, t }); return this; }
    linearRampToValueAtTime(v, t) { this.events.push({ type: 'lin', v, t }); return this; }
    exponentialRampToValueAtTime(v, t) { this.events.push({ type: 'exp', v, t }); return this; }
    setTargetAtTime(v, t, tc) { this.events.push({ type: 'target', v, t, tc }); return this; }
    cancelScheduledValues(t) { this.events.push({ type: 'cancel', t }); return this; }
  }
  class Node {
    constructor(kind, params = {}) { this.kind = kind; this.out = []; this.paramsIn = []; this.starts = []; this.stops = []; for (const [k, v] of Object.entries(params)) this[k] = new Param(v, this); nodes.push(this); }
    connect(t) { (t instanceof Param ? this.paramsIn : this.out).push(t); return t; }
    start(when = 0, offset = 0) { if (this.started) throw new Error(`${this.kind} started twice`); this.started = true; this.starts.push({ when, offset }); }
    stop(when = 0) { this.stops.push(when); }
  }
  const ctx = {
    sampleRate, currentTime: 0, destination: new Node('destination'), nodes,
    createGain: () => new Node('gain', { gain: 1 }),
    createBiquadFilter: () => new Node('filter', { frequency: 350, Q: 1, gain: 0 }),
    createOscillator: () => new Node('osc', { frequency: 440 }),
    createBufferSource: () => new Node('source', { playbackRate: 1 }),
    createDynamicsCompressor: () => new Node('compressor', { threshold: 0, knee: 0, ratio: 0, attack: 0, release: 0 }),
    createWaveShaper: () => new Node('shaper'),
    createBuffer: (ch, len, rate) => { const data = new Float32Array(len); return { length: len, sampleRate: rate, getChannelData: () => data }; },
    decodeAudioData() { throw new Error('no sample files: decodeAudioData must never be called'); },
  };
  if (stereoPanner) ctx.createStereoPanner = () => new Node('panner', { pan: 0 });
  return ctx;
}
const make = (opts = {}, ctxOpts = {}) => { const ctx = fakeContext(ctxOpts); const s = createSounds1950(ctx, ctx.destination, { manual: true, random: seeded(7), ...opts }); return { ctx, s }; };
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sources = (ctx, pred = () => true) => ctx.nodes.filter((n) => n.kind === 'source' && n.starts.length && pred(n));
const oscs = (ctx, pred = () => true) => ctx.nodes.filter((n) => n.kind === 'osc' && n.starts.length && pred(n));
const beats = (ctx) => sources(ctx, (n) => !n.loop && n.buffer && n.buffer.length === Math.floor(ENGINE.bufferS * ctx.sampleRate)).map((n) => n.starts[0].when).sort((a, b) => a - b); // a beat is a playing of the dunk buffer (its exact length)
const gapsOf = (ts) => ts.slice(1).map((t, i) => t - ts[i]);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

check('engine: a two-stroke fires once a revolution (375 rpm = 6.25 a second, the documented 1905 Bolinder); two cylinders fire unevenly', () => {
  assert.ok(Math.abs(beatInterval(375) - 0.16) < 1e-9);
  assert.ok(beatInterval(ENGINE.idleRpm) > beatInterval(ENGINE.cruiseRpm), 'idle is slower than cruising');
  assert.ok(ENGINE.idleRpm < ENGINE.cruiseRpm && ENGINE.cruiseRpm < ENGINE.maxRpm && ENGINE.maxRpm < 460, 'low revs, a little over the documented 375');
  const a = beatInterval(300, 2, 0), b = beatInterval(300, 2, 1);
  assert.ok(Math.abs(a + b - 0.2) < 1e-9, 'two firings per revolution');
  assert.ok(a < b && Math.abs(a - b) > 0.02, 'a short gap then a long one: dunk-dunk ... dunk-dunk');
  assert.equal(beatInterval(300, 2, 2), a);
});

check('distance: a passing boat is quieter and duller the further it is, monotonically; Doppler goes up approaching and down receding; the pass is symmetric', () => {
  assert.equal(engineGain(0), 1);
  let g = 1, c = Infinity;
  for (const d of [5, 15, 40, 100, 300, 1000]) { assert.ok(engineGain(d) < g, `gain falls at ${d} m`); g = engineGain(d); assert.ok(engineCutoff(d) < c, 'the low-pass closes'); c = engineCutoff(d); }
  assert.ok(Math.abs(engineGain(ENGINE.refM) - 0.5 ** 1.15) < 1e-9, 'at the reference distance the gain has halved (to the 1.15)');
  assert.ok(engineCutoff(0) <= ENGINE.maxCutoffHz && engineCutoff(1e6) >= ENGINE.minCutoffHz);
  assert.ok(dopplerRate(-10) > 1 && dopplerRate(10) < 1 && dopplerRate(0) === 1);
  const p = { speedMs: 5, closestM: 30, startM: 140 };
  const mid = passingState(passingDuration(p) / 2, p);
  assert.ok(Math.abs(mid.x) < 1e-9 && Math.abs(mid.distance - 30) < 1e-9 && Math.abs(mid.doppler - 1) < 1e-9 && Math.abs(mid.pan) < 1e-9, 'abeam: closest, no Doppler shift, centred');
  assert.ok(passingState(0, p).doppler > 1 && passingState(0, p).pan < 0, 'coming from the left, rising pitch');
  assert.ok(passingState(passingDuration(p) - 0.01, p).doppler < 1 && passingState(passingDuration(p) - 0.01, p).pan > 0, 'going away to the right, falling pitch');
  assert.equal(passingDuration(p), 56);
  assert.ok(passingState(passingDuration(p) + 1, p).done);
  assert.ok(Math.abs(passingState(0, p).distance - passingState(passingDuration(p), p).distance) < 1e-9);
});

check('the dunk buffer is synthesised: finite, headroom, ends at zero, a low thump with harmonics a phone can play, deterministic, the variants differ, the same at any sample rate', () => {
  const sr = 22050;
  const lo = analyse(generateDunk(22050, 0), 22050), hi = analyse(generateDunk(48000, 0), 48000);
  assert.ok(Math.abs(lo.centroidHz - hi.centroidHz) < 50 && Math.abs(lo.phoneShare - hi.phoneShare) < 0.25, `22.05 kHz vs 48 kHz: centroid ${lo.centroidHz.toFixed(0)} vs ${hi.centroidHz.toFixed(0)} Hz (the noise differs, the sound does not)`);
  const d0 = generateDunk(sr, 0), d1 = generateDunk(sr, 1), d2 = generateDunk(sr, 2);
  assert.equal(d0.length, Math.floor(ENGINE.bufferS * sr));
  for (const d of [d0, d1, d2]) {
    assert.ok(d.every(Number.isFinite));
    const a = analyse(d, sr);
    assert.ok(a.peak > 0.5 && a.peak <= 0.95, `peak ${a.peak.toFixed(2)}`);
    assert.ok(a.lowShare > 0.45, `still a low thump: ${(a.lowShare * 100).toFixed(0)}% of the energy below 300 Hz`);
    assert.ok(a.centroidHz > 100 && a.centroidHz < 400, `a low thump with body, centroid ${a.centroidHz.toFixed(0)} Hz`);
    assert.ok(a.phoneShare > 0.2, `a phone speaker (nothing below ~150 Hz) still hears it: ${(a.phoneShare * 100).toFixed(0)}% of the energy is above 150 Hz`);
    assert.ok(Math.abs(d[d.length - 1]) < 1e-3, 'ends at zero: no click when the buffer finishes');
  }
  assert.deepEqual(Array.from(generateDunk(sr, 0).slice(0, 50)), Array.from(d0.slice(0, 50)), 'the same every time');
  assert.notDeepEqual(Array.from(d0.slice(100, 150)), Array.from(d1.slice(100, 150)));
  const peaks = [d0, d1, d2].map((d) => analyse(d, sr).peak);
  assert.ok(Math.max(...peaks) - Math.min(...peaks) > 0.05, 'the variants differ in level (a hand-fed engine is not a metronome)');
});

check('the noise beds are baked once: periodic, finite, normalised, each with the character it is named for', () => {
  const sr = 22050;
  const bands = {};
  for (const kind of ['wind', 'rain', 'sea', 'bed']) {
    const b = generateBed(kind, sr);
    assert.ok(b.every(Number.isFinite), kind);
    const a = analyse(b, sr);
    assert.ok(Math.abs(a.rms - 0.25) < 0.01, `${kind}: rms ${a.rms.toFixed(3)} (normalised to 0.25)`);
    assert.ok(Math.abs(b[b.length - 1] - b[0]) < 0.35, `${kind}: the end meets the start (a seamless loop)`);
    bands[kind] = a;
    assert.deepEqual(Array.from(generateBed(kind, sr).slice(0, 20)), Array.from(b.slice(0, 20)), 'deterministic');
  }
  assert.ok(bands.sea.centroidHz < bands.wind.centroidHz && bands.wind.centroidHz < bands.rain.centroidHz, 'sea is the lowest, rain the brightest');
  assert.ok(bands.rain.centroidHz > 2000 && bands.sea.centroidHz < 500 && bands.bed.lowShare > 0.2);
});

check('engine: the right number of beats at the right pace, one buffer voice per beat, jitter inside its bound, rpm and cylinders can change live', () => {
  const { ctx, s } = make();
  const e = s.engine({ rpm: 330 });
  s.pump(10);
  const ts = beats(ctx);
  assert.ok(ts.length >= 52 && ts.length <= 58, `${ts.length} beats in 10 s at 330 rpm (5.5 a second)`);
  assert.ok(Math.abs(mean(gapsOf(ts)) - 60 / 330) < 0.01);
  for (const gap of gapsOf(ts)) assert.ok(Math.abs(gap / (60 / 330) - 1) <= ENGINE.jitter + 1e-9, 'jitter stays within its bound');
  assert.ok(new Set(gapsOf(ts).map((g) => g.toFixed(4))).size > 10, 'not a metronome');
  assert.ok(ts[0] >= 0.05 && ts.every((t) => t < 10));
  const before = ts.length;
  e.setRpm(ENGINE.idleRpm); s.pump(20);
  const idleBeats = beats(ctx).length - before;
  assert.ok(idleBeats >= 25 && idleBeats <= 32, `${idleBeats} beats in the next 10 s at idle (2.8 a second)`);
  e.setCylinders(2); e.setRpm(300); const b2 = beats(ctx).length; s.pump(30);
  const twin = beats(ctx).length - b2;
  assert.ok(twin >= 95 && twin <= 105, `two cylinders fire twice a revolution: ${twin} in 10 s at 300 rpm`);
  const rates = sources(ctx, (n) => !n.loop && n.buffer.length === Math.floor(ENGINE.bufferS * ctx.sampleRate)).map((n) => n.playbackRate.value);
  assert.ok(Math.min(...rates) > 0.8 && Math.max(...rates) < 1.25, 'pitch shift stays modest');
  assert.equal(e.cylinders, 2);
});

check('engine falloff: setDistance moves the low-pass and the gain; far engines are scheduled quieter', () => {
  const { ctx, s } = make();
  const e = s.engine({ rpm: 330, distance: 0 });
  const gainNode = e._g, lp = e._lp;
  e.setDistance(150);
  const gt = gainNode.gain.events.filter((x) => x.type === 'target').pop(), ft = lp.frequency.events.filter((x) => x.type === 'target').pop();
  assert.ok(Math.abs(gt.v - engineGain(150) * ENGINE.level) < 1e-9 && Math.abs(ft.v - engineCutoff(150)) < 1e-9);
  assert.ok(gt.v < 0.05 && ft.v < 800);
  e.setGain(0.5);
  assert.ok(Math.abs(gainNode.gain.events.filter((x) => x.type === 'target').pop().v - engineGain(150) * 0.5 * ENGINE.level) < 1e-9);
  void ctx;
});

check('passing boat: the track is scheduled up front (gain and low-pass peak when abeam, pan sweeps), Doppler per beat, and the engine stops by itself after the pass', () => {
  const { ctx, s } = make();
  const b = s.passingBoat({ speedMs: 5, closestM: 30, startM: 140 });
  const g = b._g.gain.events.filter((x) => x.type === 'set'), f = b._lp.frequency.events.filter((x) => x.type === 'set'), pan = b._panner.pan.events.filter((x) => x.type === 'set');
  const peakAt = g.reduce((best, x) => (x.v > best.v ? x : best), g[0]).t;
  assert.ok(Math.abs(peakAt - 28) < 0.2, `loudest abeam (28 s), got ${peakAt}`);
  assert.ok(g[0].v < g.find((x) => x.t >= 27.9).v * 0.5, 'quiet when far, loud abeam');
  assert.ok(Math.abs(g.find((x) => Math.abs(x.t - 28) < 0.01).v - engineGain(30) * ENGINE.level) < 1e-6, 'abeam at 30 m: the falloff times the engine level');
  assert.ok(f.find((x) => x.t >= 27.9).v > f[0].v * 2, 'brighter abeam');
  assert.ok(pan[0].v < -0.8 && pan[pan.length - 1].v > 0.8, 'sweeps from one side to the other');
  s.pump(80);
  const ts = beats(ctx);
  assert.ok(ts.length > 280 && ts.every((t) => t < 56.05), `beats only while it passes: ${ts.length}, last ${ts[ts.length - 1].toFixed(2)} s`);
  const rates = sources(ctx, (n) => !n.loop && n.buffer.length === Math.floor(ENGINE.bufferS * ctx.sampleRate)).sort((x, y) => x.starts[0].when - y.starts[0].when).map((n) => n.playbackRate.value);
  assert.ok(mean(rates.slice(0, 20)) > mean(rates.slice(-20)) * 1.025, 'higher pitch coming, lower going');
  assert.equal(b.durationS, 56);
  assert.equal(s.stats().streams, 0, 'the stream ended on its own: nothing left running');
});

check('mist signal: a tyfon of two tones (210 + 260 Hz), 2+4+2+22 s = two blasts every 30 s, quieter and duller far away', () => {
  assert.deepEqual(blastTimes([2, 4, 2, 22]), [{ at: 0, len: 2 }, { at: 6, len: 2 }]);
  assert.equal(patternPeriod([2, 4, 2, 22]), 30); assert.equal(patternPeriod([2.5, 2.5, 2.5, 22.5]), 30);
  assert.deepEqual(TYFON.hz, [210, 260]);
  assert.ok(mistGain(0) === 1 && mistGain(2000) < mistGain(500) && mistGain(9000) > 0.02 && mistCutoff(5000) < mistCutoff(100) && mistCutoff(1e6) >= 260, 'monotone, never silent within the ~9 km range');
  const { ctx, s } = make();
  const m = s.mistSignal({ distance: 0 });
  s.pump(62);
  const blastOscs = oscs(ctx, (o) => o.frequency.events.some((x) => x.type === 'lin' && x.v > 200 && x.v < 300));
  const starts = [...new Set(blastOscs.map((o) => +o.starts[0].when.toFixed(2)))].sort((a, b) => a - b);
  assert.deepEqual(starts, [0.1, 6.1, 30.1, 36.1, 60.1, 66.1], `blast starts every 30 s, two a period (the third period begins inside the 62 s window): ${starts}`);
  assert.equal(blastOscs.length, 6 * 2 * 2, 'six blasts (three periods), two tones, a saw and a square each');
  const hz = new Set(blastOscs.map((o) => Math.round(o.frequency.events.find((x) => x.type === 'lin').v / 1.004 / 10) * 10)); // detuned partner folded in
  assert.ok([...hz].every((h) => [210, 260].includes(h)), `only the two tyfon tones: ${[...hz]}`);
  assert.equal(m.cycles, 3, 'the third period starts at 60 s');
  const far = make(); const m2 = far.s.mistSignal({ distance: 3000 });
  assert.ok(m2.setDistance && far.ctx.nodes.find((n) => n.kind === 'gain' && Math.abs(n.gain.value - mistGain(3000)) < 1e-9), 'far: the gain is set from the distance');
  const once = make(); once.s.mistSignal({ loop: false }); once.s.pump(100);
  assert.equal(oscs(once.ctx, (o) => o.frequency.events.some((x) => x.type === 'lin' && x.v > 200 && x.v < 300)).length, 8, 'loop: false plays one period');
});

check('AGA relight: the flasher pops once per flash in the light\'s real pattern; occulting lights pop as the gas returns; the steps run in order; the pilot keeps burning until stopped', () => {
  const gl = lightGlyph({ kind: 'flash', count: 3, period: 30 }); // Maseskar Bx(3) 30 s
  assert.equal(gl.flashes.length, 3);
  const sched = flasherSchedule(gl.flashes);
  assert.deepEqual(sched.map((x) => x.at), gl.flashes.map((f) => f.at));
  const occ = lightGlyph({ kind: 'occulting', count: 2, period: 12 });
  const so = flasherSchedule(occ.flashes);
  assert.ok(so.every((x, i) => Math.abs(x.at - (occ.flashes[i].at + occ.flashes[i].len)) < 1e-9 && x.dark), 'the gas comes back at the end of each eclipse');
  assert.ok(RELIGHT_STEPS.every((st, i) => i === 0 || st.at > RELIGHT_STEPS[i - 1].at), 'in order');
  assert.ok(RELIGHT_STEPS.some((x) => x.what === 'snap') && RELIGHT_STEPS.some((x) => x.what === 'pattern'));
  const { ctx, s } = make();
  const r = s.relight1950({ flashes: gl.flashes, period: gl.period, cycles: 2 });
  assert.equal(r.pops, 6);
  assert.ok(Math.abs(r.durationS - (5.05 + 60 + 0.2)) < 1e-9);
  s.stopAll(0);
});

check('AGA relight timing: pops land on the flash starts of each cycle; the first sound is the clunk and the pattern begins after the sun-valve snap', () => {
  const gl = lightGlyph({ kind: 'flash', count: 3, period: 30 });
  const { ctx, s } = make();
  const r = s.relight1950({ flashes: gl.flashes, period: gl.period, cycles: 2 });
  const pops = ctx.nodes.filter((n) => n.kind === 'filter' && n.frequency.value === 1300);
  assert.equal(pops.length, 6, 'one pop filter per pop');
  const times = pops.map((f) => ctx.nodes.find((n) => n.kind === 'source' && n.out.includes(f)).starts[0].when).sort((a, b) => a - b);
  const base = 0.05 + 5.0; // the first clunk is at 0.05 s; the pattern begins 5.0 s after it
  const want = [0, 1, 2].flatMap((i) => [0, 30].map((c) => base + c + gl.flashes[i].at)).sort((a, b) => a - b);
  assert.deepEqual(times.map((t) => +t.toFixed(6)), want.map((t) => +t.toFixed(6)), 'pops at the flash starts, cycle after cycle');
  const firstSource = sources(ctx).sort((a, b) => a.starts[0].when - b.starts[0].when)[0];
  assert.ok(firstSource.starts[0].when <= 0.06, 'the clunk comes first');
  assert.ok(base > 0.05 + 4.1 + 0.5, 'the pattern starts after the snap of the sun valve');
  assert.ok(r.pilot && typeof r.pilot.stop === 'function');
  s.stopAll(0);
});

check('storm: wind builds with the level, rain follows, thunder is scheduled; thunder gives a crack only when near and always a rolling rumble', () => {
  const { ctx, s } = make();
  const w = s.wind({ strength: 0.1 }); const quiet = w.strength;
  w.setStrength(1);
  assert.ok(w.strength > quiet);
  const gainTargets = ctx.nodes.filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e.type === 'target'));
  assert.ok(gainTargets.length >= 1);
  const t1 = s.thunder({ distanceKm: 0.5, power: 1 }), t2 = s.thunder({ distanceKm: 8, power: 1 });
  assert.ok(t1.atS < t2.atS && t2.atS <= 6, 'the further, the later (capped so a game need not wait)');
  assert.ok(t2.durationS > t1.durationS, 'a distant rumble goes on longer');
  const cracks = ctx.nodes.filter((n) => n.kind === 'filter' && n.type === 'highpass' && n.frequency.value === 900);
  assert.equal(cracks.length, 1, 'only the near strike has a crack');
  const st = make(); const storm = st.s.storm({ level: 1 }); st.s.pump(200);
  const rumbles = st.ctx.nodes.filter((n) => n.kind === 'filter' && n.type === 'lowpass' && n.frequency.events.some((e) => e.type === 'exp' && e.v === 55));
  assert.ok(rumbles.length >= 5, `a storm has thunder every 8-25 s: ${rumbles.length} in 200 s`);
  storm.setLevel(0.2); st.s.pump(400);
  const later = st.ctx.nodes.filter((n) => n.kind === 'filter' && n.type === 'lowpass' && n.frequency.events.some((e) => e.type === 'exp' && e.v === 55)).length;
  assert.equal(later, rumbles.length, 'a fading storm (level under 0.35) stops thundering');
});

check('harbour: halyards slap more in more wind (random timing); rowing is one stroke per beat of the rate; gulls come at the asked rate; the bell strikes when asked', () => {
  const lo = make(), hi = make();
  lo.s.halyards({ wind: 0.1 }); hi.s.halyards({ wind: 0.9 });
  lo.s.pump(20); hi.s.pump(20);
  const n = (c) => sources(c.ctx).length;
  assert.ok(n(hi) > n(lo) * 3, `windy ${n(hi)} vs calm ${n(lo)} slaps in 20 s`);
  const r = make(); r.s.rowing({ spm: 22 }); r.s.pump(30);
  const creaks = oscs(r.ctx, (o) => o.frequency.events.some((e) => e.type === 'lin' && e.v < 440 && e.v > 360));
  assert.ok(creaks.length >= 10 && creaks.length <= 12, `${creaks.length} strokes in 30 s at 22 a minute`);
  const gl = make(); gl.s.gulls({ rate: 1 }); gl.s.pump(60);
  const calls = oscs(gl.ctx, (o) => o.frequency.events.some((e) => e.v > 1000 && e.v < 2600));
  assert.ok(calls.length >= 8 && calls.length <= 40, `${calls.length} gull voices in 60 s`);
  const b = make(); const d = b.s.handBell({ strikes: [0, 0.55, 1.9], delayS: 1 });
  assert.equal(oscs(b.ctx).length, 5 * 3, 'five partials a strike');
  assert.equal(Math.min(...oscs(b.ctx).map((o) => o.starts[0].when)), 1);
  assert.ok(d.durationS > 3);
  for (const type of ['mew', 'kyow', 'long']) { const g = make(); const out = g.s.gull({ type }); assert.ok(out.durationS > 0.2 && out.durationS < 3, type); }
  assert.ok(make().s.rowlockClunk() === undefined);
});

check('ambience: calm / evening / storm layer the sounds; changing preset starts and stops the right layers; levels stay in range; the storm has headroom', () => {
  for (const [name, p] of Object.entries(AMBIENCE)) {
    assert.ok(AMBIENCE_LAYERS.every((l) => p[l] >= 0 && p[l] <= 1), name);
    const sum = AMBIENCE_LAYERS.reduce((a, l) => a + p[l], 0);
    assert.ok(sum <= 5.5, `${name}: summed levels ${sum.toFixed(2)} leave headroom`);
  }
  assert.ok(AMBIENCE.storm.wind > AMBIENCE.calm.wind * 5 && AMBIENCE.storm.rain > 0 && AMBIENCE.calm.rain === 0 && AMBIENCE.storm.gulls === 0 && AMBIENCE.calm.gulls > AMBIENCE.evening.gulls, 'each preset says what it is');
  assert.ok(AMBIENCE.evening.bell > 0 && AMBIENCE.evening.mist > AMBIENCE.calm.mist, 'evening: the bell and the mist signal');
  const { ctx, s } = make();
  const a = s.ambience('calm');
  assert.deepEqual([...a.live].sort(), ['engine', 'gulls', 'halyards', 'sea', 'wind']);
  a.setPreset('storm', 0);
  assert.ok(a.live.includes('rain') && a.live.includes('thunder') && !a.live.includes('gulls'), `storm layers: ${a.live}`);
  a.setPreset('evening', 0);
  assert.ok(a.live.includes('bell') && a.live.includes('mist') && !a.live.includes('rain') && !a.live.includes('thunder'), `evening layers: ${a.live}`);
  a.setLayer('rain', 0.5); assert.ok(a.live.includes('rain')); a.setLayer('rain', 0); assert.ok(!a.live.includes('rain'));
  assert.throws(() => a.setPreset('hurricane'), /unknown preset/);
  s.pump(90);
  a.stop(0);
  void ctx;
});

check('nothing leaks or dangles: every started voice reaches the output, every looped voice has a stop, stopAll leaves no stream; no sample files are ever loaded', () => {
  const { ctx, s } = make();
  s.engine({ rpm: 300, cylinders: 2 }); s.passingBoat({}); s.mistSignal({}); s.halyards({ wind: 0.5 }); s.rowing({}); s.gulls({ rate: 1 }); s.ambience('storm');
  s.relight1950({ flashes: [{ at: 0, len: 0.5 }], period: 12, cycles: 1 }); s.handBell({}); s.gull({}); s.thunder({ distanceKm: 1 });
  s.pump(40);
  // a voice reaches the output through its connections, or by modulating a parameter of a node that does (an LFO, the rain's patter)
  const reaches = (n, seen = new Set()) => { if (n === ctx.destination) return true; if (seen.has(n)) return false; seen.add(n); return n.out.some((m) => reaches(m, seen)) || n.paramsIn.some((p) => p.owner && reaches(p.owner, seen)); };
  const voices = ctx.nodes.filter((n) => (n.kind === 'source' || n.kind === 'osc') && n.starts.length);
  assert.ok(voices.length > 200);
  const dangling = voices.filter((v) => !reaches(v));
  assert.equal(dangling.length, 0, `${dangling.length} voices go nowhere`);
  s.stopAll(0);
  assert.equal(s.stats().streams, 0, 'no stream left');
  const loopers = ctx.nodes.filter((n) => n.kind === 'source' && n.loop && n.starts.length);
  assert.ok(loopers.length > 8);
  assert.ok(loopers.every((n) => n.stops.length > 0), 'every looped voice has been told to stop');
  const lfos = ctx.nodes.filter((n) => n.kind === 'osc' && n.starts.length && n.frequency.value < 1);
  assert.ok(lfos.length > 0 && lfos.every((n) => n.stops.length > 0), 'the slow LFOs stop too');
  assert.throws(() => ctx.decodeAudioData(), /no sample files/);
});

check('CPU budgets (node counts): an engine is a handful of persistent nodes plus one buffer voice per beat; storm and ambience stay modest', () => {
  const { ctx, s } = make();
  const base = s.stats().nodesMade;
  s.engine({ rpm: 330 });
  const persistent = s.stats().nodesMade - base;
  assert.ok(persistent <= 9, `an engine keeps ${persistent} nodes`);
  const afterCreate = s.stats().nodesMade;
  s.pump(10);
  const perBeat = (s.stats().nodesMade - afterCreate) / beats(ctx).length;
  assert.ok(perBeat <= 1.01, `${perBeat.toFixed(2)} nodes per beat (just the buffer voice)`);
  const st = make(); const before = st.s.stats().nodesMade; st.s.storm({ level: 1 });
  assert.ok(st.s.stats().nodesMade - before <= 45, `a storm's wind + rain + sea keep ${st.s.stats().nodesMade - before} nodes`);
  const am = make(); const b2 = am.s.stats().nodesMade; am.s.ambience('storm');
  const keep = am.s.stats().nodesMade - b2;
  assert.ok(keep <= 90, `the storm ambience keeps ${keep} nodes at once`);
});

check('works without a stereo panner (older Safari) and without the limiter; no sample files anywhere in the module', () => {
  const ctx = fakeContext({ stereoPanner: false }); delete ctx.createDynamicsCompressor; delete ctx.createWaveShaper;
  const s = createSounds1950(ctx, ctx.destination, { manual: true, random: seeded(1) });
  s.passingBoat({}); s.engine({}); s.pump(5);
  assert.ok(sources(ctx).length > 20);
  const src = readFileSync(new URL('./sounds-1950.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['fetch(', 'decodeAudioData', 'new Audio(', 'XMLHttpRequest', 'game.js', '.mp3', '.wav', '.ogg', 'import ']) assert.ok(!src.includes(bad), `the module must not use ${bad}`);
});

check('the sound lab page is wired: every element id the script asks for exists, every import resolves, the lab never touches game.js', () => {
  const html = readFileSync(new URL('../sound-lab.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./sound-lab.js', import.meta.url), 'utf8');
  assert.ok(html.includes('./src/sound-lab.js') && html.includes('width=device-width') && /height: 44px|min-height: 44px/.test(html), 'phone-first, 44 px targets');
  const have = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const asked = new Set([...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
  assert.ok(asked.size > 6);
  for (const id of asked) assert.ok(have.has(id), `#${id} is asked for but missing`);
  for (const m of js.matchAll(/^import \{([^}]+)\} from '([^']+)';/gm)) {
    const src = readFileSync(new URL(m[2], new URL('./sound-lab.js', import.meta.url)), 'utf8');
    for (const name of m[1].split(',').map((x) => x.trim()).filter(Boolean)) assert.ok(new RegExp(`export (async )?(function|const|class|let) ${name}\\b`).test(src), `${m[2]} does not export ${name}`);
  }
  assert.ok(!/game\.js/.test(js.replace(/\/\/.*$/gm, '')), 'the lab never touches game.js');
});

console.log(`\n${passed} checks passed`);
