// Pure logic for the epoch timeline (no DOM), shared by coast-lab.html and its tests.
// Data: data/epochs.json is the single source (epochs, eras, herring periods, lighthouse years, markers, Marstrand status).
//
// The timeline axis is NOT linear: each epoch gets a share of the width equal to its `weight` (they sum to 100),
// and years are spread evenly inside their epoch. So "position" below is 0..100 (percent of the track).

export const KIND_COLOURS = {                      // [fill, text, line] per `kind`, as in the frozen ref/epoch-timeline.html
  med: ['#EEEDFE', '#3C3489', '#AFA9EC'],
  quiet: ['#F1EFE8', '#444441', '#B4B2A9'],
  boom: ['#FAEEDA', '#633806', '#EF9F27'],
  light: ['#E1F5EE', '#085041', '#5DCAA5'],
  war: ['#FAECE7', '#712B13', '#F0997B'],
  sum: ['#E6F1FB', '#0C447C', '#85B7EB'],
};

export function buildAxis(epochs) {
  let acc = 0;
  const eps = epochs.map((e) => { const x = acc; acc += e.weight; return { ...e, x }; });
  const total = acc;
  const first = eps[0].from, last = eps[eps.length - 1].to;
  const toPos = (y) => {                          // year -> 0..100
    for (const e of eps) if (y <= e.to) return ((e.x + ((Math.max(y, e.from) - e.from) / (e.to - e.from)) * e.weight) / total) * 100;
    return 100;
  };
  const toYear = (pos) => {                       // 0..100 -> year
    const p = (pos / 100) * total;
    for (const e of eps) if (p <= e.x + e.weight) return Math.round(e.from + ((p - e.x) / e.weight) * (e.to - e.from));
    return last;
  };
  return { epochs: eps, total, first, last, toPos, toYear };
}

const within = (list, y) => list.find((r) => y >= r.from && y <= r.to);
export const epochAt = (epochs, y) => within(epochs, y) || epochs[y < epochs[0].from ? 0 : epochs.length - 1];
export const eraAt = (eras, y) => within(eras, y) || eras[y < eras[0].from ? 0 : eras.length - 1];
export const herringAt = (periods, y) => periods.find((p) => y >= p.from && y <= p.to) || null;
export const lighthousesStanding = (built, y) => ({ n: built.filter((b) => b <= y).length, of: built.length });
// Marstrand's status at a year: the LAST entry whose range covers it wins (so a later, narrower entry overrides a wide one).
export function marstrandAt(statuses, y) {
  let hit = null;
  for (const s of statuses || []) if (y >= s.from && y <= s.to) hit = s;
  return hit;
}

// Everything the info panel shows for one year.
export function describeYear(data, y) {
  const epoch = epochAt(data.epochs, y), era = eraAt(data.eras, y);
  return {
    year: y, epoch, era,
    herring: herringAt(data.herringPeriods, y),
    lighthouses: lighthousesStanding(data.lighthouseBuilt, y),
    marstrand: marstrandAt(data.marstrandStatus, y),
    events: (era.events || []).map(([year, text, source]) => ({ year, text, source: source || null, on: year <= y })),
  };
}
