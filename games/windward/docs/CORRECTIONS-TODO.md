# Research corrections (applied 2026-11-07, branch felix/windward-corrections)

Found by research agents; each was verified against the repo's recorded source reading (data/world-1950.json S-records, data/island-lore.json, docs/ISLAND-LORE.md,
docs/PEOPLE-1950.md) before anything changed. Live pages were NOT re-fetched in this pass: the checks are against what those research notes recorded.
Data and docs only at first (game.js untouched); the Islandsberg 3D model was reworked afterwards, see below. `src/corrections.test.js` keeps the light-data corrections from drifting back.

- [x] **Stångehuvud dark since 1940.** Verified: fyr.org (S07: "EXTINGUISHED in 1940 and replaced by Stångholmen"), fyr.org Stångholmen (S08: set up 1940), stangehuvud.se (the
  house's owner, read in full). Only ibiblio's "inactive since the 1990s" disagrees (probably the building). Fixed `src/lighthouses.js` (the light's `lightNote`). `src/lights-1950.js` and
  WORLD-1950 already said 1940. `built: 1890` unchanged, so the rewind is unaffected. LIGHTHOUSES.md row updated. (`ref/lighthouses-kit-play.js` is a frozen lab: left.)
- [x] **Islandsberg's old light.** Verified: fyr.org / WORLD-1950.md:233 ("lens window in the upper gable"). The ridge claim lived in the `description` string of `src/lighthouses.js`
  (not in LIGHTHOUSES.md, which said nothing about where the light sat): fixed there, and LIGHTHOUSES.md now states it. **The 3D model is now fixed too** (branch felix/windward-islandsberg-model: `gableWindowLight`
  draws the window row on the seaward gable's upper floor, no ridge lantern; `src/islandsberg-model.test.js`).
- [x] **Lysekil around 1703.** Verified (sv.wikipedia Lysekil and lotsarnastockholm.se, as read by the island-lore research; medium): a fishing place older than the 1566-87 herring period with
  its own church and priest, 82 adults in 1645, part of Lysekil parish from 1700, pilot station set up early in the 1700s (4 pilots in 1729), town only from 1 April 1903. The three files never
  called Lysekil a hamlet outright, but `PEOPLE-1700.md` framed Torhild's world as "a poor fishing hamlet" and still recommended Grundsund over Lysekil. Fixed: PEOPLE-1700.md (intro, a
  correction note under section 2, the superseded Grundsund option), `data/people-1700.json` (new item L01, source E01), `story/characters/torhild-1700.md`.
- [x] **Gullholmen's harbour wreck.** Verified (Bohusläns museum rapport 2012:39 via island-lore.json): latest ring 1717, no sapwood, probable felling 1727-1827 (no earlier than the 1720s);
  the museum rejects the Tordenskiold link; one oak treenail shows fire damage. Fixed `docs/PEOPLE-1700.md` and item H04 in `data/people-1700.json` (both said only "felled after 1727").
  `UNIQUE-ARTIFACT-CANDIDATES.md` and ISLAND-LORE.md already said 1727-1827 and the rejection.

From the island-lore merge (agent 4, 2026-11-07, fyr.org + county pages):
- [x] **Fredagsholmen first built 1883, not 1917.** Verified: fyr.org S09 ("1883 station served from Islandsberg; AGA light 1917; rebuilt 1942"). 1917 is the AGA year, which stays true; the
  wrong part was `station: 1917` in `src/lights-1950.js`, now `station: 1883` (`built: 1942` is the 1950 fyrkur and stays). Description says both. Nothing at runtime reads `station`.
- [x] **Gäven's pole mark.** Verified in the lore data (fyr.org vs RAÄ conflict kept visible there). Nothing in code said otherwise; completed the summary lines: `data/world-1950.json` S06
  note and ISLAND-LORE.md item 11 (blew over, second pole to about 1901, replica at Vindön since 2009; neither pole stood in 1950).
- [x] **Islandsberg's old light behind gable windows** (same as above): done.
- [x] **Kråksundsgap manned 1890 to 1911.** Verified: lore data + PEOPLE-1950.md (Blänket 2012:4: automatic AGA light from 1911, lantern exchanged 1941). Added to the 1950 description in
  `src/lights-1950.js`. `station: 1911` was already the automatic-light year.
- [x] **Måseskär in 1950 red and white.** Verified: the repo already had the TOWER red-and-white (WORLD-1950.md:78, LIGHTHOUSES.md:17); "white, NOT red" in `src/lights-1950.js` is about the
  LIGHT. The note was ambiguous, so it now says "light white, tower red and white". No colour data changed. (WORLD-1950.md:236 still lists the exact 1950 wall colour as undocumented.)
- [x] **Gåsö's seals are harbour seals.** Verified: the lore data says knubbsäl/harbour seals everywhere. Nothing in the repo says "grey seals" any more (searched md/json/js/html, including ref/ and
  story/): the only mentions are the notes about the fix. No change needed.
- [x] **Map Lab place-name glosses ("the Hood", "the barley isle") are low confidence.** Added to `data/place-names.json` descriptionNotes (Hättan, Stora Kornö). The file's `_about` already says
  the descriptions are lore, not etymology claims.
