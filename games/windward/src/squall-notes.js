// What to TELL the player about a squall, and when. Pure: no DOM, no clock. game.js shows the words and does the felt part (buzz, shake).
// Felix opened ?squall=soon, saw dark water and rain, and did not know what a squall was supposed to be. So: say it once when the first warning appears, say what to DO when it hits,
// and say when it is over. Each squall gets its own "hit" and "passed"; the explanation is for the first one only (per page load: nothing is saved).
export const NOTES = {
  HIT_AT: 0.3, // the squall's strength (0..1) at the boat that counts as "it has hit"
  PASSED_BELOW: 0.05, // and "it has passed" once it is below this ...
  PASSED_CLOUD: 0.1, // ... and its cloud is gone from over the boat
  EXPLAIN: 'A squall is coming: a short, hard blow. When it hits, ease the sheet or head up into the wind.',
  EXPLAIN_S: 9,
  HIT: 'Squall! Ease the sheet, or head up into the wind.',
  HIT_S: 5,
  PASSED: 'The squall has passed.',
  PASSED_S: 3,
};

// step(sq) once a frame with squallAt()'s result (or null when there is no weather). Returns the notes to show now: [{ kind: 'explain' | 'hit' | 'passed', text, seconds }].
export function createSquallNotes() {
  let explained = false; // the one-time explanation has been shown
  let hitIndex = null; // the squall that has hit us and not yet passed
  let lastHit = null; // the last squall we announced a hit for
  return {
    step(sq) {
      const out = [];
      if (!sq) return out;
      if (!explained && sq.aheadM !== null && sq.cloud > 0.04) { explained = true; out.push({ kind: 'explain', text: NOTES.EXPLAIN, seconds: NOTES.EXPLAIN_S }); }
      if (sq.intensity > NOTES.HIT_AT && sq.index !== lastHit) { lastHit = sq.index; hitIndex = sq.index; explained = true; out.push({ kind: 'hit', text: NOTES.HIT, seconds: NOTES.HIT_S }); }
      else if (hitIndex !== null && sq.intensity < NOTES.PASSED_BELOW && sq.cloud < NOTES.PASSED_CLOUD) { hitIndex = null; out.push({ kind: 'passed', text: NOTES.PASSED, seconds: NOTES.PASSED_S }); }
      return out;
    },
  };
}
