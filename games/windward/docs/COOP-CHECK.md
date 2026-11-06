# Windward co-op check (2026-11-06)

Report only: no game code changed. Branch `felix/windward-coop-check`, from main at `eefd08d`. Evidence: `docs/coop-check/` (test scripts in `tests/`, screenshots in `shots/`, the audit in `design-audit.md`).

## How this was tested, and what it can't say

- Two real Windward games (the real Bohuslän coast) in headless Chromium, in **separate browser contexts** (separate `localStorage`, like two players), joined through the game's own `net` contract (`send` / `onMessage` / `isHost`) via a relay in node (`coop-check/bridge.html`). That exercises everything the *game* does with the wire.
- **Not tested: the hub's real PeerJS join flow.** WebRTC would not connect in this sandbox even between two peers on one page with no ICE servers (`tests/t3.mjs`), so that failure is the environment, not evidence about the hub. The "two different networks" test from AGENTS.md is still outstanding.
- Headless software rendering ran at 2 to 4 fps, so nothing here says anything about feel or performance. Network numbers (20 Hz `pos`) are from message counts.

## What is on the wire

Five message types, all in `game.js`: `pos` (x, z, heading, speed; 20 Hz, `:560`), `wind` (host to guest, `:463`), `ping` (`:540`), and `found` / `found-all` (`:466,867`, only used by the old procedural islands). **Nothing else is sent.** Over a 40 s run the wire carried 651 host `pos`, 710 guest `pos`, 9 host `wind`, and no other type.

## Sync matrix (what I measured)

| Thing | Synced? | Evidence |
|---|---|---|
| Both boats, positions | Yes, 20 Hz | `pos` both ways; guest's last `pos` equals host's `__self` exactly |
| Pennant colour | Yes, by role | host blue / guest gold, fixed by role (`game.js:363`) |
| Sail trim | No, approximated from wind and heading | `game.js:890-893`, known and documented |
| Boat look (type, deck items, chest) | **Not synced, not checked**: the friend's boat is built from *your own* `boatOptions` (`game.js:513`) | needs a look with two different states |
| Wind | Yes, host owns it | guest applied 9 `wind` messages |
| Traffic and the ferry | Same by design (wall clock), **if clocks agree** | 45 vessels with identical routes on both; median position difference 0.09 m, max 90 m for one vessel that was yielding (`tests/t5.mjs`) |
| Traffic gives way to the friend | Yes | `busy.update(dt, self, [self, other])` (`game.js:836`) |
| Ping | Yes | guest got "Your friend pinged, follow the gold dot" |
| Friend on mini-map and compass | Yes | `game.js:899,934` |
| Friend leaves | Noticed after 5 s | host notice after the wire was cut (`src/partner.js`) |
| Names (269 places) | Same list, **per-device progress** | host 12 and guest 9 known at the same moment; `localStorage` `windward.names.v1` |
| Chart fog (explored cells) | Per device | `windward.explored.v1` |
| Lighthouse task and progress | **Per device** | host relit Islandsberg: host `lights 1/5`; guest `lights 0/5`, all five dark (`shots/t6-*.png`, `tests/t6.mjs`) |
| Light log, chapter 1 (chest), deck cards | Per device | `windward.lightlog.v1`, `chapter1`, `windward.deck.v1` |
| Start card ("After the storm") | Per device, each player sees it | `windward.start.v1` |
| Harbour arrival moment | Own screen only; each player plays their own and gets their own card | both showed `moments: 1`, `deck: 1` (`tests/t8.mjs`) |
| 1950 world (`?year`) | **No** | host `?year=1950`: 18 boats, 15 summer houses, placeholder kit; guest default: 45 boats, 37 houses (`tests/t7.mjs`) |
| Night (`?night=1`) | No, and there is no clock | URL flag read once at start (`game.js:428`) |
| Cards and story beats | Appear only on the screen of the player who triggers them | no message exists for them |

## Bugs

- **B1. The hub drops every game option from the URL, and the game has no way to share them.** The hub rewrites the host's address to `…/?host=<id>` (`index.html:188`), and the guest link is built the same way, but the game reads `?year`, `?night`, `?lights=reset`, `?boat`, `?lure`, `?busy`, `?coast` from `window.location.search` (`game.js:104-125,367,371,428`). So in a hub session you cannot ask for 1950 at all, and if two players each add `?year` by hand they can end up in different eras, with different traffic, houses and kit (measured above). Fix direction: the era is a session setting the host sends; the hub has to carry options in its `launch` message (a shared-surface change, see `docs/COLLABORATION.md`).
- **B2. Traffic and the ferry depend on both devices having the same clock.** Motion is a function of `Date.now()` (`src/busy-coast.js:15,60`). With the guest's clock 90 s fast, the ferry was **181 m** from where the host sees it (`tests/t5.mjs`). Two friends on two laptops with clocks even a few seconds apart will disagree about where the ferry is. Fix direction: the host sends its clock when the friend joins and the guest uses the offset.
- **B3. Harbour and lighthouse "moments" hold your boat while the friend keeps sailing, with no signal to the friend.** Your boat stays parked (the `pos` stream continues with the parked position, `tests/t8.mjs`), so the friend just sees a boat that stopped. Probably fine for a few seconds; the friend gets no hint why. Low.
- **B4. Not checked: does the friend's boat show *your* deck items (the chest)?** `otherBoat` is built from your `boatOptions` (`game.js:513`). If those include the chest or wear, the friend's boat looks like yours. Needs a look with the two states different.
- **B5. Not verified: does the "friend has left" notice clear when the friend comes back?** My check read hidden text, so it can't tell. Code says yes (`game.js:852-855`).

## Design questions for Felix (undefined or confusing, not bugs)

- **D1. Whose world is it?** GAME-DESIGN.md says everyone owns their own world and save, and playing together is *visiting* a friend's (SET, Q11). The code does neither: both players are in an identical-but-separate copy of the same coast. The visible consequence is the lighthouse that is lit on one screen and dark on the other. Options: (a) parallel worlds, honest and cheap, but then lit lights must not look shared; (b) visiting, the host's world state wins while you are there (what the doc says); (c) one shared world, simplest to reason about, against the "own save" decision. Recommend (b), sequenced below.
- **D2. The lighthouse task when two play.** Each relights the same five lights separately. Under (b) the guest should *see* the host's lit lights, and the guest's own progress keeps going in their own save (the doc says earnings go home). Does a light the host relights count for the guest? (Doc rule: no blockers between players.)
- **D3. Who owns the era and the time of day?** Era change needs the friend's consent (doc, "crossing"), and skipping time needs both moored. Today there is no shared era and no shared clock. Is the 1950 chapter solo-only for now?
- **D4. Story beats and cards: whose screen?** Today each player triggers and sees their own; two players at the same harbour each get a moment and a card. Do two friends arriving together share one moment (the doc, line 1236: "a co-op friend sees the same close-up if they sail"), and do they get the same card or one each?
- **D5. Chart fog and names.** Per player today. Should a ping tag something on both charts (the doc says it should)? Do your names show on the friend's chart?
- **D6. Spawn.** The guest spawns one boat-width beside the host (`game.js:385-388`), so nobody has to "find each other", unlike the original fog-of-war design in AGENTS.md. Fine for drop-in play, but check it is intended.
- **D7. When does a session end?** The task has an end (report to grandma), per device. Does the host finishing end it for the guest? What does the guest see if the host leaves (wind freezes; no host handover)?
- **D8. "Start together or solo" is not implemented.** The doc says nobody chooses up front and the story can start solo or together; today both players always get the story start card independently.

## What works

Boat sync, wind, ping, the friend marker on the compass and mini-map, traffic giving way to both boats, the same coast and the same 45 vessels on both screens, noticing a friend leaving, and both players running the full game (task, moments, cards) without errors (no page errors in any run).

## Design audit

Run with the `design-audit` skill, full report in `coop-check/design-audit.md`: 1 pass, 4 weak, 0 fail, 2 needs playtest, 1 not re-audited, 1 split. Previous audit (2026-11-04) had 4 fails; Both-players-matter went fail to weak (ping, traffic yielding, friend on chart). The remaining weakness is the same one as D1.

## Recommendation: what stage 2 should decide and build first

**Decide first (one conversation, `/grill-me`):**
1. D1, the world model. Everything else hangs on it. Recommendation: visiting (b).
2. D3, who owns era and clock. Recommendation: host owns both while visiting.

**Build first (smallest slice that makes co-op real), in this order:**
1. **A session message from the host** when the friend joins (the game already has the trick: `heardFromPeer` at `game.js:497`): `{ type: 'session', hostClock, year }`. The guest uses the clock offset and the era. This fixes B2 and half of B1 and is needed by every later feature.
2. **Carry options through the hub** (B1): the `launch` message gets an `options` object, and the hub stops dropping params. This touches the hub, a shared surface, so follow `docs/COLLABORATION.md` and Kenny's say.
3. **Lit lights visible to the friend** (host-authoritative message, small): the first moment the guest sees the host's world change. This is the "aha" for D1 and answers check 2.
4. Then smart ping that tags places on both charts, then the pair net (the doc's signature move).

**Before any of it:** run the real two-different-networks test (phone hotspot vs home wifi) with the hub link, which this check could not do.
