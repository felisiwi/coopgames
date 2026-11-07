# Content templates for 1950: things, quests, artifacts, rumours

Drafted 2026-11-07 on branch `felix/windward-thing-templates`. **Data only: nothing in the game reads these files
yet.** They are the content for the alive-sea systems settled in `docs/ALIVE-SEA.md` (the thing model, mini quests,
artifacts, anchoring, day and night, the logbook), written for 1950 first. Felix reads and rewrites them by eye. The JSON is
**generated** from the tables in `tools/templates/` (see its README): edit the tables and regenerate, do not hand-edit the
JSON; a test fails if the two drift apart.

**The 18 quests are placeholders.** They read as repetitive fetch-and-carry, and Felix and Pierre plan a generative
choose-your-own-adventure layer on top of this data (`docs/ALIVE-SEA.md`, "Direction: generative choose-your-own-adventure
quests"). The solid part is the dataset underneath: things, regulars, places, items, wrecks, rumours and artifacts with true stories.

**The rule everywhere:** every record says where it comes from (`source.kind` + `refs`), and anything invented has
`invented: true`. Spoken lines are INVENTED-DIALOGUE, kept short. No real private person is named. **No unique
artifacts**: those are only ever placed by Felix, from `docs/UNIQUE-ARTIFACT-CANDIDATES.md`.

## What is in each file

| File | What | Count |
|---|---|---|
| `data/things-1950.json` | **Thing templates**: wildlife, drift finds, people (generic and per-place), secrets, ambient life ashore, gear | **106** |
| `data/quests-1950.json` | **Quest templates**: a need + 1 to 3 steps + a resolution, slots the world fills, lines per personality | **18** (3 first-slice + 15) |
| `data/artifacts-1950.json` | **Artifact templates**: an invented object carrying a true story, common to rare | **31** |
| `data/rumours-1950.json` | **Rumour records**: target, teller or channel, text, days, true or twist | **53** |
| `src/templates-1950.test.js` | The test: `node games/windward/src/templates-1950.test.js` (its last check regenerates the data and compares) | **38 checks** |
| `tools/templates/` | The generators and the tables the data comes from, with a README | 7 scripts |

**Things (106):** 15 wildlife, 12 drift finds, 51 people, 21 secrets, 6 ambient (smoke, washing, nets, bells, a dog, the
lights coming on at dusk), 1 gear (pot floats). 66 link back to an exact hook in `island-lore.json`; 7 are
**story-owned** (Britta, the boy, the depot clerk, the boatbuilder, the Måseskär keeper, his second book, the Kråksundsgap
white tower): hand-placed by the story, never spawned by the engine, kept so quests can name them and lore links are tracked.
Every field of the settled template shape is there (name, era range, where, when, routine, reactions tap/approach/
anchored, sighting entry, rarity, source), plus density and `requires` for secrets a warm regular reveals.

**Quests (18):** the three first-slice templates are generic (lost item, delivery, after the squall); the other 15 each
come from a lore quest seed. 126 short lines (offer and done in gruff, chatty and shy, plus a gentle "Never mind" fade
for each). Rewards are warmth, a gift from the artifact list, a rumour, knowledge, or a name to give; never money.

**Artifacts (31):** 19 common, 8 uncommon, 4 rare. 25 come from the lore's own artifact list, 6 from the drift finds.
25 carry a **sourced true story** (and say so with their refs and a confidence); 6 have a story marked invented. Six
lore artifacts are deliberately **held back** (below).

**Rumours (53):** 44 told by people, 3 by the evening shipping forecast on the radio, 3 by harbour notice boards, 3 by
the post. 37 true, 16 twists (each says what is actually so). All 26 of the lore's 1950 rumours are in, each classed from
its grounding. 4 are `dynamic: weather` (their truth follows the day's weather).

## How they link

```
island-lore.json (place id + hook + index)      the name list / lighthouses (place and anchor ids)
        |                                                    |
        +--------------- things-1950.json ---------------------+      thing id  = <category>.<slug>   place.* secret.* drift.* wildlife.* ...
                 ^        ^           ^
   giver / receiver     foundVia /   target / teller
   (quest slots)        givenBy      (rumours)
                 |        |           |
        quests-1950.json  artifacts-1950.json  rumours-1950.json
              |                ^
              +-- reward.gift -+        artifact.<slug>        quest.<slug>        rumour.<slug>
```

- **A quest** names its giver and receivers by thing id, its places by name-list id, and its gift by artifact id; a
  slot's `from` list is the set the world may choose from.
- **An artifact** says how you get it: `foundVia` (a secret or a drift find), `foundAt` (a close look from an anchored
  boat), or `givenBy` (a regular, warm or after a quest). Rare ones carry a `teller` (who tells the true story) and
  `leadsTo` (a small quest or a hook).
- **A rumour** points at a thing or a place, and is told by a person who offers rumours, or by a channel. 11 rumours
  lead players to secrets, so hailing someone is a way to find something.
- The test checks every one of these links, plus that nothing in the lore's 1950 regulars, secrets, quest seeds, rumours
  or artifacts is silently left out (what is left out is listed with a reason in the files).

## The ten to read first

1. **`quest.first.after-the-squall`.** After a blow you find a boat adrift, tell its owner, and the Måseskär keeper reads
   the drift and tells the true story of a wreck relic he gives you (the Paula stencil, the Freya's bell or the Svecia
   shackle). It ties weather, a drift find, a regular and a rare artifact in one chain.
2. **`secret.karingon.boys-loft` → `artifact.rice-sack-stencil-paula`.** A boy's collection from the wrecks, shown only
   once the net-mender likes you; the stencil's story is real (the bark Paula, November 1872, 800 sacks of rice
   auctioned on 12 November, RAÄ L1960:6080), and `rumour.paulapallarna` leads you to it.
3. **`wildlife.harbour-seals`.** Ported from `life.js`: they slip off the rock as you come, and after about a minute of
   stillness the heads come back. The anchoring payoff in one small thing.
4. **`place.karingon-island.net-mender-north-pier`.** She calls your boat's name before you are in sight, because she
   knows every boat by its sound.
5. **`secret.fredagsholmen.calendar` + `rumour.fredagsholmen-why-friday`.** Seven strokes cut in the rock, six crossed
   out, and a sheep-farmer who has a story. The rumour is a twist: nobody knows where the name comes from.
6. **`quest.name-seal-skerry`.** A boy counts seal pups; you sail to an unnamed skerry, stay still until the seals
   return, and name it. The name goes on your chart.
7. **`quest.buoy-the-freya` → `secret.harpo.ships-bell` → `artifact.freya-ships-bell`.** A favour for a grumpy long-liner
   warms him until he shows you the bell he never told anyone about: a chain from errand to rare relic.
8. **`ashore.aga-lights-at-dusk`.** After you relight them, the automatic lights come on by themselves at dusk, one by
   one along the coast; the mechanism (the sun valve) is sourced.
9. **`rumour.gullholmen-tordenskiold-wreck`.** The legend ("that wreck is Tordenskiold's") against the museum's tree-ring
   dating: a twist that teaches something true.
10. **`place.hattan.fisherman`.** Grumbles that Hättan has been dark for three nights, and says something different once
    you have relit it (`hailAfter`): the world noticing what you did.

## The sourced species check (wildlife that was marked invented)

You asked which of the wildlife species really occur on this coast, so the `invented` flag stays only where it is true.
Sources are Swedish Wikipedia articles read on 2026-11-07, plus one search summary. **Status** says what was found:
*confirmed-1950* = sourced as present around 1950; *confirmed-today* = sourced on this coast now, 1950 not sourced;
*not-1950* = sourced as absent or not yet established.

| Species (template) | Found | Status | Source |
|---|---|---|---|
| Eider (`eider-raft`, `eider-ducklings`) | Resident on the west coast. **1950 was a low:** it fell into the early 1900s and recovered after spring hunting of sea-ducks was banned in the mid-1950s. | confirmed-1950 | [Ejder](https://sv.wikipedia.org/wiki/Ejder) |
| Mackerel (`mackerel-jumping`) | Bohuslän's provincial fish; enters the Skagerrak to spawn in April and May and is fished on the west coast mainly in spring and summer; Grundsund fished it with English cutters from the early 1900s. | confirmed-1950 | [Makrill](https://sv.wikipedia.org/wiki/Makrill), [Grundsund](https://sv.wikipedia.org/wiki/Grundsund) |
| Storm petrel (`storm-petrels-maseskar`) | Käringön folk names and the storm belief (people:M10) are the 1950-era source. Today seen yearly in strong westerlies off Bohuslän; the first one ringed in Sweden was caught on Härmanö huvud in 1988. | confirmed-1950 | people:M10; [Stormsvala](https://sv.wikipedia.org/wiki/Stormsvala) |
| Harbour seal (`harbour-seals`, `seal-pups-storon`) | Bohuslän's provincial animal; lives along the west coast. Protection began only in the 1970s, so seals were hunted in 1950: present, abundance unknown. | confirmed-today | [Knubbsäl](https://sv.wikipedia.org/wiki/Knubbsäl) |
| Grey heron (`herons-shallows`) | Resident (stannfågel) on the west coast; a fairly common breeder in southern Sweden. | confirmed-today | [Gråhäger](https://sv.wikipedia.org/wiki/Gråhäger) |
| Harbour porpoise (`porpoises`) | Lives along Sweden's coasts in the Skagerrak and Kattegatt; the only whale regularly in Swedish waters. A strong decline since the 1960s (citation needed), so probably commoner in 1950. | confirmed-today | [Vanlig tumlare](https://sv.wikipedia.org/wiki/Vanlig_tumlare) |
| Arctic tern (`terns-dive-bomb`, `diving-flock`) | Breeds on coasts and in the outer archipelago along the west coast. That terns nest on Tärneskär is invented. The common tern's Swedish range was not in the article read. | confirmed-today | [Silvertärna](https://sv.wikipedia.org/wiki/Silvertärna) |
| Mareld (`mareld`) | Mostly the dinoflagellate *Noctiluca scintillans*; "most common in late summer". Not specific to the west coast. | confirmed-today | [Mareld](https://sv.wikipedia.org/wiki/Mareld) |
| Jellyfish (`jellyfish`) | The moon jelly (called blåmanet on the west coast) is the commonest jellyfish in Sweden; the red lion's mane lives on the west coast. The late-summer timing is design. | confirmed-today | [Öronmanet](https://sv.wikipedia.org/wiki/Öronmanet), [Brännmanet](https://sv.wikipedia.org/wiki/Brännmanet) |
| **Cormorant** (`cormorants-drying`) | **Exterminated from Sweden in the late 1800s**; re-established as a breeder only at the end of the 1940s, on the Baltic side (Kalmarsund); fast growth in the late 1990s. The shag, the other cormorant of this coast, only became a Bohuslän breeder in 2004. | **not-1950** | [Storskarv](https://sv.wikipedia.org/wiki/Storskarv), [Toppskarv](https://sv.wikipedia.org/wiki/Toppskarv); a search summary of a Länsstyrelsen Västernorrland report (**not read in full**) |
| Gulls (`gulls-follow-boat`, `gulls-on-marks`) | Not checked: ported from `life.js`, and ubiquitous. | not-checked | |

**What changed in the data because of it:**
- **Cormorants:** `years` is now [1990, 2030], so a 1950 world never spawns them. The template stays, in case a later era file wants it.
- **Mackerel:** the season was "late summer"; the source says spring and summer, so it is now early summer and summer.
- **Eider:** the raft numbers are ported from today's code (chance 0.4); 1950 was a low, so **consider a lower chance for 1950**. The ported numbers were left alone (a test pins them to the code).
- **Flags:** six wildlife templates (eider ducklings, heron, porpoises, diving flock, mareld, jellyfish) went from source kind `invented` to `grounded` because the species is now sourced. **`invented: true` stays on all nine confirmed-species templates that are our scene design, on purpose**: the behaviour, timing and placement are still ours, so the check changes what is *behind* the template, not whether we designed the scene. Only the cormorant remains plain `invented`. The five that are `invented: false` are the ones taken from the code or a sourced belief (gulls, eider raft, harbour seals, storm petrels). Each template carries its `speciesCheck` (status, refs, note) so this is checkable in the data.
- **Honest limits:** 1950 abundance is sourced only for the eider and the mackerel; the others are sourced as occurring on this coast today. Wikipedia is a medium-confidence source, and one claim (the porpoise decline) is marked "citation needed" there.

## Choices I made that Felix may want to overrule

- **Held back, not made (6 lore artifacts).** Five are Felix's unique candidates, or share a wreck with one: the Måseskär brass gear wheel (candidate 3), the oak treenail from the Gullholmen harbour wreck (candidate 7's wreck), the Anna Maria chain link (14), the Gäven pole ring (13) and the Kråksundsgap 1954 lantern plate (1). The sixth, the 1939 pilot-boat nameboard, can only be found "today". The test pins this list. Also: the keeper's second book and the white tower exist only as story-owned stubs (candidate 2 and the canon glimpse).
- **No template for two lore secrets / ten lore quest seeds**, each with its reason in the files: the canon chapter-1 relights and errands belong to the story script; repainting a belt is not an existing verb (folded into the delivery template as "a tin of paint").
- **Commons are sellable later; uncommon and rare are not** (ALIVE-SEA: "later sell the common ones; rare ones lead to lore"). A default, one flag per artifact.
- **Knowledge rewards are invented** ("the ferry's turn-round time", "the Freya wreck ground is marked on your chart"). They are text for the quest to promise, nothing the game has yet.
- **Decided by Felix, 2026-11-07: the Kornö rumour stays.** `rumour.korno-military-south-point` ("the military will want the south point") is true: a battery was built there in 1970. A hunch in 1950, a wink across time for the player.
- **Decided by Felix, 2026-11-07: where the radio is heard.** The evening shipping forecast is heard from the Måseskär keeper's battery radio (sourced: a radio reserved for the weather report, 1941) **and** a radio in the shop or café of each harbour: Käringön, Gullholmen, Hälleviksstrand, Grundsund, Fiskebäckskil and Lysekil. The harbour radios are the decision, not a finding: radio in Skaftö homes in the 1940s was not found. Each of the three radio rumours lists these venues in its `tellers` (`venue: keeper | shop-or-cafe`).
- **Decided by Felix, 2026-11-07: the bath-house attendant stands at Fiskebäckskil**, where the lore documents the bath resort (since 1867); id `place.fiskebackskil.bath-house-attendant`. Her lore link stays on the Lysekil hook she grew from. The quest `quest.bakery-parcel-korno` and the rumour `rumour.person.bath-jetty-mended` follow her, and the parcel is now simply "from the bakery" (the lore seed said the Lysekil bakery).
- **Quest lines have no "remind" variant** (the settled rule asks for "a few short line variants per personality per template"; offer, done and fade are in, a reminder line is easy to add).
- **All 18 quests have two or more steps**, so none is a plain one-step errand; the shape allows them.
- **Changes to the approved gate-1 file** (the ids and the count, 106, are unchanged): `errand` or `rumour` was added to the `offers` of 7 regulars that quests or rumours needed (the Gullholmen long-liner, the Kornö teacher, the ferry deckhand, the bath-house attendant, the Bonden lad, the pup-counter, the Stångehuvud quarryman); the wildlife got `speciesCheck`; six source kinds changed from `invented` to `grounded`; the cormorant's `years` and the mackerel's season changed (above).

## What is not here

1703 and today (this is 1950 only, as briefed); any game code; the artifact drawings; Felix's unique artifacts; a
"remind" line per quest; the radio's exact wording per weather (the weather system will fill it in).
