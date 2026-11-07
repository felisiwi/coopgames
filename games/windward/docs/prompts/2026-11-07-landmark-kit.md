# Agent 4: landmark asset kit (written 2026-11-07)

Paste everything below the line into agent 4 (it wrote the island lore and the asset brief).

---

You are agent 4. You wrote games/windward/docs/ISLAND-ASSETS-BRIEF.md; now build its first assets so
islands become recognisable from a boat. NEW FILES ONLY: don't edit any existing file (agent 2 is
changing game.js, the camera and the water right now; agent 1 is fixing lighthouse data).

SETUP (new worktree from the latest main; your lore is merged there):
  git -C ~/GitHub/coopgames fetch origin
  git -C ~/GitHub/coopgames worktree add ~/GitHub/coopgames-landmarks -b felix/windward-landmarks origin/main
  cd ~/GitHub/coopgames-landmarks
Read: docs/MISSION-CONTROL.md, shared/ART.md (the art style), games/windward/src/era-assets.js and
era-asset-lab.html + its doc docs/era-assets/README.md (your model: low-poly add-functions writing into
shared Meshers, flat Lambert, Skagen pastels, no textures, windows as the only lit thing), your
ISLAND-ASSETS-BRIEF.md and data/island-lore.json, and docs/CORRECTIONS-TODO.md (e.g. Måseskär was red and
white in 1950). Docs are fallible: verify.

WHAT TO BUILD
1. src/landmark-assets.js: reusable landmark types from the brief, each an add-function in the
   era-assets.js style, with era variants (1703 / 1950 / today) where the brief says they differ:
   - stone cairn (kummel) with the brief's variants: heaped unpainted stone, white square, black
     cylinder, black cylinder with arm, white concrete cone with arm, white with a coloured belt, tall
     white with pole and red ball, small white;
   - pole mark (stångmärke), incl. Gäven 1835 (the heart-shaped spire) as a parameterised variant;
   - small automatic light (fyrkur): Stångholmen's white octagonal one, Fredagsholmen's;
   - boathouse / sea hut (sjöbod) and a row of them; drying nets and fish racks;
   - small white board-clad church or chapel; the Fiskebäckskil windmill;
   - Stångehuvud's dark light house (small white wooden house, black A-frame roof).
   Reuse era-assets.js's existing cairn/boathouse/racks if they fit (import, don't copy); say what you
   reused. Sizes: real metres from the brief, then the game's 1:10 world scale (check how era-assets.js
   and boats.js scale things; sea marks at 1:10 read too small, so check what the game already does for
   marks and lighthouses and follow it).
2. data/landmarks.json: placements: { id, type, variant, era: [..], lat, lon, heading?, place (the
   island-lore key), source, confidence }. Use exact coordinates where your sources have them (K-samsök
   records have coordinates); otherwise the place's point plus a note, confidence "approx". Only
   landmarks that existed in that era (the brief's era columns).
3. landmark-lab.html + src/landmark-lab.js: a viewer like era-asset-lab: (a) a shelf of every type and
   variant, era switch 1703 / 1950 / today; (b) a "from the boat" view on the real coast (see how
   world-1700-lab.js loads the coast) at 3 or 4 places from the brief's per-island table, e.g. Måseskär
   with Hinneskär, Käringön with Tornö and Korsholmen, Kråksundsgap's cairns, Bonden: does each
   island read as itself from a boat at the game's camera distance? URL params for era and place.
4. Tests (node, no THREE where possible): every placement has a known type/variant, an era list, a
   source, coordinates inside the play region (assets/coast/names.json region), and no landmark placed
   in an era the brief says it didn't exist.

GATES
1. The shelf: all types and variants, one 390x844-ish screenshot per era you've looked at. Push. Report.
2. landmarks.json + the "from the boat" views + tests. Screenshots of the 3 or 4 places. Push.
3. docs/LANDMARKS.md: what each type is, the variants, the data fields, how the game should place them
   later (one paragraph, no game code). Push. Final report with the preview URL from Vercel and a phone
   checklist for Felix: does each place look like itself; anything too small, too big, wrong colour.

RULES
- Root cause with evidence before fixes; ask before long rebuilds. No localStorage.
- Commits: author `Claude <noreply@anthropic.com>`; messages end with the Co-Authored-By /
  Claude-Session lines. Push only at gates; do not merge. Don't edit LAST_SESSION.md: put state lines in
  your report.
- Tests: cd games/windward && for t in src/*.test.js; do node $t >/dev/null || echo FAIL $t; done
