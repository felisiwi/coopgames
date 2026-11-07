# Research agent: island lore (written 2026-11-07, not yet sent)

Paste everything below the line into a terminal Claude Code agent. New files only, so it can run
alongside the other agents.

---

You are the research agent for Windward's island lore in the coopgames repo. RESEARCH AND DATA
ONLY: new files only, change no existing file, no game code.

SETUP (own worktree, never the main folder):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-lore -b felix/windward-island-lore origin/main
  cd ~/GitHub/coopgames-lore
Read: AGENTS.md, docs/MISSION-CONTROL.md, games/windward/docs/ALIVE-SEA.md (the thing model, place
profiles, artifacts, mini quests: this research feeds them), GAME-DESIGN.md story canon (later
sections override), docs/WORLD-1700.md, WORLD-1950.md, PEOPLE-1700.md, PEOPLE-1950.md,
data/history-start-area.md, data/place-names.json (existing descriptions: extend, don't duplicate),
data/settlements-history.json, and the name list the game uses: assets/coast/names.json + src/names.js
(entries have ids like osm:relation/..., kinds island | skerry | harbour | village | light).
Docs are fallible: verify.

GOAL
For the islands, skerries and harbours in the game's play window (Skaftö, Fiskebäckskil, Grundsund,
Lysekil side, Gullmarsfjorden mouth, out to Måseskär; use the name list's bounds), find what makes
each place itself, across our eras (~1703, ~1950, today):
- History: fishing (herring periods), pilots, lighthouses and sea marks, shipwrecks, quarries and
  stone shipping, canneries, smuggling, wars (the 1700s Great Northern War, Tordenskiold), summer
  guests, storms.
- Folklore and legends (sägner): sea spirits, haunted skerries, wreckers, treasure tales, local
  superstitions about the sea, named rocks with a story.
- Place-name meanings (what the name says about the place).
- Landmarks you could see from a boat and that make an island recognisable: cairns/kummel,
  stone sea marks, chapels, huts and boathouses, quarry scars, rock carvings, wrecks, odd rock
  shapes, a lone tree, a flagpole, nets drying, bird colonies, seal skerries.
- Hooks for the systems: possible regulars per place and era (by role, never real private
  people's names), small secrets, rumours, mini-quest seeds, artifact candidates (with era made/
  found and a rarity guess), and unique-artifact candidates for Felix to choose from.

SOURCES
Swedish Wikipedia (MediaWiki API URLs work from Felix's Mac), Riksantikvarieämbetet's Fornsök /
Kulturmiljöbild (ancient monuments, wrecks, cairns), Bohusläns museum, Lantmäteriet / Institutet för
språk och folkminnen (place names, folk tales), hembygdsföreningar (Skaftö, Lysekil), Sjöhistoriska.
Every fact has a source. Mark confidence and "uncertain" where needed. Paraphrase; never paste long
passages. Invented hooks (regulars, quest seeds) are marked INVENTED and kept separate from facts.

DELIVERABLES (new files only)
1. games/windward/data/island-lore.json: one entry per place, keyed by the name list id where one
   exists (otherwise a slug + lat/lon), with: name, kind, eras [{era, facts[], landmarks[],
   folklore[], placeName, regulars[], secrets[], rumours[], questSeeds[], artifacts[]}], sources,
   confidence. Facts and INVENTED hooks in separate fields.
2. games/windward/docs/ISLAND-LORE.md: readable summary: the 15 to 20 places with the richest
   material first, the best folklore, the strongest story hooks for Britta / the boy / Torhild /
   the keeper, and gaps you could not fill.
3. games/windward/docs/ISLAND-ASSETS-BRIEF.md: a per-island landmark asset list (what to model so
   each island is recognisable from a boat), grouped into reusable asset types (cairn, boathouse,
   chapel, quarry scar, drying nets...) with era notes (exists in 1703? 1950? today?).
4. games/windward/docs/UNIQUE-ARTIFACT-CANDIDATES.md: 10 to 15 candidates, each inspired by real
   history, with why it fits the story, the era made/found, and a source. Felix picks.

GATES
1. After the 10 richest places: push, report a short sample (3 entries) so mission control can check
   the shape before you do the rest.
2. The rest + the three docs. Push once more; do not merge.

RULES
- Commits: author `Claude <noreply@anthropic.com>`; messages end with the Co-Authored-By /
  Claude-Session lines. Push only at gates; do not merge.
- Never use real private people's names for invented regulars; historical public figures only with
  sources.
- Report: counts (places covered, facts, folklore, quest seeds, artifacts), the best five finds, and
  open questions for Felix.
