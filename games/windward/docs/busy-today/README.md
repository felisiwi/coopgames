# The busy coast (era-driven)

A coast that is alive: boats sailing between harbours, the Lysekil–Fiskebäckskil ferry (line 847) on its crossing, guest harbours full of
moored boats, summer houses among the fishermen's cottages, and windows ready to light at dusk. **Everything era-specific is data**: which
boats, how many, which ferry, by year. The modern "Today" kit is only a **placeholder** for the 1950 and 1980 eras until a 1950s kit exists.

Branch `felix/windward-busy-today` (from main `2972d22`), not merged. Try it (solo entry, with the debug panel):

| URL (after `games/windward/index.html`) | What it does |
|---|---|
| `?debug=1&cat=11.46212,58.2488` | Fiskebäckskil's harbour mouth, Today profile (the default, year 2015) |
| `…&year=1950` | the 1950 profile: fewer boats, emptier harbours, fewer summer houses (modern placeholder kit) |
| `…&year=1980` | the 1980 profile |
| `…&busy=0` | the busy coast off (= `main`) |
| `…&night=1` | the dusk hook: windows lit |

`?cat=lon,lat` starts at the open water nearest that point. Harbour starts: Lysekil `11.4229,58.27617`, Gullholmen `11.40476,58.17695`,
Käringön `11.36333,58.11327`, Grundsund `11.41577,58.216`. Zoom out with the `−` button to see more.

## Screenshots (390 x 844 CSS px, looked at)

`docs/busy-today/`: made with `phone-frame.html` (the game in a 390x844 iframe, scaled to 88% to fit a small window).

| File | Shows |
|---|---|
| `busy-harbour-gullholmen.jpg` | Gullholmen's sound: sailboats on their buoys (orange balls at the bows), more alongside the shore |
| `busy-harbour-lysekil.jpg` | Lysekil's waterfront: red cottages and a slate-roofed summer house, a dozen moored boats, a sailboat under way |
| `ferry-847-crossing.jpg` | the ferry mid-crossing: salon windows, two orange life rafts on the open aft deck, bike rails at the bow |
| `traffic-at-sea.jpg` | a navy-striped sailboat under way beside the player, gulls |
| `summer-house-karingon-day.jpg`, `dusk-windows-karingon.png` | a sky-blue summer house on Käringön, day and dusk (one window lit) |
| `summer-house-gullholmen.jpg` | a rose summer house at Gullholmen |

## How it works

```
data/busy-world.json   ERA-NEUTRAL geometry, planned offline on the real coast by tools/plan-busy-coast.mjs:
                       the ferry crossing + stops, 8 harbour-to-harbour routes (class: sail | motor), 71 berths in 9 harbours
data/busy-eras.json    ERA PROFILES by year: kit, which assets per class, how many boats, speeds, ferry, mooring fill, house share
src/busy-kits.js       KITS: asset id -> builder function (+ window glass colour). 'today' = era-assets.js (placeholder for 1950, 1980)
src/busy-era.js        pure: profile for a year, validation, which boat a route / berth gets (deterministic from a seed)
src/busy-route.js      pure: where a boat is at time t, which way it points, when it gives way
src/busy-coast.js      the engine: reads a profile + the world data + a kit, builds FOUR meshes, updates per frame
game.js / coast-world.js  load the profile for the year (?year=), hand cottages over as summer houses, create + update the engine
```

- **Same traffic for both players, no messages.** A boat's place is a pure function of the wall clock (`Date.now()`) on its route, so two phones
  agree to within their clock drift (a second or two: invisible). The ferry's timetable is the same kind of loop.
- **Boats give way** (`busy-route.js`): a boat holds still while a player (you or your friend) is inside its body circle (half its length + 14 m) or
  near the water just ahead of it (a 16 m circle, 6 m + 2.5 s of travel beyond its bow). Holding = its `lag` grows; once clear it runs 1.5 x
  its timetable speed until it is back on schedule. It never moves toward a player it is yielding to (tested head-on at 10 m/s for three boat sizes).
- **Four draw calls, however many boats.** Moored boats and summer houses are stamped once into one static mesh (+ one for windows). Moving boats
  are re-written each frame into one dynamic buffer (+ one for windows); only boats within 480 m of you are written. Windows are the only emissive
  thing: unlit vertex colours that turn warm in `setNight(true)`: no new lights, so no shader recompiles.
- **Routes come from the real collision.** `tools/lib/game-world.mjs` builds the real coast exactly the way the game builds its collision
  (raster → passes → shoals → `shore.js isBlocked`), and the planner (`tools/lib/busy-planner.mjs`) routes through it: a shore-shy search (open water
  when there is any; narrow carved sounds only when forced), simplified, smoothed, then **re-validated**. The test re-checks every route point and
  berth on the real coast.
- **Berths hug the shore.** Terrain is 1:10 but boats are nearly full-size, so a real harbour basin is only ~10 game metres across and the kit's
  25 m pontoon block cannot fit. Boats lie *alongside* the shore or on *buoys* a little off it, and never within 9 m of the way into the harbour,
  15 m of the ferry's way, or 8 m of a route passing through.

## What an era needs to supply

To add or change an era (e.g. the 1950s kit), supply these and nothing in the engine changes:

1. **A kit** (`src/busy-kits.js`, `registerKit({ id, glass, buoy?, assets })`), whose assets are `addX(S, G, opts)` functions like those in `era-assets.js`:
   - **vessel assets** for the classes the world data uses: `sail` and `motor` (give each a `stripes` list and a `halfLen`);
   - a **ferry** asset (or none: set `ferry.enabled: false`);
   - a **house** asset for the summer house (with its `colours`), and its window glass colours `{ day, lit, off }`.
   - Triangle budget: about 250 per moving boat, 450 for the ferry, ~85 per moored boat (`lod: true`), ~200 per house.
2. **A profile** in `data/busy-eras.json`: `from`/`to` years, `kit`, `placeholderKit`, and
   - `traffic`: which routes (`"all"` or a list of ids from `busy-world.json`), `maxBoats` (the budget: ≤ 12), and per class the assets with weights,
     stripes and length range, plus speed and dwell ranges;
   - `ferry`: `enabled`, `asset`, `speed`, `dwellS` for the 3 stops;
   - `moorings`: `fill` (0..1 of the 71 berths), `maxPerHarbour`, per-class assets;
   - `houses`: `share` of cottages that become summer houses (≤ 0.6), the asset, `colours`, `scale`.
3. **Check it**: `node games/windward/src/busy-coast.test.js` validates every profile against its kit and the world data (unknown asset or stripe,
   wrong kind, bad ranges, a class with no assets, too many boats).

Things an era may need that do **not** exist yet (the engine would need them): different routes per era (a harbour that did not exist), different
ferry stops, a sea-going working-boat class (fishing boats, cargo), boat wakes, per-era window glow rules, a house placed by era rules rather than
converted from cottages, and switching eras *without* reloading (the village is built once, with the era's summer-house share).

### The three profiles (all placeholder numbers: `TODO(felix): confirm when each kit is made`)

| Profile | Years | Moving boats | + ferry | Moored of 71 | Summer houses | Kit |
|---|---|---|---|---|---|---|
| `summer-guests-1950` | 1950–1979 | 4 (slow, few) | 1 at 4.2 m/s | 29 | 15% of cottages | `today` (**placeholder**) |
| `leisure-sailing-1980` | 1980–1999 | 6 | 1 at 4.6 m/s | 50 | 30% | `today` (**placeholder**) |
| `today` | 2000–2026 | 8 | 1 at 5.0 m/s | 71 | 35% | `today` |

The game still opens on Today, so the default year is 2015 (`BUSY_DEFAULT_YEAR` in `game.js`). When the 1950s kit lands, change that to 1950 and the
profile is already there. Before 1950 and after 2026 there is no profile, hence no busy coast.

## The ferry: what is sourced, what is not

- **Sourced (OpenStreetMap, ODbL; `tools/data/ferry-847-osm.json`, fetched 2026-11-06):** line 847's relation (`relation/1970180`), its three stops in
  order, **Lysekil Södra hamnen → Östersidans färjeläge → Fiskebäckskil brygga**, and the shape of the crossing (a straight run to Östersidan, then
  ~30 m along the shore). The planned route keeps 16 m of clear water mid-crossing and stays within 40 game m of the real line (tested).
- **Not sourced:** the timetable (a simple loop: dwell 20 / 12 / 20 s, 5 m/s), the livery (`era-assets.js` has the same TODO), and **whether a ferry
  crossed here in 1950**. `TODO(felix)`: confirm the 1950 ferry's route, vessel and timetable.
- The ferry docks bow-in at each quay (the model has the bike rails at its bow) and swings away as it leaves. The ferry also gives way.

## Performance (Fiskebäckskil harbour mouth, `?cat=11.46212,58.2488&seed=1`, same pinned start, desktop Chrome)

| | `?busy=0` (= `main`) | Today profile | 1950 profile |
|---|---|---|---|
| Draw calls | **193** (188 in a separate raw run) | **162 (−16%)** | 186 (−4%) |
| Triangles | 313,562 | 341,484 (+8.9%) | 325,248 (+3.7%) |
| Geometries | 134 | 138 | 138 |
| Busy update (CPU, per frame) | – | 0.026 ms | 0.08 ms |
| Frame time, quiet machine | 120 fps, worst 9.4 ms | 120 fps, worst 9.3 ms | – |

- **The budget (+15% draw calls) is met with room: draw calls go *down*.** A summer house replaces a cottage that was several meshes by a house that
  is part of one shared mesh. The four busy meshes add 4.
- **Frame time is not provable here.** The machine was busy during most runs (Chrome helpers near 50% CPU, WindowServer, other apps). An alternating
  A/B/A/B run gave busy-off 38.7 and 53.1 fps and busy-on 44.8 and 42.3 fps, all with ~90 ms worst frames: inside the noise. The numbers that are
  deterministic (draw calls, triangles) and the measured CPU cost of the engine are the evidence; the first quiet runs show no difference (120 fps
  is the screen's cap, so they cannot show headroom). `TODO(felix)`: the real phone check below.
- Triangles +9% is mostly the 37 summer houses (208 each) and 71 moored boats (low-detail, ~85 each): 14.5k static.

## Tests and tools

```
node games/windward/src/busy-coast.test.js     19 checks: motion, timetable, giving way, eras, a second made-up kit, the engine,
                                               the real-coast validation of every route / berth / ferry point
node tools/plan-busy-coast.mjs                 re-plan data/busy-world.json (1.7 s). Do not edit that file by hand.
```
All 50 `games/windward/src/*.test.js` files pass. Zero console errors or warnings when loading the Today (default) and the `year=1950&night=1`
configurations (read with the console tracker running; 77 messages, none an error or warning); `busy=0` loaded with `__coastError` empty.

## Decisions I took (say stop to change)

- **Era data, not a modern kit baked in** (your change of direction): world geometry is era-neutral; profiles choose everything else; kits are registered.
- **Boats alongside and on buoys, not pontoon blocks** (scale: see above).
- **Time-driven, wall-clock motion** instead of simulating boats and syncing them: free multiplayer sync and nothing to save.
- **Cottages become summer houses** (a share, by a fixed hash of the building's index) rather than adding more houses, so villages stay the same size
  and draw calls fall. The summer house is stamped at 0.75 scale (4.2 x 6.3 m vs the cottage's 3.8 x 5.2 m).
- **Default year stays 2015** until a 1950 world exists; `?year=` selects the profile.
- A new tool, `tools/lib/game-world.mjs`, builds the real coast headlessly; `phone-frame.html` is the 390x844 capture page.
- Changed outside the new files: `game.js` (load profile, create + update the engine, ~25 lines), `coast-world.js` (`summerShare`, default 0), and `era-assets.js`
  (`GLASS` exported).

## Known limits

- Boats have no wake; moving boats do not react to wind (sails are up, unheeled); boats on buoys do not swing.
- The coast is built once per load, so the year cannot change without a reload (a year change = a new coast anyway, per-era world state).
- Routes are fixed polylines; a boat cannot go round a player, it waits (and may be late for a while).
- Traffic is sparse by design (8 boats on a 15 x 24 km coast, 480 m render radius): you meet one or two at a time. Raise `traffic.maxBoats` (≤ 12) to taste.
- No sound yet (a ferry horn, halyards).

## Phone checklist (for you)

1. Open `…/games/windward/index.html?cat=11.46212,58.2488` (Fiskebäckskil). Does it feel as smooth as before? (`&busy=0` for comparison.) Note the model of phone.
2. Sail out of the harbour mouth, look for boats at sea: do they look believable, sail up, sensible routes? Do they stay away from you when you cross their path?
3. Go to Lysekil (`cat=11.4229,58.27617`): the harbour full of boats on buoys and alongside; is it too crowded or too empty? Can you still sail in?
4. Watch for the ferry between Lysekil and Fiskebäckskil (it loops every ~3 min): does it dock at both ends and at Östersidan? Do you give it room?
5. Look at the villages (Gullholmen, Käringön, Grundsund): do the summer houses (pastel walls, slate roofs) read as mixed in with the red cottages? Too big?
6. `&year=1950` and `&year=1980`: does the emptier harbour read as "earlier" (it is the modern kit, so only the numbers change)?
7. `&night=1`: windows glow; do they look right on a daytime sea? (There is no dusk light yet.)
8. Anything that pops in or out, floats on land, or flickers? Report where.
