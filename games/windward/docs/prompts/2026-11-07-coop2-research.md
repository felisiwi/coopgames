# Research agent: co-op stage 2 plan (written 2026-11-07, not yet sent)

Paste everything below the line into a terminal Claude Code agent. Can run alongside the stage agent.

---

You are the research agent for Windward co-op stage 2 ("visit the host's world") in the
coopgames repo. PLAN ONLY: write documents, change no existing file, no code changes.

SETUP (own worktree, never the main folder):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-coop2 -b felix/windward-coop2-plan origin/main
  cd ~/GitHub/coopgames-coop2
Read: AGENTS.md, docs/COLLABORATION.md, games/README.md (the hub contract), docs/MISSION-CONTROL.md,
games/windward/docs/COOP-CHECK.md, GAME-DESIGN.md sections "Playing together", "Decisions (…late
afternoon)" and "Rule: players keep their progress", and games/windward/docs/ALIVE-SEA.md (the
settled thing-model and weather grills: world seed + day seed, wind as a fixed function of seed and
clock, host owns world changes). Then read the code: index.html (hub), shared/net.js,
games/windward/game.js (net messages: grep for net.send / onMessage), src/busy-route.js (traffic is
a function of wall-clock time), src/wind.js (host-authoritative today), src/era-storage.js (saves
per era), src/task-1950.js, src/beats-1950.js.
A stage agent is changing game.js in another worktree right now (a pause with a game clock,
scripted wind for the first errand). Don't touch it; design around a game clock existing.

DELIVERABLES (new files only)
1. games/windward/docs/COOP-STAGE2-PLAN.md:
   - Current state, verified against the code: what crosses the wire today, what each side
     computes alone, where the two phones can disagree (era, chapter phase, lit lights, traffic
     clock, wind, story cards, the opening).
   - The host session message on join: exact shape (clock offset, era/year, chapter phase,
     lit lights, world seed and day seed, anything else needed), when it's sent, how the guest
     applies it WITHOUT writing into the guest's own saves (the friend keeps only personal
     souvenirs: discovered names, light log, sightings). Save-safety: no new/renamed guest keys
     without a migration.
   - Clock: how the guest adopts the host's game clock (offset) so traffic/ferry/wind agree,
     including after either player pauses.
   - Game options through the hub launch message (e.g. ?year, story flags lost by the ?host=
     rewrite): the minimal change to the hub. This is the shared hub: spell out exactly which hub lines
     change and how other games (Kenny's) stay unaffected; Kenny gets a heads-up, no sign-off needed.
   - What happens when the guest lands mid-story (cards, the opening, the guest joining in 1950
     while the host is past chapter 1).
   - Gated build plan (batches with DONE WHEN, tests, and a two-phone/two-network check), and the
     risks you found. Options, not decisions, where the design is open; mark each for Felix.
2. docs/notes/KENNY-HUB-LAUNCH.md: a short plain-English heads-up for Kenny (FYI, not a sign-off:
   Felix decided no OK is needed): what will change in the hub launch message and why, the exact
   lines/files, and how his games stay unaffected.

RULES
- Commits: author `Claude <noreply@anthropic.com>`; messages end with the Co-Authored-By /
  Claude-Session lines. Push once, at the end; do not merge.
- Report: the plan's summary (half a page), open questions for Felix, and the Kenny note's text.
