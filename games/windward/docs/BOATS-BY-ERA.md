# Boats by era (research for the busy coast's boat variety, 2026-11-07)

Which boats sailed this coast (Lysekil, Skaftö, Gullholmen, Käringön) in **1950** and **today**, with a note on **1703**, and what the game's boats may look like in each era.
Builds on `docs/WORLD-1950.md` section D (S-ids below are its source ids) and `docs/WORLD-1700.md` / `PEOPLE-1700.md`. **How sure:**
**[doc]** a source says it · **[search]** seen in a web-search summary, page not opened in full · **[designer]** not documented: a choice of the game, kept visible so it can be changed.
Where nothing was found, this file says so. Boat colours are the weakest part: almost no source gives them.

## 1950

| Type | What the sources say | Rig | Hull and sail colours | In the game |
|---|---|---|---|---|
| **Folkbåt** (keelboat yacht) | Launched 1942 in clinker wood, c.400 by 1952, 7.64 m, 17 + 7 m² sails; GRP only from 1976 (S51; en.wikipedia Nordic Folkboat **[search]**: first built 1942, wooden clinker) | Bermuda: mainsail + jib | **[designer]** white or cream hulls, a few pastel; cotton sails, creamy white | `sailboat1950` (already there) |
| **Koster** (kosterbåt) | The working original: clinker, gaff-rigged, decked drift-net boat from mid/north Bohuslän, 1800s; "modernised kosters" built as yachts are Bermuda-rigged (sv.wikipedia Kosterbåt **[search]**); K-class rules 1934, K6 first built 1944 (S50). Size: 10-12 m in S50, but Norwegian SNL says 6-10 m and very broad **[search]** | working: **gaff** mainsail + staysail/jib on a bowsprit; yacht: **Bermuda** | **[designer]** working: tarred dark or white linseed-oil hull, tanbark (brown) sails; yacht: white or cream, white sails. (The only colour hint, a 1980 Tjörn local magazine **[search]**, is about older freight vessels: yellow tar or linseed oil, white planking, brown-barked sails: not 1950.) | **new** `koster1950` |
| **Eka** (rowing boat) | A clinker 14 ft "Orusteka" by Carl Mattsson (1844-1937), flat bow and flat stern, rowed by one or two; islanders rarely said "eka", it was the summer visitors' word; the related *kåg* could carry one or two **spritsails** (Bohusläns museum UM015683 via digitaltmuseum **[search]**; *Båtar i Bohuslän*) | mostly **rowed**; some with a **sprit** sail | **[designer]**: no tarred Bohuslän eka was found. Dark tar-brown, or painted white / green / pale blue; spritsail tanbark or cotton | **new** `eka1950` |
| **Snipa** | Pointed both ends, 4-8 m, open or half-decked; the motor snipa for nets with a small hot-bulb engine (S50, S52). A Bohusläns museum model of a snipa has a **sprit sail with a jib** (europeana BHM UM020863 **[search]**), so sailing snipor existed | motor; some with a small **sprit** sail | **[designer]** white, green, blue (as before); some with a wheel shelter | `snipa1950` |
| **Fishing boat / cutter** | Wooden carvel boats, "round and bulky"; Sandö LL 158 (1948, 24.6 m): **white linseed-oil paint above the waterline, a red stripe, red copper bottom**, black registration (S48); English-built wooden cutters rebuilt with engines (S41); steel boats only from 1959 (S49) | motor; a small steadying sail on some | white (documented for Sandö); other colours **[designer]** | `fishboat1950` |
| Small passenger / cargo boats | The old passenger boat "Ran" (1876) and S/S Bohuslän (1914): see WORLD-1950 D; names of the 1950 Lysekil-Fiskebäckskil boat not found | - | - | the 1950 ferry (not changed) |

**Never in 1950:** fibreglass boats (serial GRP kosters 1967, Folkbåt GRP 1976: S50, S51), RIBs, white-hulled modern Bermuda sloops as fishing boats.

## Today (2000-2026; the 1980-1999 profile still uses the same kit)

| Type | What the sources say | Rig | Colours | In the game |
|---|---|---|---|---|
| **Motorboat** | The most common leisure boat in Sweden is a motorboat without a sleeping cabin and ≥10 hp (32 % of ~822,000 boats); next come jolle / eka / rowing boats without a motor, then open boats under 10 hp and cabin motorboats (Båtlivsundersökning 2015 **[search]**) | outboard or inboard | **[designer]** white hulls with a coloured stripe, some grey or navy | `motorboat` (varied) |
| **Cruising sailboat** | Modern GRP sloops: no per-region numbers found | Bermuda: mainsail + genoa; some mainsail only | **[designer]** white most often; some navy or grey hulls; white or grey sails | `sailboat` (varied) |
| **Daysailer** | A small sailboat larger than a dinghy, built for trips of a day or less, 14-25 ft (4-8 m), usually trailerable (en.wikipedia Day sailer, Boating **[search]**) | Bermuda: main + jib | **[designer]** white hull, a coloured gunwale | **new** `daysailer` |
| **RIB** (rigid inflatable) | Developed at Atlantic College, Wales, from 1964 (plywood hulls); first commercial RIBs 1967-1969; fibreglass hulls later (en.wikipedia Rigid inflatable boat **[search]**) | outboard | **[designer]** grey or charcoal tubes, a white / grey / navy hull | **new** `rib` |
| Kayaks, SUPs | No Swedish source found | paddle | - | **not built** (too small to read at 1:10; left for later) |

## 1703 (for later)

No readable source names the fishermen's boats of c.1700 (`WORLD-1700.md`). The game's tarred eka with a rust-brown spritsail is plausible, not documented (`PEOPLE-1700.md`: a hogdalseka "may have had a sprit sail"; museum boat is 20th-century). The `addEka` and `addCargoBoat` models already exist; nothing here changes them.

## The rules the code follows (`src/boat-looks.js`)

- **Same seed, same boat.** Every choice below is drawn from the boat's own seed (`frac(seed, salt)`), so both phones see the same boat. Nothing uses `Math.random()`.
- **Hull, sail, rig, size, cabin, flag all come from an era table.** A 1950 look can only be picked from the 1950 table, a Today look from the Today table; a test checks every combination.
- **A profile entry can fix a koster's role** (`role: 'fishing'` in the fishing class, `'yacht'` in the sailing class); with no role the seed draws it 55 / 45.
- **1950:** no white Bermuda sloops among the fishing boats (fishing boats and working kosters get tanbark sails and a gaff rig); Bermuda is for Folkbåt-type yachts and "modernised" kosters; ekas are mostly rowed; no GRP colours or RIBs.
- **Today:** Bermuda rigs only, white most often, no tanbark sails, no gaff.
- **Small details are all [designer]** (no source): a small Swedish ensign on the stern of some boats, the sheer-strake colour of 1950 yachts (white, green, navy or red-brown), 0-4 orange floats on fishing boats, a spray hood or a canvas canopy on some Today boats, a wheel shelter or none on snipor, a beam 94-106 % of the type's.
- Facets stay at the game's scale (`shared/ART.md`, about 3 m); every boat stays under 450 triangles.

## Not found (open)

Hull colours of ordinary 1950 fishing boats and ekas; whether 1950 snipor carried sails; the share of sail to motor boats on this coast (either era); colours of today's boats; anything for kayaks. Candidates for the next research pass: Olof Hasslöf, *Svenska Västkustfiskarna* (1949), Bohusläns museum's photo archive on digitaltmuseum (1950s photos show colours directly), *Båtar i Bohuslän*, Kosterbåtsregistret.

## Sources

- Repo: `docs/WORLD-1950.md` D (S41, S48-S52), `docs/PEOPLE-1700.md` (B14, B15), `docs/WORLD-1700.md`.
- https://sv.wikipedia.org/wiki/Kosterb%C3%A5t · https://snl.no/kosterb%C3%A5t · https://digitaltmuseum.se/011024831192 (K-6 record)
- https://digitaltmuseum.se/011024268188/bat (Orusteka) · https://www.europeana.eu/item/916105/bhm_object_UM020863 (snipa model with sprit sail)
- https://www.lanspumpen.se/nummer/1980_3.pdf (Tjörn magazine 1980: tarred / white planking / brown-barked sails, older freight vessels)
- https://en.wikipedia.org/wiki/Nordic_Folkboat · https://en.wikipedia.org/wiki/Rigid_inflatable_boat · https://en.wikipedia.org/wiki/Day_sailer
- https://sxk.se/system/files/filer/foldrar_broschyrer/fakta_om_batlivet_i_sverige_2015.pdf (Båtlivsundersökning 2015)
