# Heads-up for Kenny: guest rejoin, opt-in per game (Will It Fit? is unchanged)

**FYI, not a sign-off.** Felix decided no OK is needed. Written 2026-11-07. The change is on branch
`felix/hub-guest-rejoin` and goes in as a PR (it touches the shared hub, see `docs/COLLABORATION.md`).

## What was wrong

`shared/net.js` let one guest connect to the host and then **never let go of that slot**. If the guest's tab
closed or their phone went to sleep, anyone opening the host's link afterwards was turned away until the host
reloaded the hub page (which makes a brand-new link). That is a poor "easy in, easy out".

## What changes, and for whom

**Rejoin is opt-in per game.** A game says it can cope with a returning guest by adding one line to its
`game.json`:

```json
"rejoin": true
```

- **A game with `"rejoin": true`**: when its guest's connection closes or errors, the slot is freed. The same
  link works again, the hub sends the returning guest `launch` again, and the host does not see "Connection
  lost". Still **one guest at a time**: a second guest while one is connected is refused as before.
- **Every other game (no field, or `false`)**: **exactly as before.** The guest who left holds the slot, a
  returning guest is refused, and the host sees "Connection lost".

### Who is opted in

| Game | `rejoin` | Why |
|---|---|---|
| Windward | `true` | Handles a returning friend (and re-sends the wind at once). |
| Archipelago | `true` | Relays `pos` and keeps no other state. |
| **Dino Rumble** (yours) | `true` | Snapshot-based: a returning guest stands still until the first snapshot arrives and sees 0-0 until the next `round` message, which is what a late first join already does. **We changed `games/dino-rumble/game.json` in your folder, just this one line. Set it to `false` or delete it if you'd rather.** |
| **Will It Fit?** (yours) | *not set* | **Unchanged.** It runs lockstep from frame 0 (`src/lockstep.js`), so a guest who came back mid-game could not catch up. It is refused exactly as today. We did not touch the folder. |

(Archipelago and Dino Rumble were judged by reading the code, not by running them.)

### How to opt in later (Will It Fit? or a new game)

1. Make your game safe for a guest who arrives mid-game, with a brand-new page that knows nothing yet. For
   lockstep that means deciding what a returning guest means: restart the round, or ignore a late `hello`.
2. Add `"rejoin": true` to the game's `game.json`.
3. Add the game's id to `OPTED_IN` in `shared/rejoin-optin.test.js` (that test pins the list so a game is
   never switched on by accident).

`games/README.md` documents the field (in the `game.json` section and under "Drop-in play"), and
`games/_template/game.json` shows it switched off.

## Exactly what changed

| Where | Change |
|---|---|
| `shared/net.js` | A hub-only switch `net.setRejoin(on)` / `net.rejoinAllowed()` (default off, like `onConnect` and `hasConnection`; games never see them). When a new guest arrives and the old guest has left, the new one is accepted only if the switch is on. Events from a replaced connection are ignored. |
| `index.html` (host side) | On pick: `net.setRejoin(picked.rejoin === true)`. When a guest leaves: opted-in game, log only; any other game, show "Connection lost" as before. |
| `games/*/game.json` | `"rejoin": true` on windward, archipelago, dino-rumble. Template shows `"rejoin": false`. |
| `games/README.md` | Documents the field and the returning-guest behaviour. |
| `games/windward/game.js` | One line: re-send the wind at once to a returning friend. |
| `shared/net.test.js`, `shared/rejoin-optin.test.js` | New tests: opted-in rejoin works, not-opted-in is refused as before, a second simultaneous guest is refused either way, the list of opted-in games is pinned. |

The `net` object your game receives is **unchanged** (`send`, `onMessage`, `peerId`, `isHost`), and
`scripts/manifest.js` already passes every `game.json` field through, so it needed no change.

## What you could do about it

Nothing is required. If you want a quick look: on the PR's preview URL, host Dino Rumble, join in a second
window, close that window, open the same link again, and check you are back in. Then host Will It Fit? and
check that a returning guest is still refused, as before.

## Known limit

The tests cover a connection that **closes or errors**, which is what a closed tab does. A guest who simply
vanishes (a phone that loses signal without telling anyone) may still look "connected" to the host until the
browser notices the dead link, so a rejoin attempt in that short window is refused. That is the same as today,
not worse.
