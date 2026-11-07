# Weather in the game (2026-11-07, agent 2)

The sail-feel lab's defaults, put into the real game (branch `felix/windward-weather`). Felix judges it by sailing his normal routes. The lab and its
toggles are documented in `SAIL-FEEL-LAB.md`; the design is `ALIVE-SEA.md` ("Grill: weather and sail feel", 17 decisions). This file records what the
game does, the decisions taken with evidence, and what is NOT verified.

## What you get

- **Wind from the weather**, on the real coast (1950, 1700 and Today): a day with a rhythm (light morning, sea breeze filling in, fresh afternoon), shifts,
  drifting gust and lull patches, calm lees behind islands, funnelling, a stronger and steadier wind utomskars. New session starts at **11:00**; a game day is
  30 real minutes. Day type comes from the hub's launch seed (4 types).
- **Seen on the sea**: gusts darker, bluer and flecked; lulls and lees pale and glassy; a swell outside the skerries that shows as foam-bright crest lines over
  darker troughs (flat inside). `docs/weather-into-game/*-before-after.jpg` (500x757).
- **Speed feel**: surf burst down a crest's front on a broad reach or run; heel to leeward; luff flutter when headed; bow spray; a wake that grows with speed;
  the camera rests at x1.4 (the game's was 1) and dips, tightens and looks ahead with speed (gusts show ~15 s early).
- **Squalls** (unsettled days): a warning glow on the screen edge it comes from with a countdown, the calm before, then wind +60% and a ~30 degree swing, a dark
  line and whitecaps on the water, rain, dimming light. Soft: an overpowered boat loses up to 45% speed unless you ease the sheet or round up. No damage.
- **Weather mist** (misty mornings): cool grey-white fog pulled in close and drifting wisps; not the exploration fog.
- URL: `?weather=0` the old behaviour (random wind, old sea paint, old camera), `?day=sea|grey|misty|unsettled` (or the full names), `?t=HH:MM`, `?debug=1`
  adds a `weather` line (day type, game time, wind at the boat, "+x% vs the day", open/shadow, visibility, rain, next squall) and a `gpu` line (what precision this device runs shaders at),
  **`?squall=soon`** a test squall that reaches the start ~60 s after the weather starts, on any day type (see below), `?fp16=1` (debug) runs the water shader the way a 16-bit phone GPU would.

## Decisions, with evidence (`src/game-weather.test.js`, 18 checks, plus live runs)

- **One light-air floor: main's** (`sail.js` `effectiveStrength`, `LIGHT_AIR_BREAKPOINT` 0.6 / `LIGHT_AIR_FLOOR` 0.25). The lab's own floor (2.2 m/s) is deleted;
  keeping both would have floored a calm twice. `labTargetSpeed` is now just `boatSpeed`.
- **Game time**: weather time = 11:00 + the game clock (`game-clock.js`) + an offset. A solo pause freezes the clock and so the weather (seen live: the pause card
  froze it). In co-op the clock runs on wall time (`pause.js`), so does the weather.
- **Co-op needs no wind messages.** Both phones run the same pure `windAt()` from the same seed and the same weather time. The host's `wind` message keeps
  `dir, strength, seq` (the wind at its boat) and gains `wx` (weather time, seed, day type, story-override events, ~230 bytes). Why keep it: a guest's wall clock can
  differ from the host's by seconds or minutes, so one message lines the guest's weather time up (and it re-checks every 2 s, tolerance 0.4 s); the guest also follows
  a `?day=` on the host's URL and the host's story wind. **Old guest page:** it reads only `dir, strength, seq`, ignores `wx`, and gets a fresh wind every 2 s (tested
  with the old handler as a function). **Old host, new guest:** no `wx` -> the guest drops back to applying the host's wind (tested). A friend joining resyncs the
  host's clock; `rebase()` keeps the weather time continuous across it.
- **The first errand's wind is a use of the field's story-override hook** (`setPhase(beats.phase)` -> override events), same targets and swing as `errand-wind.js`
  (which is untouched, with its tests). Verified live by stepping the beats in the real game: errand 10.4 m/s from straight behind yard->Grundsund, return swings
  (4 s) to straight behind the way home, `help` hands back through override 0.48 to 0 and the natural wind. A game loaded at any phase has it from frame 1.
- **The opening's storm stays scripted**; weather starts when the game starts (after the opening), checked with `?opening=1`.
- **The sea follows the day's wind and sea state, not the gusts**, so waves do not shimmer when a gust passes.
- **The weather's look is applied around the draw calls and restored**, so the dawn and the strange moment (which tween the same CONFIG values) are untouched.
- **The feel fades out** toward the chart (its scale is matched to the zoom) and on lighthouse visits; the chart controller got a `homeZoom` option (default 1).
- No new or renamed localStorage keys.

## Performance (desktop Chrome, 500x757, display capped at 120 fps; JS ms per frame = time inside the game's animation-frame callbacks)

| Spot | Weather on | `?weather=0` |
| --- | --- | --- |
| Inside the skerries (Grundsund) | 120 fps, 1.63 ms, 65 draw calls, 341k tris | 120 fps, 1.55 ms, 58 draw calls, 298k tris |
| Open water | 120 fps, 1.67 ms, 42 draw calls, 200k tris | 120 fps, 1.70 ms, 52 draw calls, 200k tris |

The weather's CPU cost is within noise. The wind paint is built 6 rows a frame (~2 ms) and the coast grid is kept warm ahead of the wind. The pulled-back camera sees
more terrain inside the skerries (+43k triangles). **Not measured:** a real phone's GPU (the checks were on a desktop GPU).

## Not verified / honest limits

- **Co-op was not run live** (two real peers over PeerJS): the protocol is proven by tests only (host, new guest, old guest, old host, skew, day follow, story events).
- The first-run 1950 story was not played end to end; the errand, the opening, `?jump=britta`, `?year=2015`, the chart round trip and the pause were each checked.
- **The phone's shader precision is unread** (see the update above): ask for the `gpu` line from `?debug=1`.
- Luff flutter is covered by unit tests and the lab; not looked at in the game by eye. Lighthouse visits use the old camera path by construction (feel off) but were not driven.
- Visual taste is Felix's: squall whitecap size, crest foam strength, gust contrast, the x1.4 camera, how long the 45% squall slowdown feels.

## Update: the blocky sea on a phone (fixed) and `?squall=soon`

**Blocky water.** Felix's Android phone showed the whole sea covered in hard-edged squares (~30 to 40 px) with the weather on, inside and outside the skerries; `?weather=0` looked normal. Desktop never did.
- **Cause (mechanism proven, the phone's own precision not yet read):** my new water-shader code did high-frequency noise on large absolute world coordinates (x ~ 2500, z ~ 8100, less the air's drift of
  thousands of metres). A fragment shader at 16-bit precision (mediump) can only represent a number near 4000 in steps of 2 (near 8000 in steps of 4), so `fract()`/`floor()` noise collapses into flat
  squares. A desktop GPU runs the same code at 32 bits, so it was invisible there.
- **Evidence:** `?fp16=1` (new, `src/shader-fp16.js`) rounds the shader's coordinates to 16 bits. At the same spot: weather on, 32-bit = smooth (`docs/weather-into-game/blocky-water-before-after.jpg`, bottom row);
  weather on, 16-bit = a mosaic of hard rectangles (top left), which is Felix's description. Measured on the noise itself (CPU port of the shader's noise): under 16-bit coordinates the old low-frequency lookups were
  barely harmed (mean error 0.006 to 0.014), the three new ones badly (0.13 to 0.22; 0.25 = uncorrelated), wrong by >0.15 over 31 to 58% of the visible sea. That also explains why `?weather=0` looked normal: its few
  high-frequency terms are faint (it shows faint tiles under the emulation too).
- **Not proven:** that Felix's phone runs mediump. A desktop reports `mediump 23 bits` (full precision), so it cannot show it. `?debug=1` now prints a `gpu` line (`fragment highp N bits, mediump N bits`): a phone
  that prints `mediump 10 bits` confirms it. WebGL2 requires highp in fragment shaders, so a modern phone *should* have it; if the line says 23 bits and the mosaic still shows, the cause is something else and this
  fix will not have cured it.
- **Fix (`src/shader-local.js`, `src/sail-feel-water.js`):** the fragment shader only ever sees small numbers. The vertex shader (always full precision) passes `vLocal`, the position relative to the camera target; the target's absolute
  position and the air's drift are folded into small offsets in JS (64-bit) and wrapped into a 128-cell *periodic* noise lattice (`vnp`), which gives exactly the value the absolute coordinate would (tested to 1e-6).
  The wind-texture lookup and the baked shore/depth lookup are local too. Under the 16-bit emulation the mosaic is gone (top right of the image). Tests: `shader-local.test.js` (seamless wrapping; 16-bit regression: old form wrong over >20% of the sea,
  new form under 0.01 mean error), `sail-feel-water.test.js` (the weather block never reads `vWorld`).
- **What remains:** under the emulation two or three small faint pale rectangles are still visible. They come from the game's ORIGINAL wind-line code (it feeds large coordinates into `sin()`), which the weather does not touch; they
  are also there with `?weather=0` under the emulation. Not changed (Felix called `?weather=0` normal). If the phone does turn out to be mediump and they bother, they are a small follow-up.

**`?squall=soon`.** A test squall for people who do not want to wait for an unsettled day's first squall (often many real minutes away). It adds one squall that crosses the session's start 60 s after the weather's
start (`GAME_WEATHER.SQUALL_SOON_S`), on ANY day type, on top of the day's own. The warning (glow on the screen edge it comes from, an arrow and a "Squall - N s" countdown) is up from the first frame (a squall 60 s away is
~540 m off: cloud 0.23) and gets stronger as it nears; then wind +60%, a ~30 degree swing, dark water, rain.
- **Same on both phones, no messages:** the arrival time is the weather's start hour (11:00, or `?t=`) + 60 s, so two phones that start the weather the same way derive the same squall from the seed and the clock; the
  squall's direction, length and offset come from the seed (`makeSquall`). The one case that differs: a guest whose link does not carry the host's `?t=`. It adopts the host's arrival time from one number (`ss`) in the `wx`
  the host already sends in its `wind` message (no new message type; an old guest ignores it). Tests: `game-weather.test.js` (5 new checks).
- Counts from when the game starts, not from when you tap "Set sail" on the first-run card, so reading that card eats a few seconds of the 60.
- **Warning readability at phone size (500x701 here; Chrome will not go narrower):** the first version was a faint darkening and a 13 px label, clipped at the left edge and over the zoom buttons. Now: a broad glow centred on the
  edge or corner the squall comes from (strong from the start, ~0.6 of full at 54 s), a 17 px high-contrast label with an arrow, kept fully on screen and inset clear of the corner buttons and the minimap. Checked at 54 s, 26 s and arrival.
