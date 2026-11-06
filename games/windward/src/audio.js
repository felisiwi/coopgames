// Sound (stage 1b): a harbour bell, a horn, gull cries and a splash, all SYNTHESISED with WebAudio at runtime.
// No sample files, so nothing third-party to license or download (recorded in docs/LURE.md).
//
// Browsers refuse to make sound before the player has touched the page, so the AudioContext is created on the
// first pointer / touch / key event (armOnFirstGesture); until then every call is a silent no-op. Everything is
// quiet and short: this is the background of a cosy game. If WebAudio is missing or throws, the game carries on.

// Pure sound recipes: what to play, as plain data, so they can be tested without a browser.
// partial: [frequency ratio, gain, decay seconds]. Ratios are a bronze bell's (hum, prime, tierce, quint, nominal...).
export const BELL = { base: 523, partials: [[0.5, 0.5, 3.2], [1, 0.9, 2.6], [1.2, 0.4, 2.0], [1.5, 0.3, 1.5], [2, 0.35, 1.1], [2.5, 0.12, 0.7], [3, 0.1, 0.5]], strikes: [0, 0.62], gain: 0.22 };
export const HORN = { freqs: [98, 98.9, 147], attack: 0.1, hold: 0.55, release: 0.5, cutoff: 380, gain: 0.12 };
// One gull cry: pitch glides down-up while a fast vibrato wobbles it. cries: [start offset s, base Hz, length s]
// The relight cue (stage 1d): a low, warm C-major chord that swells and fades, with two soft chimes (a fifth apart) as the lamp catches.
export const RELIGHT_SOUND = { chord: [[130.8, 1], [196, 0.8], [261.6, 0.7], [329.6, 0.5]], attack: 1.1, hold: 1.4, release: 2.4, gain: 0.07, chimes: [[880, 0.9], [1318.5, 1.6]], chimeGain: 0.05 };
// The light-pattern chimes (stage 1d, batch B): soft sines, one per flash.
export const LIGHT_CHIME = { hz: 988, darkHz: 660, decay: 1.0, longDecay: 1.8, gain: 0.045, max: 8 };
export const GULL = { vibratoHz: 24, vibratoDepth: 0.06, gain: 0.05 };

export const MOMENT = {
  village: { bell: true, horn: true, gulls: 3 },
  harbour: { bell: true, horn: false, gulls: 2 },
};

export function createAudio(ContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let ctx = null;
  let master = null;
  let broken = !ContextClass;

  function unlock() {
    if (ctx || broken) return;
    try {
      ctx = new ContextClass();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      broken = true;
      ctx = null;
    }
  }
  const live = () => ctx && !broken && ctx.state !== 'closed';

  function tone(type, freq, t0, attack, hold, release, peak) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + attack + hold + release + 0.05);
    return { o, g };
  }

  const api = {
    get unlocked() { return !!ctx && !broken; },
    unlock,
    // Listens for the first tap / key and unlocks. Returns a function that removes the listeners.
    armOnFirstGesture(target = globalThis.window) {
      if (!target || !target.addEventListener) return () => {};
      const events = ['pointerdown', 'touchstart', 'keydown', 'mousedown'];
      const off = () => events.forEach((e) => target.removeEventListener(e, handler, true));
      const handler = () => { unlock(); off(); };
      events.forEach((e) => target.addEventListener(e, handler, true));
      return off;
    },
    bell(delayS = 0, gain = 1) {
      if (!live()) return;
      try {
        const t = ctx.currentTime + delayS;
        for (const strike of BELL.strikes) {
          for (const [ratio, g, decay] of BELL.partials) {
            tone('sine', BELL.base * ratio, t + strike, 0.004, 0, decay, BELL.gain * g * gain);
          }
        }
      } catch { /* sound must never break the game */ }
    },
    horn(delayS = 0, gain = 1) {
      if (!live()) return;
      try {
        const t = ctx.currentTime + delayS;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = HORN.cutoff;
        lp.connect(master);
        for (const f of HORN.freqs) {
          const { o, g } = tone('sawtooth', f, t, HORN.attack, HORN.hold, HORN.release, HORN.gain * gain);
          g.disconnect();
          g.connect(lp);
          o.frequency.setValueAtTime(f * 0.97, t); // a horn leans up into its note
          o.frequency.linearRampToValueAtTime(f, t + HORN.attack);
        }
      } catch { /* ignore */ }
    },
    gull(delayS = 0, gain = 1, pitch = 1) {
      if (!live()) return;
      try {
        const t = ctx.currentTime + delayS;
        const len = 0.42;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(1500 * pitch, t);
        o.frequency.linearRampToValueAtTime(2300 * pitch, t + len * 0.25);
        o.frequency.linearRampToValueAtTime(1350 * pitch, t + len);
        lfo.frequency.value = GULL.vibratoHz;
        lfoGain.gain.value = 1700 * GULL.vibratoDepth * pitch * 2; // +-200 Hz wobble
        lfo.connect(lfoGain).connect(o.frequency);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(GULL.gain * gain, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(master);
        o.start(t); lfo.start(t);
        o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
      } catch { /* ignore */ }
    },
    // A fish landing on the deck: a short low "plop".
    plop(delayS = 0) {
      if (!live()) return;
      try {
        const t = ctx.currentTime + delayS;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(320, t);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.14);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.22);
      } catch { /* ignore */ }
    },
    // A lighthouse coming back on (stage 1d): calm. A warm chord swells under two soft chimes, nothing sharp, over about four seconds.
    relight(delayS = 0, gain = 1) {
      if (!live()) return;
      try {
        const t = ctx.currentTime + delayS;
        for (const [f, g] of RELIGHT_SOUND.chord) tone('sine', f, t, RELIGHT_SOUND.attack, RELIGHT_SOUND.hold, RELIGHT_SOUND.release, RELIGHT_SOUND.gain * g * gain);
        RELIGHT_SOUND.chimes.forEach(([f, at]) => tone('sine', f, t + at, 0.01, 0, 2.2, RELIGHT_SOUND.chimeGain * gain));
      } catch { /* sound must never break the game */ }
    },
    // Thunder (the opening's storm): a low rumble of filtered noise that cracks, rolls and fades over about three seconds. Synthesised; silent until the first tap unlocks audio.
    thunder(delayS = 0, gain = 1) {
      if (!live()) return;
      try {
        const t = ctx.currentTime + delayS, len = 3.4, n = Math.floor(ctx.sampleRate * len);
        const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) { const k = i / n; d[i] = (Math.random() * 2 - 1) * (k < 0.04 ? k / 0.04 : Math.pow(1 - k, 1.6)) * (0.7 + 0.3 * Math.sin(i / ctx.sampleRate * 9)); }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(70, t + len);
        const g = ctx.createGain(); g.gain.value = 0.9 * gain;
        src.connect(lp).connect(g).connect(master);
        src.start(t);
      } catch { /* sound must never break the game */ }
    },
    // The flasher's "pop" (1950 relight; the only sound of the AGA apparatus the sources name: docs/PEOPLE-1950.md section 2): one short, dry click.
    pop(delayS = 0, gain = 1) {
      if (!live()) return;
      try { const t = ctx.currentTime + delayS; tone('triangle', 180, t, 0.002, 0, 0.09, 0.22 * gain); tone('square', 900, t, 0.001, 0, 0.03, 0.05 * gain); } catch { /* sound must never break the game */ }
    },
    // A light's pattern as soft chimes in the same rhythm (stage 1d, batch B): one chime per flash (a lower one for each dark of an occulting light),
    // longer flashes ring longer. flashes: src/light-glyph.js lightGlyph().flashes. At most 8, never loud.
    lightChimes(flashes, delayS = 0, gain = 1) {
      if (!live() || !flashes) return;
      try {
        const t = ctx.currentTime + delayS;
        for (const f of flashes.slice(0, LIGHT_CHIME.max)) tone('sine', f.dark ? LIGHT_CHIME.darkHz : LIGHT_CHIME.hz, t + f.at, 0.01, 0, f.len >= 1.2 ? LIGHT_CHIME.longDecay : LIGHT_CHIME.decay, LIGHT_CHIME.gain * gain);
      } catch { /* sound must never break the game */ }
    },
    // The whole harbour moment's sound: bell (and horn for a village), then gulls in the background.
    arrival(kind) {
      const m = MOMENT[kind] || MOMENT.harbour;
      if (m.bell) api.bell(0.1);
      if (m.horn) api.horn(1.5);
      for (let i = 0; i < m.gulls; i++) api.gull(0.6 + i * 1.1 + (i % 2) * 0.3, 0.8, 0.9 + 0.12 * i);
    },
  };
  return api;
}
