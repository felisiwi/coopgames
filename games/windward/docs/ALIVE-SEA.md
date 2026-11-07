# The alive sea: ideas to choose from

Started 2026-11-07 (Felix + mission control). A menu, not a plan: nothing here is decided.
Pick from it, grill it, then it moves into GAME-DESIGN.md. Add to it freely.

## The problem (Felix, 2026-11-07)

Sailing is fun in short bursts: trimming, birds, the coast. But on a longer leg it feels slow,
and you mostly wait to get closer to where you're going. The sea feels dead: not enough happens,
and what you do as a sailor stops mattering once the sail is trimmed.

Two halves to the fix:
- **A. The sailing itself asks more of you** (small, constant decisions; speed you can feel).
- **B. The world is alive** (it has its own life, it reacts to you, and things happen).

Cost key: **S** = small, data or tuning; **M** = a new system; **L** = big. **(g)** touches game.js.

## Principles

- **Things happen whether you watch or not.** Boats go out at dawn and come home at dusk; the
  world runs on its own clock (already true for traffic: busy-route.js).
- **The world notices you.** Birds lift, seals slip off rocks, people wave, your wake rocks
  moored boats.
- **Invitations, not tasks.** Most happenings ask you to sail differently for a minute, never
  open a quest log.
- **Every leg has a choice.** Inside or outside, chase the gust or hold the line.
- **Measure, don't guess.** "Something every ~40 s" (The Witcher 3's benchmark) only means
  something on our real routes once we've logged them.

## Reference points

- **The Witcher 3:** a point of interest roughly every 40 s in any direction (living-world team).
- **Breath of the Wild:** the "triangle rule": terrain hides and reveals points of interest as
  you round or crest it (GDC 2017). The often-quoted 15 to 30 s figure isn't Nintendo's own.
- **Halo:** "30 seconds of fun" repeated in varied situations (Jaime Griesemer).
- **Wind Waker HD:** Nintendo added the Swift Sail because players found sailing slow, even
  though it was beautiful. A warning to us.

## A. Sailing that asks more of you

### Feel of speed
- **Camera dips lower and tighter with speed,** pulls back as you slow. S (g)
- **Spray at the bow, wake grows with speed, heel in gusts.** S to M (g)
- **Near things rushing past:** rocks, buoys, gulls close to the hull sell speed. S

### Reading the wind
- **Visible gusts and lulls:** dark ripple patches drifting downwind; sail into one for a surge,
  heel and spray. The core "reading the water" skill. M (g)
- **Wind shifts:** the wind swings a few degrees now and then; a lift lets you point higher, a
  header asks you to tack. Trim goes stale, so you keep noticing. M (g)
- **Wind shadows behind islands:** hugging the coast is calm and slow, open water fast. Turns
  every leg into a route choice. M (g)
- **Waves to surf** on a broad reach: catch one for a burst. M (g)
- **Funnelling in sounds:** wind speeds up through narrow passes (real effect). S to M

### Soft stakes and rewards (cozy: no capsizing)
- **Best time per leg** in your log; Britta or the boy notices ("That was quick"). S
- **Luffing or wind shadow costs speed and spray,** nothing worse. S
- **A "fine run" log line** when you sailed a leg well. S

### Pacing tools
- **Route log (measurement):** sail real legs headlessly and log every "something" (names found,
  marks passed, traffic, lights in view) on a timeline. Shows where the empty minutes are. S
- **Steer by what you see:** directions as landmarks ("keep Gäven's tower off your bow"), the
  Navigate tag as fallback. S
- **Shorter legs where the story allows:** harbour hops, a tow from a fishing boat, the ferry. S to M

## B. A world that's alive

### Nature (1950 Bohuslän)
- **Seals** hauled out on skerries; they slip into the water as you come close. S
- **Eiders with ducklings** (early summer); **cormorants** drying their wings on marks;
  **gulls** following fishing boats. S
- **A diving flock = a shoal of fish below;** mackerel jumping. A hint where fishing boats go. S to M
- **Harbour porpoises** surfacing now and then (Skagerrak). S
- **Herons** standing in shallow bays. S
- **Mareld** (sea sparkle, the bioluminescence of late summer nights): your wake and oars glow.
  A night reward once day and night exist. M
- **Jellyfish** drifting in late-summer water. S

### People and work
- **Fishing boats on a rhythm:** out at dawn, home at dusk with gulls behind; some hauling nets
  or pots on the way. M
- **Lobster and pot floats** with little flags in bays; fishermen shout if you sail through. S to M
  (Check: the lobster season opens in autumn; date rules have changed over the years.)
- **A pilot boat heading out** to meet a ship (Lysekil). S
- **Summer guests:** rowing boats, swimmers off the cliffs, children diving from rocks. S
- **Life ashore:** smoke from chimneys, washing on lines, someone mending nets on a jetty, a dog
  barking as you pass, church bells on a Sunday. S each
- **Canneries and smokehouses** in the harbours (check which ran in 1950). S
- **People wave back** if you wave (a ping or a gesture). S to M

### Weather and light
- **Fog banks** that roll in and out (fog already exists as "not yet"; here as weather). M
- **A squall line** crossing the fjord: race it home, or reef and ride it. M (g)
- **A shower over one island,** a rainbow after. S to M
- **Thunder over the mainland** at the end of a hot day. S
- **Sea smoke** on a cold morning. S
- **Light through the day:** dawn, flat noon, gold evening, the lights coming on (dusk.js). M

### Happenings (small, now and then)
- **A local snipa** edges alongside and races you to the harbour. M (g)
- **Keep pace with the ferry** across its crossing. S
- **A boat in trouble:** dismasted, an engine that won't start; tow it home for a thank-you. M
- **A lost oar or fish box drifting** from the storm: pick it up, return it to whoever lost it. S to M
- **Flotsam from the storm** as souvenirs (a fishing float, a crate stencilled with a ship's name). S
- **A message in a bottle** that points somewhere on the chart. S
- **Regatta day** in a harbour (check local 1950 history). M

### The world reacts to you
- **Birds lift, seals slip off** as you pass close. S
- **Your wake rocks moored boats** and slaps the jetties. S
- **Fishermen give way, wave, or grumble** depending on how close you pass. S to M
- **People remember you:** after the lights, someone on a jetty calls out your name or thanks you. S
- **The world changes as you help:** lit lights, a jetty mended, a boat back in use. M

### Sound (once the 1950 sound lab is wired)
- Gulls near harbours, quiet out at sea; put-put engines across the water; bells on buoys; the
  hull and the sail creaking more as you speed up. M

## C. Sailing together (co-op)

- Being visibly faster than your friend in the same gust is fun in itself.
- Race to a light; one finds the gust, the other follows.
- Shared happenings: one tows, one steers.

## Next steps (proposed, not decided)

1. A **sail-feel lab** (new page beside boat-lab) with toggles for gusts, shifts, camera dip,
   spray, heel and wave surfing, so Felix can feel each on his phone first.
2. The **route log** measurement on the chapter 1 legs.
3. Pick a first handful from B (cheap ones: seals, birds lifting, fishing boats on a rhythm,
   people waving) and build them as one batch.
