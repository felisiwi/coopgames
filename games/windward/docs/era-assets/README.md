# Era assets (Today and 1700 kits)

Two low-poly kits to make the coast busy, plus a phone-first lab to look at them. **Nothing here is wired into
`game.js`**; it is new files only.

- `src/era-assets.js`: the kits. `createAsset(id, { variant, sails, night }) -> { group, setNight, describe }`, and
  `createCompare()` for the side-by-side. Each asset is also an `addX(S, G, opts)` function that stamps triangles into two
  shared meshers (opaque + window glass), so a whole harbour is 3 meshes.
- `era-asset-lab.html` + `src/era-asset-lab.js`: the lab (the game's own sea, sky, light and camera angle; same approach as
  `boat-lab.html`). Orbit and "game camera", Day / Dusk, triangle count, ◀ ▶ to step through assets, the address keeps the
  settings (`?asset=ferry&v=navy&night=1&rot=40&cam=game&zoom=1`, `?asset=compare&focus=1700`).
- `src/era-assets.test.js`: `node games/windward/src/era-assets.test.js` (13 checks: triangle budgets, determinism, sizes,
  dusk windows with no lights, materials, URL round-trip, the lab page's element ids).
- Screenshots here (the lab in a 390x844 frame): `compare-day.png`, `compare-dusk.png`, `all-assets-sheet.jpg` (12 assets,
  each a 390x844 view at half size), `panel-open.png`.

Try it: `era-asset-lab.html` (opens on the Today vs 1700 comparison), or `?asset=cottage&v=b`, `?asset=compare&night=1`.

## Triangles (measured)

| asset | triangles | budget |
|---|---|---|
| Sailboat (4 stripe colours; sails up / furled) | 232 | 800 |
| Motorboat | 188 | 800 |
| Ferry (line 847) | 434 | 3000 |
| Guest harbour (pontoon, 10 boats moored bow-in, merged) | 938 | 3000 |
| Summer house (4 paint colours) | 208 | 800 |
| Cottage (a turf, b tile + lean-to, c long + stone chimney) | 112 / 82 / 94 | 800 |
| Sea-shed (boathouse) | 78 | 800 |
| Drying racks (3 racks, ~39 fish) | 246 | 800 |
| Kummel (stone cairn) | 145 | 800 |
| Painted rock sea mark | 80 | 800 |
| Eka (a tarred + rust sail, b grey + linen, c ochre patched + nets, d sail brailed) | ~250 | 800 |
| Cargo boat (square sail) | 540 | 3000 |
| Today harbour / 1700 harbour (shore + everything) | ~3.6k / ~3.0k | 12000 each |

## Today kit

- **Sailboat / motorboat / moored rows**: white hull, white sails, a pastel cove stripe (navy, coral, sage, sand), teak deck,
  cabin windows. Rows use a low-detail version.
- **Ferry**: the Lysekil-Fiskebackskil passenger ferry, Vasttrafik line 847.
- **Summer house**: painted board walls (cream, sky, falu rose, sage), white corner boards and frames, slate roof, two big
  sea-facing windows, an open veranda (a roof over it would hide the windows from the high game camera), chimney.
- **Dusk**: windows are the only emissive thing, an unlit `MeshBasicMaterial` that turns warm (`setNight`), no new lights
  (the same reason `boats.js` builds its lantern without a `PointLight`: a new light recompiles every material).

### The ferry: what is sourced, what is not

- Sourced (gunnarsbatturer.com, "Invigning av var nya passagerarfarja Elise"): Elise replaced Carl Wilhelmson on line 847
  (Fiskebackskil - Lysekil south harbour) in 2024; up to 150 passengers; a salon with 70 seats; an open upper deck in warm
  weather; room for about 30 bikes in the bow; electric. Carl Wilhelmson stays as the spare boat.
- Sourced (sv.wikipedia, "Carl Wilhelmson (farja)", via a search result): the older ferry, built 1990, 27.37 (m, unit not
  stated in the source), 222 passengers.
- **Not sourced: the hull and stripe colours, and the exact length of Elise.** The model is a short white boat with an
  enclosed salon (windows all along), an open aft upper deck with two orange life-raft canisters, a small wheelhouse on top,
  a bike rack on the foredeck, a coral waterline stripe and a pastel-navy lower hull. **TODO(felix): confirm the real colours
  (a photo or the Vasttrafik livery); the code has the same TODO.**

## 1700 kit

- **Cottages**: small (about 3-4 m by 4-6 m, walls under 2 m), unpainted weathered grey timber in horizontal bands, one tiny
  window, a low door, a stone foundation. Roofs: turf with tussocks (a, c) or clay tile (b). Variant b has a lean-to, c a big
  stone chimney at the gable end.
- **Sea-shed (sjobod)**: tarred grey timber, big double doors in the sea-facing gable, a granite slip with two rollers.
- **Drying racks (hjallar)**: leaning A-frames carrying a long pole, split fish hanging in a row.
- **Kummel**: a heap of granite on a faceted cone core, a capstone.
- **Painted rock sea mark**: a granite boulder with a white limewashed patch on the sea side. Designer's choice for the
  colour (white reads best against the pink-grey granite); not checked against a historical practice.
- **Ekas**: the game's small clinker eka, varied: the sail tone, the hull weathering (tarred or grey), patches, nets, or the
  sail brailed up along the sprit. About 4.6 m, tarred dark hull (BOAT-BRIEF), tanned rust sail (`esail=rust`, Felix's pick).
- **Cargo boat**: about 11.5 m, broad double-ended clinker, tarred, a decked bow and stern, herring barrels in the open
  middle, an awning aft, a steering oar over the quarter, one **square sail** on a yard.

### Sources, and what they do not say

- **Not found: a source for the rig of a 1700 Bohuslan cargo or fishing boat.** Searches returned the fishery, not the boats.
  What they did give:
  - Local boat type names *kag* (fork-rigged), *julle* and *snipa*, on the boat-hall page of allmogebatar.se
    (https://allmogebatar.se/bohushallen/). The page gives no dates and no rig, so it names types but does not prove a
    square sail.
  - The 1700s herring fishery ran on large beach seines with crews of 12-20 and, in 1778, 358 seines and 661 associated
    boats (popularhistoria.se, "Sillen gjorde Bohuslan till ett Klondyke":
    https://popularhistoria.se/sveriges-historia/sillen-gjorde-bohuslan-till-ett-klondyke/).
  - The great herring periods lasted 50-60 years and the big one fell in the second half of the 1700s (vastsverige.com,
    "Sillens historia", https://www.vastsverige.com/tjorn/se-och-gora/sillens-dag/sillens-historia/).
  - The existing `docs/BOAT-BRIEF.md` references: *Vikingen* (Gullholmen, 1860s, two masts, brown sails, white hull with a
    black bottom) and the Digitalt Museum boat models. Those are the 1860s, later than 1700, so they were not used for shape.
- So the **square sail is a stylised choice** (a clinker Nordic working boat with one square sail is a plausible picture
  of the period, and it contrasts with the eka's spritsail), **not a sourced reconstruction**. TODO(felix): confirm against
  a museum model or a drawing (Digitalt Museum, Bohuslans museum) before this goes in the game.
- Cottages, sea-shed, racks and kummel are likewise built from the general picture (small grey timber, turf roofs, drying
  fish on hjallar, cairns as landmarks), **not from a specific surviving building or drawing**. The Gullholmen stone house
  (a very old house, now a museum, from a search result) is the one named period building I found; it is stone, and was not
  modelled. TODO(felix): a photo reference for cottages would let the proportions be checked.

## Today vs 1700 (the side-by-side)

`?asset=compare`: the same small granite islet (one shared shore, so the two kits stand on the same ground) twice, Today on
the far side (top of the north-up screen), 1700 below it, with a "Look at: Both / Today / 1700" switch. Day and Dusk apply to
both: at dusk the Today harbour glows with dozens of windows and a lit ferry, the 1700 coast has two small tallow-lit
cottage windows.

## Notes

- Waterline is y = 0 and boats point +Z, like `boats.js`. The sea is opaque at y = 0, so open boats have a floor above it.
- Facet size: hulls and houses are built from few large facets (finer than ART.md's 3 m on purpose for boats' clinker
  strakes, coarser for hulls); nothing is subdivided "because it is small".
- The open lab panel covers the model, as in the boat lab: collapse it (tap its title) to look.
