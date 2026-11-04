---
name: design-audit
description: Audit one game in games/<id>/ against the hub's shared definition of a good small game for people playing together, plus that game's own design-checks.md. Report only — changes no code. Use before calling a game "playable" and after any big gameplay change.
---

# Design audit

One shared definition of "a good small game for two people playing
together" that every agent in this repo checks against — Felix's and
Kenny's alike — so quality doesn't depend on who built the game. Covers
co-op and versus equally: the hub is for people playing *together*, which
includes playing against each other.

Origin: a build log ("One month building Hiraeth", r/threejs) whose author
turned design principles into agent skills and audits his game against
them regularly. Grilled with Felix 2026-11-04.

## When to run it

- Before marking a game "playable" or showing it to the other person.
- After any big gameplay change (new mechanic, new mode, changed goal).
- Not after art-only changes — the visual changelog covers those.

## Rules

- **Report only.** Read, run, measure — never edit game code during an
  audit. Fixes are proposals in the report; a human decides.
- **Someone else's folder** (`game.json` `owner` isn't the person you're
  working for): don't write AUDIT.md there. Put the report in your final
  message for them to pass on.
- **Tool economy** (AGENTS.md): node first. Import the game's own modules
  headlessly (`node --input-type=module -e '...'`), run its tests, read
  its code. No Claude-in-Chrome, no screenshots.
- **No invented passes.** If a check is about how play *feels* and you
  haven't observed a real two-player session, rate it `needs playtest`.

## Ratings

| Rating | Means | Needs |
|---|---|---|
| **pass** | Clearly met | Evidence: `file:line`, a test, or a headless measurement |
| **weak** | Partly met, or met by accident | Evidence + one concrete fix |
| **fail** | Not met | Evidence + one concrete fix |
| **needs playtest** | Can't be judged without two people playing | What specifically to watch for, and what you could see in code that bears on it |

One fix per non-pass — the single most useful change, not a list.

## Hub-wide checks (every game)

Six on purpose. Apply them with judgement: the *why* is the point.

1. **First 30 seconds.** Each player knows what to do within about 30
   seconds, with no explanation from the other person.
   *Why:* these games get opened from a link a friend sent; if the first
   half-minute is confusion, the session is over before it starts.
   Code can show whether there's any on-screen prompt; the feel itself
   usually `needs playtest`.

2. **Both players matter.** Take one player away and the game breaks or
   goes empty. In co-op, players need each other; in versus, the opponent
   *is* the game.
   *Why:* two people playing side by side in the same world is a
   screensaver with a chat window. The other player must change what you
   do.

3. **A "come here" moment.** The game creates at least one reason for a
   player to call out to the other — "wait, look at this", "help", "watch
   out".
   *Why:* talking to each other is the thing these games are for (voice
   happens outside the game). If nothing prompts it, nothing gets said.

4. **Graceful end.** A session ends, or can be left, cleanly: there's a
   natural stopping point, and a player leaving or dropping doesn't strand
   the other in a broken state.
   *Why:* casual sessions end because someone's dinner is ready. A game
   that only ends by closing the tab feels unfinished.

5. **Hub contract.** `game.json` complete and `id` matches the folder;
   `game.js` default-exports `start({ canvas, net, seed, role, players })`;
   the same seed builds the same world on both peers; it works from the
   hub's link join; it never imports PeerJS or `shared/net.js`; assets
   resolve against `import.meta.url`. See `games/README.md`.
   *Why:* the hub only works if every game plugs in the same way.
   Mostly checkable from code.

6. **True to its own feel.** The game honours its own feel document —
   `shared/ART.md` for Windward, the game's `DESIGN.md`/`README.md` for
   others. Check the rules that are checkable in code (materials, palette,
   banned effects); leave "does it look cozy" to the human.
   *Why:* a game drifts from its intent one plausible-looking commit at a
   time.

## Per-game checks

Each game keeps its own in `design-checks.md` in its folder (the template
starts with an empty one). Same shape as above: the check, its principle,
and why it matters. Audit them after the hub-wide six. If a game has no
`design-checks.md`, say so in the report and suggest two or three.

If a per-game check depends on a measurement (e.g. a dead-zone % — the
share of the world too far from anything worth finding), run it for at
least 3 seeds and quote the numbers.

## Procedure

1. Read `games/<id>/game.json`, `game.js`, its `src/`, its `design-checks.md`,
   and its feel doc. Read its last AUDIT.md entry if there is one, so you
   can say what changed.
2. Run its tests and any headless measurements its checks call for.
3. Rate every check. Gather evidence as you go — line numbers, numbers,
   test output.
4. Write the report (format below). If you may write in this folder,
   prepend it to `games/<id>/AUDIT.md` (newest at the top). Otherwise put
   it in your final message.
5. Summarise to the human in three lines: how many pass, the most
   important fail, the first thing to playtest.

## Report format

```markdown
## YYYY-MM-DD — <short context, e.g. "first audit" or "after stage W2">

Audited at commit <sha>. Summary: X pass · Y weak · Z fail · W needs playtest.

### Hub-wide
| # | Check | Rating | Evidence | Fix |
|---|---|---|---|---|
| 1 | First 30 seconds | needs playtest | ... | Watch for: ... |
| ... |

### Per-game (design-checks.md)
| Check | Rating | Evidence | Fix |
|---|---|---|---|

### Most important next step
One paragraph: the single change that would improve the game most, and why.
```
