# Harbour approaches

Felix: "harbours matter most; he tried to sail into Grundsund and it's blocked." This work tests whether the boat can sail from open
water INTO each harbour (up to the quay water, not just to within 80 m) and carves the approach where it cannot. New files plus passes
data; **`shore.js` is unchanged** (decision 2026-11-06: no oriented hull, no smaller circle; narrow water is the close-ups' job).

## Files

- `assets/coast/harbour-audit.json`: all 49 targets: open / blocked, reach before and after, where it blocks, real topology (dead end / through-route / open coast).
- `assets/coast/passes.json`: 16 new passes, tier **`harbour`** (55 in all: 5 ship, 16 harbour, 19 later, 15 eye). `applyPasses(world, passes)` now carves **ship + harbour** by default (eye never).
- `src/harbour-approach.js`: quay water, `reachFromSea`, marks-aware fairway, `approachRoute`, `routeBetween` / `routeThrough` / `findRouteVia`, `carveHarbourRings` (keeps the quay line as land), `protectNear`.
- `tools/build-harbours.mjs`: `node tools/build-harbours.mjs --cache DIR` (Overpass: coastline, seamarks, quays, bridges; retries, a mirror, generic User-Agent; cached, so a re-run is offline and takes seconds).
- `harbours-lab.html`: before / after for all 49 harbours (quay and pier lines, red/green marks, the light, the boat 8 × 2.4 m to scale, the collision circle). Opens on Grundsund's south basin.
- `src/harbour-approach.test.js`: 10 checks, including **every harbour is reachable from open water with the current hull**. Screenshots (390x844): `carved-*.png` (16) and `open-*.png` (33) in this folder.
- Existing files I had to touch: `src/passes.js` (the `harbour` tier, default tiers), `src/passes.test.js` (a harbour approach may be widened more than ×2), `passes-lab.html` (shows the new tier).
- **Credit:** coastline, quays and marks are © OpenStreetMap contributors (ODbL 1.0); in both JSON files and the lab page.

## The carve shape follows the real banks

A first version carved a 65 m TUBE around a smoothed centreline, which looked like a straight cut. The carve now **grows the real water outward** by the boat's minimum
(the offset of the real banks), only where the real channel is narrower than that, so the outline follows both banks' bends at the same minimum width (60 m); where the
boat would still be blocked on a bend it adds a small local bulge, and at a pinch the 5 m raster has cut it adds a minimum-width disc. The centreline is routed over the 5 m
real-water raster (`refineLine`), not the 2 m game cells. Wide stretches and basins keep their real shape. (Cost: Grundsund's south approach removes 26,800 m² of land instead of 21,600 m².)

## The rule (Felix, 2026-11-06)

"In the harbour" = the boat's **centre** can get within **60 m of the quay water** from the open sea, with the game's own collision
(`HULL_RADIUS_M` 2.5). Reach each harbour BASIN; leave narrow inner channels to the close-ups.

**Grundsund** (reference: `ref/grundsund-skippo.png`): reached from both ends. The **north basin** (the guest harbour, Oc(2) WRG 8s light) is already
open (51 m from the quay water), and the village counts as in-harbour through it. The **south basin** (the fishing harbour / marina) is
carved from the south-west entrance past Skutevik (the green mark): 566 m long, a real **5 m** at its narrowest, carved to **60 m (×6)**, 26,800 m² of
land turned to water; the marina's piers and quay stay land. **The canal through the village is NOT carved** (it was historically shallow until the 1914-18 canal; sailing it is a Grundsund close-up feature).
Real widths: south-west approach min 5 m, median 46 m, p90 115 m (10% of the length under 15 m, 60% under 50 m); the canal min 9 m, median 37 m (stays closed).

## The list (49 targets)

- **33 open:** 26 as they are, 2 only after the ship batch (Vrakevik, Stångholmesunds småbåtshamn), and 5 villages whose own point is on land, so they count through their real harbour (Grundsund via the guest harbour, Fiskebäckskil, Käringön, Lysekil, Hälleviksstrand).
- **16 blocked and carved:** Grundsunds Marina (×6), Gullholmen, Bredholmen, Usholmen (×1.5), Porsholmen (×1.9), Assholmen (×1.7), Vasholmarna (×1.2), Testholmen, Dammholmen (×1.4), Danholmen (×2.4), Kråkholmen (×2.2, Felix's pin), Härmanö (×3.5), Stockens gästhamn (×2.9), two small-boat harbours called Småbåtshamn (×1.3, ×1.4), Gullmarsstrands småbåtshamn. Most are small cove entrances of 28 to 140 m.
- **Widened more than ×3 (look at these):** **Grundsunds Marina** (5 → 60 m, 566 m long, ×6) and **Härmanö** (17 → 60 m, 72 m long, ×3.5).
- **Real topology** (does the harbour have a second way out?): *through-route* Grundsund, Usholmen, Porsholmen, Danholmen, Stångholmesunds småbåtshamn (not carved: close-ups); *dead end* Testholmen, Kråkholmen, Gullmarsstrands småbåtshamn, Stockeviks småbåtshamn, one Småbåtshamn; the other 39 have open water at the quay.
- The arrival's name-list villages (Fiskebäckskil, Käringön, Lysekil, Hälleviksstrand, Gullholmen via its harbour) are open.

## Where the marks are

OSM has no red/green marks that lead into these approaches (only the Grundsund hamnfyr light, one green lateral at the Skutevik exit, and
laterals near Gullholmen and one Småbåtshamn). The routes follow the real channel; the marks' fairway is supported (it prefers a marked channel)
but changes no route here.

## The collision-shape study (no change made)

Measured on Grundsund (on the earlier straight-tube carve), sailing the exact centreline: minimum carve width for the circle (today) **70 m** (south-west) / 65 m (canal); an oriented
8 × 2.4 hull **60 m** / 65 m; a smaller circle r 1.5: 50 m / 50 m. The 2 m raster cells are the limit (about three cells, 60 m, are needed): an oriented hull
saves about one cell. Without carving, the oriented hull opens only 3 more of 49 harbours within 60 m. Turning around fully in place (a disc of radius 4) fits at
12 of 49 quays versus 49 with the circle. Decision: not worth changing now.

## Caveats

- "Closed" for villages and islet harbours uses the nearest real water to an approximate point; the 12 or so island coves are marginal (65 to 125 m before, 29 to 53 m after).
- The depth model in the raster is a placeholder; carved water is 1.8 m deep at the edge to 4 m in the middle.
- Verify on the phone: the two big carves by eye, and that the 60 to 90 m channels feel right to sail. TODO(felix).
