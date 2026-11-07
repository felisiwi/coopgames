# Windward — game design plan

Status: plan, not built. Written 2026-11-05 from Felix's brief. Grill it
(`/grill-me`) before any of it is built, then keep this file as the single
source of truth: when a decision changes, change it here first.

Updated 2026-11-05 after Felix's first answers: the game is now framed as
**era-jumping** with a retro opening (see "The opening" and "The frame"). The
single-era pitch below is the *middle* of that frame, not the whole game.
*Update 2026-11-05: Q1 is SET (see "Shared understanding" and the
decisions log); the grilling is complete.*

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
  wrong place. *Updated 2026-11-05: state is per era; see "Data model: the
  world remembers".*

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
3. **3a, saving, chart, story start at a port:** the first real save (with per-era world state);
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
  port. A second way in is the fog and thunder (see "Fog"): lingering in edge fog
  until thunder is an offer (a warning you can sail out of); only the
  lightning-flash fog commits (SET, confirmed 2026-11-05).
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
  Orust around Käringön / Härmanö / Gullholmen / Hälleviksstrand
  (SET, confirmed 2026-11-05).
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
  **Stays locked (SET, Q36 a)** until a later, spaced unlock: the "almost
  forgotten" return. Today's coast is always open. What the lights mean is in
  "Reasons to return, sea marks and flash patterns".

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
- **Treasure across time (SET, Q16 a; contents Q37 b + d):** something is
  lost during the opening (the storm takes granddad's sea chest) and found
  after the first jump; the player understands later. The chest holds
  granddad's letters or log, plus one anachronistic object (a lamp part)
  whose purpose you learn later. The earlier idea that it lifts you from poor
  into the free-port heyday is not part of these contents; revisit if wanted.
  **Found in two steps (SET, Q42 d):** the letters wash ashore first; the
  lamp part turns up later, elsewhere.
- **Eras do not unlock in order (SET, Q30 and Q34 b).** Unlocks are spaced
  across the timeline so moving back and forth in time is engaging and
  earlier eras stay relevant. They come as **cause-and-effect pairs**: every
  unlock opens two eras linked by a cause (a harbour claimed in 1706, its ruin
  in 1820). Once unlocked, you jump freely.
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
- **Visiting with different unlocks (SET, Q39: b first, then a):** build the
  simpler version first. You can only visit eras you have both unlocked (b);
  it needs no per-item unlock keys and no mist rendering. Later, option a:
  mist on whatever the visitor has not unlocked, and net-haul items from
  locked eras arrive as a "mysterious find". **Fog while visiting (SET, Q44 c for now):** no
  crossing while visiting; edge fog is just fog. Later idea: the host proposes
  a crossing and the visitor consents, and they cross together, only if it is
  not much extra work; otherwise a later feature.
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

## Data model: the world remembers (SET, Felix 2026-11-05)

**Each era keeps its own persistent world state in the save.** No goods cross
a jump (Q9); the world remembers. A harbour claimed in 1706 is yours there, a
ruin in 1820 and a heritage site in 1905.

Save sketch (not final):

- **Player:** identity, boat, and what travels: knowledge (chart sections,
  discoveries, history cards).
- **Per-era state, keyed by era id from `epochs.json`:** what you claimed,
  built and lit in that era, plus that era's boat, deck items and hold (these
  stay behind when you jump).
- **Unlocks:** which eras are open, and the cause-and-effect pair each
  unlock belongs to (see "The frame").
- **Story flags:** the chest, the storm, and so on.
- Keying by era id lets a later era ship as a later release without touching
  the others.
- Visitors see the host's state; every player's own world stays their own
  (Q11).
- **Stored actions, derived looks (SET, Q40 a):** the save keeps what the
  player did; how the world looks later comes from era rules at runtime. Each
  cause-and-effect pair therefore needs its derivation rule written.

## Reasons to return, sea marks and flash patterns (SET, Felix 2026-11-05)

- **Things you leave behind (Q35 a):** the per-era state above. A claim made
  early shows up changed in later eras.
- **Sea marks as anchors (Q35 e):** a crossing is anchored by whatever sea
  mark that era has. Lighthouses barely exist before 1840 (`epochs.json`
  lists only Carlsten, 1782), so earlier eras use stone cairns (*kummel*),
  daymarks, beacon fires (*vårdkasar*) and church towers; lighthouses from
  1840. The marks becoming more official over time is itself a way to show
  time passing. `TODO(felix): a sourced timeline of which sea marks exist in
  each era; it is not in the data yet.`
- **Flash patterns (Q38 a):** a flash pattern identifies which light you are
  seeing in fog, read together with your chart because patterns repeat (for
  example "two flashes every 6 s" is shared by Eggskär, Mollösund, Hättan,
  Sandviksholmen and Kråksundsgap Södra in `lighthouses.js`). They also matter
  when sailing at night: at night, lights are how you navigate. A way-home
  sequence of patterns (Q38 b) is a possible later addition.
- **Pairs, in build order (SET, Q41):** all four are in the plan.
  (d) a hut on crown land in 1706 becomes a saltery in The silver comes,
  ships first, both playable in release one. Then (a) a harbour claim, its
  ruin, a heritage site; (b) a beacon fire, then a lighthouse on the same
  skerry; (c) a smuggler's cache, then the same cove in Spirits at sea. The
  later ones follow as their eras get built.
- **Day and night (SET, Q43 a):** a full day-night cycle, with the season
  setting the day length. Night is a gameplay trade-off, not just mood: it is
  easier to slip past for smuggling and harder to navigate, and that is when
  lighthouses, flash patterns and sea marks really matter. Keep it cosy and
  phone-friendly (for example moonlit nights, beacon fires in early eras, a
  sensible night length). The how (SET, round 10):
  - **Length (Q45 a + c):** the season scales the night honestly. On the west
    coast summer nights are a short blue twilight (*ljusa nätter*), the Skagen
    "blue hour" look, so summer nights are short and pretty rather than dark.
    Real darkness lives in autumn and winter eras, the 1905 opening, winter
    chapters, and fog and storm events. The look is recorded
    on branch `felix/windward-look` (`DESIGN.md`, "Look pass 3") and in PR #5
    (`ART.md`), both unmerged; it lands on main at the next merge.
  - **Skipping (Q46 b):** skip the night only in a harbour or moored;
    harbours become shelter.
  - **Navigation (Q47 c):** both, mildly: a moonlit dim, landmarks fade,
    lights and fires stay bright and visible from far.
  - **Smuggling (Q48 c, then a):** in the very first slice night only affects
    navigation; when Honour and Life is built (it is in release one), visible
    customs boats and Carlsten lookouts with sweeping lanterns. No hidden risk
    number.
  - **Beacons (Q49 a + c):** a few village beacons are reliably lit at known
    spots, so early eras are navigable, and you can light your own (feeds
    pair b: beacon to lighthouse).
  - **The lure (Q50 a):** Today's coast has the same cycle. Its summer night
    is a brief blue hour where the lighthouses blink on, a first-session
    moment, never pitch dark.
- **Not chosen:** knowledge keys, season and material needs, and people
  across eras (Q35 b-d). Knowledge keys already follow from "knowledge
  travels" (Q9); revisit the others if the pairs need them.

## Shared understanding (CONFIRMED, Felix 2026-11-05)

The grilling is complete: every branch of the design tree has been visited
and Felix confirmed this summary, with the corrections folded in. Where this
section and an older section disagree, this one wins; change the older text
when you touch it.

**Shape**
- **Look:** Skagen-painter palette, pastel and slightly cold, blue-hour
  light (branch `felix/windward-look`, `DESIGN.md` "Look pass 3").
- **Start:** west Orust (Käringön / Härmanö / Gullholmen / Hälleviksstrand).
- **Today's coast is never dead:** small life (fish, boats, birds); sailing
  into a port or up to a house triggers something small (a wave, a tossed
  fish); the story is offered quietly at a port. A **"just sail" mode stays
  available.**
- **Two ways into the story:** choose it at a port, or linger in edge fog
  until thunder (a warning you can sail out of; only the lightning-flash fog
  commits).
- **~1905 is the opening chapter, not just a storm:** granddad's chart, the
  lights teaching navigation, chill sailing. It ends in the storm that throws
  you to ~1700.
- **Phone = short trips that still feel rewarding; laptop = bigger
  missions.** Five minutes must always be worth it.
- **No ending:** stay in an era or move on; staying never stagnates.

**Time**
- Seasons run as one year across the timeline (autumn to winter in epoch I,
  spring in New border, summer in Today); winter chapters can sit inside
  eras.
- First release builds for real: the end of New border, Crown shores, The
  silver comes, Honour and Life, plus Today and the 1905 opening. The rest
  are tastes and time-lapses.
- Marstrand free port and smuggling are in; historical characters
  (Lasse-Maja and others) at some point.

**Sea and night**
- Before 1840 you steer by sea marks (cairns, daymarks, beacon fires, church
  towers); lighthouses from 1840. The marks becoming official is part of
  showing time pass.
- Night: short blue-hour summer nights; real dark in autumn/winter eras, the
  1905 opening and storms; skip only in harbour.

**Together**
- Solo first, drop in/out any time, nobody commits to solo or co-op up front.
- **Today's coast is the shared meeting place between times.**
- The pair net sweeps different things per era (barrels, flotsam, herring,
  contraband, wreck goods): not a fishing game. A smart ping is the cheap
  first co-op feature.

**The loop**
- Granddad's chart reveals a place-based section of an expandable mini-map;
  more sections come by exploring, barter or buying.
- Works loop: get rights to a harbour, build a saltery / oil works yourself
  (diorama feel, small workers optional), herring to oil (~10 to ~60
  riksdaler), carry it by sea, sell to foreign ships, a little smuggling,
  permits and inspections later in the era.

**Title**
- "Windward: Honour and Life" is the working title regardless; it is our own
  phrase. Do not present it as a historical quote unless Olán or Holmberg
  confirm the wording.

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
`firstRelease` field matches this (fixed 2026-11-05).

## The flow (SET, Felix 2026-11-05; replaces the earlier opening order)

1. **You start casual on Today's coast** (the lure; the data marks it 2015).
2. **A time warp takes you to about 1905**, the end of Light and Stone: the
   opening, granddad's chart, the lighthouses.
3. **The first jump lands at the end of New border (about 1700).** You warm up
   poor, and soon after the 1706 crown-land ordinance lets you claim islands
   and build. That is how eras are introduced naturally.

The timeline markers in the data are "you start (casual)" 2015, "time warp
lands" 1905 and "first jump lands" 1700.

## Characters, places and events (adapted from Realm of Thrones; DRAFT, Felix 2026-11-05)

Reference: `games/windward/docs/character-relations-system.md`, the Realm of
Thrones companion app's system written for reuse. What transfers is how
people, places and time are linked. Items marked **SET** are the adaptation
list Felix gave; items marked **PROPOSAL** are mine and open (round 11).

**Authored files vs the save (PROPOSAL).** Characters, bonds, places and the
event table are authored files, read-only at runtime. The player's own
actions live in the save (Q40) and are projected into the same event format
while the game runs; they are never written back into the files. Validation
would be a node script like `scripts/manifest.js`, which fits a repo with no
build framework. `TODO(felix): confirm.`

- **Files and ids (SET):** a file per character, a file per bond named by the
  sorted pair of ids (`a--b`). Ids are never guessed from a similar name: a
  link is certain or absent.
- **Derived facts are never stored (SET):** generations, whether two lives
  overlapped, who is in which scene, what exists at a given year. One rule,
  one place.
- **Gaps are reported, not invented (SET):** a missing portrait, an unplaced
  place, an unparseable date or a bond with no text becomes a note in a notes
  panel in the game's lab views. A bad file is skipped with a warning; the
  build never fails on content.
- **Explicit scene casts (SET):** a `cast: [ids]` line under each scene
  heading, validated, never name matching.
- **One date format and one parser (SET, Q56 a):** displayed as the real
  year plus a season, for example "Late summer 1787". **The year is the
  data; the season is derived** from the era (Q32, `epochs.json`), so it is
  never stored. A **chapter** inside an era (for example a winter chapter)
  may override the season with an explicit field. This adds a **chapter
  concept to the model**: an optional sub-span of an era with its own
  season. `epochs.json` has no chapters yet; adding them is a data task.
- **Places are files with ids (SET),** built from the real-coast data
  (settlements, lighthouses, harbours). A character's `place` is a place id,
  never free text. Reuse the ids already in `settlements-history.json`
  (phases, with a confidence key) and `lighthouses.js` (29 lights, sourced
  built years and light patterns). `TODO(felix): confirm the id scheme those
  files use.` Harbour data does not exist yet; it goes to the map agent's
  next pass.
- **One event spine (SET):** a single events table, `date | place_id | who
  (ids) | kind | text | source`, fed by era events (`epochs.json`),
  settlement phases, lighthouse years, story scenes and the player's saved
  actions (Q40), all in one format. So the year slider drives the map, the
  people and the story together. PROPOSAL for `kind`: era, settlement,
  light, scene, player.
- **Echoes across eras (SET):** each era-version of a person is its own
  character file with an era id, linked by a shared **thread id** (same
  soul, different century). Only the player sees the overlaps. **Temperament is shared per
  thread (Q54 a):** one base per thread; each era-version may shift up to one
  step (+/-1) per axis. **Bonds (SET, Q55 a, for now):** a bond file joins
  two era-versions in the same era; echoes are linked only by the thread id.
  Thread-level bond files are a later addition if needed. Because echoes
  never overlap in life, the "never crossed" computation must not apply to
  them.
- **Sourced history vs invented story (SET):** the RoT game/lore split
  becomes history/story. Real people (Lasse-Maja, merchants) carry sources,
  with the same high/medium/low confidence key as the settlements data;
  invented people are marked invented. Prose is prefixed `**(history)**` or
  `**(story)**`.
- **Temperament (SET, Q51-Q54):** five shared axes scored for everyone, so
  two cards compare at a glance.
  - **Axes (Q51):** Old ways-New ways, Rules-Free, Thrift-Spend,
    Kin-Stranger, Caution-Daring. (RoT used Duty-Freedom, Faith-Doubt,
    Lords-Kin, Caution-Daring, Silence-Speech.) Old-New is scored relative
    to the person's own era, so comparing it across eras is not the point.
  - **Scale (Q53 a):** 1-5, as RoT; 3 is the midpoint.
  - **What it does (Q52 a, then b):** first display only (cards and
    side-by-side comparison). Then small behaviours, for example how a
    harbourmaster treats contraband, how alert a lookout is, how a village
    welcomes you. **Temperament is visible once you have met someone**, so
    behaviour follows something the player can read; there is no hidden
    number behind it (consistent with Q48).
  - **Honesty rule:** temperament scores on real historical people are
    interpretation, so they are marked **story, not history**.

Character file sketch (PROPOSAL): `id`, `name`, `thread`, `era`, `role`,
`place` (place id), `born`, `died`, `status`, `basis` (history | invented),
`sources`, `traits`, `tags`, `summary`, and the body sections. **Format (SET,
Q57 c):** Markdown with YAML frontmatter for characters, bonds and places
(prose-heavy); JSON for events and epochs (tables of rows, like the existing
`epochs.json`). Needs two validators. `traits` holds the five scores, for
example `[Old-New 2, Rules-Free 4, Thrift-Spend 2, Kin-Stranger 3,
Caution-Daring 4]`.

## Build first: stage 1, the lure (PROPOSAL, 2026-11-05)

Scoped to what is already built. Nothing here is started; Felix decides.

**What already exists on main** (read from `game.js` and `src/`, 2026-11-05):
sailing (boat, sail trim, wind, fixed three-quarter camera, water, wake, sky),
a procedurally scattered archipelago, settlements with buildings, lighthouse
props, discoverables, a drop-in partner with a ping, phone controls and a
HUD. Stages 1 and 2 of the old plan, the phone work and drop-in play are
merged. Touch controls (`felix/windward-touch`, one commit) are not.

**What exists only on branches (unmerged):** the Skagen look
(`felix/windward-look`), the real-coast data and `epochs.json`
(`felix/windward-real-coast`), 29 sourced lighthouses
(`felix/windward-lighthouses`). All three are data or look work, not game
logic.

**What the lure still needs (checked by search, none exists in `src/`):**
fog (the sky only sets `fog: false`), thunder, birds, fish and other small
life, port or house arrival triggers, deck items, device-kept memory
(`localStorage`), and a day-night cycle.

**Proposed slice, in order** (each is playable and tested before the next):

1. **Merge what exists.** Look, real-coast data and lighthouses reach main
   (Felix merges; the touch controls branch too). Without the look the lure
   is not the game Felix described.
2. **Port or house arrival.** Sail up to a settlement building and get one
   small reaction: gulls scatter, a wave, a tossed fish onto the deck. The
   fallback is a simple port menu (start the story / leave). Uses the
   existing settlements and a proximity check like `discover.js`.
3. **Small life.** A few birds, fish and one drifting boat so the sea is
   never dead. Cheap and decorative; no interaction rules.
4. **Deck items and device memory.** Three or four items visible on the boat;
   kept in `localStorage` (device-only, Q26 b).
5. **Blue-hour sky.** A short fixed blue-hour moment first, with lighthouses
   blinking on, before a full day-night cycle (Q50 a).
6. **Quiet edge fog and the thunder warning.** One fog with a fixed edge
   distance, a rumble that fades because the story does not exist yet. The
   first piece that needs the fog numbers tuned (Q22 c).

**Open before it starts (Felix decides):**
- **Real west Orust coast or the procedural archipelago?** The playable game
  today uses procedural islands; the real coast exists only as data in the
  lab. Using the real coast in the lure is a large step; the proposal is to
  keep the procedural islands for stage 1 and move to the real coast with
  stage 3a, where the chart needs it. `TODO(felix): confirm.`
- **Order of steps 3 to 6**, or drop any of them to ship the lure sooner.
- **Mission control setup.** `AGENTS.md` expects a gated batch per commit and
  one agent per folder; stage 1 should be run that way, in a worktree.

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
| 18 | Visiting with different unlocks | **SET** (b first, then a) | Visit only eras both have unlocked first; later mist on what the visitor hasn't unlocked, with net-haul items from locked eras arriving as a mysterious find. Fog while visiting: no crossing for now (Q44 c). |
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
| 36 | Unlocking eras | **SET** | Eras do not unlock in order; unlocks are cause-and-effect pairs spaced across the timeline (Q30, Q34 b). |
| 37 | Per-era world state | **SET** | Each era keeps its own persistent state in the save; no goods cross, the world remembers (a 1706 claim is a ruin in 1820 and heritage in 1905). Keyed by era id. |
| 38 | Reasons to return | **SET** (a + e) | Things you leave behind, and sea marks as anchors (kummel, daymarks, vårdkasar, church towers; lighthouses from 1840). Marks getting more official shows time passing. |
| 39 | The opening stays locked | **SET** | The ~1905 opening stays locked until a later spaced unlock. Today's coast is always open. |
| 40 | The sea chest | **SET** (contents) | Granddad's letters or log plus one anachronistic object (a lamp part) whose purpose you learn later. Found in two steps: the letters wash ashore first, the lamp part turns up later, elsewhere (Q42 d). |
| 41 | Flash patterns | **SET** (a) | Identify which light you see in fog, read with the chart because patterns repeat; they also matter at night. A way-home sequence is a possible later addition. |
| 42 | Stored actions, derived looks | **SET** | The save keeps the player's actions per era; later looks come from era rules at runtime (Q40 a). |
| 43 | Pair build order | **SET** | d first (hut 1706 to saltery, both in release one), then a (claim, ruin, heritage), b (beacon fire to lighthouse), c (smuggler's cache to Spirits at sea) (Q41). |
| 44 | Day and night | **SET** | A full cycle, season sets day length; a trade-off (easier to slip past, harder to navigate). Summer nights are a short blue twilight; real darkness in autumn/winter eras, the 1905 opening, winter chapters, fog and storms. Skip only in harbour or moored; moonlit dim with fading landmarks while lights stay bright; customs boats and lookouts when Honour and Life is built; village beacons lit at known spots plus your own; the lure has the same cycle with a brief blue hour (Q43-Q50). |
| 45 | Fog while visiting | **SET** (for now) | No crossing while visiting; edge fog is just fog. Later: host proposes, visitor consents, they cross together, if cheap (Q44 c). |
| 46 | Characters, places, events | **SET** | File per character and per bond (sorted pair ids), ids never guessed, derived facts never stored, gaps reported, places as files, one event spine incl. the player's saved actions, history vs story, explicit scene casts. Date: year is the data, season derived from the era, chapters may override, shown as "Late summer 1787" (Q56 a). Echoes by thread id with a shared base temperament and +/-1 shift per era-version (Q54 a); bonds within an era only for now (Q55 a). Markdown + YAML for characters, bonds and places; JSON for events and epochs (Q57 c). Reference doc committed. |
| 47 | Temperament | **SET** | Axes: Old ways-New ways, Rules-Free, Thrift-Spend, Kin-Stranger, Caution-Daring; 1-5; display only first, then small behaviours, visible once you have met someone, no hidden number (Q51-Q53). Scores on real people are marked story, not history. |
| 48 | Shared understanding | **SET** | Felix confirmed the whole design on 2026-11-05 with corrections (look, start place, never-dead coast, two ways in, 1905 as a chapter, phone vs laptop, no ending, shared meeting place, pair net not a fishing game). See "Shared understanding". The grilling is complete. |
| 49 | Build first | **PROPOSAL** | Stage 1, the lure, scoped to what is built: merge look, real-coast data and lighthouses; then port arrival, small life, deck items with device memory, blue hour, quiet edge fog and thunder. Open: procedural islands or real coast for stage 1. |

## Gaps (to grill)

Recorded 2026-11-05; resolved ones move into the log above.

- **Pair-net odd items:** an even split leaves odd items; which half gets
  the extra one?
- **Saving:** a world needs an owner and a save for visiting to mean
  "a friend's world". Before the story (stages 1-2) a visit is a room with
  no save; the first real save is needed at stage 3.
- **How "understands later" lands:** which later moment explains the
  letters and the lamp part.
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
- **Coverage:** the settlements data has Käringön, Gullholmen and
  Hälleviksstrand but not Härmanö. The start area needs the deeper history
  layer anyway.
- **Unmerged inputs:** lights (`felix/windward-lighthouses`) and the real
  coast and settlements (`felix/windward-real-coast`) are not on `main`.
- **Derivation rules per pair:** the first one needed is pair d (hut to
  saltery).
- **Sea marks timeline:** a sourced list of what sea marks exist in each era.
- **Chapters in the data:** `epochs.json` needs the chapter concept (an
  optional sub-span of an era with its own season), Q56 a.
- **Two validators:** one for Markdown + YAML files, one for the JSON tables
  (Q57 c); id scheme of the existing settlements and lighthouses data still
  to confirm.
- **Customs boats and lookouts:** their design, when Honour and Life is built.
- **Harbour data:** does not exist yet; it goes to the map agent's next
  pass. Places need it.
- **Host-proposed crossing:** the later idea in Q44, only if cheap.
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

## Felix's inputs (2026-11-05, evening): start area, life, people, harbour arrival

**Start area.** Felix's chart photos (Figma "Labs", page Westcoast) show two dense clusters
of red dots (places he remembers): (1) the skerries around Storön / Gåsö / Kalvön west of
Grundsund and Fiskebäckskil, and (2) Härmanö / Gullholmen / Kråkesund / Käringön. Start
anywhere close to these. Both were early fishing islands (Fiskebäckskil ~1500s, Grundsund
by ~1600s, Käringön 1659), so there is plenty to explore even in early eras. Blue dots were
planned overnight stops, nothing special.

**Felix's natural harbours** (Figma frames with his own photos, Aug 2026, each labelled with
the wind directions it suits): Rammen, Bredholmen, Skarvesäter, Usholmen,
Testholmarna-Usholmen, DammholmeSkären, Porsholmen, Västra Danholmen, Kråkesundsgap,
Altarholmen, Skaboholmen, Smörasken, Assholmen, Jonsborg, Vasholmarna. These are the first
harbour/anchorage data: real places, real photos, and a shelter-by-wind-direction rule
(fits Q46: skip the night only in harbour). The same page has his day-by-day wind log
(e.g. "Monday: Smörasken. Morning S5, Midday NNE3, Evening N5, Night N5"), a good reference
for believable wind patterns. Geocoded 2026-11-05 by exact OSM name: 8 placed, 7 unplaced, see `assets/coast/names.json` and `docs/COAST-TRIAL.md` (stage 1a); Felix to confirm the unplaced ones.

**Small life (fitting each era, nothing modern in early eras):** gulls (also on buoys and
sea marks), eiders, harbour seals, buoys/marks of the era. Cheap to build, makes the world
feel alive.

**Granddad.** Very loved. Loved sailing and exploring. Knew the old ways, and knew a lot of
people from his younger days. (His letters are found after the first jump, Q42 d.)

**First friend after the jump.** Lives around 1700 (end of New border): a young adult then,
born ~1675–1685, old enough to remember stories of Norwegian/Danish times, and about to live
through the Great Northern War (1700–1721; Tordenskjold takes Marstrand 1719). Proposal: from
a start-area fishing village that existed then (Fiskebäckskil or Grundsund). Felix to shape.

**Harbour arrival (stage 1 spec seed):** a bell, maybe a horn, gulls in the background.

**Music:** flexible: fitting, cute, easy background music for now.

**Start: Grundsund (Felix, 2026-11-05).** Start at Grundsund, with Fiskebäckskil and Lysekil
north and Gullholmen and Härmanö south to explore in the early game.

**Names are discovered.** Islands, skerries and natural harbours have no names on the
chart/mini-map until you have seen them first; then the name appears (and stays, per Q9:
knowledge crosses eras).

## IDEA (Felix, 2026-11-05, not decided): you age, eras keep their own clocks

Two clocks instead of one: the **world year** of each era, and **your own age**, which only
moves forward. Early eras you play young, later eras older. When you hop back to an era you
last saw as a young person, you return at your current (older) age, and that era's own clock
has moved on too: people have grown, new places exist, your claims have developed or
decayed. Familiar places feel new again. Fits "each era keeps its own world state" (Q40) and
eras having spans (e.g. Crown shores 1706–1746) with room to move forward inside them.
Nice side effect: the first jump to ~1700 makes you young, a peer of Torhild.

Open questions to grill: what advances your age (play time, jumps, story beats)?; what does
an era's clock do while you're away (advance by your time away, or by story)?; what age
changes in play (look, voice, what people expect of you, abilities such as weather sense)?;
age bounds; how it fits "same character reimagined per era"; content cost (people at several
ages).

**Ageing: Felix's answers (2026-11-05, leaning, not final):**
- What ages you: **story beats, mostly the forward jumps** (mission control's recommendation,
  accepted). Going back in time keeps your age. Never ages you by accident.
- An era's clock while you're away: **moves on in steps** (recommendation, accepted): each
  return advances that era a set amount (e.g. 5–10 years), capped by the era's span, so each
  step is a designable world state (fits Q40: derived from rules + your actions).
- What age changes: **all four**: looks and voice; how people treat you; skills (young =
  quick and nimble, older = reads weather, sea and people better); what you can do (some
  things open only at an age: own land, captain a ship, marry).
- Who ages with you: **core people plus anyone you've met**. Strangers you never met are
  era-locals. Content grows with who you actually know; met villagers can age by rules
  (look variants), core people are authored at several ages.

## Chart naming (Felix, 2026-11-05, Map Lab)

- **Islands, skerries and villages keep their real names in every era.** If a documented older
  spelling exists, early eras show it (e.g. Gottskär as Gåttskiähl, late 1600s). A completely
  different name only where history really had one. Lighthouse rocks before their light
  existed are plain skerries under their real name.
- **Style: real old names first**, made readable for English players; lore names where none fit.
- **Chart sections (granddad's chart):** The Border Skerries (Koster & Strömstad) ·
  The Cliffy Coast (Fjällbacka & Hamburgsund) · The Granite Fjord (Smögen & Lysekil, at the
  mouth of Gullmarsfjorden) · **The Shallow Sounds** (Grundsund & west Orust, start; Grundsund
  means "shallow sound") · The Crown's Fortress (Tjörn & Marstrand; strict, military,
  Carlsten) · The Göta River Mouth (Göteborg skerries) · Goose Inlet (Onsala & Gottskär;
  from Gottskär's medieval name Gåsekil). Modern area names show as subtitles.
- **Map UI direction (Map Lab):** big chart in sections (tap to zoom in), fog over unexplored
  areas that lifts where you've sailed, minimap, edge tags for nearby harbours, pinch zoom,
  names revealed on discovery. Lab: claude.ai artifact "Windward Map Lab" (settings to
  compare minimap shape/rotation, tag modes, label modes, reveal radius).
- **Descriptive names before discovery (Felix):** big areas have general names; specific
  places (islands, skerries, harbours, villages) show a descriptive name until you've been
  close ("Goose Isle", "the shallow sound", "the Hood"). Once discovered, the real name
  appears, with the description kept underneath ("Grundsund · the shallow sound").
  Descriptions are written as lore, partly from what the Swedish names mean; they are not
  etymology claims.

## Felix's favourite places: Google Maps list "Segling" (2026-11-05)

Read via Chrome from his shared list (23 places). West-coast entries, north to south:
- Alvöns naturreservat (Hunnebostrand), Hunnebostrand, Smögens Gästhem (Smögen)
- Lysekil
- **Vrakevik**: his own pin at 58.238711 N, 11.385059 E (the name is his note)
- Vasholmarna (island), Skarvesäter (island), Grundsunds fiskehamn & gästhamn
- Gullholmens Gästhamn, Käringön, Altarholmen (island)
- **Kråksundsgap, Kråkholmen**: his pin at 58.104431 N, 11.439134 E
- Tornholmen (island), Åstols Café, Skärhamns gästhamn, Klädesholmens Gästhamn
- Nordön, Rammen (island), **Skinnbroken, Rammholmen**: his pin at 57.859606 N, 11.561551 E
- Bussholmen (island), Marstrands Gästhamn
(Two pins are not on the west coast and are ignored.) Use these as granddad's chart marks /
sweet spots and as harbour candidates; geocode the named ones from OSM by exact name, use the
three pinned coordinates as given. Note: Rammen sits by Marstrand (near Rammholmen), outside
the current Grundsund region, consistent with the coast agent's finding.
- **Smörasken** (from Felix's Skippo link, harbour id 127978): a lagoon harbour in Häröns
  naturreservat on Härön by Kyrkesund (Tjörn), approx. 58.0017 N, 11.475 E (map centre on the
  page; may be off by a little). Outside the current Grundsund region (south edge 58.085 N);
  place it when the map grows south.

**Boats:** see docs/BOAT-BRIEF.md: today = granddad's koster "Svalan" (varnished, white
sails); ~1700 = a small tarred eka with a tanned spritsail and oars; masthead pennant in the
player's colour; visible deck items, night lantern, worn and mended.

**Terrain look (Felix, 2026-11-05, from terrain-lab):** crisp zones with soft edges
(`crisp=1 soft=0.82`), granite only on the steepest ground (`rock=1 slope=55`, the slider max),
grain on, no terraces, no edge lines. Link:
terrain-lab.html?at=Käringön&crisp=1&soft=0.82&rock=1&slope=55&step=3.5&grain=1.
Port in stage 1c via attachTerrainStyle() (branch felix/windward-terrain-style). Follow-up:
trees should obey the same slope rule (no trees on painted granite).

## Felix's 1c ideas (2026-11-05, late)
- **Lighthouses on Today's coast:** before the first jump, the chart and minimap show the
  lighthouses and you can go and look at them ("they look cute and are a core part of the game").
  Mission control's suggestion: Today is the modern, casual coast, so the lights are already on
  every modern chart; the mystery belongs to the past eras. Tap a lighthouse on the chart, and
  the camera flies there for a look (a "visit" view) while the boat stays where it is; sailing
  there is still how you go. Decide with Felix whether the boat can also jump.
- **Zoom out further:** zoom out more than today, so you see more around you. It isn't
  infinite: zooming out past a limit turns smoothly into the chart.
- **Minimap for short hops:** it should make it easy to sail short distances (e.g. just
  outside a harbour) without feeling lost.
- **Leading marks in and out of harbours, time-appropriate:** Today = the real buoyage
  (lateral red/green, cardinals, lit beacons). Old eras = cairns (kummel), painted rock
  marks, spar marks and leading lines, the marks the "sea marks before 1840" idea already uses.

## Felix's 1c phone test (2026-11-06)
Loved it: the lighthouses, the camera glide back to the boat, the sounds, the minimap ("minimal
feels good"), sticky edge names for big places (Fiskebäckskil, Lysekil).

Changes he asked for:
- **Chart:** show your boat on the chart as a little miniature/arrow pointing your heading.
  Uncharted sections must NOT show the chart, only their big lore/descriptive name until you
  sail there.
- **"Navigate here":** tapping a lighthouse (or place) on the chart offers "Navigate here",
  which shows it as a distant edge name/tag you can follow, so the sail there is the fun part.
- **One-handed sailing:** a static rope bottom-right that you pull in or let out to trim,
  while the other finger points/holds the course as now.
- **"Trimmed" UI:** the colour is great but should stand out more.
- **Names:** don't show a name before you can see that land; names appear when it's revealed.
  Subtly show the names of explored islands as you sail past.
- **Shallows:** mark grund and grynnor (shoals) where they really exist, and they stop the
  boat (no sailing over them).
- **Harbour marks:** clearer red and green lateral marks leading into harbours, plus
  cardinal marks (reference: ref/cardinal-marks.png, IALA cardinal marks with their light
  rhythms).
- **Harbour menu:** he tried to sail into a harbour and open a menu; not built yet (later).

**First task (Today's coast): the dark lighthouses.** A recent storm put the 5 lighthouses
nearest the start out of action. A lightweight start screen tells you this: restore them,
then return to **grandma in Fiskebäckskil** to report. Lightweight version: sail to each one;
close enough, the boat moors, the camera does the lighthouse-visit view, slowly circles, and
the light comes back on. Meeting the lighthouse keeper comes later. (Fits "lighthouses as a
tutorial" and the storm/thunder that leads to the first jump.)

**Name idea:** Torhild (Torild), from Þórr (thunder) + hildr (battle): "thunder fight" /
"storm battle". Felix: a good name "for my friend".

**Decisions (2026-11-06):** rope control = option A (absolute rope: handle position is the trim,
green sweet band, glows when trimmed). Generated harbour-mouth marks (where OSM has none) look
the same as real ones in the game; only the chart/debug view tells them apart (`invented: true`).
**Torhild** is the friend you meet in 1700 (whether she joins Brita or takes her place is open).
Local shoal words here are båd/både and flut (e.g. Sverkerbådan, Smedjeflut), not grund/grynna.

**Decisions (2026-11-06, morning):**
- **Narrow passes = option B:** keep 1:10, and carve a hand-picked list of real sounds and natural
  harbours from OSM's sharp coastline, widened just enough for the boat (like skerries are
  exaggerated). Harbour close-ups at near-true scale (option C) are the later harbour stage.
  Changing the whole scale (A) only if sailing still feels cramped after B. Why: at 1:10 the boat
  acts like an ~80 m ship (needs ~50 m real gap); the 20 m raster plus smoothing closes passes
  under ~40-60 m (Smörasken: pool ~70x45 m, entrances ~10-20 m, checked 2026-11-06).
- **Units:** knots for wind and boat speed, nautical miles for distance (navigation tags, chart).
- **Rope:** smaller and looks like a real rope: slack (curved) when eased, taut when sheeted
  in; swipe up/down on it to let out/pull in. The trim indicator by the boat stays; the rope
  needs no big indicator of its own. The old sheet control is hidden for now.

**Lighthouse task, the win (Felix, 2026-11-06):** reaching a dark lighthouse (e.g. via
"Navigate here") should feel like a win: the light comes back on, and the fog lifts on the
chart in a wide circle around it.

**Night navigation (later, after 1d; not decided yet).** Felix: night should be harder, so you
rely on marks and lighthouses (maybe no minimap or chart, or less detail). Mission control's
suggestions to decide later:
- Your position isn't shown on the chart at night: you can read the chart by lantern, but you
  find yourself by lit marks and lighthouses.
- The minimap shows only what your lantern reaches, plus lit marks and the light beams.
- Lighthouse sectors are a mechanic: white = safe water, red/green = danger side (real feature).
- Restored lighthouses are what make night sailing possible near them, so the first task pays
  off later.

**Harbour close-ups (option C), Felix 2026-11-06:** later in the game, choosing "Moor here" or
sailing into a harbour opens a more detailed, spacious view at near-true scale. In natural
harbours ("gems" like Smörasken, Kråksundsgap) you can navigate them the way he remembers
them. In village harbours you see more houses, docks, fishing nets drying and people. This is
the answer for places the 1:10 map simplifies (small islets, narrow inlets), and it's also
where the harbour menu, mooring and meeting people live.
Close-up answers (Felix, 2026-11-06): you leave a close-up by sailing far enough out, and you're
asked whether you want to go back to sea. A co-op friend sees the same close-up if they sail
up. Order: Fiskebäckskil first, then Lysekil and Grundsund, then others close by.
Close-up value (Felix, 2026-11-06): entering the close-up must add something. Sailing into a
harbour on the normal map gives just a basic harbour menu (e.g. trade). Going into the
close-up lets you sail around, talk to different people, get clues from them, and visit
places like the fishery.

**UI (Felix, 2026-11-06):** remove the Chart button; tapping the minimap opens the chart.

**Dug channels: history that changes the map (2026-11-06)**
- **Grundsund canal**: the village is named after the *grund sund* (shallow sound) between
  Skaftölandet and Ösö. Grundsunds kanal och hamn were built 1914-1918 (only formally
  inaugurated at the centenary in 2018; Västsverige, "Kanalfesten Grundsund 2018"). Era
  mechanic: before ~1914 the sound is shallow, eka-only or closed, and a through-route only
  from Epoch V on. (Exact pre-canal depth: unverified.)
- **Sotekanalen** (candidate for the narrow carved passage Felix's dad told him about): 4.8 km
  canal across the Sotenäs peninsula between Hunnebostrand and Smögen/Kungshamn, built 1930-35
  (opened 15 July 1935), about 200 men, mostly out-of-work local stonemasons (relief work),
  30-40 m at its narrowest, swing bridge. It's north of today's map window, so it's a future
  POI when the map grows. Felix to confirm it's the one he meant.
Grundsund on the big map (Felix, 2026-11-06): reach it from both ends (north entrance → guest
harbour basin; south entrance past Skutevik → fishing-harbour basin). The narrow canal through
the village stays closed at 1:10. Sailing through it is a Grundsund close-up feature (fits
history: shallow until the 1914-18 canal). General rule: carve to reach harbour basins, and
leave narrow inner channels to the close-ups.

## End of chapter 1: the lights speak (Felix loved it, 2026-11-06)
Goal: something to do after the 5 lights, and lighthouses that feel quietly magical (their
flash patterns become clues/codes later in the game).
1. **The lights "speak":** relighting a lighthouse shows its real flash pattern as a glyph
   (e.g. ●●●● · 12s) with a matching soft chime rhythm, saved in a **light log** on the chart.
   Later: codebook for clues, night navigation, era-jumping.
2. **Grandma's reward:** report in Fiskebäckskil and she gives you **granddad's sea chest**
   (it appears in Svalan's chest deck slot). Inside is his old chart. She says something like:
   "He always said the lights talk, if you know how to listen." His chart adds his
   favourite harbours (Felix's Segling list, those in the region) as new chart marks and
   Navigate targets.
3. **The hook: a light that shouldn't be there.** Granddad marked a lighthouse with a pattern
   on his chart. Proposal: **Måseskär's old 1865 tower**, dark since 31 Aug 1978 when the
   fibreglass light replaced it; since 2000 the Måseskär foundation lights it for a few
   minutes at New Year's midnight (en.wikipedia.org/wiki/Måseskär; 58.0938 N, 11.3302 E). Sail
   there: a faint flash in the old tower's pattern from the dark tower, a bell, the fog
   thickening. Card: "That tower has been dark since 1978. But you saw it." That ends chapter
   1 and points to the storm and the jump.

**Characters settled (Felix, 2026-11-06):** **Torhild** is the friend you meet in 1700, the
**pilot's daughter** (story/characters/torhild-1700.md, formerly the Brita-1700 draft).
**Britta** is your **grandma** in Fiskebäckskil today (story/characters/britta-today.md).

**Tordenskiold (later, not now):** Felix cleaned up his coat of arms (ref/tordenskiold-arms.png).
Idea: an asset of his ship with his flag, seen now and then at sea in his era, as friend or
foe or with some function. History check before building: Peter Wessel (b. 1690) was ennobled
as Tordenskiold in 1716, and he fought for Denmark-Norway against Sweden on this coast during
the Great Northern War (Dynekilen 1716, Marstrand/Carlsten 1719). So he belongs to the late
1710s, not 1700 (he was 10 then). The Danish swallow-tailed naval flag ("splitflag") is a nice
echo of Svalan, "the swallow".

**Decided: the chart after the jump (Felix, 2026-11-06).** Your chart becomes a faint ghost of
the land only: what you explored on Today's coast stays as faint pencil outlines of islands
and shores, with no names, harbours, marks or lighthouses (granite barely changed in 300 years;
everything people made did). Your memory can't be trusted: the sea stood about 0.55 m higher
(data/world-1700.json), so many rocks you remember as visible are just under water, and the
ghost shows safe water where a hidden rock lies. Torhild, the pilot's daughter, teaches you to
read the coast the old way (cairns, marks, leading lines). Re-sailing an area inks it in as a
real 1700 chart over the faded memory, and places come back one by one with their old names.

## The flow, revised: wake in 1950 (Felix, 2026-11-06; supersedes "start casual on Today's coast → time warp ~1905 → first jump ~1700")
1. **Opening scene, today (~30 s, not playable):** old Britta's kitchen in Fiskebäckskil,
   granddad's koster Svalan at the jetty, a storm rolling in. You go out; darkness.
2. **You wake around 1950** (Epoch VI, "Summer guests"), the long **home base** and where
   you first sail. Britta is about 14, a fisherman's daughter on Skaftö, who finds you and
   becomes your friend and guide. **Chapter 1 happens here:** the dark lighthouses (most
   still have keepers in 1950; Islandsberg really was dark from 1938), the reward, and
   Måseskär's red light as the first sign that time is strange (not an instant jump).
   Chapter 2 also stays in 1950 (young granddad, harbour close-ups, co-op).
3. **The first big jump** to ~1700 (Torhild, the pilot's daughter) comes when the story has
   earned it, a couple of hours in. 1950 stays the era you return to.
4. **Later eras.**
5. **Finale: back home to today**, the final, fully unlocked era. Old Britta opens the door:
   "I've been waiting for you since 1950." (Her "has seen you before" mystery pays off from
   her side.)
**Granddad and changing history (idea):** in 1950 he's a boy Britta likes. In the original
timeline he was lost at sea one night when a light was dark; your lighthouse work changes
that, and in the finale the door opens on both of them, old together.
**Consequences to carry through (1950 world):** retro wooden boats and inboard put-put engines
(plastic boats arrive late 1960s), the 1950s ferry, fewer summer guests, keepers at the
lights, paper charts (no GPS), period sea-mark system (Sweden adopted IALA A later; check the
1950s Swedish buoyage before building marks), Svalan with white sails fits. Ages: Britta
born ~1936 → ~90 today.

**Svalan's loop (Felix, 2026-11-06):** after the opening storm, Svalan washes up battered in
1950. Young granddad, a **boatbuilder's son**, finds her and repairs her, and she becomes
"granddad's boat", the same koster you inherit in today's opening scene. The boat has no
beginning: a time loop that ties you, granddad and Svalan together. (The boat lab's wear
slider can show her repaired, newer self.)
**While Svalan is repaired (Felix, 2026-11-06):** granddad's family lends you a small boat (an
old snipa or eka), and you do chapter 1's lighthouse task in it. When the five lights burn,
Svalan is ready, repaired and freshly painted: that's the chapter 1 reward.
**At the lighthouses in 1950 (Felix, 2026-11-06):** you bring what the keepers need. The storm
cut them off; you carry paraffin, lamp mantles or a spare lens part from the depot in Lysekil
to each lighthouse, the keeper relights it, and you watch from the boat (supply boats really did
this). Five keepers, five small characters. Which five lights: per the 1950 data (manned and
standing then; Islandsberg was already dark from 1938).
**The strange light in 1950 (Felix, 2026-11-06):** a light where no lighthouse stands yet, if a
future one is close to the mission. There is: **Kråksundsgap Södra (built 1954, 58.1006 N,
11.4405 E)**, by Felix's Kråkholmen / Kråksundsgap pin; in 1950 it doesn't exist. So at night a
light burns in its pattern on the bare rock where it will be built four years later. (It's one
of today's five task lights, so the 1950 task list changes anyway.) Fallback if that doesn't
work: Måseskär shows its old 1865 fixed red instead of its 1950 white ("That's not our light.").

**Correction and decision: chapter 1 lights in 1950 (Felix, 2026-11-06).** Research
(docs/WORLD-1950.md) shows only Måseskär had keepers in our window in 1950; the others were
automatic AGA acetylene lights (Gustaf Dalén's sun valve, Nobel Prize 1912: the light switches
itself on at dusk). New task: you carry gas tanks to four automatic lights and get each burning
again yourself (keeps the relight moment); the fifth is Måseskär, where you deliver to the one
real keeper, the character who hints about strange lights. The Kråksundsgap light from the
future (built 1954) stays. 1950 sea marks are red/black by compass side (IALA A only from
1980). Supersedes "five keepers" above.

**Correction and decision: the light from the future (Felix, 2026-11-06).** Kråksundsgap Södra
already had a light in 1950: an unmanned AGA light (from 1911; station 1941, Bx(2) WRG 7 s, 6 m
focal height; docs/PEOPLE-1950.md). Only the 13 m white concrete tower and its new sector split
are from 1954. Decided: keep Kråksundsgap. At night, for a moment, the small iron lantern on
the rock becomes the tall white 1954 tower shining with its new sectors, then it's gone: you
glimpse the light's future self. Finale easter egg: the restored 1941 lantern stands today in a
roundabout in Lysekil. The Måseskär keeper is invented (no named 1950 keeper found; don't use
real people's names).

**Day and night (Felix, 2026-11-06):** some quests are bound to day and some to night, giving
two layers to the game. Outside quests, time drifts slowly between day and night, and you can
moor at an island or in a harbour to pass time until it's day (or night) again.
Mission control's notes to decide when building: the AGA sun valve gives a natural rule (the
automatic lights switch themselves on at dusk); in co-op, skipping time needs both players
moored or the friend's consent (same pattern as crossing to another era).

## Opening and chapter 1 story, revised (Felix, 2026-11-06 afternoon; supersedes the SVG opening and the first cards)
**Opening (in the game engine, not cut-outs):**
1. Dusk / blue hour over today's Fiskebäckskil: modern lit windows, the ferry coming in with its
   lights, modern boats. The camera settles on one house by the water, with Svalan moored at its
   jetty. (It is Britta's house; the game doesn't say so yet.)
2. Fog rolls in, thunder, darkness with flashes. Two or three minimal lines of text over it,
   no explanation of time travel.
3. **The lighthouse rewind:** in the dark, the lighthouse row from the lighthouse timeline
   (ref/lighthouse-timeline-play.html), with the year counting down from today. The camera moves
   left past the lights with their years, faster and faster, and towers built after the current
   year wink out, until it slows and stops at 1950. (Kråksundsgap Södra's 1954 tower vanishes
   here, the setup for glimpsing it again in chapter 1.)
4. Dawn: the fog lifts on 1950. You lie washed up with battered Svalan on Skaftö's MAINLAND shore,
   away from town.
**Story order:**
1. The boy (young granddad, a boatbuilder's son) finds you; his father will take Svalan; he
   lends you the small boat.
2. First errand: sail to Grundsund for repair parts (a short, safe trip that teaches sailing).
3. Back at the yard: "It'll be a while. Careful, the lights are out since the storm. Someone in
   Fiskebäckskil was asking for help."
4. Fiskebäckskil: Britta, about 17, whose father normally tends the nearby lights (invented but
   plausible; in reality staff from Marstrand serviced them) and has broken his arm. She asks you
   to relight them; her family's shed holds the gas tanks (the depot).
5. The lights (four AGA lights plus Måseskär's keeper; the Kråksundsgap glimpse), then report back
   at her house, the house from the opening.
**You're the reason your grandparents meet:** the boy sends you to Britta.
Britta born ~1933 (17 in 1950, ~93 in the finale).

**Decisions (Felix, 2026-11-06, late afternoon):**
- **The first big jump lands in late 1703**, echoing the great North Sea storm of November 1703
  (no great storm is recorded locally around 1700; docs/PEOPLE-1700.md). The jump storm is ours.
- **Torhild lives by Lysekil**, the only recorded pilot station in our area. Pilots were paid
  per ship, so her family also fishes and farms. A hook for later eras: in 1716 Tordenskiold
  captured the Swedish pilot who had guided the fleet into Dynekilen.
- **Co-op starts as "you visit the host's world"** (docs/COOP-CHECK.md): the friend sails in
  the host's game: the host's era, chapter progress, lit lights and story. The friend keeps
  personal souvenirs (discovered names, light log). Fix first: a host session message on join
  (clock offset and era), and game options through the hub's launch message (touches the shared
  hub: tell Kenny).

## Next run (Felix, 2026-11-06 end of day)
1. **Pause:** a proper pause when the app is hidden or minimised (sound stopped, a "tap to
   continue" paper card). Today the game just freezes; traffic and the ferry run on the real clock.
2. **The first errand is easy and quick:** the wind blows **downwind** from the yard to
   Grundsund, then turns so the sail back is downwind too (scripted wind for the opening beats).
3. **Light winds feel REALLY slow:** give the boat a sensible minimum speed / better light-air
   performance so low wind never feels stuck.
Then: co-op stage 2 ("visit the host's world"), then day/night (reuse dusk.js).

**Rule: players keep their progress (Felix, 2026-11-06).** The live game is shared; players'
progress lives in their browser (localStorage) on the live address. Every future change must keep
existing saves working: never rename or drop a save key without a migration that carries the old
data over, add a test for it, and mention any save change in the report. Changing the live
address (e.g. a custom domain) loses saves unless we migrate them, so decide the address early.
