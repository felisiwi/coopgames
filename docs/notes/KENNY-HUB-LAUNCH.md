# Heads-up for Kenny: the hub's launch message gets an `options` field

**FYI, not a sign-off.** Felix decided no OK is needed from you. This is here so nothing in the hub changes
under you without you knowing. Written 2026-11-07 for Windward's co-op stage 2
(`games/windward/docs/COOP-STAGE2-PLAN.md`, section 5). Nothing has been changed yet: this describes the PR
that is coming.

## What changes, in one sentence

When the host presses Play, the hub will also send along the host's page options (the `?key=value` bits of the
address) as a small `options` object, and hand them to the game in `start()` as one extra optional field.

## Why

Windward reads settings like `?year=1950` from the page address. Inside the hub that never works: the hub
rewrites the host's address to `?host=<id>` (`index.html:188-189`), so the settings are lost, and the friend's
link never had them. That is how two players end up in different versions of the world. Windward needs the
host's settings to reach both players' games. Other games could use it too (a difficulty, a map name).

## Exactly what changes

Only the hub's `index.html` and one paragraph of `games/README.md`. **`shared/net.js` is not touched.**
Line numbers are as of `d785ba4`.

| Where | Change |
|---|---|
| `index.html`, just before line 188 | Remember the page's `?key=value` pairs (except `host`) before the address is rewritten. At most 20 keys, values at most 200 characters, text only. |
| `index.html:222` | `currentLaunch = { gameId, seed, options }`. The two places that send `launch` (`:223`, `:233`) already spread `currentLaunch`, so they need no edit. |
| `index.html:140` and `:153-161` | `launchGame(...)` and the `start({...})` call get one more field, `options`. |
| `index.html:282` and `:298` | The guest passes the `options` from the launch message on to `launchGame`. |
| `games/README.md`, "The contract" | One added line documenting `options` as optional. |

The new launch message looks like this. The first three fields are exactly what it is today:

```json
{ "type": "launch", "gameId": "windward", "seed": 123456, "options": { "year": "1950" } }
```

## Your games are unaffected

- `archipelago`, `dino-rumble` and `will-it-fit` (and `_template`) all take `start({ canvas, net, seed, role, ... })`
  by picking out the fields they use. An extra `options` field is simply not looked at. `net`, `seed`, `role`
  and `players` keep their meaning and shape.
- The solo `index.html` pages that read `location.search` for debug switches are not affected: inside the hub
  the address was only ever `?host=...`.
- Old and new coexist. A guest on an old hub page ignores `options`; a new guest on an old host sees no
  `options` and carries on exactly as today. So a deploy while someone has a tab open does not break anything.
- The hub does not interpret `options` at all, so it cannot break a game. Each game decides what to honour.
  (Windward honours only a short list and ignores the rest, because one of its debug options resets a
  player's save.)

## What you could do about it

Nothing is required. If you want a 2-minute check: on the Vercel preview URL of the PR, host each of your
games through the hub, join with a second tab, and see that it starts and plays as before. The PR will ask for
that.

## How it ships

By `docs/COLLABORATION.md`, `index.html` is a shared surface, so this goes as a branch
(`felix/windward-coop2-hub-options`) and a PR with the preview URL in it; either of you can merge.

## One more hub change that may follow, separately

`shared/net.js` never frees the guest slot when a guest's connection closes (lines 206-213), so a guest whose
phone sleeps cannot rejoin the same link until the host reloads. Windward would like that fixed (about three
lines), and it would help your games too. It is **not** part of this PR. If Felix goes ahead you will get a
separate note.
