// The strange mark (stage 1d, batch B): Måseskär's old 1865 tower, dark since 1978. Granddad marked it on his chart with a pattern. Sail near it
// (once the chest is open) and the dark tower gives a faint flash in that pattern, a bell sounds, the fog thickens round the boat for a moment, then a
// card: "That tower has been dark since 1978. But you saw it." Lightweight: an emissive flash and a fog tint over values the game already has.
// Pure timeline + fog values; game.js applies them.
export const STRANGE_TRIGGER_M = 55; // game metres from the tower: near enough to see it
export const STRANGE = {
  flashAtS: 1.5, // the flashing starts
  bellAtS: 2.2, // one bell, as the flash is first seen
  fogUpS: 2.5, // the fog thickens over this long ...
  fogHoldUntilS: 7, // ... holds ...
  fogDownS: 3, // ... and thins again over this long
  flashEndS: 8.5,
  cardAtS: 9.5, // then the card
  endS: 10.5,
};
export const STRANGE_LOOK_BIAS = 0.7; // how far (0..1) the camera drifts from the boat toward the tower: at the trigger distance the tower is off the top of the screen
export const STRANGE_FLASH_LEVEL = 0.55; // faint: a ghost of a light, not a beacon

export const STRANGE_CARD = {
  lines: ['That tower has been dark since 1978.', 'But you saw it.'],
  button: 'Carry on sailing',
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// t: seconds since the boat came near the tower. Returns { fog 0..1, look 0..1 (the camera drift toward the tower), flashing, bell, card, done }.
export function strangeFrame(t, c = STRANGE) {
  const up = smooth(t / c.fogUpS);
  const down = smooth((t - c.fogHoldUntilS) / c.fogDownS);
  const look = smooth(t / 1.2) * (1 - smooth((t - 7) / 1.5)); // drifts over before the flash, settles back before the card
  return { fog: up * (1 - down), look, flashing: t >= c.flashAtS && t < c.flashEndS, bell: t >= c.bellAtS, card: t >= c.cardAtS, done: t >= c.endS };
}

// The haze values at fog level k (0 = the normal day, 1 = thick, cold and close). base: the CONFIG haze values at the start. Pure.
export function fogMoodValues(base, k) {
  const lerp = (a, b) => a + (b - a) * k;
  const mix = (c0, c1) => {
    const ch = (c, s) => (c >> s) & 255;
    const m = (s) => Math.round(lerp(ch(c0, s), ch(c1, s)));
    return (m(16) << 16) | (m(8) << 8) | m(0);
  };
  return {
    HAZE_MESH_NEAR_MUL: lerp(base.HAZE_MESH_NEAR_MUL, base.HAZE_MESH_NEAR_MUL * 0.35),
    HAZE_MESH_FAR_MUL: lerp(base.HAZE_MESH_FAR_MUL, base.HAZE_MESH_FAR_MUL * 0.3),
    HAZE_WATER_NEAR_MUL: lerp(base.HAZE_WATER_NEAR_MUL, base.HAZE_WATER_NEAR_MUL * 0.35),
    HAZE_WATER_FAR_MUL: lerp(base.HAZE_WATER_FAR_MUL, base.HAZE_WATER_FAR_MUL * 0.3),
    HAZE_WATER_STRENGTH: lerp(base.HAZE_WATER_STRENGTH, 1),
    HAZE_COLOR: mix(base.HAZE_COLOR, 0xaab6c2), // a cold grey-blue
  };
}
