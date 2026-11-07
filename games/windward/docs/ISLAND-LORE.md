# Island lore: what makes each place itself

Research summary for Windward's islands, skerries and harbours (play window 58.085-58.30 N, 11.25-11.50 E).
Machine-readable twin: `data/island-lore.json` (25 places, every fact with a source id and a confidence).
It feeds `docs/ALIVE-SEA.md`: place profiles, things, rumours, artifacts, mini quests. Written 2026-11-07.

**How to read it.** Facts have a source and a confidence (high / medium / low / uncertain). Anything marked
INVENTED is ours: regulars, secrets, rumours, quest seeds, artifacts. Real private people are never named; the
only named people are historical public figures with a source (Olof Strömstierna, Calla Curman, Carl Wilhelmson,
Tordenskjold). Folklore is thin on this coast in the sources we could reach: see "Best folklore" and the gaps.

**Counts (JSON):** 25 places, 120 facts, 110 landmarks, 6 folklore items, 107 dated timeline events,
69 invented regulars, 31 secrets, 32 rumours, 38 quest seeds, 35 artifact candidates.

## The 18 richest places, richest first

Keys are the game's own name-list ids (`src/names.js`: `relation/NNN`, `village:Name`, `light:Name`).

1. **Käringön** (`village:Käringön`). Name theory (a whitewashed cairn), native son Olof Knape/Strömstierna (born
   1664, admiralty captain 1700), a 1516-1648 keel on the bottom (tree rings), 56 ship remains in the register,
   two cairns (Tornö black 1886, Korsholmen white 1853), the rocks Paulapallarna named after a wreck.
2. **Gullholmen** (`village:Gullholmen`). The best-documented place: 20 families in the late 1600s, anchorage for
   Norwegian row-fleets and Tordenskjold's praise, the harbour wreck found 1936 and the legend that it is
   Tordenskjold's (the museum rejects it).
3. **Måseskär** (`light:Måseskär`). The only manned light in the window in 1950; iron tower 1865, brass clockwork to
   1955, steam siren, 1873 cannons, keepers' stone-walled plots, lit again for a week in 2015.
4. **Gåsö and Storön** (`relation/10604591`, `relation/10604590`). Bought from the Crown for 50 riksdaler in 1741,
   wall-ringed shelter hollows, seal skerries, skipper community to bath resort, "Vrakevik" (wreck bay).
5. **Lysekil** (`village:Lysekil`). 1666 herring packing licence, the 1712 shelling of Norra hamnen, the 1773
   fire, Operation Bridford 1943-45, Stångehuvud saved by Calla Curman, Skandia engines.
6. **Grundsund** (`village:Grundsund`). A chapel paid by one herring cast (1799), a ship's bell until 1818,
   English cutters for mackerel, Bovik cannery, the Bonden cairn.
7. **Fiskebäckskil** (`village:Fiskebäckskil`). Sea huts, captains' villas, Wilhelmson, Lyckans Slip, the
   Lysekil ferry; Britta's home.
8. **Stora Kornö** (`relation/10094463`). Train-oil boileries (1791, 1799), the cave Klingkyrka, seal colony,
   timber sea huts from the 1600s, a coastal battery 1970-2004. At the window's north edge.
9. **Kråksundsgap and Bråtö** (`light:Kråksundsgap Södra`). The "light from the future": the 1950 AGA light, the
   1954 tower, the black Bråtö cairn (1838), Pipeskär cone, leading marks (1926, 1941).
10. **Härmanö** (`relation/5463706`). House platforms at Skållehus, the abandoned hamlet (1705), feldspar quarry,
    wrecks Jupiter (1899), Svecia (1926), Vendlus (1927).
11. **Gäven** (`light:Gäven`). A red 15 m pole mark with a pilots' lookout platform (1835) before the light (1917).
12. **Bonden**, west of Grundsund (`relation/10250201`). White 8 m cairn with pole and red ball (1875); the
    schooner Anna Maria wrecked on its west side in 1905.
13. **Hälleviksstrand** (`village:Hälleviksstrand`). "Strana", the 1905 fire, boatyard (1907), Bovik cannery.
14. **Tornö, Korsholmen, Vedholmen** (`relation/10238557`). The quarry sound and the conflicting Dora records.
15. **Islandsberg** (`light:Islandsberg`). Dark keeper's house since 1938 (sold 1948), the new automatic tower;
    **correction:** it was not dark in 1950.
16. **Stångholmen and Stångehuvud** (`relation/10237903`). The light that replaced Stångehuvud in 1940.
17. **Jämningarna and Byxeskären** (`relation/10237897`). Painted cairns at Lysekil's western inlet (1874).
18. **Stora Harpö, Salthästen, Röra** (`relation/10250169`, `relation/10250171`). The wrecks of Freya (1940) and Neptun (1908).

Thin (one or two facts only): Hättan, Fredagsholmen, Malö, Lavön, Silleskär.

## Best folklore (and an honest note)

We found **little real sägen** for this stretch of coast. What exists:

1. **The Tordenskjold wreck of Gullholmen.** Locals say the wreck in the harbour is from his fleet; the museum dates
   the timber to felling 1727-1827 and rejects it. A story and the proof it cannot be true. (high)
2. **Käringön's "turkäringar" and "oturskäringar".** Fishermen saw women aboard as bad luck; meeting an unlucky one
   on the way to the boat meant turning back. Tourism page, later-recorded. (medium)
3. **The chapel built on one cast of the net.** Grundsund's first chapel money came from a seine team who made one
   cast for herring and gave the profit; first service 5 October 1799. (medium)
4. **No whistling aboard.** Whistling was believed to summon the devil (Bohuslän crews, via Skaftö-born painter
   C.G. Bernhardson; search summary only). (low)
5. **Names made by wrecks.** Paulapallarna (bark Paula, 1 Nov 1872) and Korsets Stenar (bark Jupiter, 1899). (medium)
6. **Käringön = "the whitewashed cairn".** A name theory, disputed. (medium)

Not found: any legend for the cave Klingkyrka, sea spirits (sjörå) or wreckers attached to a named skerry in the
window. Do not invent a "legend" for these without marking it INVENTED. Bernhardson's *Bohuslänsk sed och folktro*
(1980) and Bohusläns museum's archive are the next place to look.

## Storm days that can be "the last storm"

Real ship-loss clusters, each with named wrecks in the register: **late Oct to early Nov 1863** (Olga, Rika, Cadmus,
Freya, Solid), **1 to 7 Nov 1872** (Paula, Nordkap, David with petroleum barrels, Queens Own, Martin Luther,
Fata Morgana), **15 to 30 Nov 1861** (Rosina, Julius, Constitutionen, Anne Marie Chatarina). Good drift-find and
rumour material; each wreck has a cargo (salt, coal, rice, timber, linseed cake, petroleum).

## Story hooks

**Britta (1950, 17, Fiskebäckskil).** Her father tended the lights; her shed holds the gas tanks. Her home waters:
Kaptensgatan, Lyckans Slip, the Lysekil ferry. Hooks: Stångholmen is her nearest light (the easy first relight);
her father would say "out at the old pole" about Gäven; Bonden's red ball; the family keeps a list of which cairn
is painted which colour (the belts on Jämningarna and Byxeskären). The Kråksundsgap glimpse is hers to see first.

**The boy (young granddad, Grundsund yard).** Grundsund's canal and cutters; Hälleviksstrand's yard builds Iceland
boats under a roof; Malö had a shipyard in the 1800s; Skandia engines come from Lysekil. Hooks: the dare to touch
Bonden's cairn; wrecks as timber and brass; the 1905 Anna Maria story; Svalan lands on Skaftö's mainland shore by
Grundsund; mackerel tins from Bovik.

**Torhild (late 1703, pilot's daughter near Lysekil).** No light, no mark yet: pilots steer by the cairns and the
rocks (Gäven is a bare rock; the pole is 1835). Hooks: the first to hail a ship earns the fee; the herring boom of
1666 faded by 1675; Norwegian ships will shell Norra hamnen in 1712 and Tordenskjold will use Gullholmen; a young
sea officer from Käringön, Olof Knape (commissioned 1700), may later command the Swedish squadron at Dynekilen in
1716 (our inference, low). A cairn on Måseskär is "possible" in 1703.

**The keeper (Måseskär, 1950, INVENTED).** Wound the brass clockwork until 1955; a steam siren and a cannon from
1873 still stand; his wife's stone-walled plots; the supply boat goes to Käringön 3 to 4 times a month. The light was
fixed red 1865-1887: a rumour of a red light fits. A second book of lights that should not be there is our
invention, grounded in the canon. Post-war arsenic wrecks lie west of Måseskär (low).

## Cross-era traces (things made in one era, found in another)

Käringön's old keel (made 1516-1648) lies under 1703, 1950 and today; Gäven's pole mark (1835) has a ring in the rock
for 1950; the Bonden chain link (1905); the Käringön harbour anchor (found 1995); Kråksundsgap's 1954 lantern plate.

## Gaps and flags

- **Malö (Felix's question).** Resolved by coordinates: Wikipedia's Malö (58.2008 N, 11.4797 E) matches the name
  list's Malö (`relation/5214486`, 58.2002 N, 11.4787 E). It is the Orust-side island just east of Skaftö, in Morlanda
  parish, 122 ha, 35 residents in 2012. My own search had collided with another "Malö" in Halland (Kungsbacka). No
  conflict; still only thin material (shipyard in the 1800s, Taube songs).
- **Two Bondens.** The name list has `relation/10250201` (58.2087, 11.3127, the outer skerry west of Grundsund) and
  `relation/10239120` (58.0851, 11.3402, at the window's southern edge). The 8 m cairn and the Anna Maria wreck are
  tied to the first; check on the chart before wiring.
- **Knapp / Knapparna.** The Dutch wreck of 19 Sept 1855 is "vid skäret Knapp" (Skaftö parish record); the name list
  has a `Knapp` near Härmanö (58.1765, 11.3508) and four `Knapparna` (58.138). Which one is not shown. A koff
  Arendina Elisabeth (roof tiles) has the same date: probably the same wreck (our inference).
- **Saltö.** No article for the Orust Saltö (58.1189 N, 11.4121 E). The Stora Kornö article's "Saltö" (an emptied fishing
  island) is probably the skerry at 58.2976 N, 11.4077 E, not this one. Nothing sourced.
- **Lavön.** The train-oil boilery records match the text "Lavön" in Morlanda parish; not confirmed to be on the island.
- **Dora.** Two records (11 Dec 1925, blown-up wreck; 11 Apr 1928, quarry sound between Vallerö and Tornö) probably
  describe one steamer.
- **Svarten and Hinneskär (Måseskär).** The pole mark of 1829/1853 was replaced by a cairn in 1878; Hinneskär's
  cone is dated 1878 too and lies south of Måseskär. We say they are the same; the registers do not.
- **Gäven.** sv.wikipedia's "Gäven" is a lake in Dalarna: it does not describe our rock. All Gäven facts come from RAÄ
  (the pole mark) and the repo's light data.
- **Fredagsholmen.** Two skerries by that name; the light is on the one near Gullholmen (`relation/10237443`). The
  name's meaning is not found: do not present "Friday islet" as etymology.
- **Stångehuvud.** ibiblio lists the light as lit after 1940; the repo's data says out. Left as in WORLD-1950.
- **Gåsö, 1717.** "Tordenskjold's ship of the line ran aground off Gåsö" is only in sv.wikipedia's Lysekil article.
- **Käringön and Dynekilen.** That the Strömstierna of Dynekilen is the Käringön-born Olof Knape is our inference.
- **Lysekil's pilot station,** Vrakevik's name origin, a Klingkyrka legend, pre-1900 Käringön pilot history: not found.
- **1703 is thin everywhere.** Almost no documented sea marks or buildings for 1703; entries say so.
- **Excluded on purpose:** a 1969 murder case on Gåsö involving a named private person.
- **Fornsök itself is a JavaScript app and cannot be scraped,** but its data can be read through the open API below.
- **Stora Kornö** lies in the 80 m edge-fade strip at the window's north border (place-names.json): it may not be
  visible yet.

## Source access: K-samsök (the data behind Fornsök)

`https://kulturarvsdata.se/ksamsok/api?x-api=test&method=search&recordSchema=presentation&hitsPerPage=100&query=...`
with, for example, `serviceOrganization=RAÄ AND text=Käringön`. Records have an id (`L1960:6080`), a label
(Fartygs-/båtlämning, Sjömärke, Fyndplats, Tomtning ...), a place and a description; the sea-mark records quote
Söderlund's book (*Sjömärken; vägvisare och kulturmärke*, 2007) with colours, heights and years. RAÄ marks many
descriptions "not quality-assured". Use `curl -G --data-urlencode` so å/ä/ö are encoded. sv.wikipedia's API needs
percent-encoded titles and a polite pace (it rate-limits hard).
