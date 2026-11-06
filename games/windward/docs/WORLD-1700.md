# The world around 1700

Data and notes for the coast as it was at the end of the era **New border** (1658-1705, inside the epoch
New Crown), so the game can switch years later. Machine-readable twin: `data/world-1700.json` (checked by
`node games/windward/src/world-1700.test.js`). The region is the game's: 58.085-58.30 N, 11.25-11.50 E.

**Not decided here:** whether the player's chart is wiped on arrival. That is Felix's call.

**How to read the flags.** `uncertain` = the 1700 state is not directly documented for 1700 (estimated,
inferred, taken from a nearby year, or from a weak source). `invented` = a placement or choice made by us
as a recommendation, with no source that it existed. Source ids (S01...) are in the registry at the top of
the JSON; the URLs are repeated below. Every page and PDF was read on 2026-11-06; nothing is from memory.
"Search summary" means only a search-result summary was seen and the page was not opened: weak.

## What the research found, in one screen

- The sea stood about **0.55 m higher** against the land in 1700 (range 0.45-0.70). That figure is our
  arithmetic on a published SMHI rate, not a published number. See section 3.
- **203** of today's chart rocks change: 200 that are "awash" now would have been just under the surface,
  two that "cover" likewise, and one "dry" rock becomes awash-or-dry. The 9 named shoals cannot be decided
  from the data (no heights). The 283 skerries have no heights either.
- No lighthouse existed in the region. The earliest light in the project data is Carlsten (1782, Marstrand).
  But a **state pilot service existed**: a decree of 19 September 1696 created Kungliga Lotsverket, and
  compulsory pilotage dates from 1667. A coast with no lights is not a coast with no officials.
- **Documented sea marks in the region for 1700: almost none.** One undated cairn at Måseskär and one name
  theory at Käringön. Everything else in section 2 is an invented recommendation, labelled as such.
- Around 1700 the fishing was **probably lean**: neither herring source lists a herring period between
  1660-1680 and 1747. The sources do not say the herring were absent, only that no period is listed.
- **Gullholmen is the best-documented place** (primary source: a Bohusläns museum report): 24 households in
  1610, about 39 in 1645, 20 fishing families at the end of the 1600s, a recognised anchorage in the
  Gyldenløve feud and the Great Northern War.
- **Grundsund as a village is doubtful in 1700.** One source says fishing village "from the 1600s at least";
  the museum says the present village began in the 1700s herring period, as three clusters round the sound.
- Boat types: **not found.** No readable source names the fishermen's boats of c.1700. The "eka" is the
  repo's own design choice (BOAT-BRIEF), and says so in the data.

## 1. Settlements around 1700

Positions come from `data/settlements-history.json` (same coordinates). Sizes are the weakest part: no source
gives a 1700 count for any of these places. Where a size is shown it is a bracket between two documented
counts, or a description, and the data marks it estimated.

| Place | Around 1700 | Size class | Lived from | Flag | Sources |
|---|---|---|---|---|---|
| **Lysekil** | yes | fishing village, a few dozen households (estimated) | fishing; herring packing allowed from 1666; some trade suspected | uncertain | sv.wikipedia Lysekil, Lyse socken |
| **Fiskebäckskil** | yes | fishing village with a parish and a wooden church (estimated) | fishing | uncertain | sv.wikipedia Fiskebäckskil, Morlanda socken; vastsverige.com Fiskebäckskils kyrka |
| **Grundsund** | uncertain | hamlet: a few cottages round the sound (estimated) | fishing | uncertain | sv.wikipedia Grundsund; Bohusläns museum (DigitaltMuseum) |
| **Gullholmen** | yes | small fishing village, about 20 families | fishing; natural harbour | documented | Bohusläns museum rapport 2012:39 |
| **Härmanö** | yes | farms with home fishing and freight sailing | farming, fishing, freight sailing | uncertain | settlements-history.json (Västkuststiftelsen folder); museum report |
| **Käringön** | yes | hamlet | fishing | uncertain | sv.wikipedia Käringön; project file history-start-area.md |
| **Hälleviksstrand** | probable | unknown | fishing (probable) | uncertain | settlements-history.json only |

Per-place evidence:

- **Lysekil.** 1645: "82 vuxna personer", of which "runt hälften strandsittare". 1750: 226 people; 1760: 332
  (Hansson 1983 via sv.wikipedia). "Då Lysekil inte var en egen stad eller egen socken saknas statistik" for
  the period. Own church and priest already before the herring period of 1566-1587. "I kyrkligt hänseende har
  Lysekil sedan 1700 hört till Lysekils församling" (Lyse socken: "Omkring 1700 utbröts Lysekils församling").
  1666: "en av de sex hamnar i länet där sillpackning och sillvrakning tilläts"; "sillperioden avtog redan
  1675". Not used: the infobox "Grundad 1570" (no source).
  https://sv.wikipedia.org/wiki/Lysekil · https://sv.wikipedia.org/wiki/Lyse_socken
- **Fiskebäckskil.** Fishing place "sedan 1500-talet". Fiskebäckskils församling split off Morlanda "på
  1600-talet" (no year). Old wooden church from the 1500s (replaced 1772), oak font 1600s, altarpiece 1665,
  bell cast 1535. The 1750 population (202) is a Tabellverket figure under a restricted licence in
  settlements-history.json and is deliberately not copied into the new file.
  https://sv.wikipedia.org/wiki/Fiskeb%C3%A4ckskil · https://sv.wikipedia.org/wiki/Morlanda_socken ·
  https://www.vastsverige.com/lysekil/produkter/skafto-fiskebackskils-kyrka/
- **Grundsund.** Two sources disagree (see "Grundsund" in the summary). Chapel licence February 1798,
  consecrated 5 October 1799. An existing project note says the scattered settlements took the name
  Grundsund when the church was built; **not re-verified here**, but if true "Grundsund" was not yet a village
  name in 1700.
  https://sv.wikipedia.org/wiki/Grundsund · https://digitaltmuseum.org/021017762068
- **Gullholmen.** 1588 first secure record ("paa Guldholmen"); 1610: 24 resident strandsittare; 1645: about 39
  households plus "forarmede"; end of the 1600s: 20 fishing families (Holmberg 1979); about 100 houses only
  around 1800. A kronoholme (crown land, free to build on). Anchorage on the earliest Swedish maps. In the
  Gyldenløve feud "den norska roddflottan ankrade vid Gullholmen"; in the Great Northern War Tordenskiold calls
  it one of the coast's "mest brugelige Havne" (Hansson 1983:178). The northern part of the sound between
  Gullholmen and Lilla Härmanö, deeper than 4-4.5 m, looked undisturbed by dredging and held a harbour
  cultural layer; undated finds, and pottery in the dredged part dates 1600-1900.
  https://www.bohuslansmuseum.se/wp-content/uploads/2016/11/BM_Rapport_2012-39.pdf ·
  https://sv.wikipedia.org/wiki/Gullholmen
- **Härmanö.** Farms on the east side "åtminstone sedan 1500-talet" with home fishing and freight sailing; about
  ten house platforms from the 1500s-1600s at Skållehus; first map record Felterus 1673.
  Source: `data/settlements-history.json` (cites Västkuststiftelsen folder and the museum report).
- **Käringön.** Written "Kierlingøon" in 1659; said to be inhabited since the 1500s (Svenska kyrkan, as
  relayed in `data/history-start-area.md`); the island was "put on the map" by the 1700s herring period (after
  1747). Olof Knape, born on the island in 1664, was made an admiralty captain in 1700.
  https://sv.wikipedia.org/wiki/K%C3%A4ring%C3%B6n
- **Hälleviksstrand.** "nämns i skriftliga källor första gången 1617" (settlements-history.json). The
  sv.wikipedia page returned 404 in this mission. Nothing for 1700.

Not covered: the smaller Skaftö hamlets (e.g. Rågårdsvik) and the Lysekil-side farms. No source was read for them.

## 2. Sea marks

**No lighthouses in 1700.** The project data (LIGHTHOUSES.md, `epochs.json`) puts the earliest light at the
Carlsten fortress, Marstrand, 1782 (outside the region); the earliest tower in the region is Hållö 1842
(sv.wikipedia calls Hållö "Bohusläns äldsta", just north of the region) and Måseskär 1865.
The test checks `epochs.json` contains nothing built on or before 1700.

**What guided sailors, as far as it is documented:**

| Kind | What the sources say | For 1700 |
|---|---|---|
| Cairn (kummel, röse) | A recognised sea-mark type, chart abbreviation "Kl" (sv.wikipedia Sjömärke) | The type, yes; no dated example in the region |
| Spar mark (stångmärke) | Måseskär got one in 1829 "på Kronans bekostnad" (sv.wikipedia Måseskär) | Later than 1700 |
| White-painted cairn | The name Käringön (1659) "antas innehålla käring i betydelsen (vitmålat) röse" (Svenskt ortnamnslexikon 2003); a tourism page adds a "käring" mark at Saltskär; the origin is disputed | A theory about a name |
| Beacon fires | A Skåne source: important fairways "kunde vara markerade med tända eldar" | Nothing found for Bohuslän |
| Church towers | The same Skåne source names church towers as land marks | Plausible; not documented for Bohuslän |
| **Pilots** | Compulsory pilotage under the Maritime Code of 1667; Kungliga Lotsverket by decree of 19 September 1696; 97 pilot stations and 10 lighthouse stations in Sweden at the end of the 1600s (Högman) | Yes, but no Bohuslän station named for c.1700. Väderöarna (outside the region): pilots "sedan åtminstone 1600-talet", a pilot place in 1754 |

Sources: https://sv.wikipedia.org/wiki/Sj%C3%B6m%C3%A4rke · https://sv.wikipedia.org/wiki/M%C3%A5sesk%C3%A4r ·
https://sv.wikipedia.org/wiki/K%C3%A4ring%C3%B6n · https://hhogman.se/maritime-piloting-swe.htm ·
https://www.vastsverige.com/tanum/produkter/vaderoarnaslotsutkik/ · https://sv.wikipedia.org/wiki/H%C3%A5ll%C3%B6

**Marks in the data (positions are in the file):**

| Mark | Status | Position source | Why |
|---|---|---|---|
| Måseskär cairn | documented, undated, **uncertain** | names.json (OSM) | "Ännu tidigare fanns ett stenkummel på samma plats", before the 1829 pole mark; may or may not date to 1700 |
| Käringön white cairn | name **theory**, uncertain | settlements-history.json | see table |
| Stångehuvud point | **invented** | LIGHTHOUSES / lighthouses.js | prominent headland, approach to Lysekil and Gullmarn |
| Islandsberg point | **invented** | lighthouses.js | headland, southern approach to the Grundsund sound |
| Gäven outer rock | **invented** (painted rock mark) | lighthouses.js | outer rock off Lysekil |
| Hättan outer skerry | **invented** (spar) | lighthouses.js | seaward mark for the Gullholmen anchorage; spar is a guess, first documented spar is 1829 |
| Gullholmen harbour entrance | **invented** | settlements-history.json | documented anchorage; placed at the village point, exact entrance to be set when drawing |
| Grundsund harbour mouth | **invented** | names.json (OSM guest harbour) | the sound is the village's reason for being |
| Kråkesundsgap entrance | **invented** | names.json (OSM) | the gap between Orust and the islands |

Recommendation: draw cairns at harbour mouths and prominent points, whitewash the Käringön one as a nod to the
name theory, keep spar marks to a few outer skerries. If the game ever says these are historical, it is wrong:
only the first two rows have any source behind them, and neither is dated to 1700.

## 3. Land uplift and the water level

**Published rate (SMHI, "Havsvattenstånd 2026", column "Apparent landhöjning", cm/år; footnote "Relativ
landhöjning för mätperioden"):**

| Station | Apparent uplift |
|---|---|
| Marstrand | 0.16 cm/yr |
| Göteborg (Torshamnen, Krossholmen) | 0.16 cm/yr |
| Smögen | 0.18 cm/yr |
| Kungsvik | 0.20 cm/yr |
| (Ringhals 0.10, Varberg 0.07 for comparison, further south) | |

There is **no Lysekil gauge**. Lysekil lies between Marstrand and Smögen, so 0.16-0.20 cm/yr is used.
SMHI defines apparent uplift as "ett mått på hur jordskorpan rör sig relativt havets medelnivå" and notes it
already includes today's climate sea-level rise. The measurement period is not printed in the table.

**The offset.** 0.16-0.20 cm/yr x 325 years (1700 to 2025) = 52-65 cm. We use a single value:

> **`waterLevel.offsetM = 0.55`** (range 0.45-0.70). In 1700 the sea stood this much **higher** against the
> land than it does today. Equivalently: lower today's land and rocks by 0.55 m.

Honest limits, repeated in the JSON:

1. 0.55 m is **our arithmetic**. SMHI publishes the rate, not a 1700 water level.
2. A rate measured since the gauge era (late 1800s onward) is extended back as if constant. Sea-level rise
   accelerated in the 1900s, so the earlier apparent uplift was probably a little larger; that is why the range
   reaches 0.70 m. The only support is a search summary of Stockholm figures (0.47 cm/yr for 1774-1885 vs 0.38
   later; Swedish Maritime Administration report, **page not opened**), and Stockholm is a different regime.
3. Mean sea level, not chart datum. "Awash" means at about the mean water surface.

Sources: https://www.smhi.se/hfa_coord/BOOS/dbkust/mwreg_MW.pdf ·
https://www.smhi.se/kunskapsbanken/oceanografi/vattenstand-och-klimat/landhojning-och-vattenstand ·
https://www.smhi.se/kunskapsbanken/oceanografi/vattenstand-och-klimat/havsnivahojningen-syns-i-matningar

**What it does to today's shoals** (`assets/coast/shoals.json`, OSM, chart levels):

| Today | In 1700 | Count |
|---|---|---|
| rock, "awash" | just under the surface (about half a metre) | 200 |
| rock, "covers" | just under | 2 |
| rock, "dry" (height unknown) | awash if it stands under 0.55 m, else still dry | 1 |
| rock, "submerged" / "unknown" | stays under, 0.55 m deeper (the four with a stated depth, 3.8-7.1 m, become 4.3-7.6 m) | 78 |
| named shoals (Tors både, Bytebåden, Hästebåden, Långgaps både, Smedjeflut x2, Sverkerbådan, Jämningsbådan x2) | **cannot be decided**: OSM gives outlines and names but no heights; -båden / -både / -flut mean a shoal where the sea breaks | 9 |
| skerries in names.json | **cannot be decided**: positions only, no heights. A skerry standing under about 0.55 m above the water today would then have been awash or under | 283 |

The full per-rock list (id, position, level today, level in 1700) is in the JSON under `shoals.list`; the test
rebuilds it from `shoals.json` and fails if they drift apart.
`TODO(felix): confirm` whether to source skerry heights (Lantmäteriet elevation data) before the game uses this.

## 4. Names

Only documented forms are listed. None is a guess; where a form is not from 1700 itself, the year is shown.

| Today | Documented form | Year | Source | Flag |
|---|---|---|---|---|
| Lysekil | Lusekijll | 1578 | sv.wikipedia Lysekil ("Ortnamnet skrevs 1578 Lusekijll"). No 1700 spelling found. The church village was Lysa in 1317; the parish Lysekils församling dates from c.1700 | uncertain (1578, not 1700) |
| Käringön | Kierlingøon | 1659 | sv.wikipedia Käringön ("skrevs 1659 Kierlingøon") | documented |
| Gullholmen | Guldholmen | 1588 | Bohusläns museum rapport 2012:39 ("paa Guldholmen"). Matches with the saga's Gulleyna are disputed and not used | documented |
| Härmanö | Hermanö | 1673 | the museum's caption for the Felterus map ("Stora och Lilla Hermanö"). The map itself was not read, so the exact spelling on the map is unconfirmed. The sound was Hermanösund | uncertain |
| Morlanda (parish; church on Orust, no position) | Molanda | 1388 | sv.wikipedia Morlanda socken | uncertain (1388) |

No differing documented 1700 form found for: Fiskebäckskil (the parish name Fiskebäckskils församling existed
in the 1600s), Grundsund, Måseskär, Stångehuvud, Islandsberg, Gäven, Hättan, Skaftö. "Not found", not "same".

## 5. Boats and people at sea

Honest summary: the documented picture is thin.

- **People.** The common fishermen are *strandsittare* (resident households on rented shore plots,
  "framförallt vanlig under 1600-talet"): Gullholmen 24 (1610), about 39 households (1645), 20 families (end of
  the 1600s); Lysekil about half of 82 adults (1645).
- **Fishermen's boats: not found.** No readable source names the boat types or crews of c.1700 (two relevant
  PDFs were unreadable or returned an error). The repo's own `docs/BOAT-BRIEF.md` chooses a small tarred clinker
  eka with a rust-brown spritsail for the player: that is a design decision, recorded as such. A slide deck
  citing the 2024 book "Sill" says the Dutch fishing of the 1600s brought clinker-built decked herring boats
  (search summary only; no Bohuslän boat is tied to it).
- **War craft, documented.** In the Gyldenløve feud "den norska roddflottan ankrade vid Gullholmen"; Gyldenløve
  landed about 800 men at Marstrand on 2 July 1677 (search summary). Swedish privateers from 1709 included a
  brigantine, a huckert, a galliot and a frigate (sv.wikipedia Kapare; where they sailed from is not stated).
  Tordenskiold's ships attacked Marstrand in 1719 (search summary); he called Gullholmen one of the coast's
  "mest brugelige Havne".
- **State pilotage**, as in section 2.
- **How busy.** Recommendation, **invented**: quiet. Few fishing boats, rowed or sailed by one or two; a pilot
  boat now and then; a rare armed vessel; busier around Marstrand than Skaftö; more war traffic 1709-1719.
  Basis: no herring period is listed 1680-1747 (sv.wikipedia Sillperiod: 1660-1680, 1747-1809; Uddevalla
  page: 1660-1680, 1747-1808); Lysekil's herring "avtog redan 1675"; the Great Northern War began
  11 February 1700; the `epochs.json` vibe for the era is "unsettled".

Sources: https://www.bohuslansmuseum.se/wp-content/uploads/2016/11/BM_Rapport_2012-39.pdf ·
https://sv.wikipedia.org/wiki/Sillperiod · https://www.vastsverige.com/uddevalla/guider1/Uddevallas-sillhistoria/ ·
https://sv.wikipedia.org/wiki/Kapare · https://en.wikipedia.org/wiki/Battle_of_Marstrand (search summary) ·
https://en.wikipedia.org/wiki/Attack_on_Marstrand (search summary) ·
https://www.spfseniorerna.se/globalassets/foreningar/spf-seniorerna-morup-stafsinge/sill.pdf (search summary)

Unresolved (listed in the JSON): boat types and crew sizes; counts of boats or ship movements near the region;
whether Dutch shipping passed.

## 6. Grundsund's sound in 1700

**No depth for the sound before the 1914-1918 canal was found in any source.** What is known:

- The village is named after the shallow sound: "är uppkallat efter det grunda sund, nu kallat Grundsunds
  kanal, som skiljer dessa öar från varandra" (Skaftölandet and Ösö).
- The Bohusläns museum's description: "Där Gåsöfjorden går in i ett trångt sund mot Värbofjorden ligger på
  ömse sidor fiskeläget Grundsund. Den djupa hamnrännan löper genom ett bergspass" (a present-day description
  of the harbour channel; no depth given). In the 1700s the village was three clusters, Ösö and Bovik on either
  side of the narrow sound.
- By the 1910s: "Väl hemma kunde dom inte gå in i den allt grundare hamnen." 1886 an Orust member of the Riksdag
  asked for money to survey the harbour area (650 kr; surveyed the next year); 1892 dredging was raised at the
  municipal meeting but nothing happened; 1911-1913 state funds; "Arbetet påbörjades i januari 1914 och
  slutfördes 1918"; no ceremony in 1918; formally inaugurated at the 2018 festival.
- Dug "under första världskriget" so fishing boats and schooners could pass more easily and to give a larger
  sheltered harbour.

**Not found:** the depth before the canal; whether boats could pass at all, only at high water, or only small
ones; a bridge or ford; the canal's width and depth (the 1 500 m figure is a canoe-race leg, not its length).

**Link to the water level.** The 1700 sea stood about 0.55 m higher than today (range 0.45-0.70). Silting
plus land uplift fits "allt grundare", but that is our inference, not a source statement.

**Recommendation, invented** (and in line with GAME-DESIGN "Dug channels"): in 1700 the sound is shallow,
passable by an eka and small rowed boats, closed to anything with a deeper keel; the through route for larger
boats arrives with the canal in epoch V. Add the 0.55 m offset to any modern depth used.

Sources: https://sv.wikipedia.org/wiki/Grundsund · https://digitaltmuseum.org/021017762068 ·
https://www.vastsverige.com/skafto/artiklar/kanalfesten-2016/ ·
https://www.vastsverige.com/skafto/artiklar/kanalfesten-grundsund-2018 ·
https://www.vastsverige.com/lysekil/produkter/skafto-grundsund/

## Source reliability, in one place

Primary (agency or museum): the SMHI table and pages, the Bohusläns museum report, the museum's Grundsund
text. Secondary: sv.wikipedia (several pages carry "källa behövs" tags), Högman's piloting history. Tourism:
vastsverige.com. Weak: three items seen only in search summaries (marked in the registry as
`search-summary`). Project files: settlements-history.json, shoals.json and names.json (OSM, ODbL 1.0),
LIGHTHOUSES.md, epochs.json, BOAT-BRIEF.md.

Five PDFs came back from the fetch tool as compressed bytes (the Gullholmen report, a herring-history PDF,
SMHI's table, a Skaftö brochure, a Bohusarvet magazine issue); their text was extracted locally with
`pdftotext` and read as data. Two more sources were unreachable: a Strandsittarna PDF (HTTP 409) and snl.no
(HTTP 403).
