# The busy coast (era-driven)

A coast that is alive: boats sailing past you, harbour-to-harbour traffic, cruising and fishing boats offshore, the Lysekil–Fiskebäckskil ferry (line 847),
guest harbours full of moored boats, summer houses among the fishermen's cottages, and windows ready to light at dusk. **Everything era-specific is data**:
which boats, how many, which ferry, by year. The modern "Today" kit is only a **placeholder** for the 1950 and 1980 eras until a 1950s kit exists.

Branch `felix/windward-busy-today`, not merged. Try it (solo entry, with the debug panel):

| URL (after `games/windward/index.html`) | What it does |
|---|---|
| `?debug=1&cat=11.4157,58.2160` | Grundsund (the real start), Today profile (the default, year 2015) |
| `…&year=1950` / `…&year=1980` | those profiles: fewer boats, emptier harbours, fewer summer houses (modern placeholder kit) |
| `…&busy=0` | the busy coast off (= `main`) |
| `…&night=1` | the dusk hook: windows lit |

`?cat=lon,lat` starts at the open water nearest that point. Starts: Lysekil `11.4229,58.27617`, Fiskebäckskil `11.4578,58.2502`, Gullholmen `11.40476,58.17695`,
Käringön `11.36333,58.11327`. The `−` button zooms out; **two steps is the widest 3D view (about 60 x 140 m on a phone)**, a third step switches to the chart.

## What changed after the phone test (Felix, 2026-11-06)

1. **The ferry docks slightly off its quay, in clear water.** The dock point slides back along the approach until the whole hull (plus a 3 m gap ahead of the bow, and
   1 m of clear water round it) is free of shallows, and until it is clear of the story harbour's gate lane and the harbours' ways in. Measured: the bow is
   **7.3 m from the shallows at Lysekil and 4.3 m at Fiskebäckskil**, never wedged, and 40 m from the Fiskebäckskil harbour gate. The ferry backs out along the lane it
   came in on, swinging 180° as it leaves (the turn direction is fixed once: at exactly 180° "the shortest way round" flipped between frames, a bug found and fixed).
2. **The ferry is play-scaled: 14 m, 1.75 x Svalan's 8 m** (the kit models it at 24 m; the profile's `ferry.lengthM` sets the size, the engine scales). No other boat is
   large: the biggest sailboat any profile asks for is 9.6 m (1.2 x Svalan).
3. **More boats at sea.** Boats waiting at a quay: **1% of the time** (was most of them): quay stays are 2–6 s, and 32 of 36 scheduled boats are out sailing or fishing:
   harbour routes (2 boats each, spread round the cycle), **8 offshore cruising loops** round named islands, **4 slow fishing circles** in open water. On top of that:
4. **Ambient boats: a pool that always sails past you** (see below). This is what puts boats on your screen: with fixed routes alone the view (about 1/23 of the area I
   first measured) was empty most of the time.

## Screenshots (390 x 844 CSS px, looked at)

`docs/busy-today/`: made with `phone-frame.html` (the game in a 390x844 iframe, scaled to 88% to fit a small window).

| File | Shows |
|---|---|
| `ferry-at-berth-fiskebackskil.jpg` | the 14 m ferry lying off Fiskebäckskil's shore with its bow gap, sailboats and moored boats round it |
| `ferry-at-berth-lysekil.jpg` | the ferry off Lysekil Södra hamnen, with sailboats under way and boats on buoys |
| `several-boats-under-sail.jpg` | five sailboats with sails up round the player, at the widest 3D zoom |
| `busy-harbour-gullholmen.jpg`, `busy-harbour-lysekil.jpg` | guest harbours: boats on buoys (orange balls) and alongside the shore |
| `traffic-at-sea.jpg` | a sailboat under way beside the player |
| `summer-house-karingon-day.jpg`, `dusk-windows-karingon.png`, `summer-house-gullholmen.jpg` | summer houses, day and dusk |

## How it works

```
data/busy-world.json   ERA-NEUTRAL geometry, planned offline on the real coast by tools/plan-busy-coast.mjs: the ferry route + its two docks, 20 routes
                       (8 harbour-to-harbour, 8 cruising loops, 4 fishing circles; class sail | motor | fish), 68 berths in 9 harbours
data/busy-eras.json    ERA PROFILES by year: kit, which assets per class, how many boats (+ ambient), speeds, ferry (length, speed, dwell), mooring fill, house share
src/busy-kits.js       KITS: asset id -> builder function (+ window glass colour, buoy colour). 'today' = era-assets.js (placeholder for 1950, 1980)
src/busy-era.js        pure: profile for a year, validation, which boats an era runs, which boat a route / berth gets (deterministic from a seed)
src/busy-route.js      pure: where a boat is at time t (lines, loops), which way it points, when it gives way
src/busy-ambient.js    pure: the ambient pool's legs (a straight stretch of open water that passes near you)
src/busy-coast.js      the engine: reads a profile + the world data + a kit, builds FOUR meshes, updates per frame
game.js / coast-world.js  load the profile for the year (?year=), hand cottages over as summer houses, create + update the engine
```

- **Same scheduled traffic for both players, no messages.** A boat's place is a pure function of the wall clock on its route (lines go back and forth, loops go round and
  round, the n boats of a route are spread evenly round its cycle). The ambient pool is local to each player (fill traffic, not a shared event).
- **Ambient boats** (`busy-ambient.js`): each of 8 boats (Today; 6 in 1980, 4 in 1950; 80% sail) spawns out of sight (90–150 m from you) on a straight leg of open water
  that passes 22–60 m from where you are, sails through the view and respawns when finished or left behind. In tight water it falls back to shorter legs closer in; in the
  narrowest pockets (Gullholmen's sound) there is none and you see the scheduled boats and the moored ones. Legs are checked every 1.5 m against the game's collision and stay 8 m
  from every moored boat and ferry dock.
- **Boats give way** (`busy-route.js`): a boat holds still while a player (you or your friend) is inside its body circle (half its length + 14 m) or near the water just ahead of
  it. It never moves toward a player it is yielding to (tested head-on at 10 m/s for three boat sizes); ambient legs pass a resting player at 21 m or more, so nothing crowds you.
- **Four draw calls, however many boats.** Moored boats and summer houses are one static mesh (+ one for windows). Every moving boat (scheduled, ambient, the ferry) is re-written each
  frame into one dynamic buffer (+ one for windows); only boats within 480 m of you are written. Windows are the only emissive thing: unlit vertex colours that turn warm in `setNight(true)`.
- **Routes come from the real collision.** `tools/lib/game-world.mjs` builds the real coast the way the game builds its collision; the planner (`tools/lib/busy-planner.mjs`)
  routes through it shore-shy (open water when there is any), then the test re-checks every route point, berth and dock on the real coast.
- **Berths hug the shore.** At 1:10 a real harbour basin is ~10 game metres across, so boats lie alongside the shore or on buoys, about a boat length apart, and never within
  9 m of the way into a harbour, 11 m of the ferry's way, 9 m of a docked ferry's bow, or 8 m of a route passing through.
- **The ferry skips Östersidan.** The real line calls at Lysekil Södra hamnen, Östersidan and Fiskebäckskil brygga. At 1:10 Östersidan is ~10 game m from the story harbour's gate with a ~3 m strip
  of water beside the way in (no room for a hull that leaves it clear) and only 28 m from the brygga, so the game's ferry runs Lysekil ↔ Fiskebäckskil brygga. It is recorded in
  `busy-world.json` (`ferry.skippedStops`). The Gullmarsstrand marina shares the brygga quay with the ferry (3.5 m apart): the ferry owns the quay, the marina keeps its berths.

## What an era needs to supply

To add or change an era (e.g. the 1950s kit), supply these and nothing in the engine changes:

1. **A kit** (`src/busy-kits.js`, `registerKit({ id, glass, buoy?, assets })`), whose assets are `addX(S, G, opts)` functions like those in `era-assets.js`:
   - **vessel assets** for the classes the world data uses: `sail`, `motor` and `fish` (give each a `stripes` list and a `halfLen`);
   - a **ferry** asset with a `nativeLength` (or none: set `ferry.enabled: false`);
   - a **house** asset for the summer house (with its `colours`), and its window glass colours `{ day, lit, off }`.
   - Triangle budget: about 250 per moving boat, 450 for the ferry, ~85 per moored boat (`lod: true`), ~200 per house.
2. **A profile** in `data/busy-eras.json`: `from`/`to` years, `kit`, `placeholderKit`, and
   - `traffic`: which routes (`"all"` or a list of ids), `perRoute` (a number, or `{ harbour, cruise, fish }`), `maxBoats` (the budget: ≤ 40), per class the assets with weights,
     stripes and length range plus speed and dwell ranges, and `ambient` (`count` ≤ 16, `mix`, optionally `ring`, `legM`, `lateral`, `despawnM`);
   - `ferry`: `enabled`, `asset`, `lengthM` (8–16, within the docks' design length), `speed`, `dwellS` (one number per stop: 2);
   - `moorings`: `fill` (0..1 of the 68 berths), `maxPerHarbour`, per-class assets;
   - `houses`: `share` of cottages that become summer houses (≤ 0.6), the asset, `colours`, `scale`.
3. **Check it**: `node games/windward/src/busy-coast.test.js` validates every profile against its kit and the world data.

Things an era may need that do **not** exist yet: different routes per era (a harbour that did not exist), different ferry stops, a sea-going working-boat class (cargo), boat wakes,
per-era window glow rules, houses placed by era rules rather than converted from cottages, and switching eras *without* reloading (the village is built once).

### The three profiles (all placeholder numbers: `TODO(felix): confirm when each kit is made`)

| Profile | Years | Scheduled boats (sail) | Ambient pool | Ferry | Moored of 68 | Summer houses | Kit |
|---|---|---|---|---|---|---|---|
| `summer-guests-1950` | 1950–1979 | 13 (7) | 4, 60% sail | 14 m, 4.2 m/s | 28 | 15% | `today` (**placeholder**) |
| `leisure-sailing-1980` | 1980–1999 | 22 (11) | 6, 75% sail | 14 m, 4.6 m/s | 47 | 30% | `today` (**placeholder**) |
| `today` | 2000–2026 | 36 (20) | 8, 80% sail | 14 m, 5.0 m/s | 68 | 35% | `today` |

The game still opens on Today, so the default year is 2015 (`BUSY_DEFAULT_YEAR` in `game.js`). When the 1950s kit lands, change it to 1950. Before 1950 and after 2026: no profile, no busy coast.

## The ferry: what is sourced, what is not

- **Sourced (OpenStreetMap, ODbL; `tools/data/ferry-847-osm.json`, fetched 2026-11-06):** line 847's relation, its stops in order (Lysekil Södra hamnen → Östersidan → Fiskebäckskil brygga),
  and the shape of the crossing. The planned route keeps the whole hull in clear water mid-crossing and stays within 40 game m of the real line (tested). The game skips Östersidan (above).
- **Not sourced:** the timetable (a simple loop: 20 s at each quay, 5 m/s, a ~2.7 min round trip), the livery, and **whether a ferry crossed here in 1950**. `TODO(felix)`.
- The ferry also gives way; it docks bow-in and backs out.

## Performance (Fiskebäckskil harbour mouth, `?cat=11.46212,58.2488&seed=1`, same pinned start, desktop Chrome, a quiet machine)

| | `?busy=0` (= `main`) | Today (45 vessels, 18 in range) | 1950 (18 vessels, 11 in range) |
|---|---|---|---|
| Draw calls | **191** | **160 (−16%)** | 184 (−4%) |
| Triangles | 313,434 | 344,010 (+9.8%) | 326,402 (+4.1%) |
| Of which busy coast | – | 14,219 static + 4,114 moving | – |
| Busy update (CPU, per frame) | – | **0.084 ms** | 0.048 ms |
| Frame time | 120 fps, worst 9.4 ms | 120 fps, worst 9.3 ms | 120 fps, worst 9.4 ms |

- **The +15% draw-call budget is met with room: draw calls go *down*.** A summer house replaces a cottage that was several meshes by a house that is part of one shared mesh; the four busy
  meshes add 4, however many boats (the first version had 8 boats and the ferry; this one has 45 vessels).
- 120 fps is the screen's cap, so these runs show no cost but also no headroom; the CPU figure is the real evidence. Earlier runs on a *loaded* machine were too noisy to separate (38–53 fps
  busy-off vs 42–45 busy-on); the real phone check below is what matters. `TODO(felix)`.

## Tests and tools

```
node games/windward/src/busy-coast.test.js     25 checks: motion (lines, loops), timetable, giving way, eras, a second made-up kit, the engine, ambient legs and ambient
                                               boats in view, and on the REAL coast: every route / loop / berth / dock point, the ferry hull at its berth and off every lane,
                                               and how busy the sea is (mean 2.4 boats within 250 m, >=1 boat 88% of the time, 66% a sailboat under way, 1% waiting at a quay)
node tools/plan-busy-coast.mjs                 re-plan data/busy-world.json (a few seconds). Do not edit that file by hand.
```
All 50 `games/windward/src/*.test.js` files pass. Zero console errors or warnings loading Today (38 s of sailing, 8 ambient boats respawning; 833 messages) and `year=1950&night=1`.

## Decisions I took (say stop to change)

- **Ambient boats are local, not synced** (a pool that sails past each player); the scheduled boats stay shared. Syncing them would need messages for fill traffic.
- **The ferry skips Östersidan** (above), and **the ferry's length is era data** (14 m now).
- **Boats alongside and on buoys, not pontoon blocks** (scale). **Cottages become summer houses** (a share) so villages keep their size and draw calls fall; stamped at 0.75 scale.
- **Era data, not a modern kit baked in**: world geometry is era-neutral; profiles choose everything else; kits are registered.
- Default year stays 2015 until a 1950 world exists; `?year=` selects the profile.
- Changed outside the new files: `game.js` (load profile, create + update the engine), `coast-world.js` (`summerShare`, default 0), `era-assets.js` (`GLASS` exported).

## Known limits

- Boats have no wake; they do not react to wind (sails up, unheeled); boats on buoys do not swing.
- The coast is built once per load, so the year cannot change without a reload.
- Scheduled routes are fixed polylines; a boat cannot go round a player, it waits (and may be late for a while).
- Ambient boats are absent in the narrowest sounds (no straight leg of water).
- No sound yet (a ferry horn, halyards).

## Phone checklist (for you)

1. Open `…/games/windward/index.html?cat=11.4157,58.2160` (Grundsund). Smooth as before? (`&busy=0` to compare.) Note the model of phone.
2. Sail out. Are there boats on your screen most of the time, mostly under sail? Too many, too few? (Today: 8 ambient + 36 scheduled; `ambient.count` and `maxBoats` in `busy-eras.json`.)
3. Cross a boat's path: do they stop for you, and never reach you? Does anything look crowded around you when you stop?
4. Go to Fiskebäckskil (`cat=11.4578,58.2502`) and Lysekil (`cat=11.4374,58.2730`): is the ferry now clearly off its quay, in clear water, not wedged, not blocking the harbour mouth? Is 14 m the right size, bigger than Svalan but not massive?
5. Watch it leave a quay: it backs out and swings around. Does the turn look natural?
6. Harbours (Lysekil, Gullholmen, Käringön): full of boats on buoys and alongside; can you still sail in?
7. `&year=1950` and `&year=1980`: does the emptier sea read as "earlier"? (modern kit, so only the numbers change.)
8. Anything that pops in or out, floats on land, or flickers? Report where.
