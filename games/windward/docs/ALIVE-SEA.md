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

## Round 2: Felix's picks and new ideas (2026-11-07 midday)

**Felix loves:** rumours, "different each time", what you leave behind, places with personality
(all four parts), the boathook, the fishing line, anchoring in a bay, the sighting log, carrying
things, names that survive across eras (and naming a place together with a quest partner).
Carved initials: cute, niche. **Not busy, but engaging, with things to interact with.**
**Approach (Felix): design systems, not single things,** fed by the research docs per era and
place, so the world grows on its own and each player's world comes out a little different.

### Tap to interact (input change)
- **Today (verified in src/phone.js onDown):** a finger anywhere except the boat or the rope
  steers at once on pointer down; a short tap on the boat is a ping.
- **Idea (Felix):** steering starts only after a short hold (~120 to 150 ms) or once the finger
  moves; a quick release is a **tap** that goes to the world. Dragging still steers immediately,
  so it should not feel slower. The boat tap stays a ping.
- **What a tap could do:** pick up floating things in reach (no aiming minigame: in reach = yours);
  scare a flock up; a seal slips into the water; a passing boat: wave or toot; a person on a
  jetty: hail them (and maybe hear a rumour); a place: add it to the sighting log.
- **One system:** anything in the world can register as "tappable" with a reach and a reaction.
  New things plug in as data.

### Fishing
- Trail a line; over a diving flock at calm speed, it tugs. Not a fishing minigame.
- **Purpose ladder (Felix):** fish as gifts → sell fish → later a fishery of your own.
- **Hunger/thirst (open, Felix's idea):** fish could feed you. Mission control's caution: in a
  cosy game survival meters can turn into chores. Options: (a) real hunger that slowly drains;
  (b) meals as a bonus only (a good meal = a small boost, never a penalty for skipping); (c) no
  meters, fish is for people and trade. Decide later.

### Anchoring and close-ups
- When you anchor or moor, the camera eases in and the island gains detail it can't afford while
  sailing: small fish in a lagoon, rock pools, flowers, birds coming closer. Wildlife comes closer
  the longer you're still. Overlaps the planned harbour close-ups: one "close look" system.

### The place system (data-driven)
- A **place profile** per spot and era: mood (wind, birds, sound), regulars (who is there and
  when), a secret, its temper by time and weather. Filled from WORLD-/PEOPLE- research docs.
- A per-world seed picks which regulars, secrets and rumours a given world gets, so worlds differ.
  In co-op the host's world rules (fits "visit the host's world").
- Keep invented people marked as invented, never real people's names (existing rule).

### Rumours without radio
- 1950: the evening shipping forecast on the radio, people you hail, harbour notice boards, the
  post. Before radio (1703): news after Sunday service outside the church, the pilots' and
  sailors' talk in harbour, letters, market days, a traveller passing through.

### Names you give
- Unnamed skerries can be named by you, or by you and a quest partner together; the name carries
  into later eras' charts. Extends the "names are discovered" rule.

### One data model behind it all (sketch, to grill)
Taps, sightings, rumours, carry-jobs and happenings could share one shape: a **thing** at a place,
in an era, with conditions (time of day, weather, season, story phase), what it does on its own
(routine), and how it reacts (tap, approach, anchoring nearby). Rumours then just point at things.

## Grill: the thing model (2026-11-07, in progress)

**Round 1, settled (Felix agreed):**
1. A **thing** is something physically out there (seal, float, net-mender, wreck). Rumours and
   errands are lighter records that point at things; the sighting log reuses things too.
2. Things come from **templates** written once (kind of place, era, conditions), placed by rules
   on real places. A few story things stay hand-placed (Britta, the boy, the keeper).
3. Templates attach to **typed anchors** from the real coast, not coordinates. Today's data has:
   skerry (283), island, harbour, village, light, sea mark (226), berth/jetty, the passes. No bays,
   headlands or sounds as data yet.
4. The world saves **only what you changed** (picked up, helped, named, carved, delivered), as a
   small log per era under the saves rule. Nature just reappears (like life.js today).
5. Two seeds: a **world seed** fixed when a save begins (regulars, secrets, nameable skerries) and
   a **day seed** per in-game day (rumours, weather, visitors, finds; per session until day/night
   exists). No world seed is saved today: it will be a new key, with a test.
6. **Cross-era traces are things** you create, with the year made and how they age; later eras
   read the same list.

**Round 2, settled (Felix agreed):**
7. **Template fields:** name, era range; where (anchor type + placement rules); when (time of
   day, weather, season, story phase); routine; reactions (tap, approach, anchored nearby);
   sighting entry; rarity; source (research ref or "invented", so Felix can rewrite by eye).
8. **Anchors to start:** skerry, island, harbour, village, light, sea mark, berth, pass, plus
   **open water** (sampled sea points). Bays later, when anchoring/close-ups need them.
9. **Placement is a fixed function** of world seed + day seed + anchor + template (like life.js):
   both phones agree with no messages; the guest uses the host's seeds, sent on join.
10. **Density:** rarity per template plus a cap per area; tuned with the route log.
11. **Change log:** stable key per thing (template + anchor); one save key per era with entries
    `{key, what, when}`; existing keys untouched; test that old saves load without it.
12. **Co-op ownership:** world changes are saved by the host (gone on both screens); personal
    rewards (sighting, souvenir) go to whoever tapped.
13. **Templates in one data file per era** (e.g. data/things-1950.json) wired through
    world-years.json; a research agent drafts them from WORLD/PEOPLE docs, Felix reviews.
14. **Traces age** by type (stands, weathers, grows, lost) with an optional "survives until" year
    from research (e.g. a breakwater built over your cairn).
15. **Sighting log per kind,** with the first place and era it was seen.

**Round 3, settled (Felix agreed):**
16. **Rumour** = target thing, who tells it (era channels: 1950 people, radio forecast, notice
    boards; 1703 church talk, pilots, letters, market days), text, days it lasts, true or twist.
    Mostly true, sometimes a twist, never empty.
17. **Errand** = giver, item, receiver, reward (gift, line, warmth). No time limits by default.
18. **Regulars remember you** through a hidden warmth per regular, saved in the change log; it
    unlocks lines, rumours and errands. No visible meter.
19. **Naming:** only skerries with no real name; era-fitting suggestions plus free text; names
    live in the world they were given in (the host's); a friend's name enters only if the host
    accepts it.
20. **Tap reach** scales with the thing's size; too far = a small "get closer" hint; reach
    numbers in config.
21. **Existing life:** life.js wildlife is ported into templates as the first things; the harbour
    moment stays until regulars replace it.
22. **First slice** (after Next run is merged, since tap vs hold touches phone.js): tap vs hold
    steering; a drifting fish box (tap pickup, change log); seals ported (slip off on approach
    or tap, sighting); one net-mender regular (hail = rumour); one rumour pointing at the seals;
    world seed saved, day seed per session. Gated, with a phone checklist.

**Hunger (Felix, 2026-11-07):** no hunger to begin with; meals/fish are a bonus only (option b).

**Left open on purpose (outside the thing model):** deriving
bays/headlands; a weather system; anchoring close-ups; sound wiring.

## Grill: weather and sail feel (2026-11-07, in progress)

**Fact (src/wind.js, config.js):** today the wind is one value for the whole sea. Every 40 to
60 s it eases (8 to 12 s) to a fully random new direction (any of 360°) and a random strength
0.2 to 1.0. No gusts in space, no shifts around a steady direction, no weather system.

**Round 1, settled (Felix agreed):**
1. **Weather is the source of the wind:** the day's weather sets direction, strength, sea state
   and visibility; sailing feel comes from local variation on top.
2. **Layered wind**, replacing the random 360° jumps: the day's wind (steady, slowly veering);
   shifts (±10 to 20° every minute or two: lifts and headers); gusts and lulls as patches drifting
   across the water; local effects (shadows behind islands, funnelling through sounds).
3. **Real Bohuslän patterns, simplified:** calm or light mornings, a westerly sea breeze filling
   in around midday, fresh in the afternoon, easing in the evening; fronts bring grey westerlies
   and shifts.
4. **Day types** by day seed (and season later): fine sea-breeze day; grey fresh westerly; calm
   misty morning that clears; unsettled with showers and squalls. Story storms stay scripted.
5. **Soft weather now:** strong wind is fast but lively (heel, spray, harder to hold a course); a
   squall's worst is a slowdown and a soaking. **Later (Felix):** boat damage, collisions with
   boats, rocks and grounding doing something (fits a repair loop with the boatbuilder family).
6. **Story override layer** on top of weather (generalises the scripted errand wind), rare,
   always handing back smoothly.
7. **Wind is a fixed function of the day seed and the clock** (like traffic and things), so
   gusts line up on both phones with no messages. Replaces host-sent wind.
8. **Reading the wind:** dark ripple patches on the water first, then other boats heeling and
   sails filling, then smoke and flags ashore, the wind arrow as fallback.

**Round 2, settled (Felix agreed):**
9. **In-game clock starts now with the wind;** visuals follow in the day/night stage. First guess:
   a game day of ~30 real minutes (tune on the phone).
10. **Gusts you can see coming:** gusts 30 to 50% stronger, lulls ~40% weaker, patches last 30 to
    60 s and drift downwind, visible 10 to 20 s before they arrive (the key number). All in config.
11. **Island shadows and funnelling are strong and readable** (smooth water in the lee). **Felix:**
    inside the skerries must not feel boring or slow; the point is that sailing **utomskärs**
    (outside the skerries) feels faster and livelier, not that inside is punished.
12. **Squalls:** dark cloud and a dark line on the water; wind +~60% and ~30° swing, rain, passes
    in 1 to 2 min; ease or round up, or heel hard and slow down. Plenty of warning.
13. **Weather mist looks different from the "not yet" fog:** thin, drifting, all around; the
    exploration fog stays as it is; the chart keeps working in mist.
14. **Speed feel is part of this work:** camera dips and tightens with speed, bow spray, a growing
    wake, heel in gusts.
15. **Build a sail-feel lab first** (new files only), with toggles for each layer, day types,
    squalls, mist and speed feel; into the game after Felix has felt it on his phone.

**Round 3, settled (Felix agreed):**
16. **Utomskärs is faster and livelier** through all three: a steadier, stronger open-water wind;
    a swell to surf on a broad reach (flat water in among the skerries); more spray and heel.
    Inside keeps a decent pace (light-air floor) and its own charm: flat water, wildlife, shortcuts
    through passes.
17. **Noticing a shift:** the sail is the main signal (luff flutter when headed, the trim control
    shows you're off); the wind arrow confirms.

## Grill: generated mini quests (2026-11-07, in progress)

**Round 1, settled (Felix agreed):**
1. **A mini quest is a small chain:** a need (regular, place, happening) + 1 to 3 steps with
   existing verbs (sail to, find, pick up, carry, deliver, be there at a time/weather) + a
   resolution. An errand is a one-step quest; a rumour can be the lead-in step.
2. **Quest templates with slots** the world fills ("{regular} lost {item} near {skerry} in
   {last storm}"); each template good enough alone; generation adds variety, not substance.
   (Not Skyrim-style radiant grammar.)
3. **Sources:** regulars' needs (the main source), places' secrets, happenings, weather
   aftermath, story chapters.
4. **No quest log:** people remember; a paper "on your mind" page in the logbook lists what you
   said yes to; Navigate can point at one you pick.
5. **At most 1 to 2 offered at once,** never pushy; saying no is fine; ignored quests fade
   gently ("Never mind, my brother found it").
6. **Rewards:** warmth, gifts, rumours, a name to give, **knowledge** (a shortcut through a pass,
   where the mackerel run), boat improvements later; no money until an economy.
   **Felix: gifts are lore-appropriate artifacts with a rarity scale.** Collectibles for now;
   later sell the common ones; rare ones lead to historically accurate lore; some rare artifacts
   unlock other templated quests (a bigger system), and Felix can hand-assign story meaning to
   rare objects.
7. **Words:** a few short line variants per personality type (gruff, chatty, shy) per template,
   drafted from the research, marked INVENTED, rewritten by Felix by eye.
8. **Co-op:** quests live in the host's world, both can help, rewards split like the thing model;
   a few two-boat quests (towing, holding a line) later, after co-op stage 2.

**Round 2, settled (Felix agreed):**
9. **Artifacts are templates:** name, era made, era found, rarity tier, true story with a research
   reference, what it leads to (quest template or story hook), sellable later. Tiers: common,
   uncommon, rare, unique. Uniques are only ever placed by Felix. **Felix:** later, a curated list
   of unique candidates, inspired by history and fitting the story, for him to pick from.
10. **Artifacts across time:** rare and unique ones can carry "lost in year X at place Y" and their
    owners can be met in their own era; things you leave in 1703 can turn up in 1950 or today.
11. **Sources and rarity:** quest rewards, drift finds, places' secrets, close looks when anchored,
    gifts from warm regulars. Drift finds mostly common; secrets and warm regulars give rare ones.
12. **The collection:** a logbook page with a small drawing per artifact; rare ones displayed in the
    world (Svalan's chest or shelf now; Britta's house and your own later).
13. **Lore is told by a regular who knows** (the keeper, an old fisherman, Britta's father); it stays
    in the logbook marked "real history" with its source.
14. **"Leads to":** rare artifacts unlock small templated quests (return it to a descendant, find its
    pair, learn where it came from); uniques are wired into the main story by Felix.
15. **Repetition:** per-template cooldowns; regulars remember what you've done for them.
16. **Co-op:** commons to the finder; rare and unique finds go to both players as a shared memory.

**New research thread (Felix, 2026-11-07):** lore of Bohuslän's islands (history, folklore,
place-name meanings, landmarks) for the game, story and quests, and for recognisable per-island
assets. Prompt: docs/prompts/2026-11-07-island-lore-research.md.

**Round 3, settled (Felix agreed):**
17. **First quest slice** (after the thing-model slice): three templates: lost item (find with the
    boathook near a skerry, return it: warmth + a common artifact); delivery (harbour to a regular:
    a rumour or knowledge); after the squall (find a drifted boat, tell the owner: a rare artifact
    with lore told by the keeper). Plus the logbook's "on your mind" and collection pages. Slots fed
    by the island-lore research.

## Build order (proposed, 2026-11-07)

1. Next run (pause, light names, downwind errand, light air): prompts/2026-11-07-next-run-stage.md
2. In parallel, new files only: co-op stage 2 plan, sail-feel lab, island lore research
   (prompts/2026-11-07-*.md).
3. Thing-model slice: tap vs hold, fish box, seals ported, net-mender, one rumour, world seed.
4. Weather and sail feel into the game, once Felix has felt the lab.
5. Quest slice: the three templates, logbook pages.
6. Co-op stage 2 build (Kenny gets a heads-up note on the hub launch change; Felix: no OK needed).

## Grill: the logbook (2026-11-07, in progress)

**Round 1, settled (Felix agreed):**
1. **One paper book** with sections you leaf through (the cards' paper style).
2. **It is Grandpa's logbook:** it lies aboard Svalan in today's opening; you carry it into 1950 and
   write in it; the finale can reveal its old pages are in your hand (mirrors Svalan's loop).
3. **Sections (Felix: lighter):** light log, sightings, collection, stories, people, places, and
   **quests** (accepted quests and tasks live there; replaces "on your mind"). No best-runs section for now.
4. **Opening the book pauses** solo (game clock), not in co-op (same rule as the pause).
5. **Automatic handwritten entries** with small drawings; your own short notes later.
6. **One book across all eras,** entries marked with their era.
7. **Co-op:** your book is yours; days sailed in a friend's world are recorded in it too.

**Round 2 (in progress):**
12. **Logbook drawings:** auto-made ink silhouettes rendered from the 3D models for every template;
    hand-drawn only for unique artifacts (Felix agreed).
