# Boat variety for the busy coast (written 2026-11-07)

---

You are the agent named in the message (e.g. "You are agent 1"). Task: passing boats all look alike (few
models, one colour). Make the busy coast's boats varied and era-appropriate.

SETUP (new worktree from the latest main):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-boats -b felix/windward-boat-variety origin/main
Read: docs/MISSION-CONTROL.md, shared/ART.md, src/busy-kits.js (kits: 'today' = sailboat, motorboat, ferry;
'1950' = sailboat1950, snipa, fishing boat, ferry1950), src/era-assets.js (the add-functions; the 1700
ekas/cargo boat), data/busy-eras.json (profiles, colours), src/busy-coast.js (how vessels are stamped and
seeded), src/boats.js (the player's boats, for style), docs/WORLD-1950.md "boats", data/world-1950.json
boats. Do NOT edit game.js (agent 2 is changing it). Docs are fallible: verify.

1. Research first (short, sourced, into docs/BOATS-BY-ERA.md): which boat types sailed this coast around
   1950 and today (and note 1703 for later): e.g. 1950: koster (gaff), snipa (motor, some with a sail),
   eka (rowed or spritsail), Bohuslän fishing cutters, small passenger/cargo boats; today: modern sloops,
   motorboats, small daysailers, RIBs, kayaks. Rigs and typical colours per era (white or tarred/varnished
   hulls, tanbark/red-brown vs white sails), with sources.
2. Variety per boat, deterministic from the boat's existing seed (both phones see the same boat): hull
   colour, sail colour, rig (single sail vs foresail + mainsail; gaff, sprit, Bermuda per era), size within
   a range, small details (cabin or not, a flag). Era rules decide what's allowed (no white Bermuda sloops
   in 1950 fishing fleets, etc.).
3. New boat types where the research says they're missing (at least a koster and an eka for 1950, and a
   daysailer or RIB for today), as add-functions in the era-assets.js style (new file if era-assets.js
   would grow too much; you may edit busy-kits.js, busy-eras.json and era-assets.js; keep the kit API).
4. A shelf in era-asset-lab (or a small new boats lab) showing 20 seeded boats per era side by side.
5. Tests: same seed = same boat; every variant allowed in its era; triangle budgets; busy-today/busy-coast
   tests still pass.
GATES: 1) research doc + variety on existing types (screenshot of the shelf), push, report. 2) new types +
tests + a 390x844-ish screenshot of a busy harbour in the game per era you've looked at. Push; do not merge.
Commits: author `Claude <noreply@anthropic.com>`, Co-Authored-By / Claude-Session lines. Report with the
preview URL from Vercel.
