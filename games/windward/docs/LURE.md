# Stage 1b: the lure comes alive (2026-11-05, branch `felix/windward-lure`)

Today's coast, free sail, no save. Real coast stays the default; **`?lure=0`** turns the harbour moment and the
animals off (compare frame rate), `?debug=1` shows the overlay and the solo-dev line.

## What is in
| | where |
|---|---|
| Harbour arrival: slow into a village or natural harbour (<= 3 m/s, inside 70 m / 45 m), once per visit (re-arms after leaving 1.8 x reach, 90 s cooldown; spawning inside is not an arrival) | `src/arrival.js` |
| The moment: bell (+ horn at villages), gulls, someone waves on the shore, a fish arcs onto the deck | `src/harbour-moment.js`, `src/audio.js` |
| Fish on deck: 4 visible slots, kept in localStorage (`windward.deck.v1`), oldest replaced when full | `src/deck.js` |
| Life: 12 gulls (fly; perch on buoys + lighthouse rocks), eider rafts that swim away, harbour seals on low rocks that dive, a drifting dinghy, 36 buoys by the harbours | `src/life.js` |
| Descriptive names: a place shows its description when sighted (reach + 120 m), the real name with the description underneath once discovered; no description = unnamed until discovered | `data/place-names.json`, `src/names.js` (`sight`, `displayName`), `src/name-labels.js` |
| Harbours placed: Testholmen, Dammholmen, Danholmen (Felix's near-matches), Vrakevik + Kråkholmen (his pins, as given), Grundsunds hamn | `data/place-names.json` |
| HUD counter: "places named N" (was "found 0/0") | `game.js` `progressText` |
| Solo-dev line only with `?debug=1` | `index.html` |

## Sounds: sources and licences
All four sounds are **synthesised at runtime with the Web Audio API** (`src/audio.js`): bell = bronze-bell partials,
horn = detuned saws through a low-pass, gull = gliding triangle wave with vibrato, splash = falling sine. No sample
files, nothing third-party, nothing to license. Audio starts only after the first tap/key (browser rule); before that
every call is a silent no-op.

## Data notes (TODO(felix) = not verified)
- **Testholmen**: placed at the midpoint of Lilla + Stora Testholmen (the only ones in the region). TODO(felix): confirm.
- **Stångehuvud, Islandsberg**: described, but no place yet (not in `names.json`; Overpass was down, 502, to geocode by exact name).
- **Stora Kornö** ("the barley isle"): in the 80 m edge-fade strip at the north border, so not on the chart yet.
- Favourites outside the window (Altarholmen, Tornholmen, Åstol, Skärhamn, Klädesholmen, Rammen/Skinnbroken, Marstrand, Smörasken, Hunnebostrand, Smögen...) are listed in `data/place-names.json`; they appear when the window grows.
- Gullholmens Gästhamn has no coordinate of its own; Gullholmen village covers the arrival.

## Measured (headless Chrome, software GL: counts matter, fps does not)
Same spots, same script, with and without the lure (`?lure=0`), moment running:
- Busiest village, Hälleviksstrand: **386,486 triangles / 134 draw calls** with, 384,758 / 129 without.
  The lure costs about **+1.7k triangles (+0.4%) and +5 draw calls**; the rest is the existing terrain.
- Most draw calls: Fiskebäckskil 173 (169 without). iPhone 13 emulation (585 x 1266 canvas): worst 352,790 triangles.
- Pixel held 60 fps at 634k triangles (stage 1a), so there is headroom. Real-phone fps is still Felix's read.
- Every village and harbour has open sea 2-26 m from its point, inside its arrival circle (`lure-data.test.js`).
- Headless desktop + iPhone 13 runs: zero page errors; arrival fired by itself with the boat idling into the wind.

## Tests
`for f in games/windward/src/*.test.js; do node $f; done` (28 files). New: `arrival`, `audio`, `life`,
`harbour-moment`, `lure-data` (real coast); extended: `names`.

## Label fixes (2026-11-05, after Felix's phone test)
Two bugs in `src/name-labels.js`, root causes found with a headless repro that logs every label's box and why it stays or goes:
1. **Overlap at the edge / under the compass.** Labels were clamped by their *centre* to a 10% margin and never compared with each other or the HUD
   (at 390 px: Gåsö and Långholmen 24 px apart, both under the compass box). Now `layoutLabels`: clamp by the label's own size, keep clear of the
   HUD boxes actually on screen (read from the DOM) and the bottom line, nearest first (a village / harbour / island / described place counts as
   nearer than a bare skerry), the rest stack one or two rows or collapse. At most 4 names on a narrow screen, 6 on a wide one.
2. **Names fading near the island.** Lifetime was a 6.5 s timer, and the first fix (keep only while on screen) still failed: a portrait phone sees only
   about 20 m to each side, so a place 40-80 m away is "near" yet a screen-width off to the side. Now a name stays while the boat is near the place
   (reach + 140 m; as an edge tag 170-ish m for a skerry), over the island when it is on screen, and fades only when you sail away or it is crowded.
Evidence: parked 6 m from Hättan the name stayed at full opacity for 18 s (was gone at 8 s); sailing away it stays 41 -> 166 m, then fades.
