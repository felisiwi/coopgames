## 2026-11-06 — co-op check (stage 2 prep)

Audited at commit eefd08d (main). Summary (9 checks): 1 pass · 4 weak · 0 fail · 2 needs playtest · 1 not re-audited · 1 split (pass solo, weak together).

Previous audit: `games/windward/AUDIT.md`, 2026-11-04 (first audit, 2 pass · 3 weak · 4 fail). Since then the game moved to the real Bohuslän coast, the lighthouse task, harbour moments and the busy coast landed. Tests: `node --test games/windward/src/*.test.js` → 62 pass, 0 fail.
Method: two real game instances in headless Chromium, in separate browser contexts, connected through the game's own `net` contract (`docs/coop-check/bridge.html`). The hub's real PeerJS join could NOT be exercised: WebRTC failed in this sandbox even between two peers on one page with no ICE servers (`tests/t3.mjs`). So nothing below says the hub link works or fails.

### Hub-wide
| # | Check | Rating | Evidence | Fix |
|---|---|---|---|---|
| 1 | First 30 seconds | needs playtest | Each player gets a start card, "After the storm", saying what to do, plus a key legend (`game.js:690`, screenshots in `shots/`). Both players see it, on their own screen, once per device (`src/lighthouse-task.js` `START_KEY`). Nothing tells a *guest* that the friend is already out there or that the ping key exists beyond the legend line "space ping". | Watch for: does a guest who joins mid-session know the host is nearby and what the lights task is, without the host explaining? |
| 2 | Both players matter | weak | Better than the first audit: ping (`game.js:540`), traffic yields to both boats (`game.js:836`), the friend is on the mini-map and compass (`game.js:899,934`). But the task, names, fog, cards and chapter are each player's own (`localStorage`), and after the host relit Islandsberg the guest's screen still showed all five lights dark and `lights 0/5` (`tests/t6.mjs`). Take the friend away and nothing changes for you. | Decide the world model (see COOP-CHECK.md D1), then share lit lights first. |
| 3 | A "come here" moment | weak | Ping exists and works: guest got "Your friend pinged — follow the gold dot" (`tests/t7.mjs`). Nothing in the world needs two boats; the lights are solo tasks, found-together finds only exist on the procedural islands (`game.js:864`, `DISCOVER_REQUIRE_BOTH`). | The pair net, or a light that needs both boats nearby. |
| 4 | Graceful end | weak | A friend who stops sending `pos` for 5 s is removed and a notice shows (`src/partner.js`, `game.js:843-850`; host notice confirmed after cutting the wire). The hub's own "Connection lost" panel is still hidden during play (`index.html:82-84,142`). The task has an end (report to grandma, `phase: 'done'`), but only per device. A refreshed host kills the link (known, accepted). Not verified: that the notice clears when the friend returns (my text query could not tell hidden from shown). | Verify "friend is back" in a real session; decide what "session over" means in co-op (D7). |
| 5 | Hub contract | weak | `game.json` fine, `game.js` default export, no PeerJS import, assets via `import.meta.url` (`game.js:104-123`). Same seed gives the same coast and 45 identical traffic vessels (`tests/t5.mjs`). But: the link join was not tested here, and game options in the URL (`?year`, `?night`, `?lights`, `?boat`, `?lure`, `?busy`) do not survive the hub's link rewrite (`index.html:188`), so a hub session cannot carry them. | See COOP-CHECK.md B1. |
| 6 | True to its own feel | not re-audited | Out of scope for a co-op check; last result in `AUDIT.md` (weak). | — |

### Per-game (design-checks.md)
| Check | Rating | Evidence | Fix |
|---|---|---|---|
| Sailing is a skill you can feel yourself getting better at | pass (not re-measured) | Sail/wind tests still green (62/62). Feel is a playtest call. | — |
| The sea tells you about the wind | needs playtest | Not re-checked; wind is host-authoritative and the guest applied the host's `wind` messages (`game.js:495-535`, 9 `wind` messages seen in 40 s). | Playtest on a guest screen. |
| Going somewhere is worth it | pass (solo), weak (together) | Solo: the five lights, harbour moments and 269 names give a reason to sail (`tests/t8.mjs`: moment plays, card added). Together: a harbour moment and its card play separately on each screen, and the friend's reward is not visible to you. | Same as check 2. |

### Most important next step
Decide the co-op world model before building any co-op feature: do two friends play in their own copies of the same coast (what happens now), or does one visit the other's world, which is what GAME-DESIGN.md says (SET, Q11)? Today's code is a third thing, "two solo games with a shared sea", and that is why a relit lighthouse stays dark on the friend's screen. The cheapest first build under either model is a small host-owned session message (era, shared clock, lit lights) sent when the friend joins.
