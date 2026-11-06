# World Lab (1700 / 1950 / Today)

Sail the real Bohuslän coast as it is **Today** and as it was **around 1700**, flip between the two at the same spot with one
tap, and open the **ghost chart**: your old Today chart as faint pencil outlines of the land, inked in as you sail in 1700.

- Page: `world-1700-lab.html` (phone-first; a **1700 / 1950 / Today** toggle; opens in 1700; `?era=1950` or `?era=today` start elsewhere)
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

## What you see in 1950 (data/world-1950.json, docs/WORLD-1950.md, docs/world-1950/)

1950 is the game's home base (GAME-DESIGN "The flow, revised: wake in 1950"). The coast is today's (the sea stood about **0.13 m** higher:
our arithmetic on SMHI's rate, a few centimetres: 1.2% of the land cells, against 3.1% in 1700), with the 1950 kit (`docs/era-assets/README.md`).

| | 1950 |
|---|---|
| Villages | the data's counts, **one game house per ~25 people, capped at 28** (a stylised scale, ours): Lysekil 28, Grundsund 28, Gullholmen 19, Fiskebäckskil 15, Käringön 14, Hälleviksstrand 12, Härmanö 4 (no count: size class). 120 houses |
| Houses | white, ochre and "English red" (the municipal preservation advice quoted in WORLD-1950 E: **not a 1950 survey, uncertain**) under red clay tile, white corner boards, green window frames; red / ochre / bare-wood sea-sheds |
| Canning | two factories drawn: Hälleviksstrand (Bovik, 1934-1976) and Gullholmen (Hallgren, from 1864; its 1950 status is **conflicting** in the sources). Three more entries are undated and not drawn. Their look is the designer's choice |
| Lighthouses | **only Måseskär had keepers** (lit: white, 3 flashes / 30 s, electric lamp from 1950; red dwelling, brick siren house, slate roofs). Hättan and Gäven: automatic, lit. Islandsberg: the game's tower is the OLD keeper's-house light, **dark since 1938**, so it is shown dark (override in the era row); the lit 1938 concrete tower 425 m north has no model. Stångehuvud: dark (since 1940). 11 lights stand in the window, 5 have a model |
| Sea marks | **no IALA A** (it came to the west coast on 17 March 1980). The 1923 plate's compass-side system: red on the N/E side, black on the S/W side, cone buoys or poles with a broom or ball; a red-and-black banded pole for dangers passable both ways. 59 marks drawn from today's OSM positions (26 buoys); cardinal, special and the 41 minor lights are not drawn |
| Boats | wooden: snipor with an inboard engine, white fishing boats with a red stripe and a red bottom (the documented one: Sandö, 1948), wooden sailboats; no plastic (fibreglass from the late 1960s). 10 moored, 3 fishing boats at work |
| Ferry | **not identified for 1950 in any source read.** Unnamed; a small white passenger boat with a black funnel (designer's choice) crosses Fiskebäckskil - Lysekil (120 game m) |
| Names | modern (no differing 1950 spellings found); the lights are named too |

Dusk (the **Day / Dusk** button) lights the houses' windows (paraffin-warm) and the lit lanterns on their real flash pattern: emissive only, no lights.

## The ghost chart

Tap **Chart** (1700 only). Behind the sheet:

- **Pencil**: Today's shoreline as a faint graphite line, only where your Today chart was explored. Land outlines only: no names, no
  marks, no harbours, no lights (the module has no text code at all, and its test checks that).
- **Ink**: the 1700 shoreline in the game's ink colour, with the chart's land and sea tint, only where you have sailed in 1700. The
  edge fades with the game's own fog smoothing (`chart.js fogAlpha`), so it looks like the game's fog lifting. Where the water level
  moved the shore, pencil and ink disagree, and the pencil under the ink is drawn fainter.
- **Reset ink** blanks the 1700 chart; the pencil stays.
- Drag to pan, pinch or scroll to zoom. It opens fitted to whatever has been drawn.
- **Names come back once the ink covers them**, by the game's own rule (`src/seen.js`: some revealed land within 150 m of the label point), and only where a name is documented: Lusekijll (1578, uncertain), Guldholmen (1588), Hermanö (1673, uncertain), Kierlingøon (1659). Fiskebäckskil, Grundsund and Hälleviksstrand have no documented 1700 form, so they stay blank however much is inked. A reset forgets the names too.

The old chart (`?ghost=saved|demo|full`): by default the game's **saved chart on this device**, read through a read-only storage
wrapper (the lab never writes the game's key `windward.explored.v1`). With no saved game it falls back to a **demo**: fog lifted
along Grundsund - Fiskebäckskil - Lysekil - Gullholmen - Härmanö. `full` lifts everything. The 1700 ink has its own key,
`windward.explored.1700.v1`; sailing in Today inks nothing.

## URL

`?era=1700|1950|today` `?night=1` (dusk) `?near=<settlement or light id>` (start in the nearest open water, facing it) `?ghost=saved|demo|full` `?chart=1` `?info=1` `?touch=1|0` (phone controls or keyboard + HUD) `?zoom=<0.5-2.5>` (camera
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

- **The design note "Decided: the chart after the jump" has since landed** (GAME-DESIGN, Felix 2026-11-06) and the lab follows it: the old chart is a faint pencil ghost of the land you explored, with no names, harbours, marks or lights; hidden rocks are simply absent from the pencil (it shows safe water where one lies); sailing inks a real 1700 chart over it; places return one by one with their old names. **Not built:** Torhild teaching the old way of reading the coast (a story piece).
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
- Chrome's phone emulation was not used; the screenshots are a 390x844 frame in desktop Chrome with `?touch=1`, so the touch UI is
  the game's own phone controls, but real touch was not tried.

## Tests

`node games/windward/src/world-year.test.js` (era choice, water, hidden rocks, settlements, marks, names, `coastAtWaterLevel`),
`world-year-build.test.js` (builds BOTH eras from the real coast files: shore moved, hidden rocks solid but not surf, no lights or
buoys in 1700, sizes follow the data, Today equals the game's coast, ekas animate; about 10 s),
`ghost-chart.test.js` (contours, read-only chart, pencil vs ink rules, no text, ink picture, view fit), `world-1700-lab.test.js` (page
wiring, three eras, dusk, names by the seen rule, "cannot damage saved progress"), and `era-assets.test.js` (now also: no red on a 1700 cottage).
