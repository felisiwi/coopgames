# Sail-feel lab

A phone-first lab for the weather and sail-feel decisions in `docs/ALIVE-SEA.md` ("Grill: weather and sail feel", 17 settled decisions).
It sails the real coast around Skafto (1950 or today) through a game day, so Felix can feel gusts, lees, shifts, swell and squalls
before any of it goes into the game. **New files only: nothing in the game was edited.** The game's world, sea, boat, sky, phone
controls and `sail.js` `boatSpeed` are reused; only the wind is replaced.

Open `games/windward/sail-feel-lab.html` (on the phone: add `?touch=1` on a desktop browser). All settings live in the URL; the lab
uses no localStorage at all. **Copy this setup as a link** (in the panel) gives an exact setup to send.

## Files

| File | What it is |
| --- | --- |
| `src/weather.js` | The day's weather: a fixed function of `(daySeed, gameTimeS)`. Four day types, a 30 minute game day. Pure. |
| `src/wind-field.js` | `windAt(x, z, t)`: day wind + shifts + gust/lull patches + island shadow + funnelling + utomskars boost + squall + story override. Pure. |
| `src/squall.js` | Squall line plan (unsettled days) and `squallAt`. Pure. |
| `src/sail-feel-swell.js` | The swell and the surf rule. Pure. |
| `src/sail-feel-model.js` | Light-air floor, heel, luff flutter, squall overpower, camera feel, spray, wake, weather look. Pure. |
| `src/sail-feel-params.js` | URL <-> settings. Pure. |
| `src/sail-feel-water.js` | Patches the game's water shader at runtime (gust/lull paint, storm line, swell). Throws if `water.js` changes shape. |
| `src/sail-feel-fx.js`, `src/sail-feel-weather-fx.js` | Spray, wake, camera; rain, mist wisps, cloud bank. |
| `src/sail-feel-panel.js`, `src/sail-feel-lab.js`, `sail-feel-lab.html` | The panel and the page. |
| `src/wind-map.js` | Node tool: draws `windAt` over the real coast (`docs/sail-feel-lab/wind-map-*.png`). |

Tests (`*.test.js` beside each module): `cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done`.
Every number below is in one exported constants object per module (`WEATHER`, `WIND_FIELD`, `SQUALL`, `SWELL`, `FEEL`), with comments.

## What each toggle does

**Wind** (these change the wind itself, so the boat feels them)
- **Shifts**: the direction wobbles +-20 degrees at most (a slow swing about every 100 s plus a quicker one every 55 s); a shift rolls through the area at 8 m/s.
- **Gusts and lulls**: patches that live in the air and drift downwind. Gusts +30 to 50%, lulls about -40%, each lives 30 to 60 s, streaks 1.6x longer along the wind than across. About 28% of the sea is in a visible patch; a phone window has one in view more than half the time.
- **Island shadows**: smooth calm in the lee of land (up to -80%, reaching 14 x the land's height downwind).
- **Funnelling**: land close on both sides across the wind (a sound along the wind) gives up to +35%.
- **Utomskars: stronger, steadier**: open water (long fetch upwind) is +25% and its gusts and shifts are half the size. This is measured from the real coast, per wind direction.

**Sea**
- **Swell and surfing**: a 26 m long swell (0.15 to 0.85 m high, following the sea state) rolls in from the W/SW, only in open water (flat among the skerries). On a broad reach or run you get up to +3.2 m/s riding down a crest's front.
- **Squalls and showers**: on unsettled days 2 to 3 squalls between 10:00 and 20:00: wind +60%, a ~30 degree swing, 1 to 2 minutes, a dark line then dark water with whitecaps, rain, and light dimming. Soft only: an overpowered boat loses up to 45% speed unless you ease the sheet or round up. The camera sees only ~100 m, so the warning is a storm glow on the screen edge it comes from with a countdown ("Squall - 41 s"), the calm before the front, and the light dimming.
- **Weather mist (low visibility)**: the misty morning is thick at dawn and burns off by ~12:00. Cool grey-white fog pulled in close, drifting wisps. Deliberately not the game's exploration fog.

**Feel**
- **Camera dip and tighten**: lower and closer with speed (12 degrees, 20%), pulls back when slow.
- **Look ahead**: the view slides ahead of the bow (up to 45 m north-bound, less sideways: a portrait phone is narrow). This matters for the key test: see below.
- **Bow spray**, **Heel** (leans to leeward in gusts and strong wind, less running; eased sheet reduces it), **Luff flutter** (the sail flaps when headed by 3 to 12 degrees, or pointing within 38 to 26 degrees of the wind), **Wind arrow** (the fallback).

## Panel

Top-left pill = the live readout. Opens a paper card: today's wind (true wind here, the day's wind, "in a gust / lull / lee", boat speed, off the wind, inside/outside the skerries, next squall, sea state and visibility), day type and seed, time of day (+ stop the clock, fast-forward x10), start points (Grundsund / inside the skerries / utomskars), every toggle, and four sliders: gust drift (share of the wind), camera distance, spray, heel.

## URL params

`?day=sea-breeze|grey-westerly|misty-morning|unsettled` `?t=14:00` `?seed=7` `?ff=1` (clock x10) `?freeze=1` `?off=gusts,spray` (layers off; ids: shifts gusts shadows funnel boost swell squalls mist dip look spray heel luff arrow) `?zoom=1.4` `?drift=0.4` `?spray=1` `?heel=1` `?era=1950|today` `?start=spawn|inside|outside` `?panel=1` `?debug=1` (fps) `?touch=1`.
`?demo=gust|lee|heel|swell|squall|mist` sets up a ready scene (clock, day, boat, camera). Examples:
- gust ahead: `?demo=gust` (sea-breeze 14:00, a strong gust ~50 m north of the boat, outside)
- a lee: `?demo=lee`; a heeled boat: `?demo=heel` (16:00, fresh); swell: `?demo=swell` (17:00, broad reach); squall: `?demo=squall` (50 s out); mist: `?demo=mist` (07:00)
Test hook: `window.__sfl` (e.g. `__sfl.hold = true` freezes boat and clock for a still picture).

## Findings worth knowing

- **Seeing a gust 10 to 20 s ahead.** At the game's camera distance the top of a 500 x 757 screen sees only ~54 m ahead (about 8 s of sailing). The lab defaults to camera distance x1.4 and a 45 m look-ahead: ~75 m standing, ~120 m at speed (~15 s). Patches also drift at 40% of the wind's speed (real gusts ~100%) so they are slow enough to see; both are sliders.
- Gust patches in the first version were a postage stamp (0.6% of the sea): the bump shape was too peaky. Now plateau-shaped and streaked.
- The wind paint costs 6 to 17 ms if built in one go; it is built 6 rows a frame (about 2 ms a frame).
- The sea's wind waves follow the day's wind and sea state, not the local gusts, so the sea does not shimmer when a gust passes.
- `wind-field.js` needs `heightAt` (land > 0.7 m) and the world bounds; it caches a coarse grid per 5 degrees of wind direction (about 1 ms to look up, a few ms to build each bucket the first time).

## Not decided / for Felix's phone

Whether gust contrast, the squall's flecks, spray and heel are too much; the right gust drift; whether the camera dip is wanted; the swell's height. Adopting into the game (`game.js`, `config.js`, `sail.js`, `phone.js`, `wind.js`) is a separate mission after Felix has felt this.
