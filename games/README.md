# Adding a game to the hub

This is the doc an agent reads to build a game that plugs into this hub. Read
`AGENTS.md`'s "Hub structure" section first for the why; this is the concrete
how.

## The contract

Every game is a folder at `games/<name>/` with two required files.

**`game.json`** — discovery metadata, scanned by `scripts/manifest.js` into
`games/manifest.json`, which the hub's `index.html` fetches at runtime to
render its picker:

```json
{
  "id": "archipelago",
  "name": "Archipelago",
  "description": "One sentence, shown on the hub picker card.",
  "players": { "min": 2, "max": 2 }
}
```

`id` should match the folder name. A folder with no `game.json` isn't
discoverable. `_template/` is skipped outright, by name, regardless of what
its own `game.json` says.

**`game.js`** — default-exports the game's entry point:

```js
export default function start({ canvas, net, seed, role, players }) {
  // canvas: <canvas> element, already sized and inserted into the page.
  // net: { send(msg), onMessage(fn), peerId, isHost } — the ONLY way to
  //   talk to the other peer(s). The hub owns the PeerJS connection; games
  //   never import PeerJS or shared/net.js directly, only this object.
  // seed: number, identical on every peer — seed your generator with it,
  //   don't invent separate randomness for anything that must match.
  // role: 'host' | 'guest'.
  // players: info about the session's participants (shape not finalized
  //   until multiplayer sync lands — don't build load-bearing logic on it
  //   beyond player count, which game.json's players.min/max already gives
  //   you).
}
```

## Folder layout

```
games/<name>/
  game.json     required — discovery metadata
  game.js       required — the start() entry point
  index.html    solo dev entry (see below) — expected, not enforced
  src/          your code, organized however you like
  assets/       your game's own art/audio, if not shared (see below)
```

No build step, no framework, no bundler for games. Plain ES modules, relative
imports.

## Discovery

`scripts/manifest.js` scans `games/*/game.json` (skipping `_template`) and
writes `games/manifest.json`. Run it yourself after adding or editing a game,
and commit the result:

```
node scripts/manifest.js
```

It also runs automatically as Vercel's `buildCommand` (`vercel.json`) on
every deploy — but the committed copy is what local testing sees, since
`python3 -m http.server` serves static files with no build step of its own.

## Asset conventions

- Art/audio shared by more than one game goes in `shared/assets/<pack-name>/`,
  with a `LICENSE.txt` next to it recording where it came from and its
  license (CC0, etc). Never assume a license — check and record it.
- Art/audio used by only one game goes in `games/<name>/assets/`. Same rule:
  a license file if the source needs one, and curate only what you actually
  use — don't vendor a whole pack "just in case" (see AGENTS.md risk #6 on
  the archipelago tileset for the pattern).

## Solo dev entry

Because `game.js` never touches PeerJS, a game can be developed and tested
with zero networking: `games/<name>/index.html` should be a standalone dev
entry that fakes `net` and calls `start()` directly — see
`games/_template/index.html` for the pattern (`send()` logs, `onMessage()`
just collects listeners nobody drives yet, `peerId` is a fixed string,
`isHost` is `true`). Open it directly in a browser, or via
`python3 -m http.server` — no hub, no connection, no second player required.

## The two-human rule

Felix and Kenny both push to `main` on this repo. One agent works one repo
at a time, across both humans — check `git status` for someone else's
in-progress work before starting anything, and don't start a mission on a
dirty tree without asking first. `LAST_SESSION.md` at the repo root is the
handoff: read it before you start, update it as your last step before you
stop.

## Tool economy

See AGENTS.md's "Tool economy" section — it applies here too. Prove a game's
invariants with a headless node script (import the module directly, no
browser) before reaching for Claude in Chrome. Screenshots are for genuinely
visual judgment calls only ("does this look cozy") — and even then, the
human makes that call, not the agent; one screenshot to show them is enough.
