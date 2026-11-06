# Stage 1c: the chart and the new look (2026-11-05, branch `felix/windward-chart`)

Real coast, today's coast, free sail. Not merged. Everything below was checked in headless Chrome at 390x844 (iPhone 13
emulation, touch) with zero page errors and zero console warnings.

## What is in

**Batch 1, new look.** Terrain style merged (`felix/windward-terrain-style`) and attached in `loadRealCoast` with Felix's values
(`STYLE_GAME`: crisp 1, soft 0.82, rock 1, slope 55, grain 1, terraces and lines off). `?preset=` and the single style keys still tune it in
the game; `?preset=current` is the old look. Trees skip ground the slope rule paints as granite (`makeGraniteTest`, the CPU twin of the
shader's rule). Boats: `src/boats.js`; today = Svalan (koster, gaff + jib, deck items, wear 0.8), player colour = masthead pennant only;
`?boat=eka` for the eka (rust sail). The harbour-moment fish slots follow the boat type. `PCFSoftShadowMap` -> `PCFShadowMap` (game and labs).

**Batch 2, zoom and minimap.**
- Zoom out to 4x (was 2.5x) in the boat view, then it turns into the chart; keeps zooming to the whole coast (zoom ~286 at 390x844).
  One gesture both ways. `src/zoom.js` (the maths: the chart is drawn tilt-, turn- and scale-matched to the 3D camera, tested against a real
  perspective camera), `src/chart-controller.js` (state), `src/zoom-input.js` (wheel, pinch).
- Pinch only counts when both fingers land within 150 ms (the phone's second finger is the sheet, so a later second finger never zooms).
  +/- buttons (bottom left, away from the sheet thumb) and the wheel also zoom.
- Far sea: a coarse flat ring round the water tile (`farRingGeometry`, ~3k triangles), same shader, no waves, so the sea reaches the horizon at
  the new zoom without growing the 142k-triangle wave tile.
- Minimap (`src/minimap.js`): about 320 m across, built from the game's own height field a few rows per frame: depth in four blues, awash rock hatched,
  low rock vs land, coast line, buoys, harbours (square = village, ring = natural harbour), lighthouses. Fixed look (Felix's pick): round and north up, no settings button
  and nothing saved. Tap a lighthouse on it to visit.

**Batch 3, the chart.**
- Chart (`src/chart.js`): the Map Lab's two pictures (`assets/chart/`, extracted from `ref/map-lab.html`, geography in `chart.json`), the 7 sections
  (only "The Shallow Sounds" is granddad's, the rest "uncharted"), fog over what you have not sailed (`src/explored.js`: 24 m cells, lifted within
  150 m of the boat, saved in localStorage `windward.explored.v1`), names by the discovery rules (real name + description once found, the
  description alone where the fog has lifted, nothing for an undescribed skerry you have not found).
- Lighthouses are places now (`kind: 'light'` in the name list): Hättan, Måseskär, Gäven, Islandsberg, Stångehuvud and three more in the window.
  They show on the chart and minimap from the start. Tap one on either: the camera glides there, the boat stays put, a card names it, "Back to the
  boat" returns. The 21 lights outside the playable window are icons only ("beyond your chart, for now").
- `?debug=1` adds "Jump here (debug)" to the visit card: the boat moves to open water beside the lighthouse.
- Islandsberg and Stångehuvud finally have a place (they are the lighthouses), so their descriptions attach.

## Decisions (Felix: change any of these)
1. **Zoom-to-chart = scale-matched crossfade** (not a Chart-button-only overlay, not a 3D pull-back). The Chart button exists too.
2. **Pinch** needs both fingers down within 150 ms; otherwise the second finger is the sheet. Buttons are the fallback.
3. The 3D render is paused once the chart fully covers the view.
4. Descriptions for lights come from `place-names.json`; "built <year>" on the card is from `LIGHTHOUSES.md`.

## Measured (headless, software GL: counts and CPU matter, fps does not)
At Fiskebäckskil, boat idling, 390x844 emulation, 3 runs of 6 s, `Performance.getMetrics` (main-thread CPU per frame):

| | triangles / draw calls | JS ms/frame | main-thread task ms/frame |
|---|---|---|---|
| main (aa4bdc0) | 329,130 / 150 | 1.33-1.39 | 1.75-1.81 |
| this branch, boat view | 315,344 / 158 | 1.55-1.58 | 2.00-2.06 |
| ... minimap switched off | | 1.49 | 1.96 |
| max boat zoom (3.9) | 339,144 / 231 | 1.76 | 2.31 |
| mid-blend (3D + chart) | 359,440 / 239 | 2.02 | 2.60 (the peak, for a moment) |
| chart up, zoom 40 | 3D not rendered | 1.01 | 1.54 |
| full chart | 3D not rendered | 0.75 | 1.28 |

So the whole stage costs about +0.2 ms of main-thread CPU per frame in the boat view (the minimap ~0.06 of that), and the chart is cheaper than sailing.
Main logs `PCFSoftShadowMap has been removed`; this branch logs nothing. Style bake adds ~220 ms to the load (software GL; the chart pictures load in the
background ~2.5 s after the game starts, 1.1 MB).

## Known gaps / TODO(felix)
- Real-phone fps is still Felix's read (the Pixel held 60 at 634k triangles; this is far under).
- The overview picture's tile seams are repainted by `tools/clean-chart-seams.py` (the cut edges of water bodies at the old tile borders stay straight: the data ends there).
- Uncharted sections stay blank for now: there is no way to "sail there" and chart them yet (the whole playable window is inside the start section).
- Lights outside the start section are not drawn on the chart any more (an uncharted section shows nothing).
- Stora Kornö ("the barley isle") is still outside the playable edge. Gullholmens Gästhamn has no coordinate of its own.
- Reveal radius (150 m) and minimap span (320 m) are first guesses: tune by feel (`REVEAL_M` in `src/explored.js`, `MINI.spanM` in `src/minimap.js`).

## Phone checklist
1. Load the preview with `?debug=1`. Sail from Grundsund: the round minimap top-left shows the sound, the harbour mouths (squares/rings), buoys, the way out in deeper blue.
2. Zoom out with two fingers (both down at once). Past the boat view it unrolls into the chart; keep going to the whole coast; zoom back in to land on the boat.
3. Try +/- and the Chart / Boat button. Check that steering (one finger) still works, and trim with the rope (bottom-right, below).
4. The minimap is always round and north up (no gear button).
5. On the chart: red outline = granddad's sheet, the rest uncharted (tap one: a note). Fog lifts where you sailed; reload, the fog is still lifted.
6. Tap a gold lighthouse on the chart or the minimap: the camera glides there, the boat stays; "Back to the boat". "Jump here (debug)" moves the boat.
7. `?boat=eka` for the 1700 eka. `?preset=current` for the old terrain look.

## 1c revision (phone test, 2026-11-06)
- Chart: your boat is an arrow along its heading (a friend's is blue). Uncharted sections: plain parchment + big lore name + "UNCHARTED", no coast, no markers.
- Names: nothing is named or sighted until the fog has lifted over some LAND of the place (`src/seen.js`; a big island's centre is inland, so any land within 150 m of its label point counts). After the announcement an island/skerry name goes quiet (small, 60% opacity, only while the island is on screen); villages, harbours and lights keep their sticky edge tags.
- Navigate here: tap a lighthouse or a discovered place on the chart (or a lighthouse on the minimap) -> card -> "Navigate here". One target; a gold tag with distance (game metres, same scale as the knots) follows the screen edge towards it; arrival (45-90 m) or the cross clears it.
- Trimmed: the sweet zone glows steadily, the dot grows a white ring, a small "trimmed" word sits by it (and the desktop trim bar does the same).
- A lighthouse visit now puts its description/name label up in the world.
Phone checklist additions: tap a discovered place on the chart -> Navigate here -> sail, watch the tag and distance, cross to cancel; sail past an island: a small faint name; trim the sail: the glow and "trimmed".

## The rope (final, Felix picked the block version after comparing three)
Bottom-right on phones, for one-handed sailing. Soft warm-grey hemp (not yellow) hanging from a small round navy pulley block at the TOP, as if from the boom, with a visible three-spoke sheave; you pull the hanging tail, and nothing is at the bottom but the rope's end. Few details: faint tone-on-tone strand lines that run along the rope while you swipe (down when pulling in, up when letting out, at the swipe's speed, easing to a stop after you let go: `ropeScrollStep`, `ROPE_COAST_RATE`). The sheave turns with the rope, driven by the same velocity (clockwise pulling in, the other way letting out, `sheaveStep`; flip the sign there if it looks backwards on the phone). A new finger on the rope takes it over from a stale one, so a missed lift cannot leave it dead.
- Swipe down on the rope to pull in, up to let out, relative to the current trim (one rope length = the whole range), so nothing jumps on touch. The touch zone is 84 px wide although the rope is thin; a finger on it never steers, so the other hand steers on its own.
- Four small yellow chevrons flow along the rope the way to trim (down = sheet in, up = ease) and fade out when the sail is trimmed. They are the only yellow. The rope shows no trimmed cue of its own: the dot and arc by the boat (and the desktop trim bar) are the readout.
- The second-finger sheet and its ghost hint are off (`SECOND_FINGER_SHEET` in `src/phone.js`); a second finger away from the rope is ignored. Keyboard trim unchanged; the rope is phone-only, hidden while the chart is up, and names keep clear of it.
- Code: `ropeGeom`, `swipeTrim`, `ropeNeed`, `ropeGuideStep`, `ropeScrollStep`, `drawRopeControl` in `src/phone.js` (tests in `src/phone.test.js`).
Units: knots for wind and boat speed (no m/s), nautical miles for distances ("0.4 nm", "< 0.1 nm"), 1 nm = 1852 m on the same scale as the knots, so 0.4 nm at 6 kn is four minutes.
Rope checklist: touch the rope's edge without swiping, nothing changes; swipe down/up, the stripes run with your finger and coast to a stop; chevrons point the way to trim and fade when trimmed; steer with one thumb and swipe with the other; a second finger on the water does nothing; Navigate here, the tag reads in nm. (Headless runs at ~5 fps, so the stripe speed and easing are only judged on a phone.)
