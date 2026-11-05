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
  finds and (later) markets.
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
  port. Nothing forces the story on you.
- This is the no-save lure: 5 minutes must already feel rewarding.

## The opening: where the story starts (new, Felix 2026-11-05)

When you choose the story, you start in a short slice of a later but still
retro era: before 1950, maybe older. No GPS. It should feel retro and
mystical.

- **Opening year (open, option to weigh):** about 1905. Måseskär, Pater
  Noster and Hållö stand nearby; small lights, cairns (*kummel*) and village
  signal fires (*vårdkasar*) mark the coast; sail is still dominant.
  `TODO(felix): confirm year; check each light's built year in lighthouse-lab
  data before relying on "stand nearby in 1905".`
- **Start location:** the densest cluster of Felix's favourite places, west
  Orust around Käringön / Härmanö / Gullholmen / Hälleviksstrand.
  `TODO(felix): confirm.`
- **Granddad's chart:** you inherit his nautical chart. It reveals a small
  part of an expandable mini-map with markers on sweet spots (Felix's
  favourite places). Deeper in you explore it yourself or buy further chart
  sections from people you meet.
- **Teaching sailing and navigation:** lighthouses, cairns and village fires
  are the tutorial. No pop-up lessons; the coast teaches.
- **The storm:** after the first chart and some chill sailing, a storm rolls
  in that you cannot escape wherever you are: thunder, the mysterious fog
  with flashes, then the first era jump. Destination open (see below).
- **The opening era locks after the first jump.** Much later you return to
  it, when you have almost forgotten it, and the lighthouses carry meaning
  then, for example their real flash patterns as a code or a way home.
  **Open: what that meaning is.**

Opening-year options (no pick):

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
- **Treasure across time:** treasure buried in a rich later era (by you,
  unknowingly) is dug up in the poor early era. That lifts you from poor
  fisher into the free-port heyday and smuggling. *Idea, not set.*
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
- **Technical tension:** today the host owns wind, finds and (later) markets,
  and a host leaving ends the room. "Not just the host" needs a decision on
  authority. Open, see Gaps.

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

## Era candidates (written up, no pick)

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

First-jump destination (open): the poor era around 1745 (Götheborg sinks),
or another exciting era first. No pick until Q1 is settled.

## Decisions log

Status: **OPEN**, **SET** (Felix said it), **INFERRED** (my reading, confirm).

| # | Decision | Status | What we have |
|---|---|---|---|
| 1 | Era | **OPEN** | Held until Felix has seen the year-slider labs. Seven candidates above, no pick. |
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

## Gaps (to grill)

Recorded 2026-11-05; resolved ones move into the log above.

- **Pre-story sailing: which year?** The free sailing before the story needs
  a look and a set of lights. Is it the opening year, today's coast, or
  something else? (It sets what the lure looks like.)
- **Drop-in/out authority:** if the host owns wind, finds and markets, what
  happens when the host leaves? Options include host migration, a
  per-player view with no shared world state, or a lightweight server.
- **Leaving mid-trip:** what happens to shared contracts, cargo and co-op
  bonuses when one player leaves? (Purses are separate, SET.)
- **Story without blockers:** the rule is set; the mechanism isn't. Do story
  beats ever need both players, and if one is further ahead, who sees what?
- **The "aha, better together" moment:** what small purpose does sailing
  together have before the story?
- **The early port/house trigger:** what happens when you sail into a port
  or up to a house? Small, early, not deep.
- **Treasure across time:** what exactly is recorded when you bury it, and
  when does it become findable? What crosses is settled; this mechanic isn't.
- **The returned-to opening:** what do the flash patterns unlock?
- **Stage table (T0-T8)** assumes one era and trade first. Where do the
  first minutes, the chart, the storm and the first jump go?
- **Mini-map and chart sections:** data shape, and how "buy a chart
  section" fits the markets.
- **Coverage:** the settlements data has Käringön, Gullholmen and
  Hälleviksstrand but not Härmanö. The start area needs the deeper history
  layer anyway.
- **Unmerged inputs:** lights (`felix/windward-lighthouses`) and the real
  coast and settlements (`felix/windward-real-coast`) are not on `main`.

## Sources

- Great herring period 1747-1809: Rigby's Encyclopaedia of the Herring,
  https://www.herripedia.com/bohuslan/
- Marstrand Free Port 1775-1794: https://en.wikipedia.org/wiki/Marstrand_Free_Port
- NorFish herring landings 1520-1808 (licence to check):
  https://gbif.org/dataset/5cd986a3-9180-4a11-b2a7-7f340e062b52
