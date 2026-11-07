# Windward co-op stage 2: "visit the host's world" (plan)

Plan only. Written 2026-11-07 by the co-op plan agent (branch `felix/windward-coop2-plan`, from `origin/main`
at `d785ba4`). No code was changed or run: everything below was **verified by reading** the files named, at
that commit. Line numbers are as of `d785ba4`; another agent is changing `game.js` right now (a pause with a
game clock, scripted wind), so by the time you build, find things by the function or variable name given, not
by the number.

Things I could not check from here are marked **not verified**. Where the design is open there are options,
marked **FELIX:**, with my recommendation. Everything else is a proposal I'd build as written.

## 0. The short version (plain words)

Today two phones that join through the hub are two separate copies of the same coast. They see each other's
boats and share the wind, and nothing else is shared: a light the host relights stays dark on the friend's
screen, the two ferries drift apart by exactly the difference between the two phones' clocks (181 m when
COOP-CHECK tried a 90-second difference), and the friend has their own chapter progress.

Felix has already decided what co-op is: **you visit the host's world** (GAME-DESIGN "Playing together" and
"Decisions, late afternoon"): the host's era, chapter progress, lit lights and story; the friend keeps only
personal souvenirs (discovered names, light log).

The plan, in one paragraph: the host's game answers a one-line **hello** from the friend with a **session
snapshot** (era, seeds, the host's game-clock reading, the story state, the host's boat and position). The
friend's game builds its story modules on a **throwaway in-memory copy** seeded from that snapshot, so what the
friend sees is the host's world, and nothing is ever written to the friend's own saves except their personal
souvenirs. A small **clock sync** makes traffic, ferry and wind agree. The hub's launch message gets one new
optional field, **`options`**, so the host's page options (like `?year`) reach both games instead of being lost.
Six small gated batches; the last one is the real two-phone, two-network test nobody has done yet.

## 1. What is settled, and what is not

Settled (Felix, quoted from GAME-DESIGN.md; this plan implements these, it does not reopen them):

| Decision | Where |
|---|---|
| Playing together = visiting a friend's world; leaving sends you home; nobody depends on another player's world | "Playing together", Q11 |
| The visitor brings their own stuff; earnings go home to their own save | Q14 a |
| Visit only eras both players have unlocked (b first) | Q39 |
| No crossing between eras while visiting; edge fog is just fog | Q44 c |
| Co-op starts as "you visit the host's world": host's era, chapter progress, lit lights, story; the friend keeps discovered names and the light log. First fix: a host session message on join (clock offset, era), and options through the hub's launch message (touches the shared hub: tell Kenny) | "Decisions, 2026-11-06 late afternoon" |
| Players keep their progress: never rename or drop a save key without a migration plus a test | "Rule: players keep their progress" |
| Story progress must never create annoying blockers between players | "Playing together" |
| World changes are saved by the host and show on both screens; personal rewards go to whoever tapped. One world seed (fixed when a save begins) and one day seed; the guest uses the host's seeds, sent on join. Wind becomes a fixed function of day seed and clock | ALIVE-SEA grills (thing model 5, 9, 12; weather 7) |
| Pause: solo freezes the game clock; with a peer connected the shared clock does **not** freeze | next-run stage prompt, batch 1a |

Open (marked **FELIX:**; the full list is in section 7): what the guest can *do* in the host's story (F1), how
the guest learns the year (F2), the opening for a visitor (F3), where the visitor spawns (F4), world versus
personal flags (F5), the visitor's boat (F6), three hub choices (F7), eligibility (F8) and a "visiting" tag
(F9). Each has a recommendation.

## 2. Current state, verified against the code

### 2.1 What crosses the wire today

Hub level (`index.html`, `shared/net.js`):

| Message | Direction | Shape | When | Source |
|---|---|---|---|---|
| `launch` | host to guest | `{type:'launch', gameId, seed}` | once per guest connection, from the hub's `onConnect` (the guest can join mid-game) | `index.html:222,231-234` |

Game level (`games/windward/game.js`):

| Message | Direction | Rate / trigger | Source |
|---|---|---|---|
| `pos` `{x,z,heading,speed,ts}` | both | 20 Hz (`CONFIG.NET_SEND_HZ`), from inside `startGame` | `:603-612` |
| `wind` `{dir,strength,seq}` | host to guest | on first contact with the guest, on a heartbeat, and during transitions | `:505-511,542-548` |
| `ping` `{x,z}` | both | a keypress, with a cooldown | `:584` |
| `found`, `found-all` | host to guest | only for the old procedural islands (`discoverables` is built from `scatteredIslands`, `:349`); per COOP-CHECK. **Not verified in a coast run by me** | `:510,1057` |

**Nothing about era, seeds, clock, story phase, lit lights, cards or the opening crosses the wire.**

Transport facts that shape the design (all read from `shared/net.js` and the vendored PeerJS 1.5.5):

- **The data channel is unordered.** `peer.connect(hostId)` is called without `{reliable:true}` (`net.js:232`),
  and PeerJS builds the channel as `{ordered: !!reliable}` (vendored `peerjs.min.js`). Delivery is still
  guaranteed (no retransmit limit), but **messages can arrive out of order**. `wind` already carries a `seq`
  for this reason. Every new state message needs one too.
- **Games cannot see "a guest connected".** `onConnect` and `hasConnection` are hub-only (`net.js:23,185`,
  `index.html:157`). A game only learns about the friend by receiving a message from them (`heardFromPeer`,
  `game.js:542`).
- **Before a guest joins, the host's `send()` keeps only the newest 50 messages** (`net.js:112,167-173`). At
  20 `pos` a second, anything sent earlier than about 2.5 s before the guest opens is evicted. A `session`
  message must therefore be sent *after* the guest is known, not at start-up.
- **The inbound buffer is flushed to the first listener only** (`net.js:175-181`). On the guest the hub
  registers first (`index.html:271`), so anything arriving between the hub's registration and the game's
  `start()` (the time `import game.js` takes) is read by the hub, ignored, and gone. The game's own early queue
  (`game.js:118-126`) protects everything after `start()`. The README's promise that early messages are
  "delivered on registration" is true for the hub's listener, not for the game's. Design consequence: the
  guest must *ask* (hello) from inside the game, not rely on a push at connect time.
- **One guest, and the slot never frees.** A second connection is closed (`net.js:208-210`), but `guestConn`
  is never cleared when the first guest's connection closes. A guest whose phone sleeps cannot rejoin the same
  host link. See risk R1.

### 2.2 What each side computes alone: where the two phones can disagree

| Thing | Who decides today | Can the phones disagree? | Evidence |
|---|---|---|---|
| **Era / year** | each page: `num('year') ?? 1950` from `window.location.search` | Not in a plain hub session (both default to 1950, because the hub address is always `?host=`). **Yes the moment anyone needs another year**, and the host cannot ask for one at all. 17 separate reads of the address in `game.js`. | `game.js:109,131`; `index.html:188-189` |
| **World seed** | the hub: random per Play press, sent in `launch` | No (identical). Not saved anywhere yet. | `index.html:222` |
| **The opening cinematic** | each device's own 1950 save (`hasSeenOpening`) | **Yes.** A first-time guest sits through it while the host sails on. The guest's `pos` only starts afterwards. | `game.js:143-152` |
| **Chapter phase** (`find, errand, return, help, free`) | each device, `windward.beats1950.v1.1950` | **Yes** | `beats-1950.js:8-9`; `game.js:653` |
| **Gas, relit lights, keeper** | each device, `windward.lights.v1.1950` and `windward.task1950.v1.1950` | **Yes** (COOP-CHECK measured host 1/5, guest 0/5) | `task-1950.js:11`; `game.js:646,776-784` |
| **Chest / chart open / tower seen** | each device, `windward.chapter1.v1.1950` | **Yes** | `chapter1.js:4,16-30` |
| **Story cards, harbour moments** | each player's own screen; no message exists | Yes, by design today | `game.js:730-765` |
| **Traffic and the ferry** | `Date.now()/1000`, the default of an injectable `clock` that `game.js` does not pass | **Yes by exactly the clock difference.** COOP-CHECK B2: a 90 s skew put the ferry 181 m apart (about 2 m/s). | `busy-coast.js:60`; `game.js:466` |
| **Wind** | host random walk; guest follows `wind` messages; the guest uses a seed-derived wind until the first one | Briefly, until the first message | `game.js:496-503,547`; `wind.js:20-36` |
| **Night** | URL flag read once | Yes, and the hub drops the flag | `game.js:470,474` |
| **The friend's boat look** | each side builds the *other* boat from **its own** `boatOptions` | **Yes.** Each player sees the friend's boat as a copy of their own. (COOP-CHECK B4, now confirmed.) | `game.js:411,557` |
| **Spawn** | `coast.spawn` plus an offset by role | Not a disagreement, but the guest never starts near a host who has moved on | `game.js:427` |
| **Discovered names, light log, explored fog, card deck** | each device | Yes, and that is **intended** (personal) | `names.js`, `lightlog`, `explored`, `deck` keys |

### 2.3 The save keys, classified

The game has eleven save keys. Each is stored under an era suffix (`eraStorage`, `era-storage.js`): `today`
has none, `1950` appends `.1950`. One shared `store` object serves all of them (`game.js:402`).

| Key | What it holds | Class while visiting |
|---|---|---|
| `windward.lights.v1` | which task lights are relit | **World** (the host's) |
| `windward.task1950.v1` | gas aboard, post delivered to the keeper | **World** |
| `windward.beats1950.v1` | story phase | **World** |
| `windward.chapter1.v1` | `chest`, `towerSeen` | **World** (see F5 for `towerSeen`) |
| `windward.names.v1` | names you have discovered | **Personal** (guest keeps and writes) |
| `windward.lightlog.v1` | flash patterns you have seen | **Personal** |
| `windward.explored.v1` | chart fog | **Personal** |
| `windward.deck.v1` | your cards | **Personal** |
| `windward.start.v1`, `windward.intro.v1`, `windward.opening.v1` | "has seen this" flags | **Never written while visiting** (so the guest's own solo game still plays its opening later) |

## 3. The design

### 3.1 Principles

1. **The host's world wins while you are there.** The guest *shows* the host's story state; it never owns it.
2. **A visiting guest writes nothing into their own world keys, and creates no new keys.** The world modules
   (`task`, `beats`, `chapter`) run on an in-memory store; the personal modules keep the real one. No save
   changes, so no migration (the rule in section 1 is satisfied by construction, and a test enforces it, see 3.6).
3. **State messages are whole snapshots with a revision number.** The story state is about 300 bytes. Sending
   it whole, and re-sending it on every change and on a heartbeat, is immune to loss and to the unordered
   channel. There is no delta logic to get wrong. (The `wind` heartbeat that also carries `found-all`,
   `game.js:505-511`, is the precedent in this codebase.)
4. **Ask, don't hope.** The guest's game asks for the snapshot itself, from inside `start()`, because the host
   cannot know when the guest is ready (2.1).
5. **Old and new builds must coexist** for at least a deploy (R5): unknown message types are ignored (the
   existing handler is an `if / else if` chain with no `else`), and a missing answer times out into today's
   behaviour.

### 3.2 Two moments, two channels

| | What | Why it needs its own moment |
|---|---|---|
| **A. Boot options**, in the hub `launch` message | `options`: the world-defining page options the host had (`year`, `busy`, `night`; see section 5) | The guest must know the year **before** it builds the world (`loadCoastForYear(year)`, `game.js:131-138`). A snapshot that arrives later is too late to choose the era without rebuilding. |
| **B. The session snapshot**, in a game message after the game is up | clock, seeds, story state, boat, host position | It changes over the session (a light is relit), and it needs the host game to be running to answer. |

If the two ever disagree (the snapshot says a different year than the launch options), the guest shows "this
is a different world to the one you opened" and offers to rejoin. With no in-game era change (Q44 c) this
cannot happen in stage 2; the check is there for stage 3.

### 3.3 The messages (exact shapes)

All game-level, all plain JSON, all ignored by builds that do not know them.

**guest to host: `hello`** (sent from `start()`, before the coast loads and before the opening; repeated every
2 s until a `session` arrives, at most 5 times)

```json
{ "type": "hello", "v": 1,
  "boat": { "type": "eka", "deck": ["crate", "barrel", null], "wear": 0.1 } }
```

`boat` is the guest's **own** boat look, so the host can draw it correctly (F6).

**host to guest: `session`** (the reply to every `hello`; **also** sent unprompted on the first message heard
from a peer, as a fallback, mirroring `sendWind` at `game.js:547`; **also** re-sent in full whenever the story
state changes, and on a 10 s heartbeat)

```json
{ "type": "session", "v": 1, "rev": 7,
  "year": 1950, "era": "1950",
  "worldSeed": 123456, "daySeed": 987654,
  "clock": { "gameS": 1736.42 },
  "story": {
    "beats": "help",
    "task": { "gas": true, "keeper": false, "relit": ["light:Hättan", "light:Gäven"] },
    "chapter": { "chest": false, "towerSeen": false }
  },
  "boat": { "type": "eka", "deck": ["crate", "barrel", null], "wear": 0.1 },
  "host": { "x": 1234.5, "z": -980.2, "heading": 1.2 }
}
```

Field notes:

- `rev` is a host-side counter, +1 on every `session` sent. The guest ignores any `rev` at or below the last
  one it applied (the channel is unordered).
- `worldSeed` is today's hub `seed`. When the thing-model slice adds a saved world seed (ALIVE-SEA grill 5),
  the host sends *that*; the guest never saves it. `daySeed` is a fixed random number for the session today and
  becomes per game-day when the clock lands. They are in the message now so the weather and thing-model work
  can drop `wind`-style host messages later **without a protocol change**.
- `clock.gameS` is the host's **game clock** reading, not `Date.now()`. They differ when the host was in a
  solo pause before the friend joined (4.3).
- `story.task.relit` lists relit task-light ids; the guest rebuilds `isDark` from it. `beats` is `null` outside
  1950.
- Nothing personal is in it, and nothing here is secret. About 450 bytes.

**clock sync** (section 4): `clock` `{t0}` (guest to host) and `clockr` `{t0, gameS}` (host to guest).

**`pos`** gains nothing. The existing 20 Hz stream is unchanged.

### 3.4 When it is sent, and how the guest applies it

```
guest game start()          host game
  |-- hello ------------------>|        (host: reply with session; also remember "a peer exists")
  |<------------------ session-|        (guest: waits up to 3 s, then carries on "unsynced" = today's behaviour)
  |-- clock {t0} ------------->|
  |<----------- clockr {t0,gS}-|        (3 to 5 samples, 1 s apart)
  |  ...builds the coast with launch.options.year...
  |  ...applies the session: visiting world, clock, host boat, spawn beside the host...
  |<------- session rev 8 -----|        (host relit a light: whole story state again)
```

Applying on the guest, in order, before the first frame the player sees:

1. Build the **visiting world store**: `memoryStore(seedFrom(session.story))`, a `{getItem,setItem,removeItem}`
   over a `Map`, in the same shape `scopedStorage` returns (`era-storage.js:14-22`). Its `setItem` can never
   reach `localStorage`.
2. Create `task`, `beats` and `chapter` on that store (`game.js:646,653` and the chapter at the `store` block,
   `:402-410`), and keep `lightLog`, the name book, the explored fog and the deck on the real `store`
   (`:404,452`). This is the one structural edit to `game.js`: **split `store` into `worldStore` and
   `personalStore`**. For the host and for solo play they are the same object, so behaviour and keys are
   unchanged.
3. Make the world modules **read-only in visiting mode** (a thin wrapper whose mutators do nothing). The
   mutators are `advance`, `reset`, `loadGas`, `meetKeeper`, `restore`, `finish`, `giveChest`, `markTowerSeen`.
   This is a belt and braces guard: option A below means the guest never triggers them anyway.
4. Disable the URL flags that write the guest's own saves: `?lights=reset` (`game.js:405` calls
   `chapter.reset(); lightLog.reset()`; `:654` calls `task.reset()`), `?jump=` (`:852-853` resets the task and
   the beats), and `?opening`/`?tune`. The guest accepts only the whitelisted world options (section 5).
5. Skip the opening and the start card, and write no "seen" flags (F3).
6. Adopt the clock offset (section 4), set the tower lamps from `relit`, and build the host's boat look.
7. Place the boat (F4).

When a later `session` arrives with a higher `rev`: replace the visiting store's contents and re-run the small
"apply" step, which today lives in two places: `fx.setLit(...)` over all task lights (`game.js:660-670`) and the
live relight path `onRelit` (`:776-779`, which does `lanternFx.get(id)?.setLit(true)`). For a delta the guest
runs only those two lines, **not** `onRelit` itself (that also logs the flash pattern in the guest's own light
log and plays sounds, which is a personal reward and must stay with whoever was there).

The host sends a fresh `session` from the same places it already changes the story: `beats.advance()`
(`:730,734,738,760`), `task.loadGas()` (`:760`), `task.meetKeeper()` (`:764`), `onRelit` (`:776`),
`task.finish()` and `chapter.giveChest()` (`:709-710,751-752`). One helper, `broadcastSession()`, called after
each.

### 3.5 What the guest can do in the host's story (F1)

**FELIX: F1. Can the visitor take part in the host's story, or just sail in it?**

- **A. Sail-along (recommended for the first slice).** The guest sees the host's world and can sail anywhere,
  but story interactions belong to the host: the guest's boat cannot moor at a dark light to relight it, no
  cards fire for the guest, the Navigate tag follows the host's current objective ("sail with your friend to
  what they are doing"). Cheap, safe, and it already delivers the "aha": the lights you relit are lit on your
  friend's chart. No blockers by construction.
- **B. Helper.** The guest's relight, mooring and deliveries are sent to the host (`act` messages), the host
  validates them against its own state and broadcasts the result; the world change is the host's, the personal
  reward (the flash pattern in the light log, a sound, a souvenir) goes to the guest. This is where ALIVE-SEA
  grill 12 points. It needs host-side rules for what the guest may do out of order (can a guest relight before
  the host has the gas?). Batch 5.
- **C. Parallel.** Both play the story separately in one shared sea. This is the thing COOP-CHECK called
  option (a) and Felix's "own world" decision rules out.

Recommendation: ship A (batches 1 to 4), playtest it with Kenny or a friend, then decide on B with real
experience.

### 3.6 Save safety, as tests

The rule is "never rename or drop a save key without a migration; add a test". This plan adds no key, renames
none, and never writes the world keys on a guest. Tests that hold it:

1. **Key inventory test:** a node test that scans `src/**/*.js` and `game.js` for `windward\.[a-z0-9]+\.v\d`
   and fails if the set differs from the eleven keys in 2.3. Anyone adding a key (the thing model will) is
   forced to update the list and think about visiting.
2. **Memory store test:** `setItem` on the visiting store never calls the base storage (a spy).
3. **Visiting leaves the world keys alone:** build `task`, `beats`, `chapter` over the memory store, run
   every mutator, assert the real storage object is byte-identical afterwards.
4. **Hostile options test:** a `launch.options` of `{lights:'reset', jump:'britta', opening:'1', tune:'1'}`
   applied by a guest changes nothing in the guest's storage.
5. **Two-profile relay test** (batch 3): host at lights 2/4 relit, a guest with a brand-new profile joins; the
   guest shows 2/4 lit, and its `localStorage` contains only personal keys.

## 4. The clock

### 4.1 Facts

- Traffic and the ferry are pure functions of a `clock()` that defaults to `Date.now()/1000`
  (`busy-coast.js:60`, `busy-route.js:4-5`); `game.js:466` passes none. This is the single injection point.
- The wind controller uses `performance.now()/1000` (`game.js:496`) and runs on the host only.
- The in-progress stage (next-run batch 1a) introduces **one game clock = wall time minus paused time**, passed
  to `createBusyCoast`'s `clock` and to the wind controller, with a **co-op exception**: when a peer is
  connected, the shared clock does not freeze. This plan builds on that module; if it has not landed, the
  batch 1 module below *is* that module's co-op half.
- COOP-CHECK measured the cost of skew: 90 s fast gave 181 m, so the ferry moves at about 2 m/s. **A clock
  error under 250 ms is under half a metre.** The target does not need to be precise.

### 4.2 Design

The guest computes `offsetS` so that `gameClock.nowS() = hostGameClock`, by the classic round-trip estimate:

```
guest sends   clock {t0}          t0 = guest Date.now() (ms)
host replies  clockr {t0, gameS}  gameS = host game clock now (s)
guest gets it at t2 = Date.now()
  rtt     = t2 - t0                       (ms)
  offsetS = gameS + (rtt / 2000) - (t2 / 1000) - guestPausedS   (guestPausedS = 0 while a peer is connected)
```

Take 3 to 5 samples 1 s apart and use the one with the lowest `rtt`. Re-sample every 60 s and **slew** the
offset (at most 50 ms of change per second) so traffic never visibly jumps. The host's offset is 0 by
definition. `gameClock.nowS()` on the guest is then `Date.now()/1000 + offsetS` (minus paused time only when no
peer is connected). One injection: `createBusyCoast({ ..., clock: () => gameClock.nowS() })`.

A `session` also carries `clock.gameS`, and the guest re-runs the offset estimate whenever a `session` arrives
that follows a gap (a rejoin), which covers section 4.3.

### 4.3 Cases

| Situation | What happens |
|---|---|
| Normal play | Offset constant to within drift; slewed resync every 60 s. |
| Host was in a **solo pause** when the friend joined | The host's game clock was wall time minus paused time, so it is *not* `Date.now()`. That is why `session.clock.gameS` and `clockr.gameS` carry the **game clock**, never wall time. When the peer connects, the host's clock stops freezing (the stage's co-op exception) but keeps the paused-time offset it had earned. |
| **Guest** tab hidden or phone locked | The guest's clock is wall time plus a constant, so it is right the instant the tab returns; there is no catch-up. The pause card still shows. The guest's `pos` stops, so after `PARTNER_TIMEOUT_S` the host shows "friend left" (`partner.js`), and the same `pos` resuming brings the friend back. If the phone's connection actually dies, see R1. |
| **Host** tab hidden | Same for the clock: it keeps running on wall time because a peer is connected. The host's `pos` is throttled by the browser, so the guest sees the host's boat stutter, then the "friend left" notice. |
| A peer drops and the host goes solo again | The host's next pause freezes its clock again. When the friend rejoins, `hello` produces a fresh `session` and a fresh sync, so the offset is re-learned. "Peer connected" for a game means "heard a `pos` within `PARTNER_TIMEOUT_S`" (`partner.js`), since games cannot see connections. |
| Wind | Unchanged for now: the host still sends `wind`. When weather becomes a function of `daySeed` and the game clock, both sides compute the same wind and the `wind` message can go (the handler stays for old builds). |

## 5. Game options through the hub launch message

This is the part that touches the **shared hub**. Kenny gets a heads-up (see `docs/notes/KENNY-HUB-LAUNCH.md`);
Felix decided no sign-off is needed. By `docs/COLLABORATION.md` a change to `index.html`, `shared/` or `docs/`
still goes branch, PR, with either person merging.

### 5.1 What goes wrong today

`index.html:188-189` builds the share link as `origin + pathname + ?host=<id>` and runs `history.replaceState`
with it. Any page option the host typed (`/?year=1950&debug=1`) is therefore (a) not in the guest's link and
(b) gone from the **host's own** address before the game reads it. The game reads 16 named
options from `window.location.search` (`opening`, `lights`, `night`, `jump`, `debug`, `cat`, `year`, `tune`,
`near`, `lure`, `cvex`, `cstep`, `csmooth`, `coast`, `busy`, `boat`) plus the look-style parameters, in 17
separate places in `game.js`. In the hub, none can ever be set (COOP-CHECK B1).

### 5.2 The minimal change

Six edits, all additive. Nothing is removed and no existing field changes meaning.

| # | File and line (`d785ba4`) | Change |
|---|---|---|
| 1 | `index.html` just before `:188` | Capture `const pageOptions = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => k !== 'host'))` before `replaceState` wipes the query. (Caps: at most 20 keys, values at most 200 characters, strings only.) |
| 2 | `index.html:222` | `currentLaunch = { gameId, seed, options: pageOptions }`. The two `net.send({type:'launch', ...currentLaunch})` calls (`:223,233`) already spread it, so `options` rides along with no further edit. |
| 3 | `index.html:140` | `launchGame(game, { net, seed, role, options })` (new optional field). |
| 4 | `index.html:153-161` | `start({ canvas, net, seed, role, players, options })`. |
| 5 | `index.html:282` and `:298` | Guest: pass `options: msg.options` into `launchGame`. |
| 6 | `games/README.md` ("The contract") | Document `options` as optional: "`options`: `{[key]: string}`, the host's page options; absent in the solo dev entry and from older hubs; a game that doesn't use it ignores it." |

Optional but recommended, to keep the logic testable without a browser (F7): put the capture-and-cap function
in a new `shared/launch.js` with a node test, and import it from `index.html`.

### 5.3 What Windward does with it

- One accessor, `gameOptions(args)`, returns `args.options` (as a `URLSearchParams`) when present, and
  `window.location.search` when not (the solo dev entry, an older hub). All 17 reads in `game.js` go through
  it. A small node test fails if `game.js` mentions `location.search` anywhere except inside the accessor. Two
  reads in `src/phone.js` (`touch`, `sheet`) are device-local and stay.
- **The guest honours only a whitelist** of host options: `year`, `busy`, `night`. The rest are either
  device-local (look style, `touch`, `sheet`) and come from the guest's own address, or host-only debugging
  (`debug`, `tune`, `cvex`, `cstep`, `csmooth`, `cat`) and are ignored on a guest. **`lights`, `jump` and
  `opening` must never be honoured on a guest, because `lights=reset` calls `chapter.reset()` and
  `lightLog.reset()` (`game.js:405`), and a second `lights=reset` read at `:654` calls `task.reset()` and clears
  the start-card flag: a hostile or careless host link would wipe the visitor's progress** (R4). `opening` is
  read in three places (`:143`, `:416`, `:858`) and `jump` in two (`:143`, `:852`); all must go through the
  accessor and be ignored on a guest.
  This is the most important single test in the plan (3.6, test 4).
- The host's own options now work in the hub too, which is a bonus: `/?year=1950&debug=1` finally means what it
  says.

### 5.4 Kenny's games stay unaffected, and why

- `archipelago`, `dino-rumble`, `will-it-fit` and `_template` all read `start({ canvas, net, seed, role, ... })`
  by destructuring named fields (`games/*/game.js`). A new `options` field is ignored by every one of them.
  Nothing else about `net`, `seed`, `role` or `players` changes.
- Their solo `index.html` files read `location.search` for their own debug switches (and `archipelago/game.js:26`
  reads `?debug`); none of that changes either, because under the hub the query was always just `?host=`.
- An old hub tab and a new one coexist: an old guest ignores `options`; a new guest with an old host sees
  `msg.options` undefined and falls back to `window.location.search` (which is the `?host=` link, so: no options,
  exactly today).

### 5.5 Other hub decisions

**FELIX: F7. Three hub-level choices.**

- **H1 versus H2 (how options are filtered).** *H1 (recommended):* the hub passes options through verbatim
  (capped) and each game decides what to honour; Windward whitelists. Smallest hub change. *H2:* a game
  declares `"options": ["year","busy","night"]` in `game.json` and the hub filters. Cleaner contract, but it
  touches `scripts/manifest.js` and the manifest shape, which is also shared. Move to H2 later if more games
  want options.
- **Free the guest slot (rejoin).** `net.js:206-213` never clears `guestConn`, so a guest who drops (a sleeping
  phone, a flaky network) cannot rejoin the same link until the host reloads and everyone gets a new link. That
  contradicts "either player can drop in and out" (GAME-DESIGN "Playing together") and makes "visit the host's
  world" fragile on phones. Fix: clear `guestConn` in the connection's `close` handler. It is about three lines
  in a shared file and benefits Kenny's games too, but `games/README.md` says "reconnect is explicitly out of
  scope" and it changes hub behaviour for everyone. *Recommendation: yes, as its own small PR, with its own
  Kenny heads-up.* Not in the six edits above.
- **Ordered channel.** `peer.connect(hostId, {reliable:true})` would make the channel ordered and remove the
  reordering worry. It would also add head-of-line blocking to every game's 20 Hz streams on a lossy network.
  *Recommendation: no.* The `rev`/`seq` numbers cost almost nothing and don't touch the transport.

## 6. When the guest lands mid-story

Under option A (sail-along), with the host's phase on the left:

| Host is... | The guest sees | Notes |
|---|---|---|
| Still **loading or in the opening** | `hello` waits up to 3 s, then the guest carries on unsynced and re-asks every 10 s | The host game is not answering yet. Harmless. |
| Chapter 1, phase `find` / `errand` / `return` / `help` | The 1950 coast, the family eka, all four task lights dark | The Navigate tag points where the host's tag points. |
| Phase `lights`, 2 of 4 relit | Two towers lit, two dark | The guest's stage-1 "aha". Updates live as the host relights. |
| Phase `keeper` / `report` / `done` (past chapter 1) | All lights lit, the host's current goal on the tag | If the chest was given, the **host's** boat shows Svalan; the **guest's** boat is the guest's own (F6). |
| In a **lighthouse visit, harbour moment or story card** | The host's boat parked (`pos` keeps streaming the parked position, COOP-CHECK B3) | A one-line notice, "Your friend is at Gäven" (low priority). |
| Past chapter 1 and a **guest with no 1950 save at all** | Nothing special: the guest has no progress to protect | The guest's personal keys fill as they explore. |

- **Cards.** Under A the guest triggers none. The first time a guest joins, show **one** short paper card
  (existing `paper.js` style) built from the session: "You're sailing in a friend's 1950. The lights have been
  out since the storm. [N of 4 lit]." After that the HUD line is enough: the HUD already derives from
  `beats.phase` / `task.progressText()` (`game.js:~774`), so it follows the visiting store with no new code.
- **Era mismatch (eligibility).** Q39 says visit only eras both players have unlocked. No unlock flag exists
  yet, and 1950 is the only playable chapter. Add a single hook `canVisit(year)` that returns `true` for now so
  the rule has one home (F8 in section 7).
- **The guest is the one who is ahead.** If the guest has finished 1950 on their own device and joins a host
  at the very start, they see the host's early world and keep their own finished save untouched, which is the
  point of the memory store.

## 7. Open questions for Felix

| # | Question | Options | My recommendation |
|---|---|---|---|
| **F1** | What can a visitor do in the host's story? | A sail-along, B helper (acts go to the host), C parallel | A first, B after a playtest (3.5) |
| **F2** | How does the guest know the year before building the world? | (a) `launch.options.year`, plus a mismatch check; (b) wait for the snapshot, then build | (a). The era never changes mid-session in stage 2, so (a) is enough and the guest builds without waiting. |
| **F3** | Does a visiting guest play the opening cinematic? | skip it and write no seen-flag (recommended); play it every time; play it once per device | Skip, and don't mark it seen, so their own solo game still shows it later. |
| **F4** | Where does the visitor start? | the shared spawn plus an offset (today); beside the host's current position (`session.host`) | Beside the host (one-time placement before the first frame). Today's spawn is useless once the host has sailed away. |
| **F5** | Which flags are the host's world and which are personal? | my table in 2.3; the open point is `chapter.towerSeen` ("you saw the old Måseskär tower flash", chapter complete) | World flag, but the *glimpse moment* is each player's own screen. Confirm. |
| **F6** | Whose boat does each player sail, and how does the friend see it? | each sails their own (Q14 a) and the look travels in `hello` / `session`; or both sail the host's | Own boat (Q14 a), look sent so each friend is drawn correctly (fixes B4). |
| **F7** | Three hub choices | section 5.5 | H1; free the guest slot as its own PR; keep the unordered channel |
| **F8** | Eligibility: can a guest visit an era they haven't unlocked? | `canVisit(year)` returns `true` now; later the Q39 rule | Build the hook, keep it `true`. |
| **F9** | Does the HUD say "you are visiting"? | a small tag; nothing | A small, quiet tag: it tells the guest why they can't relight a light. |

## 8. Gated build plan

**Gate 0 (prerequisite).** The next-run stage (pause plus game clock, scripted wind) merges first. It rewrites
the same parts of `game.js` that batches 1, 3 and 4 touch, and batch 1 builds on its game-clock module. If
Felix wants to start earlier, batch 2 (the hub PR) and batch 3's pure modules can go ahead, since they don't
touch `game.js`.

One batch = one commit = stop and report. Stage specific files; `git status` before every commit; push at the
end of each committed batch. Run the unit tests with the repo's own loop:
`cd games/windward && for t in src/*.test.js test/*.test.js; do node $t >/dev/null || echo FAIL $t; done`
(from `docs/MISSION-CONTROL.md`; this plan adds the test files named below).

### Batch 1: shared clock (no hub change)

*Files:* extend the stage agent's game-clock module (or add `src/session-clock.js` if absent), `game.js`
(pass `clock` at `createBusyCoast`, one line; send and answer the `clock` / `clockr` messages),
`src/session-clock.test.js`.
*Messages:* `clock`, `clockr`. *Save impact:* none.
*DONE WHEN:*
1. `node src/session-clock.test.js` passes: simulated skews of 0 s, 3 s and 90 s with 20 to 300 ms of
   asymmetric latency converge to within 250 ms; the lowest-`rtt` sample wins; the slew never exceeds 50 ms/s.
2. A pause test: a solo pause then a connect gives a clock that agrees with the host's `gameS`.
3. The COOP-CHECK `t5` relay run with the guest 90 s fast shows the ferry within 5 m (it was 181 m).
4. Full test loop green.

### Batch 2: options through the hub (shared surface: branch, PR, Kenny heads-up)

*Files:* `index.html` (six edits in 5.2), `games/README.md` (one paragraph), optional new `shared/launch.js` +
`shared/launch.test.js`, `docs/notes/KENNY-HUB-LAUNCH.md` (this plan's second deliverable). Branch
`felix/windward-coop2-hub-options`, PR, say in the PR what it affects, include the Vercel preview URL.
*Save impact:* none.
*DONE WHEN:*
1. `node shared/launch.test.js`: options are captured without `host`, capped at 20 keys and 200 characters,
   strings only.
2. Through the hub on the preview URL: `/?year=1950&debug=1` hosted; the guest's `start()` receives
   `options.year === '1950'` and no `debug` honoured (logged by a one-line test shim).
3. **Kenny's games each start through the hub, host and guest** (archipelago, dino-rumble, will-it-fit): a
   2-minute human smoke test, noted in the PR.
4. The version-skew matrix is tried once by hand: old hub tab with a new host, and the reverse.

### Batch 3: session snapshot and visiting mode

*Files:* `src/memory-store.js`, `src/session.js` (pure: `buildSession(state)`, `applySession(...)`,
`revGuard`), `src/gameoptions.js` (the accessor and whitelist), `game.js` (split `store`; `hello`; `session`
handling; guards; accessor), tests `src/memory-store.test.js`, `src/session.test.js`, `src/gameoptions.test.js`,
`src/save-keys.test.js`. *Messages:* `hello`, `session`. *Save impact:* none by construction (3.6).
*DONE WHEN:*
1. All five tests in 3.6 pass, including the key inventory test and the hostile-options test.
2. Relay-pair run with two separate browser profiles: host at lights 2/4 relit, guest on a **new** profile; the
   guest shows 2 lit and 2 dark; `localStorage` on the guest contains only personal keys and **no** `.1950`
   world keys.
3. The guest's opening is skipped and no seen-flag is written.
4. A guest that hears no answer within 3 s plays unsynced and nothing throws.
5. A `rev` replay test: delivering `session` rev 7, 5, 8 in that order leaves rev 8 applied.

### Batch 4: live world updates

*Files:* `game.js` (`broadcastSession()` after the mutation sites in 3.4; the guest's apply step re-runs the
two tower-lamp lines), `src/session.test.js` additions.
*DONE WHEN:*
1. Relay-pair run: the host relights a light; the guest's tower is lit within one heartbeat or sooner and the
   guest's light log is unchanged.
2. The HUD line on the guest follows the host's phase.
3. A dropped message (relay `drop`) is repaired by the next heartbeat.

### Batch 5 (optional, only if F1 is B): guest actions to the host

*Files:* `act` message, host-side validation, the guest's chart "visit" hold re-enabled. Its own DONE WHEN
once Felix picks B: the guest relights, the host's world changes and both screens agree, and the personal
reward lands only in the guest's light log.

### Batch 6: the real field test and the paperwork

This is the one the earlier check could not do. *DONE WHEN:*
1. **Two phones on two different networks** (phone on a mobile hotspot, the other on home wifi) join through
   the real hub link on the live URL, in the real order: host picks Windward, friend opens the link.
2. A checklist, recorded in `docs/COOP-CHECK.md` as a dated addendum: the ferry is in the same place by eye
   (note the minute and the position); a light relit by the host lights on the friend's chart; the friend's
   own progress is unchanged afterwards (reopen the friend's solo game: no change); the friend's phone locks for
   30 s and returns; the friend closes the tab and rejoins (this will fail until R1's fix, and that is the
   result worth recording).
3. Update `docs/MISSION-CONTROL.md` section 1 and `LAST_SESSION.md` (state pointer, 40-line cap).

## 9. Risks found

| # | Risk | Severity | Where it comes from | Mitigation in the plan |
|---|---|---|---|---|
| **R1** | **A guest who disconnects cannot rejoin the same link.** `guestConn` is never cleared. A phone that sleeps or switches network loses the visit until the host reloads and sends a new link. | High for phones | `net.js:206-213` | F7: free the slot, as its own small PR. Until then batch 6 records the failure. |
| **R2** | **Unordered channel: stale state can overwrite fresh state.** | Medium | vendored `peerjs.min.js`, `net.js:232` | `rev` on every `session`, whole-state snapshots, heartbeat repair. |
| **R3** | **A push at connect time is lost or evicted** (hub-only `onConnect`, the 50-message queue cap, the first-listener-only inbound buffer). | High if ignored | `net.js:112,167-181`; `index.html:271` | The guest asks (`hello`) from inside `start()`; the host also answers on first contact. |
| **R4** | **Guest-save damage through host options.** `?lights=reset` wipes the visitor's chapter and light log. | **High** | `game.js:405` | Whitelist; world modules read-only while visiting; hostile-options test. |
| **R5** | **Version skew** across a deploy: an old tab left open (a known gotcha) next to a new one. | Medium | `docs/MISSION-CONTROL.md` section 6 | Unknown message types and fields are ignored; a missing answer times out into today's behaviour; tried by hand in batch 2. |
| **R6** | **Merge conflicts in `game.js`.** The stage agent is editing it, and the busy-today, chapter1-1950 and sail-feel branches touch it too. | Medium | `git worktree list` | Gate 0; batches are small; edit points are named by function; pure logic goes in new files. |
| **R7** | **Incomplete migration of the 17 option reads** leaves a path where the guest ignores a host option (`?busy=0`) and desyncs. | Medium | `game.js` | One accessor plus a test that fails on any other `location.search` read in `game.js`. |
| **R8** | **Two clocks inside one game:** traffic on `Date.now()`, wind on `performance.now()`. After a device sleep they can diverge (`performance.now` may not advance in sleep). | Low to medium | `busy-coast.js:60`; `game.js:496` | The stage agent's single game clock fixes it; batch 1 builds on it. |
| **R9** | **The 2-network test has never been done.** WebRTC could not connect in the earlier sandbox, and the relay is Open Relay's free, rate-limited public TURN, flagged "swap before real traffic". | Medium | `net.js:51-54`; COOP-CHECK "How this was tested" | Batch 6 is a real two-network run; plan to replace the TURN provider if it flakes. |
| **R10** | **The unprompted `session` heartbeat plus 20 Hz `pos`** on a mobile connection. | Low | | `session` is about 450 bytes every 10 s; negligible beside `pos`. |
| **R11** | **Unverified:** I did not run the game or the relay in a browser, and did not read `life.js` (wildlife), the audio, or the chart-controller's visit code. They may hold more per-device state than the 11 keys list. | Unknown | | Batch 3's two-profile relay test is the check; add anything it finds to 2.2. |

## 10. Verified-by-reading log

Read in full: `AGENTS.md`, `docs/COLLABORATION.md`, `games/README.md`, `docs/MISSION-CONTROL.md` (sections 1, 3, 6),
`games/windward/docs/COOP-CHECK.md`, `ALIVE-SEA.md`, `index.html`, `shared/net.js`, `src/era-storage.js`,
`src/wind.js`, `src/beats-1950.js`, `src/task-1950.js`, `src/partner.js`, `src/chapter1.js` (keys), the head and
clock parts of `src/busy-route.js` and `src/busy-coast.js`, the next-run stage prompt (batch 1), and the
"Playing together", "Data model", "Decisions late afternoon" and "Rule: players keep their progress" sections
of `GAME-DESIGN.md`. In `game.js` I read the entry point (`:96-175`), the wind and message handling
(`:490-625`), and the story, task, relight and lamp code by targeted search; not the whole 74 KB file.
`shared/vendor/peerjs.min.js` was searched for the data-channel options only. The three other games' entry
points were checked for how they take `start()` arguments.
