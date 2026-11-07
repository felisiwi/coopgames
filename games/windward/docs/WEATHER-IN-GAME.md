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
  adds a `weather` line (day type, game time, wind at the boat, "+x% vs the day", open/shadow, visibility, rain, next squall).

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
- Luff flutter is covered by unit tests and the lab; not looked at in the game by eye. Lighthouse visits use the old camera path by construction (feel off) but were not driven.
- Visual taste is Felix's: squall whitecap size, crest foam strength, gust contrast, the x1.4 camera, how long the 45% squall slowdown feels.
