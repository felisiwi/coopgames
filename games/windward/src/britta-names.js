// Britta names the four lights (Next run, batch 1b). In 1950 the discovery rule says a light shows only its description ("A lighthouse") until you have sailed up
// to it. But Britta's card names all four AGA lights (Hättan, Gäven, Stångholmen, Fredagsholmen) when she asks for help, so after that card their Navigate tag, visit
// card and chart label should read the real name. Måseskär, and every other light, keep the discovery rule.
//
// Derived, never saved: "Britta has spoken" is beats.phase having reached 'free' (the phase moves on only when her cards are finished: game.js helpMoment), which
// the beats already save. So there is no new save key, an old save past 'free' just works, and the real name book (the "places named" count) is untouched.
import { LIGHTS_1950 } from './story-1950.js';
import { PHASES } from './beats-1950.js';

export const BRITTA_LIGHT_IDS = new Set(LIGHTS_1950.map((name) => `light:${name}`));
export const brittaHasSpoken = (phase) => PHASES.indexOf(phase) >= PHASES.indexOf('free');

// nameBook: the real name book (src/names.js). phase: () => the current beats phase, or null when there are no beats (not 1950).
// Returns the same name book with only isKnown() widened. The chart controller gets this one; the HUD count and discovery keep the real one.
export function withBrittaNames(nameBook, phase) {
  return { ...nameBook, isKnown: (id) => nameBook.isKnown(id) || (BRITTA_LIGHT_IDS.has(id) && brittaHasSpoken(phase() || 'find')) };
}
