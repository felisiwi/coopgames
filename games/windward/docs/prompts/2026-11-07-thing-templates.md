# Agent 3: draft thing, quest and artifact templates (written 2026-11-07)

---

You are agent 3. RESEARCH AND DATA ONLY: new files only, no game code. New worktree from the latest main:
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-templates -b felix/windward-thing-templates origin/main
Read games/windward/docs/ALIVE-SEA.md: the settled grills (thing model rounds 1 to 3, mini quests and
artifacts, anchoring, day and night, logbook). It is your spec for the shapes. Then data/island-lore.json
and docs/ISLAND-LORE.md (27 places), data/world-1950.json, data/people-1950.json, docs/PEOPLE-1950.md,
docs/UNIQUE-ARTIFACT-CANDIDATES.md, and src/names.js + assets/coast/names.json (anchor ids, kinds).

Deliverables (1950 only for now):
1. games/windward/data/things-1950.json: thing templates per the settled fields (name, era range, where:
   anchor type + placement rules, when: time of day / weather / season / story phase, routine, reactions:
   tap / approach / anchored nearby, sighting entry, rarity, source or invented). Cover: wildlife (port
   what src/life.js has: gulls, eiders, seals; plus herons, cormorants, porpoises, a diving flock), people
   and regulars by role (net-mender, fisherman out at dawn, pilot boat, summer guests, keeper), drift finds
   (fish box, oar, fishing float, bottle), and per-place regulars/secrets from island-lore.json (link by
   place id). Every invented one marked invented.
2. games/windward/data/quests-1950.json: quest templates with slots, per the settled rules (need + 1 to 3
   steps with existing verbs + resolution; giver; cooldown; line variants per personality: gruff, chatty,
   shy; marked INVENTED). Include the three first-slice templates (lost item, delivery, after the squall)
   plus 10 to 15 more drawn from the lore's quest seeds.
3. games/windward/data/artifacts-1950.json: artifact templates (name, era made, era found, rarity tier,
   true story with source, leads to, sellable later). Commons to rares from the lore; NO uniques (Felix
   places those himself).
4. games/windward/data/rumours-1950.json: rumour records (target, who tells it via 1950 channels: people,
   the radio shipping forecast, notice boards, the post; text, days it lasts, true or twist; never empty).
5. games/windward/docs/TEMPLATES-1950.md: what's in each file, counts, how they link (ids), and a short
   list of the 10 templates you think are strongest for Felix to read first.
6. A node test (src/templates-1950.test.js): every file parses; ids unique; every place/anchor id exists in
   the name list or island-lore; every invented item flagged; every quest slot type known; every rumour
   target exists.
Rules: never real private people's names; facts with sources, invention flagged. Short line variants
(Felix rewrites by eye). Commits: author `Claude <noreply@anthropic.com>`, Co-Authored-By / Claude-Session
lines. Gate after things-1950.json (push, report 3 sample entries); then the rest; push; do not merge.
