// The game's weather: the sail-feel lab's weather (weather.js, wind-field.js) wired to the GAME clock. Pure: no DOM, no THREE; `clock` is injectable so a test can drive it.
// (docs/ALIVE-SEA.md "Grill: weather and sail feel"; the lab is docs/SAIL-FEEL-LAB.md.)
//
// TIME. Weather time = START_HOUR of the game day + the game clock since the session began + `offset`.
//   - The game clock (src/game-clock.js) freezes under a solo pause, so the weather freezes with it. In co-op the clock runs on wall time (src/pause.js).
//   - `offset` is how a guest adopts the host's weather time (one number, set from the host's message), and how the host keeps weather time CONTINUOUS when a friend
//     arrives and the clock resyncs (rebase()).
// CO-OP. No wind has to be sent. Both phones run the same pure windAt() from the same seed (the hub's launch seed) and the same weather time, so they agree on the
//   day, the gusts and the lees. The host's existing 'wind' message carries one extra field, `wx` (weather time, seed, day type, story-override events), which a guest uses
//   to line its clock up (wall clocks of two phones can differ by seconds or more) and to follow the host's day type and story wind. The message keeps its old fields
//   (dir, strength, seq: the wind at the host's boat), so an OLD guest page just applies those as it always did and never sees `wx`; a NEW guest that hears a message
//   WITHOUT `wx` (an old host) falls back to the old way.
// STORY. The first errand's scripted wind (src/errand-wind.js) is a use of the field's override hook: setPhase(beats.phase) turns the phase into override events.
import { CONFIG } from './config.js';
import { createWindField } from './wind-field.js';
import { timeOfHour, hourOf, DAY_TYPES, dayTypeFor, parseClock, formatClock } from './weather.js';
import { errandWindFor } from './errand-wind.js';

export const GAME_WEATHER = {
  START_HOUR: 11, // a new session starts late morning, so the sea breeze builds while you play
  SYNC_TOL_S: 0.4, // a guest re-aligns its weather time when it is further than this from the host's (latency is ~0.1 s)
  HEARTBEAT_S: 2, // the host sends its 'wind' message at least this often (old guests get a fresh dir/strength; new guests re-check their time)
  EVENT_KEEP: 8, // override events carried in a message (the story has two or three)
  SEA_MIN: 0.12, // the sea's wind strength never drops below this (waves stay a little alive in a calm)
  PREWARM_EVERY_S: 2, // keep the coast grid warm for the next directions the wind may turn to ...
  PREWARM_SPREAD_DEG: 8, // ... this far either side
};

// ?day=misty / sea / grey / unsettled ... -> a day type (or null: the seed's own).
const ALIASES = { sea: 'sea-breeze', breeze: 'sea-breeze', seabreeze: 'sea-breeze', grey: 'grey-westerly', gray: 'grey-westerly', westerly: 'grey-westerly', misty: 'misty-morning', mist: 'misty-morning', fog: 'misty-morning', squall: 'unsettled', squalls: 'unsettled', showers: 'unsettled' };
export function dayTypeFromParam(text) {
  if (!text) return null;
  const t = String(text).trim().toLowerCase();
  if (DAY_TYPES.includes(t)) return t;
  return ALIASES[t] ?? null;
}
export function startHourFromParam(text) {
  const h = parseClock(text);
  return h === null ? GAME_WEATHER.START_HOUR : h;
}

// opts: { seed, dayType (null = the seed's own), startHour, heightAt, bounds, center, clock { now() }, errand { yard, grundsund } | null }
export function createGameWeather(opts) {
  const { clock } = opts;
  let errand = opts.errand ?? null; // { yard, grundsund }: the host's first-errand story; set later by setErrand() (the positions are known after the world is built)
  let seed = opts.seed;
  let dayType = opts.dayType || dayTypeFor(seed);
  const startS = timeOfHour(opts.startHour ?? GAME_WEATHER.START_HOUR);
  const anchor = clock.now();
  let offset = 0;
  const gtNow = () => startS + (clock.now() - anchor) + offset;
  let gt = gtNow(); // the weather time of this frame (update() refreshes it)

  const events = []; // the story override, replayed into whichever field is current: { t0, blend, target | null }
  let eventsTotal = 0; // how many the story has made (a guest counts how many it has applied)
  let applied = 0; // events already given to the field
  let field = null;
  function build() {
    field = createWindField({ daySeed: seed, dayType, heightAt: opts.heightAt, bounds: opts.bounds, center: opts.center });
    applied = 0;
    for (const e of events) { if (e.target) field.setOverride(e.target, e.blend, e.t0); else field.clearOverride(e.blend, e.t0); applied++; }
  }
  build();

  const sea = { dir: 0, strength: GAME_WEATHER.SEA_MIN }; // what the sea (waves, foam, the boat's bob) follows: the DAY's wind and sea state, not the gusts
  const addEvent = (e) => { events.push(e); eventsTotal++; if (e.target) field.setOverride(e.target, e.blend, e.t0); else field.clearOverride(e.blend, e.t0); applied++; };

  // ---- the first errand: phase -> override events (what src/errand-wind.js does with its own blend, as events on the field) ----
  let key = undefined; // 'errand' | 'return' | null (normal) | undefined (not seen yet)
  function setPhase(phase) {
    if (!errand) return;
    const k = phase === 'errand' || phase === 'return' ? phase : null;
    if (k === key) return;
    const first = key === undefined;
    key = k;
    if (first && !k) return; // a game that starts on the normal wind: nothing to do
    const blend = first ? 0 : CONFIG.ERRAND_WIND_SWING_S; // a game loaded at any phase gets the right wind from frame 1; a phase change swings over ERRAND_WIND_SWING_S
    if (k) addEvent({ t0: gt, blend, target: errandWindFor(k, errand) });
    else addEvent({ t0: gt, blend, target: null }); // 'help': hands back to the weather, smoothly
  }

  let lastPrewarm = -Infinity;
  const api = {
    get field() { return field; },
    get dayType() { return dayType; },
    get seed() { return seed; },
    get gt() { return gt; },
    get hour() { return hourOf(gt); },
    get clockText() { return formatClock(gt); },
    sea,
    setPhase,
    setErrand(e) { errand = e; },
    // once per frame, before anything asks for wind: refresh the weather time, the sea's wind, and keep the coast grid warm
    update() {
      gt = gtNow();
      const b = field.base(gt);
      sea.dir = b.dir;
      sea.strength = Math.max(GAME_WEATHER.SEA_MIN, b.seaState);
      if (gt - lastPrewarm > GAME_WEATHER.PREWARM_EVERY_S || gt < lastPrewarm) {
        lastPrewarm = gt;
        const s = (GAME_WEATHER.PREWARM_SPREAD_DEG * Math.PI) / 180;
        field.prewarm(b.dir); field.prewarm(b.dir + s); field.prewarm(b.dir - s);
      }
      return api;
    },
    windAt: (x, z, out = {}) => field.windAt(x, z, gt, out),
    base: () => field.base(gt),
    // Run fn (a clock resync, when a friend joins) and keep the weather time continuous across it.
    rebase(fn) { const g = gtNow(); fn(); offset += g - gtNow(); gt = gtNow(); },
    // The host's weather state for its 'wind' message (see the file header). Small: a few numbers.
    packet() {
      const keep = events.slice(-GAME_WEATHER.EVENT_KEEP);
      return {
        v: 1, gt: Math.round(gt * 1000) / 1000, seed, day: dayType, n: eventsTotal,
        ov: keep.map((e) => [Math.round(e.t0 * 1000) / 1000, e.blend, e.target ? Math.round(e.target.dir * 1e6) / 1e6 : null, e.target ? Math.round(e.target.strength * 1e6) / 1e6 : null]),
      };
    },
    // A guest hears the host's `wx`. Returns true if it was a weather packet we understood (false: an old host, use the old wind).
    receive(wx) {
      if (!wx || wx.v !== 1 || !Number.isFinite(wx.gt)) return false;
      const sameDay = wx.day === dayType && wx.seed === seed;
      if (!sameDay && DAY_TYPES.includes(wx.day)) { dayType = wx.day; seed = wx.seed; build(); } // follow the host's day (a ?day= on the host's URL)
      if (Math.abs(wx.gt - gtNow()) > GAME_WEATHER.SYNC_TOL_S) offset += wx.gt - gtNow();
      if (Array.isArray(wx.ov)) { // the host's story-override events: apply the ones we have not applied
        const keep = wx.ov; const firstIndex = wx.n - keep.length; // event number of keep[0]
        for (let i = Math.max(applied, firstIndex); i < wx.n; i++) {
          const [t0, blend, dir, strength] = keep[i - firstIndex];
          const e = { t0, blend, target: dir === null ? null : { dir, strength } };
          events.push(e); eventsTotal++;
          if (e.target) field.setOverride(e.target, e.blend, e.t0); else field.clearOverride(e.blend, e.t0);
          applied++;
        }
      }
      gt = gtNow();
      return true;
    },
  };
  return api;
}

// The host's 'wind' message: the old fields first (an old guest reads only these), then `wx`. (dir, strength) = the wind at the host's boat.
export function windMessage(weather, wind, seq) {
  return { type: 'wind', dir: wind.dir, strength: wind.strength, seq, wx: weather.packet() };
}

// What an OLD guest page does with that message (src/../game.js before this change), as a function, so a test can prove it still works: it reads dir, strength, seq only.
export function oldGuestApply(state, msg) {
  if (msg && msg.type === 'wind' && msg.seq > state.windSeq) return { wind: { dir: msg.dir, strength: msg.strength }, windSeq: msg.seq };
  return state;
}

