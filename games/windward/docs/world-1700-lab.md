# World 1700 Lab

Sail the real Bohuslän coast as it is **Today** and as it was **around 1700**, flip between the two at the same spot with one
tap, and open the **ghost chart**: your old Today chart as faint pencil outlines of the land, inked in as you sail in 1700.

- Page: `world-1700-lab.html` (phone-first; opens in 1700; `?era=today` starts in Today)
- Nothing in `game.js` or `src/coast-world.js` is changed. The lab calls the game's own world code and is built so that `game.js`
  can adopt the same switch later (see "Adopting it in game.js").
- Screenshots (the lab in a 390x844 frame): `docs/world-1700-lab/grundsund-today.png`, `grundsund-1700.png` (same spot, one tap),
  `hidden-rock.png`, `ghost-chart.png`.

## What you see in 1700

| | Today (the game's coast) | 1700 |
|---|---|---|
| Sea level | as the raster | **0.55 m higher** (`data/world-1700.json` `waterLevel.offsetM`; our arithmetic on SMHI's rate, range 0.45-0.70, flagged uncertain) |
| Shore | the raster | low land under 0.55 m goes under (about 3% of the land cells in the window), the sea is deeper by the offset |
| Rocks awash today | white surf rings, solid | **hidden but still solid**: 202 rocks, 173 inside the window. A faint pale patch and now and then a thin breaker; a keel hits them (the boat slides off like land, no damage) |
| Lighthouses, buoys, beacons | 6 lights, the OSM marks | **none** |
| Settlements | the game's 98 red cottages | 7 places, **47 cottages**, sizes from the data (below) |
| Marks | - | 8 cairns and painted rocks (only Måseskär and the Käringön name theory have a source) |
| Boats | Svalan, the koster | the eka (rust sail); 5 ekas moored near the villages, 2 working ekas sailing a clear line |
| Names | modern, as in the game | only documented old forms: Käringön **Kierlingøon** (1659), Gullholmen **Guldholmen** (1588), Härmanö **Hermanö** (1673, uncertain), Lysekil **Lusekijll** (1578, uncertain). Fiskebäckskil, Grundsund and Hälleviksstrand have no documented form, so **no name is shown** |

Settlement sizes (`data/world-years.json`): a count of families near 1700 wins (Gullholmen: 20 fishing families, one cottage per two
households = 10); otherwise a table by size class (hamlet 4, farm-and-fishing 3, fishing village 12, unknown 2). **The table is our
bracket between the two nearest documented counts, not a source figure.** Grundsund is doubtful as a village in 1700 (two sources
disagree); it is shown as a hamlet of 4 and the info sheet says so. The 1700 cottages are bare grey timber under turf or old
grey-brown tile (the red one is gone: `docs/era-assets/README.md`).

The info sheet (bottom left) lists the counts, the per-village sizes, the names and their years, and the honest notes.

## The ghost chart

Tap **Chart** (1700 only). Behind the sheet:

- **Pencil**: Today's shoreline as a faint graphite line, only where your Today chart was explored. Land outlines only: no names, no
  marks, no harbours, no lights (the module has no text code at all, and its test checks that).
- **Ink**: the 1700 shoreline in the game's ink colour, with the chart's land and sea tint, only where you have sailed in 1700. The
  edge fades with the game's own fog smoothing (`chart.js fogAlpha`), so it looks like the game's fog lifting. Where the water level
  moved the shore, pencil and ink disagree, and the pencil under the ink is drawn fainter.
- **Reset ink** blanks the 1700 chart; the pencil stays.
- Drag to pan, pinch or scroll to zoom. It opens fitted to whatever has been drawn.

The old chart (`?ghost=saved|demo|full`): by default the game's **saved chart on this device**, read through a read-only storage
wrapper (the lab never writes the game's key `windward.explored.v1`). With no saved game it falls back to a **demo**: fog lifted
along Grundsund - Fiskebäckskil - Lysekil - Gullholmen - Härmanö. `full` lifts everything. The 1700 ink has its own key,
`windward.explored.1700.v1`; sailing in Today inks nothing.

## URL

`?era=1700|today` `?ghost=saved|demo|full` `?chart=1` `?info=1` `?touch=1|0` (phone controls or keyboard + HUD) `?zoom=<0.5-2.5>` (camera
distance, 1 = the game's) `?at=lon,lat` (start beside a point) `?rock=N` (start beside the Nth-nearest hidden rock)
`?breaker=<s>|all` (freeze the breaker clock, or hold every breaker on, for a still picture) `?inkroute=1` (ink the first part of the demo
route) `?inkreset=1`.

## Design: the world-by-year switch

Data-driven on purpose, so it is the same shape for 1905 or any later era.

1. **`data/world-years.json`**: one row per era (`from`/`to`, `year`, which dataset, kit, whether lights and modern marks exist, how
   the water offset and the hidden rocks are read from the dataset, the settlement size rules, boats). Adding an era is a new row
   plus its data file.
2. **`src/world-year.js`** (pure): `worldAtYear(years, sources, year)` -> a plain description (`waterOffsetM`, `hiddenRockIds`,
   `settlements`, `marks`, `labels`, `boats`, `notes`); `coastAtWaterLevel(coast, offset)` (the coast seen at another water level, through
   the four accessors `buildCoastWorld` reads); `shoalsInEra`.
3. **`src/world-year-build.js`**: `loadWorldFiles()` and `buildWorldForSpec(files, spec)` -> terrain, trees, props, shoal layers,
   water, collision (`sailHeightAt`, `shoalSlowAt`), labels. Today is built with exactly the game's functions (the test checks its
   height field equals what `loadRealCoast` builds); 1700 is the same coast through `coastAtWaterLevel` plus the 1700 kit
   (`src/era-assets.js`).
4. **`src/ghost-chart.js`**: contours (marching squares on the world's own height field), the ink picture, the model, `drawGhostChart`.
5. **`world-1700-lab.html` + `src/world-1700-lab.js`**: only the viewer; reuses the game's sea, sky, light, camera, `sail.js`, `wind.js`,
   `shore.js` and phone controls.

### Adopting it in game.js (not done; for later)

1. Load once with `loadWorldFiles()`; pick `spec = worldAtYear(years, sources, year)`.
2. Replace `loadRealCoast()` by `buildWorldForSpec(files, spec)` for years other than Today (or for all of them once the adapter exists).
   **Gap:** `loadRealCoast` returns a bigger object (`names`, `lights`, `granddad`, `sea.marks`, `terrainStyle`...) that the chart, name book and
   lighthouse task read; the builder returns the world, props, shoals and collision, but not those. An adapter that fills them per spec is
   the main remaining job.
3. Keep the player's boat per era (`spec.boats.kit`): the lab swaps Svalan and the eka on the toggle.
4. The ghost chart takes the two built worlds and two explored grids; `game.js`'s chart controller would call `drawGhostChart` instead of the
   normal chart while in a past era.
5. The chart rules below are the lab's reading of the design notes; confirm them before the game does it.

## What I could not verify, and choices made

- **The design note "Decided: the chart after the jump" does not exist** in `GAME-DESIGN.md` or `docs/` at this commit (searched for the
  heading, "ghost", "pencil", "wipe", "after the jump"). The brief refers to it, so it may be uncommitted. The nearest text is "What
  crosses a jump (SET): knowledge travels (chart sections, discoveries, history cards)" and `docs/WORLD-1700.md`: "Not decided here:
  whether the player's chart is wiped on arrival. That is Felix's call." The lab implements the brief's description: the old chart
  survives as faint pencil outlines of the land only, and the new chart inks in as you sail. **TODO(felix): confirm against the decided
  note when it lands** (in particular: pencil only where the old chart was explored, ink replaces pencil, no names, marks or harbours
  carry over).
- **Skerries**: the 283 skerries have no heights in the data (`docs/WORLD-1700.md` section 3), so none is hidden; they are stamped as in the game.
  Where Today's raster has low land that drowns in 1700 and an OSM skerry ring sits there, the islet reappears as a rock (a handful of cells
  are *higher* in 1700 than today for that reason; the test counts them).
- **The nine named shoals** (`Tors både`...) cannot be decided from the data: unchanged.
- **Hidden-rock look** (a pale patch, a breaker roughly every 7 s, four groups so they do not break at once) is a design guess;
  `TODO(felix): confirm by eye on the phone`. Radii and collision follow `shoal-look.js`'s awash rock (2.4 m).
- **The spar mark at Hättan** (invented, `docs/WORLD-1700.md`) has no model and is not drawn. Marks are drawn bigger than the 1:1 props
  (cairn x1.8, rock x2.0) so they read from the game camera.
- **1700 ekas**: moored ones follow the sea height; two working ekas sail back and forth along a clear line near the start. Where they
  go and how many is the quiet-coast recommendation (invented), not documented.
- A cottage stands for two households; the size-class table is ours. Both are in `data/world-years.json` with notes.
- Day only: no dusk in this lab (see the era-asset lab for lit windows).
- Chrome's phone emulation was not used; the screenshots are a 390x844 frame in desktop Chrome with `?touch=1`, so the touch UI is
  the game's own phone controls, but real touch was not tried.

## Tests

`node games/windward/src/world-year.test.js` (era choice, water, hidden rocks, settlements, marks, names, `coastAtWaterLevel`),
`world-year-build.test.js` (builds BOTH eras from the real coast files: shore moved, hidden rocks solid but not surf, no lights or
buoys in 1700, sizes follow the data, Today equals the game's coast, ekas animate; about 10 s),
`ghost-chart.test.js` (contours, read-only chart, pencil vs ink rules, no text, ink picture, view fit), `world-1700-lab.test.js` (page
wiring and "cannot damage saved progress"), and `era-assets.test.js` (now also: no red on a 1700 cottage).
