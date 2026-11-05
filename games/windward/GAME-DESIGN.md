# Windward — game design plan

Status: plan, not built. Written 2026-11-05 from Felix's brief. Grill it
(`/grill-me`) before any of it is built, then keep this file as the single
source of truth: when a decision changes, change it here first.

Updated 2026-11-05 after Felix's first answers: the game is now framed as
**era-jumping** with a retro opening (see "The opening" and "The frame"). The
single-era pitch below is the *middle* of that frame, not the whole game.
Era choice (Q1) is deliberately still open.

Read with: `DESIGN.md` (sailing, controls, look), `shared/ART.md`.

## The pitch

A cosy trading game on the real Bohuslän coast, Marstrand to Smögen, in the
great herring years of the late 1700s. Each friend sails their own small
boat. You buy cheap in one harbour and sell dear in another, keep the crew
fed, and slowly grow from a rowing-and-sailing *eka* to a proper trading
sloop. Like Catan, the fun is in resources, good harbours and dealing with
each other, but here the board is a real coastline you sail across.

## Why this era

- **The great herring period, about 1747-1809.** Herring crowded into the
  Bohuslän fjords for sixty years, then vanished. Salteries and train-oil
  boilers sprang up along the coast. That is a ready-made economy: a boom
  good (herring), the things it needs (salt, barrels), what it becomes
  (salted herring, train oil), and a built-in event (the shoals come, then go).
- **Marstrand free port, 1775-1794.** No customs on goods coming in, ships
  from all over Europe, and smuggling nobody could stop. One port with
  different rules is a perfect special harbour.
- **Carlsten fortress, privateers in 1789, storms.** Gentle tension and
  events without combat being the point.
- **No engines.** Wind and oars only, which is exactly the game we already
  have.

Alternatives if the herring era doesn't feel right: the stone-quarrying
1870s-1900s (granite to Europe, steam arriving), or the 1600s, when
Bohuslän passed from Norway to Sweden (1658). Decide in the grill.

> **Superseded in part (2026-11-05):** the game is no longer one era. This
> section argues for era 3 below (free port + herring boom); it stays as the
> case for that candidate. See "Era candidates".

## Pillars

Every system has to serve at least one of these, or it waits.

1. **Sailing is the joy.** Trade exists to give sailing a reason and a
   route; it should never feel like spreadsheet time between voyages.
2. **Better together.** Two boats should beat one: shared contracts, pooled
   cargo, splitting a long route. Never punish playing alone; reward
   playing together.
3. **Cosy, not harsh.** Nobody dies. Being hungry or broke slows you down
   and closes doors, it never ends the game.
4. **Real places, real history.** Ports, lighthouses and events are real;
   numbers can be playful.

## Core loop

```
pick a plan (a contract, a rumour of herring, a price you saw)
  -> provision (food, water) and load cargo
  -> sail (wind, tacking, the coast)
  -> arrive: sell, buy, take contracts, hear rumours
  -> upgrade (boat, hold, sails) when you can afford it
  -> bigger plans, longer routes
```

One loop should take about 5-15 minutes of play. Marstrand to Smögen is
about 20 minutes (scale 1:8, see the real-coast stage).

## Systems

Designed as separate systems with clear owners and data, not as one-off
features. Each one: what it owns, its data, who is the authority in
multiplayer, and what it talks to.

### 1. World and ports
- **Owns:** the map (real coast data), ports, landmarks.
- **Data:** `ports.json`: id, name, real lat/lon, size, what it
  produces, what it needs, services (saltery, boiler, shipyard, chandler),
  its **special trade** (Catan's harbours: e.g. Marstrand trades anything
  2:1 and has contraband; Smögen pays more for barrels).
- **Authority:** static data, identical everywhere.

### 2. Goods
- **Data:** `goods.json`: id, name, base price, weight/size in the hold,
  perishable or not, legal or contraband. Starting set (small on purpose):
  fresh herring, salt, barrels, salted herring, train oil, grain, beer.
  Later: timber, dried fish, stone, coffee and tobacco through Marstrand.

### 3. Markets
- **Owns:** stock and price of each good in each port.
- **Rule:** price moves with stock against what the port wants (supply and
  demand), and drifts back to normal over time. Players' trades move
  prices, so two friends dumping herring in the same port crash it, a
  natural reason to split up or plan together.
- **Authority:** host. Clients send "I want to sell 5 herring"; the host
  checks, applies, and broadcasts the new prices.
  *Superseded in part (2026-11-05): each player owns their own world; see
  "Playing together". Within a world, the owner is the authority.*
- **Tested in node:** price curves, recovery, no negative stock, no money
  from nothing (buy then sell straight back must lose money).

### 4. Production
- **Owns:** turning goods into other goods at ports with the service.
- **Chains:** fresh herring + salt + barrels -> salted herring (saltery);
  fresh herring -> train oil (boiler). Fresh herring spoils, so speed
  matters: a real reason to sail well.
- Starts as fixed port recipes; later players can own a share of a saltery.

### 5. Boat and cargo
- **Owns:** each player's boat: type, hold capacity, sail area (speed),
  upgrades, cargo list.
- **Data:** `boats.json`: eka -> snipa -> kosterbåt -> sloop (galeas
  later). Upgrades: bigger sail, better hull (pointing higher), bigger
  hold, oars for calm days.
- **Talks to:** sailing (speed and pointing come from here, so the sail
  model reads boat stats instead of fixed config), markets (capacity).

### 6. Provisions
- **Owns:** food and water on board.
- **Rule:** one "provisions" meter to start, used up per hour of sailing
  (more crew, faster use). Running low: slower boat and a worried crew
  note; empty: you can still sail home slowly. Split into food and water
  only if one meter proves too simple.
- Bought at any port; some ports are cheap for it.

### 7. Time, seasons and weather
- **Owns:** the game clock (one game day = a few real minutes), seasons,
  the wind (already host-authoritative).
- Herring arrive in autumn and winter, prices and events follow the
  season, storms close the open sea for a while.

### 8. Events
- **Data:** `events.json`, a deck the host draws from: "herring shoal in
  Gullmarsfjorden", "salt ship late, salt prices up in Lysekil", "rumour
  of privateers off Måseskär", "storm coming".
- Events only change data (prices, stock, wind, map markers), so new events
  are content, not code.
- Optional real data: the NorFish dataset of Bohuslän herring landings
  1520-1808 could set how good each herring year is (check licence first).

### 9. Contracts and reputation
- **Owns:** jobs posted at ports ("40 barrels of salted herring to Marstrand
  within 3 days") and each player's standing with each port.
- **Co-op contracts** need more cargo than one boat holds, or two places at
  once. Good standing unlocks better prices and the shipyard.

### 10. Money and progression
- Riksdaler. A simple ledger per player (what you earned where), shown at
  port. Progress is visible on the boat itself: new sails, bigger hull,
  a pennant.

### 11. Discoveries and history
- What exists today (found-together props, lighthouses) becomes history
  cards: short true stories about the place, unlocked by visiting. This is
  where Felix's favourite spots live.

### 12. Players and multiplayer
- **Today:** 2 players, host and guest over PeerJS; the host owns wind,
  finds and (later) markets. *Superseded in part (2026-11-05): own world and
  own save per player, playing together = visiting; see "Playing
  together".*
- **Design for N players from now on:** every per-player thing (boat,
  cargo, money, reputation) lives in a map keyed by player id, never in a
  single "other" variable (`game.js` has one today; refactor before
  markets). The host stays the single authority; clients send intents and
  receive state.
- **Player-to-player trade** (the Catan bit): offer cargo or money to
  another boat when you are moored together.
- **Later:** a small server or Firebase for a persistent shared world and
  dropping in and out; only when we actually want it.

### 13. Saving
- The whole world state (markets, clock, players) is plain data that can be
  saved and loaded. If saving is hard, a system is holding state in the
  wrong place.

## How we build it (the game-developer approach)

- **Simulation apart from rendering.** Markets, provisions, contracts,
  events are pure modules with node tests, like `sail.js` and
  `discover.js` today. The 3D game only draws them and sends intents.
- **Data, not code, for content.** Ports, goods, boats, events, contracts
  in JSON. Adding a port or a good never needs a code change.
- **One authority, small messages.** Clients send "buy 5 salt"; the host
  validates and broadcasts the result. Same shape for 2 players or 8.
- **Fixed simulation tick** for the economy (say once a second), separate
  from the render frame.
- **Seeded randomness** for anything both sides must agree on.
- **Numbers in a spreadsheet first.** Before code, model prices, hold
  sizes and provision use in a sheet and play a few trips on paper. Cheap
  to change, and it catches broken economies early.
- **Each stage playable on its own**, audited with the design-audit skill.

## Stages

Each stage is small, playable and tested before the next.

**Stage order (SET, Q17 a and Q28, 2026-11-05):**

1. **The lure:** free sailing, small interactions, port arrival, and fog (the
   quiet edge, the lighthouse beam or foghorn, and a thunder warning that
   rumbles then fades, "not yet", until the story exists). Items on deck;
   small things kept on the device.
2. **Co-op visiting:** a room with no save; smart ping; the pair net.
3. **3a, saving, chart, story start at a port:** the first real save;
   granddad's chart (the west Orust section); device-kept things move into the
   save; the story is offered at a port.
4. **3b, storm, jump, time-lapse, sea chest:** the can't-escape storm, the
   first jump, the backwards time-lapse, the lost sea chest.
5. **Trade:** the T0-T8 table below. It predates this order and still assumes
   one era; it is due a rewrite around the works slice (Q31 c).

| Stage | What you can do | New systems |
|---|---|---|
| T0 | Play a few trips in a spreadsheet; agree prices and sizes | none (numbers only) |
| T1 First trade | 3 real ports, 3 goods, buy and sell, hold limit, money | ports, goods, markets (fixed prices), cargo |
| T2 Provisions | Buy food and water, run low, sail home slowly | provisions, game clock |
| T3 Better boats | Spend money on sails, hull, hold at a shipyard | boats and upgrades (sailing reads boat stats) |
| T4 Living markets | Prices move with trade and season; herring shoals | markets (dynamic), seasons, events |
| T5 Salteries | Turn herring, salt and barrels into salted herring | production |
| T6 Contracts | Port jobs, co-op contracts, reputation | contracts, reputation |
| T7 More friends | 3+ players, trading between boats | per-player state map, player trade |
| T8 Keep your world | Save and load; history cards from finds | saving, discoveries -> history |

Before T1: the real coast (stage R0) and the look (L1) should be in, and
`game.js`'s single `other` player refactored to a players map.

## The first minutes (SET, Felix 2026-11-05)

Before any story, the first thing is just sailing.

- A nice view, and you figure out the controls yourself. No tutorial wall.
- Small interactions so it never feels dead: fish, another little boat,
  birds, and so on.
- Sailing into a port or up to a house triggers something early on, so it is
  clear that sailing is fun in itself and that ports do things. Don't go
  deep on port mechanics yet; make the early hook clear.
- **"The game" (story, chart) starts when you choose it**, for example from a
  port. A second way in is the fog and thunder (see "Fog"); whether that
  is an offer or a hijack is open.
- This is the no-save lure: 5 minutes must already feel rewarding.
- **Pre-story sailing is today's coast (SET, Q10):** the current free-sail
  mode, with its real present-day lights.
- **Choosing the story at a port plays the first time-lapse backwards** to the
  opening year: lights sink, years roll back. (The opening year is
  about 1905, SET; see "The flow".)
- **Arriving at a port or house (SET, Q13):** a sensory reward (bell,
  chimney smoke, gulls scatter, someone waves), someone tosses you a small
  gift (a fish), and the story is offered quietly (a lit doorway, a chart on
  a table). No long dialogue UI. Fallback if real interactions are too much
  for now: a simple port menu (start the story / later: sell catch /
  leave).
- **Items on deck (SET, Q25 a):** three or four visible items on the boat
  (the port gift, barrels and flotsam from the pair net). It grows into the
  hold later.
- **What persists before the story (SET, Q26 b):** small things are kept on
  this device and moved into the save when the story starts. Device-only: a
  phone and a laptop don't share it, and clearing site data loses it.

## Fog: the universal "not yet" (new, Felix 2026-11-05)

One visual language for "not yet / beyond".

- **Today's coast has no hard map edge.** Sail too far and fog rolls in
  gradually, with no clear line. You can keep navigating in it, but it is
  hard to see.
- **Stay in the fog long enough and thunder starts:** another way the story
  can begin, alongside choosing it at a port.
- **The same mist hides what a visitor hasn't unlocked** during visits
  (Q15, open).
- **The lightning-flash fog is the era crossing.** Ordinary weather fog still
  exists (see "The frame"). Fog makes lighthouses essential.
- **Drifting in by accident (SET, Q19 a):** a lighthouse beam or foghorn
  carries through the fog so you can find your way back. It teaches "fog
  makes lights essential". No walls, no prompts.
- **Thunder in free-sail is a warning (SET, Q20 b):** you can sail back out
  of it; only the lightning-flash fog commits you. The scripted
  can't-escape storm stays inside the story.
- **Telling the fogs apart (SET, Q21 c):** same look, different behaviour.
  Weather fog drifts in and out, edge fog is fixed, only story fog brings
  thunder and flashes.
- **Where the fog begins (SET, Q22 c, kept simple):** one fog-start distance
  per side, generous to the west (open sea), earlier at the north and south
  ends of the data. Four tunable numbers, no hand-drawn shape.
- **One fog, three depths (SET, Q24 a):** a quiet edge, thunder if you
  linger (a warning, you can sail out), flashes deeper (the commit). It is
  fine that the story can start at any data edge. Before the story exists
  (Q28 a), thunder rumbles then fades: "not yet".

## The opening: where the story starts (new, Felix 2026-11-05)

When you choose the story, you start in a short slice of a later but still
retro era: before 1950, maybe older. No GPS. It should feel retro and
mystical.

- **Opening year (SET, about 1905, the end of Light and Stone).** Måseskär,
  Pater Noster and Hållö stand nearby; small lights, cairns (*kummel*) and
  village signal fires (*vårdkasar*) mark the coast; sail is still dominant.
  `TODO(felix): check each light's built year in the lighthouse data against
  epochs.json (it lists Hållö 1842, Måseskär 1865, Pater Noster 1868, Eggskär
  1904).`
- **Start location:** the densest cluster of Felix's favourite places, west
  Orust around Käringön / Härmanö / Gullholmen / Hälleviksstrand.
  `TODO(felix): confirm.`
- **Granddad's chart:** you inherit his nautical chart. It reveals a small
  part of an expandable mini-map with markers on sweet spots (Felix's
  favourite places). Deeper in you explore it yourself or buy further chart
  sections from people you meet.
  **(SET, Q18 c)** Build fixed chart sections first (inherited or bought),
  with exploring revealing detail on top. **(SET, Q27 a)** Sections are cut
  by place (for example west Orust = granddad's chart), each with its own
  history and sweet spots; lighthouses are markers inside sections.
- **Teaching sailing and navigation:** lighthouses, cairns and village fires
  are the tutorial. No pop-up lessons; the coast teaches.
- **The storm:** after the first chart and some chill sailing, a storm rolls
  in that you cannot escape wherever you are: thunder, the mysterious fog
  with flashes, then the first era jump. It lands at the end of New border,
  about 1700 (SET, see "The flow").
- **The opening era locks after the first jump.** Much later you return to
  it, when you have almost forgotten it, and the lighthouses carry meaning
  then, for example their real flash patterns as a code or a way home.
  **Open: what that meaning is.** Under review with Q30: eras no longer unlock in order.

Opening-year options (kept for the record; about 1905 chosen):

| Option | For | Against |
|---|---|---|
| ~1905 | Three real lights of different character nearby plus humbler marks (cairns, fires): a rich navigation lesson. Sail still dominant but the world feels old. | It sits inside era 6's window (1877-1906), so the opening spends era 6's taste and leaves it little contrast. Engines may be arriving. `TODO(felix): confirm.` |
| Older (1850s-1870s) | Fewer lights, so fog bites harder and the mystery is stronger. | The three named lights may not be lit yet; fewer things to teach with. |
| Later (up to 1949) | More photos and maps survive. | More engines, less retro and mystical. |

## The frame: era-jumping (new, Felix 2026-11-05)

- **Same character reimagined in every era** (different friends, partners,
  historical figures). Only the player sees the overlaps; the story threads
  across eras.
- **Crossing = mysterious fog with lightning-like flashes.** Ordinary fog
  still exists. Fog makes lighthouses essential, which is a feature.
- **Heritage touch points** (standing stones, cairns, etc.) as clues,
  points, treasures. Rock carvings are a much later release.
- **Treasure across time (SET, Q16 a):** something is lost or buried during
  the opening (for example the storm takes granddad's sea chest) and found
  after the first jump; the player understands later. That can lift you
  from poor fisher into the free-port heyday and smuggling. What is inside
  the chest is not set.
- **The story unlocks eras; once unlocked you jump freely.**
- **Era tastes are very small at first** but clearly different in look and
  feel, to tease.
- **Time is shown by what exists** (lighthouses, villages, boats), with a
  sped-up time-lapse (towers rising) at era changes.
- **Co-op across eras:** undecided, possibly a big mechanic later. Start with
  everyone in the same era.
- **What crosses a jump (SET):** knowledge travels (chart sections,
  discoveries, history cards); stuff does not (boat, cargo, money), apart
  from the one deliberate exception of buried treasure. Each era keeps its
  own economy and boat, so a later era can ship as a later release.

## Playing together: easy in, easy out (SET, Felix 2026-11-05)

Design this explicitly; it touches almost every system.

- **Before the story, anyone can join.** You just see each other nearby and
  sail together. Sailing together should already have some small purpose, so
  players get an "aha, it's better together" moment.
- **Nobody chooses solo or co-op up front.** When you start the story, either
  your solo adventure starts or you and your friend start together.
- **Either player can drop in and out without breaking the other's game.**
  Ideally both, not just the host.
- **Story progress must never create annoying blockers between players.**
  This is a design rule for every story mechanic, not a feature.
- **Purses are separate (SET).** The drop-in/drop-out flow must define what
  happens to shared contracts, cargo and co-op bonuses when someone leaves
  mid-trip. Open, see Gaps.
- **Whose world (SET, Q11):** everyone owns their own world and save.
  Playing together = visiting a friend's world; leaving sends you home. No
  one can be stranded when the other leaves, because nobody depends on
  another player's world. Shared contracts and market effects are a separate
  protocol, designed later.
- **What this supersedes:** the "host owns markets" wording in Markets (3) and
  Players and multiplayer (12), and the "two friends crash a market" idea,
  until that later protocol exists. Inside a world, its owner is still the
  authority.
- **The pair net (SET as the signature co-op move):** a rope or net strung
  between both boats that sweeps up what is in the water, an easy, fun way
  to boost resources. **What it sweeps varies by era and place**, so the
  game does not read as a fishing game early: drifting barrels, a loose
  dinghy or storm flotsam on today's coast; herring in herring eras; dumped
  contraband in the smuggling era; wreck goods. Fish is one use, not the
  identity. The sweep lists are data per place and era. It may arrive with
  the "visit each other's worlds" stage if it's a lot of work.
- **What a visitor brings (SET, Q14 a):** you bring your own stuff (boat,
  hold, contracts) and your earnings go home to your own save. A trade cap
  can come later if visiting breaks an economy.
- **Visiting with mismatched progress or era (OPEN, Q15):** leaning towards
  showing the host's era filtered to what the visitor has unlocked (d), or
  the host's world with anything the visitor hasn't unlocked hidden in mist
  (a), if there is a simple smart filter. Not locked. Later decisions that
  would favour it: (1) the stage order (Q17 a) means visiting ships before
  any era is unlocked, so there is no mismatch until the chart, storm and
  jump stage; decide then. (2) Chart sections and discoveries are per-save
  sets of ids (Q9, Q18 c), which makes "unlocked by this visitor" a simple
  yes/no per item and favours the mist filter. (3) Sweep lists and era
  content keyed by era and place make filtering a data lookup, not code.
  (4) Q14 a means the visitor's stuff is already their own, which works
  with either. Come back when the story stage is designed. Also decide
  then: if a visitor lingers in the host's fog (Q24 a), whose story do the
  flashes commit?
- **No early currency (SET, Q23 c):** barter and favours. Things the pair
  net sweeps up (barrels, flotsam) become gifts and trade goods for chart
  sections. No throwaway early economy; the real one is the trade stage.
- **Pair-net haul split (SET, Q29):** split evenly; each half goes to each
  player's own save. Odd items: see Gaps.
- **Early co-op (SET, Q12): smart ping + the pair net.** The ping is the
  first feature beyond "here I am": it tags what you point at (a find, a
  fish school, a port, a lighthouse) and marks it on both mini-maps.
  Signalling (horn / lantern / flag codes), a casual race (ping a
  lighthouse or buoy as a finish line) and found-together finds (already
  built: both near = found) stay as optional extras.

## Where the story is told: history layers (SET, Felix 2026-11-05)

- **Start area: west Orust** (Käringön / Härmanö / Gullholmen /
  Hälleviksstrand), the densest cluster of Felix's favourite places.
- **History in two depths:** a broad scan of villages and big history for the
  whole coast, plus deeper, more niche history for the start area.
  Sourced like `settlements-history.json` (its confidence key), never from
  memory.
- **Technically an era is a year value** driving lighthouses, settlements,
  boats and palette. Already prototyped for two of those four, unmerged:
  `coast-lab.html` + `data/settlements-history.json` (branch
  `felix/windward-real-coast`, settlement phases per year, sourced, 1700-2025)
  and `lighthouse-lab.html` (branch `felix/windward-lighthouses`, towers by
  built year, 1740-2025). Boats and palette are not year-driven yet.

## Terms (new, Felix 2026-11-05)

- **Epoch:** a long span (about 100+ years), roughly one release.
- **Era:** a chapter inside an epoch (10-40 years) with its own tone,
  season, history and rules.
- **Today's coast:** the summer free-sail lure. The timeline lists it as the
  seventh slot, but it is a separate setting, not a story epoch.

## Epochs and eras (SET structure, Felix 2026-11-05)

**Source of truth: `games/windward/data/epochs.json`** (merged from branch
`felix/epoch-timeline`), with the frozen viewer `ref/epoch-timeline.html`. If
this section and the data disagree, the data wins and this section gets
fixed. Anything the data marks `approx` or `verify` is not source-checked
yet. `TODO(felix): confirm against a cited source before it ships.`

Seven slots on the timeline (six story epochs plus the lure) and 17 eras.
Every epoch and every era has a **vibe** and a **season**. This replaces the
earlier draft epoch "Herring and Light" (1706-1906), which was split into
New Crown, The Silver Sea and Light and Stone.

| Epoch | Years | Vibe | Season |
|---|---|---|---|
| I Kings and raiders | 800-1657 | Mythic, raw | Autumn to winter |
| II New Crown | 1658-1746 | Poor, unsettled, hopeful | Spring to summer |
| III The Silver Sea | 1747-1809 | Rich, rowdy, greedy | Summer, late summer, autumn |
| IV Light and Stone | 1810-1906 | Loss, then hope, then bustle | Late autumn, winter, late winter |
| V Engines and wars | 1907-1949 | Sly, tense | A long, cold spring |
| VI Summer guests | 1950-1999 | Friendly, cute, with a feud | Summer |
| Today (the lure) | 2000-2026 | Easy, pretty | Summer |

Eras (vibe; season):

- **I:** Norse coast 800-1050 (raw, mythic, open sea; autumn). Fortress and
  fish 1051-1555 (old, slow, stony; late autumn). Border wars 1556-1657
  (contested, wary; winter).
- **II:** New border 1658-1705 (unsettled; spring). Crown shores 1706-1746
  (poor, hopeful; summer).
- **III:** The silver comes 1747-1774 (rising, busy; summer). Honour and Life
  1775-1794 (rich, rowdy, mischievous; late summer). Last silver 1795-1809
  (anxious, stormy; autumn).
- **IV:** Empty harbours 1810-1839 (loss, melancholy; late autumn, last
  leaves falling). Lights go up 1840-1876 (hope, safer seas; crisp winter).
  The second silver 1877-1906 (industrial bustle; late winter to early
  spring).
- **V:** Motor and canning 1907-1916 (change, engines; long, cold spring).
  Spirits at sea 1917-1938 (sly, night runs). Mines and neutrality 1939-1949
  (tense, watchful).
- **VI:** Summer guests 1950-1979 (friendly, cute, with a feud; summer):
  holiday homes, leisure boats, bridges to the islands, and the friendly
  west-coast-east-coast feud begins, with rich Stockholmers buying up
  fishermen's cottages. Leisure sailing 1980-1999 (easy, playful; summer).
- **Today:** Summer coast 2000-2026 (free sail, pretty; summer), the lure.

**Seasons run as one full year across the timeline (SET):** autumn to winter
(I Kings and raiders), spring (New border), summer (Crown shores, The silver
comes), late summer (Honour and Life), autumn (Last silver), late autumn
(Empty harbours), crisp winter (Lights go up), late winter to early spring
(The second silver), a long, cold spring (epoch V), summer (VI and Today).

**Built for real first (SET, Q1):** the end of New border (about 1700), Crown
shores, The silver comes and Honour and Life, plus Today and the about-1905
opening. Everything else is a taste or a time-lapse. Note that Last silver
(1795-1809) is a taste even though it sits inside epoch III. The data's
`release: "first (proposed)"` on epoch III does not match this; the data is
not edited here (see Gaps).

## The flow (SET, Felix 2026-11-05; replaces the earlier opening order)

1. **You start casual on Today's coast** (the lure; the data marks it 2015).
2. **A time warp takes you to about 1905**, the end of Light and Stone: the
   opening, granddad's chart, the lighthouses.
3. **The first jump lands at the end of New border (about 1700).** You warm up
   poor, and soon after the 1706 crown-land ordinance lets you claim islands
   and build. That is how eras are introduced naturally.

The timeline markers in the data are "you start (casual)" 2015, "time warp
lands" 1905 and "first jump lands" 1700.

## Core loop: build a works (SET as a minimal first slice, Q31 c)

- **The idea:** find a sheltered harbour, get the rights (crown land under
  1706, a lease elsewhere, a governor's permit from 1780), and build a
  saltery or train-oil works.
- **Why it works as a loop:** herring is boiled into oil. Real ratio about
  10 riksdaler cost to about 60 sale per barrel, so processing multiplies
  value. `TODO(felix): confirm the ratio against a source.`
- **Feel:** a diorama. You sail in and do it yourself, simplified, not Age of
  Empires. Small workers are optional.
- **Trade around it:** French and foreign oil ships offer trade, and a little
  smuggling. Rules tighten later in the era (permits, inspections).
- **First slice (SET, Q31 c):** one loop, built minimal: sail to a harbour,
  get rights, build a small works, carry oil by sea, sell to a foreign ship.
  The older markets and production systems (3 and 4 above) and the T0-T8
  table get reshaped around this slice; rewrite them later.

## Seasons (SET, Q32)

**Season = the era's mood, fixed per era**, following the year arc in the
epochs section. Winter fishing can appear as chapters inside an era. The great herring fishery was a winter
fishery: short days, storms, ice in inner fjords, open boats, seine nets.
Winter should feel very different from the summer lure.

## Working title (SET as working, Q33)

Working title: **"Windward: Honour and Life"**. It hints that it is not just
sailing, it is living: adventurous and explorative. It is our own phrase;
**do not present it as a historical quote** unless Olán or Holmberg confirm
the wording. Keep checking. It came from the free-port asylum rule. **Checked
2026-11-05, wording not confirmed:**
- English Wikipedia ("Marstrand Free Port", section Criminals): "As long as
  their crime concerned no matters of 'honour and life', they were afforded
  full legal protection." Its only source for this is Olán (1917); it is not
  a quote of the 1775 charter.
- Swedish Wikipedia ("Frihamnen Marstrand"): refuge "på grund av skuld eller
  mindre svåra förbrytelser" gave "säkerhet till person och egendom" (debt or
  lesser crimes; security of person and property). It never uses "ära",
  "heder" or "liv".
- Grimberg, *Svenska folkets underbara öden* vol. VII, p. 73 (read at
  runeberg.org/sfubon/7/0075.html): "Envar, som för skuld eller mindre svåra
  förbrytelser tog sin tillflykt till Marstrand, åtnjöt där säkerhet till
  person och egendom." Grimberg paraphrases the 1775 privilegium; it is not a
  quote of the regulation.
- Not found: any Swedish "honour and life" phrase (ära, heder, liv) in
  anything read. Olán (1917), *Marstrands historia, krigsminnen och
  badortslif*, could not be read online (only a catalogue stub).
- Third check (2026-11-05): archive.org has neither Olán (1917) nor Holmberg
  (1867); Libris returned "Access Denied". archive.org did give a
  nineteenth-century text on the charter itself, Hartelius, *Om luft och bad
  m.m. vid Marstrand* (1862): "Föga, eller åtminstone mindre långvarig,
  vederqvickelse erfor Marstrand af Gustaf den III:s nådegåfva i författningen
  1775, som gjorde den till en frihamn." (OCR reads "4775".) It says nothing
  on refuge or crime, and only about 60% of that book was read verbatim.
  Still to try: a Swedish library for Olán (1917) and Holmberg (1867), or a
  digitised text of the 1775 privilegium itself.
- The title idea also collides with the draft epoch: "Honour and Life" is
  already the name of era 3 (1775-1794), while the epoch is "Herring and
  Light".

## Earlier era candidates (kept for the record; superseded by the epochs section above)

All dates are Felix's candidate windows. Historical facts beyond them are
`TODO(felix): confirm` against the lab data, which cites its sources.
"Buffer" = what extra years before or after the window would buy.

1. **Tordenskjold's war, 1700-1720.**
   For: dramatic; privateers and fortress (Carlsten) as gentle tension.
   Against: war is the theme, which fights "no combat"; thin economy; few
   or no lights, so fog is brutal.
   Buffer: start earlier shows the coast before the war; end later runs into
   era 2.
2. **East India + herring returns, 1731-1774.**
   For: Götheborg's sinking (1745) is a ready story beat and the "poor era"
   to land in; a clear poor-to-rich arc into era 3.
   Against: East India trade happens at Gothenburg, not the small-boat coast;
   herring return date needs checking against the 1747 start in this doc.
   Buffer: ending later at 1774 makes the free-port declaration the payoff.
3. **Free port + herring boom, 1775-1794.**
   For: every hook in this doc fits (shoals, Marstrand, smuggling, Carlsten);
   the richest economy.
   Against: the obvious choice, so least surprising; the free port ends 1794;
   lights of today's kind are probably few. `TODO(felix): confirm.`
   Buffer: start earlier to witness the port declared; end later is era 4.
4. **Herring crash, Napoleonic smuggling, Lasse-Maja, 1795-1815.**
   For: smuggling, a real folk character, a strong mood shift from era 3.
   Against: the crash is grim for a cosy game (pillar 3); needs a gentle way
   to show decline.
   Buffer: start earlier lets the boom visibly end; end later shows recovery.
5. **Lights go up, 1840-1876.**
   For: the time-lapse of towers rising is this era; best fit for "fog makes
   lighthouses essential"; sail still dominant.
   Against: the herring economy is over, so trade needs other goods.
   Buffer: start earlier is darker, with fewer lights; end later meets era 6.
6. **Second herring boom + granite, 1877-1906.**
   For: new good (granite); steam arriving gives a "last days of sail" mood.
   Against: overlaps the ~1905 opening, so little contrast if both are used.
   Buffer: end later is the opening's own date.
7. **Today's summer coast (current free-sail mode).**
   For: already built; the natural no-save lure and the real-coast reference.
   Against: no mystery; the least "jump" feeling.
   Buffer: n/a.

First-jump destination: SET, about 1700, the end of New border (see "The
flow"). The older 1745 idea is dropped.

## Decisions log

Status: **OPEN**, **SET** (Felix said it), **DRAFT** (Felix's proposal, not
yet grilled), **INFERRED** (my reading, confirm).

| # | Decision | Status | What we have |
|---|---|---|---|
| 1 | Era | **SET** | Seven epoch slots and 17 eras, single source `data/epochs.json`. Built for real first: the end of New border (~1700), Crown shores, The silver comes, Honour and Life, plus Today and the ~1905 opening. The rest are tastes or time-lapses. |
| 2 | Shared fortune or separate | **SET** | Separate purses (Q7). Must work with the drop-in/drop-out flow: what happens to shared contracts, cargo and bonuses when someone leaves mid-trip is open. |
| 3 | Provisions | **SET** | One combined "stores" meter, planned but not at the start. It must matter enough to make you sail into ports. |
| 4 | Session shape | **SET** | No-save mode is the lure: jump in, sail, pretty. The real game is saves + friends + story + history + trading. 5 minutes must still feel rewarding; longer play goes deeper. Phone = short trips, laptop = bigger missions. |
| 5 | Player trade | **SET** | Only when moored together or close at sea; sea trades more limited. |
| 6 | Contraband and free port | **SET** | Definitely in. Historical characters (Lasse-Maja and others) at some point. |
| 7 | Win condition | **SET** | None. Stay in an era or move on; staying never stagnates, moving changes flavour and unlocks things. Later eras can be later releases, so plan them ahead. |
| 8 | The lure / first minutes | **SET** | Free sailing first, alive with small interactions, an early port or house trigger. The story starts when you choose it, e.g. from a port. See "The first minutes". |
| 9 | What crosses an era jump | **SET** | Knowledge travels; boat, cargo and money do not; buried treasure is the one exception. |
| 10 | Solo vs co-op | **SET** | No up-front choice. Anyone joins before the story; start the story solo or together; either player can drop in or out; story never blocks the other player. See "Playing together". |
| 11 | Light patterns in data | **SET, built, not merged** | Sourced characteristics (Lighthouse Directory) in `src/lighthouses.js` on branch `felix/windward-lighthouses` (commit `d02dcbf`). That worktree also has uncommitted edits. The meaning at the return is still open. |
| 12 | Start area and history depth | **SET** | West Orust. Broad coast-wide history plus deeper niche history for the start area. |
| 13 | Pre-story year | **SET** | Today's coast. Choosing the story at a port plays the time-lapse backwards to the opening year. |
| 14 | Whose world | **SET** | Everyone owns their own world and save. Together = visiting a friend's world; leaving sends you home. Shared contracts and market effects are a later, separate protocol. |
| 15 | Signature co-op move | **SET** (timing open) | The pair net, sweeping different things by era and place (fish is one use). May arrive with the visiting stage. Early co-op = smart ping + pair net. |
| 16 | Port arrival | **SET** | Sensory reward + a small gift (a fish) + the story offered quietly. Fallback: a simple port menu. No long dialogue UI. |
| 17 | What a visitor brings | **SET** | Your own stuff comes along; earnings go home. A trade cap later if needed. |
| 18 | Visiting with mismatched progress | **OPEN** | Leaning d or a with a mist filter. Not locked; decide when the story stage is designed. |
| 19 | Treasure causality | **SET** | Something is lost during the opening (the storm takes granddad's sea chest) and found after the first jump. |
| 20 | Stage order | **SET** | Lure, then co-op visiting, then chart/storm/jump, then trade. |
| 21 | Chart shape | **SET** | Fixed sections first (inherited or bought), exploring reveals detail on top. |
| 22 | Fog | **SET** | No hard edge on today's coast; fog thickens gradually; a lighthouse beam or foghorn carries through it (no walls, no prompts); thunder in free-sail is a warning, only lightning fog commits; weather fog drifts, edge fog is fixed, story fog brings thunder and flashes; one fog-start distance per side; one fog at three depths (quiet edge, thunder warning, commit flashes), and the story can start at any data edge. |
| 23 | Money before trade | **SET** | Barter and favours. Pair-net finds (barrels, flotsam) are gifts and trade goods for chart sections. No early currency. |
| 24 | Items before the hold | **SET** | Three or four visible items on deck; grows into the hold later. |
| 25 | What persists before the story | **SET** | Small things kept on this device, moved into the save when the story starts. Device-only. |
| 26 | Chart sections cut | **SET** | By place (west Orust = granddad's chart), each with its own history and sweet spots; lighthouses are markers inside sections. |
| 27 | Stage cut | **SET** | Fog, beams and the thunder warning ship with the lure. Stage 3 splits into 3a (saving, chart, story start at a port) and 3b (storm, jump, time-lapse, sea chest). |
| 28 | Terms | **SET** | Epoch (about 100+ years, roughly one release) and era (10-40 years, own tone, season, history, rules). |
| 29 | Epochs and eras | **SET** (data unverified in places) | I Kings and raiders, II New Crown, III The Silver Sea, IV Light and Stone, V Engines and wars, VI Summer guests, Today (the lure). Vibe and season per era; one year of seasons across the timeline. `epochs.json` wins over this doc. |
| 30 | Core loop: build a works | **SET** (minimal slice) | Sail to a harbour, get rights, build a small works, carry oil by sea, sell to a foreign ship (Q31 c). |
| 31 | Seasons | **SET** | Season = the era's mood, fixed per era, following the year arc. Winter fishing can appear as chapters inside an era (Q32). |
| 32 | Title | **SET as working title** | "Windward: Honour and Life". Our own phrase, not a historical quote unless Olán or Holmberg confirm the wording; keep checking. Also the name of era "Honour and Life". |
| 33 | The flow | **SET** | Start casual on Today's coast, a time warp to ~1905 (the opening: granddad's chart, lighthouses), the first jump lands at the end of New border (~1700), and the 1706 ordinance soon lets you claim islands and build. |
| 34 | Opening year | **SET** | About 1905, the end of Light and Stone. |
| 35 | Pair-net haul split | **SET** | Split evenly; each half goes to each player's own save (Q29). |
| 36 | Unlocking eras | **SET** (principle), design **OPEN** | Eras do not unlock in order. Unlocks are spaced across the timeline so moving back and forth in time is engaging and earlier eras stay relevant. Spacing and reasons to return are open (round 8). |

## Gaps (to grill)

Recorded 2026-11-05; resolved ones move into the log above.

- **Pair-net odd items:** an even split leaves odd items; which half gets
  the extra one?
- **Visiting with mismatched progress (Q15, OPEN):** decide when the story
  stage is designed; notes above.
- **Saving:** a world needs an owner and a save for visiting to mean
  "a friend's world". Before the story (stages 1-2) a visit is a room with
  no save; the first real save is needed at stage 3.
- **The sea chest:** what is in it, how the player finds it after the jump,
  and how "understands later" lands.
- **Stage 5 rewrite:** T0-T8 is the trade phase and still assumes one era;
  rewrite it around the works slice (Q31 c).
- **Chart sections:** how many, what each reveals, who authors them, and
  what each barter asks for (Q23 c). Cut by place (Q27 a).
- **Backwards time-lapse:** lights have a year-range lab on
  `felix/windward-lighthouses` (its commit message mentions a Play
  timeline, not verified here); boats and palette are not year-driven yet.
- **Where a gifted fish goes:** the port gift happens before the story, so
  before there is a hold or an inventory. A visual-only prop, or a first
  taste of the hold?
- **Shared contracts and market effects:** a separate protocol between
  worlds, later.
- **Opening year:** held with Q1.
- **The returned-to opening:** what do the flash patterns unlock?
- **Coverage:** the settlements data has Käringön, Gullholmen and
  Hälleviksstrand but not Härmanö. The start area needs the deeper history
  layer anyway.
- **Unmerged inputs:** lights (`felix/windward-lighthouses`) and the real
  coast and settlements (`felix/windward-real-coast`) are not on `main`.
- **Unlock design (round 8):** spacing across the timeline and the reasons
  to return (Q30).
- **Parked items re-opened (round 8):** the sea chest, the flash patterns,
  and Q15 under non-ordered unlocks.
- **`epochs.json` release field:** it marks epoch III as the first release
  (proposed), while Q1 builds parts of II, III and IV and leaves out Last
  silver. Data not edited here.
- **Lights cross-check:** the lit years in `epochs.json` against the sourced
  built years in `lighthouses.js` (branch `felix/windward-lighthouses`).
- **Source check for the epoch draft:** every date and figure (1706
  ordinance, 1780 permits, 1783 inspection, the riksdaler ratio) needs a
  cited source.
- **Pitch rewrite:** "The pitch" and "Why this era" still describe one era;
  rewrite once Q1 is settled.

## Sources

- Great herring period 1747-1809: Rigby's Encyclopaedia of the Herring,
  https://www.herripedia.com/bohuslan/
- Marstrand Free Port 1775-1794: https://en.wikipedia.org/wiki/Marstrand_Free_Port
- NorFish herring landings 1520-1808 (licence to check):
  https://gbif.org/dataset/5cd986a3-9180-4a11-b2a7-7f340e062b52
- Marstrand free port asylum wording (checked 2026-11-05, unconfirmed):
  https://en.wikipedia.org/wiki/Marstrand_Free_Port and
  https://sv.wikipedia.org/wiki/Frihamnen_Marstrand and
  https://runeberg.org/sfubon/7/0075.html and
  https://archive.org/stream/arkivkopia.se-runeberg-htjomluft/htjomluft_djvu.txt
