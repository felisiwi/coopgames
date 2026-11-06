// The lighthouse rewind (stage 1e, batch 2b): in the dark, a row of lighthouses, oldest on the left, each with the year it was built (the approach of
// ref/lighthouse-timeline-play.html). The year counts down from today; the camera moves left past the lights, faster and faster, and every tower built after the current
// year winks out, until the camera slows and stops at 1950. Kråksundsgap Södra (1954) vanishes here: the set-up for glimpsing it again in chapter 1.
// Pure timeline and layout: no THREE, no DOM. src/opening-stage.js draws it.
export const REWIND = Object.freeze({
  fromYear: 2026,   // today
  toYear: 1950,     // where the camera stops
  spacingM: 14,     // between neighbouring towers (the lab used 24; a portrait phone at the opening's camera shows about 20 m across, so there is always one in view)
  durationS: 15,    // the whole run
  accelShare: 0.62, // the first part of the run gets faster and faster; the rest slows to a stop
  startPadM: 30,    // the camera starts this far to the right of the newest tower (the year there is `fromYear`)
});

// lights: [{ name, built }] (any order). The row: oldest first, x = i * spacing. Returns [{ name, built, effBuilt, x }].
// effBuilt is the year the camera's counter compares with: the build year, except that towers sharing a year are spread across that year (the last of n keeps it, the one before
// is n-1 ths of a year earlier ...), so the counter never holds flat across them and each tower winks out exactly as the camera passes it. (Three towers were built in 1974:
// compared with the plain year they all went at once, when the camera reached the leftmost, and the middle one stood on while the counter went by.)
export function layoutRow(lights, { spacingM = REWIND.spacingM } = {}) {
  const sorted = [...lights].sort((a, b) => a.built - b.built || (a.name < b.name ? -1 : 1));
  const groupSize = new Map(), seen = new Map();
  for (const l of sorted) groupSize.set(l.built, (groupSize.get(l.built) || 0) + 1);
  return sorted.map((l, i) => {
    const n = groupSize.get(l.built), j = seen.get(l.built) || 0; seen.set(l.built, j + 1);
    return { name: l.name, built: l.built, effBuilt: l.built - (n - 1 - j) / n, x: i * spacingM };
  });
}

// The year shown with the camera at x: between two towers the year runs between their years, right of the newest it is `fromYear`, left of the oldest it is that tower's year.
export function yearAtX(row, x, fromYear = REWIND.fromYear) {
  if (!row.length) return fromYear;
  const last = row[row.length - 1];
  if (x >= last.x) return last.effBuilt + Math.min(1, (x - last.x) / REWIND.startPadM) * (fromYear - last.effBuilt); // right of the newest tower: 2020 at it, today at the start
  if (x <= row[0].x) return row[0].effBuilt;
  for (let i = row.length - 1; i > 0; i--) {
    if (x >= row[i - 1].x) { const k = (x - row[i - 1].x) / (row[i].x - row[i - 1].x); return row[i - 1].effBuilt + (row[i].effBuilt - row[i - 1].effBuilt) * k; }
  }
  return row[0].effBuilt;
}

// The camera x at which the year reads `year` (the inverse of yearAtX on the way down). Used for where the run stops (1950).
export function xAtYear(row, year, fromYear = REWIND.fromYear) {
  if (!row.length) return 0;
  const last = row[row.length - 1];
  if (year >= fromYear) return last.x + REWIND.startPadM;
  if (year >= last.effBuilt) return last.x + ((year - last.effBuilt) / Math.max(1, fromYear - last.effBuilt)) * REWIND.startPadM; // between the newest tower and the start
  for (let i = row.length - 1; i > 0; i--) {
    const a = row[i - 1], b = row[i];
    if (year >= a.effBuilt && year <= b.effBuilt) return b.effBuilt === a.effBuilt ? b.x : a.x + ((year - a.effBuilt) / (b.effBuilt - a.effBuilt)) * (b.x - a.x);
  }
  return row[0].x;
}

// Progress 0..1 through the run at time t: gets faster and faster (quadratic in), then slows to a stop (quadratic out), continuous in position and speed at the join.
export function rewindProgress(t, c = REWIND) {
  const u = Math.min(1, Math.max(0, t / c.durationS));
  const a = c.accelShare;
  // speed rises linearly to v at u = a, then falls linearly to 0 at u = 1; total distance 1 -> v = 2
  const v = 2;
  if (u <= a) return (v / (2 * a)) * u * u;
  const rest = 1 - a;
  const d = (v / (2 * a)) * a * a; // distance at the join
  const w = u - a;
  return d + v * w - (v / (2 * rest)) * w * w;
}

// Where the run lands: the newest tower still standing at `toYear` (Gäven, 1941, for 1950), so the camera stops with that tower centred in the frame.
export function landingX(row, toYear = REWIND.toYear) {
  const standingRow = row.filter((r) => r.built <= toYear);
  return standingRow.length ? standingRow[standingRow.length - 1].x : xAtYear(row, toYear);
}

// t seconds into the run. row from layoutRow(). Returns { x (camera), year (shown, whole number), yearExact (what towers compare their build year with), progress, done }.
// The year reaches `toYear` between two towers and then holds while the camera finishes its slide onto the landing tower, so the counter reads 1950 at the stop.
export function rewindFrame(t, row, c = REWIND) {
  const x0 = row.length ? row[row.length - 1].x + c.startPadM : 0;
  const x1 = landingX(row, c.toYear);
  const p = rewindProgress(t, c);
  const x = x0 + (x1 - x0) * p;
  const yearExact = yearAtX(row, Math.max(x, xAtYear(row, c.toYear, c.fromYear)), c.fromYear);
  return { x, year: Math.round(yearExact), yearExact, progress: p, done: t >= c.durationS };
}

// Is the tower still standing in `year`? (Towers built after the current year wink out.)
export const standing = (built, year) => built <= year;
