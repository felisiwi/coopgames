# Heads-up for Kenny: a guest who drops can now come back on the same link

**FYI, not a sign-off.** Felix decided no OK is needed. Written 2026-11-07. The change is on branch
`felix/hub-guest-rejoin` and goes in as a PR (it touches the shared hub, see `docs/COLLABORATION.md`).

## What was wrong

`shared/net.js` let one guest connect to the host and then **never let go of that slot**. If the guest's tab
closed or their phone went to sleep, anyone opening the host's link afterwards was turned away until the host
reloaded the hub page (which makes a brand-new link). That breaks "easy in, easy out" for every game.

## What changes

Only the hub, `shared/net.js` plus two small edits:

| Where | Change |
|---|---|
| `shared/net.js`, `host()` | When the guest's connection **closes or errors**, the slot is freed. A new guest on the same link is accepted. Still **one guest at a time**: a second guest while one is connected is refused exactly as before. |
| `shared/net.js`, `wireConnection()` | Events from an **old** connection are ignored once a new guest has replaced it (otherwise a late "close" from the old one would have told the game the connection was lost). |
| `index.html` (host side) | `net.onClose` on the host no longer swaps the screen for "Connection lost — host must resend a link", because the link is fine now. Guests still see it. |
| `games/README.md`, "Drop-in play" | One paragraph: a returning guest looks to your host game like a late first join. |
| `games/windward/game.js` | One line: Windward re-sends the wind at once to a returning friend. |

The `net` object your game receives is **unchanged** (`send`, `onMessage`, `peerId`, `isHost`). The hub sends
`launch` to the returning guest again, the same way it does for any guest who connects. Messages `send()`
queued while nobody was connected (the newest 50) are flushed to the returning guest, as they already were
for the first one.

## Your three games, by reading the code (not run)

- **Archipelago**: relays `pos` and keeps no other state. A returning guest just works.
- **Dino Rumble**: snapshot based. A returning guest stands still until the first snapshot arrives and sees
  0-0 until the next `round` message. That is exactly what a late first join does today, so nothing new.
- **Will It Fit?**: **this is the one to look at.** It settles solo-or-networked in a 90-frame handshake at
  the start and then runs lockstep, where a frame only runs when *both* players' inputs for it are known
  (`src/lockstep.js`). A returning guest starts again at frame 0 while the host is at frame N, so the host
  would sit on "Waiting for your partner…" and the two would be playing different stages. **Before this
  change** that player was simply refused at the door. **After it**, they get in and then the game stalls.
  This change does not touch your game. Options when you have a minute: restart the round when a `hello`
  arrives after the handshake has settled, or ignore a late `hello` so the old behaviour (a stuck, silent
  partner) stays, or tell us you'd rather the hub could say "this game doesn't allow rejoin" and we'll look at
  a one-line opt-out.

## What you could do about it

Nothing is required. If you want a quick look: on the PR's preview URL, host a game, join in a second window,
close that window, open the same link again, and check you are back in.

## Known limit

The tests cover a connection that **closes or errors**, which is what a closed tab does. A guest who simply
vanishes (a phone that loses signal without telling anyone) may still look "connected" to the host until the
browser notices the dead link, so a rejoin attempt in that short window is refused. That is the same as today,
not worse. It gets better on its own as soon as the browser reports the connection as failed.
