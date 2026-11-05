# epochs.json: fact-check record (2026-11-05)

Every item in `epochs.json` flagged `"verify": true` or "(verify)" was checked against fetched pages. Researchers read the sources and gave a verbatim quote and URL for each claim. **Every quote was then re-fetched and searched for mechanically** (page text, not a summary). Where a researcher's suggested correction went beyond its own quote, it was read again and corrected (see "Researcher corrections that were themselves wrong").

Source grade: *high* = museum, municipal heritage document, national encyclopedia (SNL, ne.se), university; *wiki* = sv.wikipedia; *other* = regional tourism site, digitised handbook, local-history blog.

## What changed

| Item | Before | After | Why |
|---|---|---|---|
| Herring ~1556-1589 | flagged verify | kept as "about"; sources added | Bohusläns museum and Kungälvs kommun both print 1556-1589; end year varies (sv.wikipedia 1588, vastsverige.com 1598), so variants are recorded |
| Herring ~1660-1680 | flagged verify | kept as "about"; sources added | museum, Kungälv and vastsverige.com all print 1660-1680 |
| Herring 1747-1809, 1877-1906 | herripedia only | museum and Kungälv added | both print these years; variants (1747-1808, 1878-1898) noted |
| Norse coast (800-1050) | "...Longships, chieftains, rock carvings already ancient." | "part of Viken, the Norwegian realm. Bronze Age rock carvings (about 1700-500 BCE) are already ancient." | **Longships and chieftains had no source for Viking-age Bohuslän; removed.** Viken and the carvings' age are sourced |
| Fortress and fish (1051-1555) | "...fishing villages are first recorded." | Marstrand founded in the 1200s on herring fishing, privileges 1442; Bohus guards the southern border | **"fishing villages first recorded" had no source; removed.** Marstrand facts from Store norske leksikon |
| 1308 "Bohus fortress begun (verify)" | flagged | "begun by King Håkon Magnusson of Norway", source ne.se | confirmed |
| Border wars (1556-1657) | generic sentence | herring period, then repeated wars; events added: 1563, 1643 (Hannibal's Feud), 1657 (Crab Feud) | only years stated on the pages are used |
| Motor and canning (1907-1916) | "Engines arrive...; canneries and emigration." | engines by 1914; canneries established (Hälleviksstrand 1905); emigration stays high until WWI | no source gives a Bohuslän year for the *first* engines; canneries were not new in these years; the emigration source is national |
| Spirits at sea (1917-1938) | "Prohibition in Norway and rationing in Sweden..." | Norway bans spirits 1916-1927; Sweden's motbok 1917-1955; smuggling around Strömstad in the early 1920s | Norway's ban covered spirits (fortified wine 1917-1923), not all alcohol. Smuggling is documented only for 1919-23 and only by a local-history blog. **Nothing found for the 1930s**, so the era carries a design note |
| 1917 "alcohol ration book (verify)" | flagged | "Sweden's motbok ... in force (to 1955)", source sv.wikipedia Motbok | other pages differ on the start by city |
| Mines and neutrality (1939-1949) | "...boats from occupied Norway." | neutral through the whole war; Hanstholm-Lindesnes mine barrier; over 70,000 refugees from Norway 1940-1945 | **"boats from occupied Norway" had no source; removed.** The refugee figure is national, and the page does not say how they crossed |
| 1960 "Tjörn bridges open (verify)" | flagged | "Tjörn bridge route opens (Almöbron, Stenungsöbron, Källösundsbron)" | page: all three inaugurated 15 June 1960 as one route. Skåpesundsbron (to Orust) is 1939, Nötesundsbron 1966 |
| Leisure sailing (1980-1999) | "Marinas and boatbuilding; a sailing playground." | Orust yards (plastic boats after 1950), first Najad 1971, Hallberg-Rassy at Ellös 1972; events 1980 (Almöbron collapse) and 1981 | **sources date the leisure-boat story to the 1960s-70s; nothing found for marinas in 1980-1999.** The era span is kept as a design choice and says so |
| "West-coast-east-coast feud" (Summer guests) | in the summary | moved to a `flavour` field, labelled "game flavour, not history" | no source found for a feud or its start |
| Summer guests summary | holiday homes, boats, bridges | adds: 208,000 of 596,000 holiday homes built 1961-1980 | sv.wikipedia Fritidshus |
| Marstrand status (info panel) | hard-coded rules in the frozen ref lab; "fortress + bathing resort" for ever after | new sourced `marstrandStatus` list (7 entries) | SNL: Carlsten was decommissioned in 1882, so after that the status is "Bathing resort" |

## Researcher corrections that were themselves wrong (caught on re-reading)

- *"Only Almöbron opened in 1960."* The page says it opened together with two other bridges as one route.
- *"Refugees came mostly overland."* The source gives only the number 70,000.

## Not re-checked

Entries without a "verify" flag (for example 1658 Roskilde and Carlsten, 1706 ordinance, 1719 Tordenskjold, 1731 East India Company, 1745 Götheborg, the 1766-1798 oil-works items, 1813-1839 Lasse-Maja) were not part of this check. Where a fact there overlaps one we sourced elsewhere, a source link was added. Weakest sources (grade *other*): the 1914 handbook, the Strömstad blog, vastsverige.com, tourism pages.

## Quote check (page text fetched and searched, 2026-11-05)

| id | result | page | quote |
|---|---|---|---|
| bohuslan-viken | exact | [page](https://sv.wikipedia.org/wiki/Bohuslän) | Under vikingatiden var Bohuslän en del av Viken, som innefattade kustområdena runt Oslofjorden och öster om Skagerrak |
| roskilde-1658 | exact | [page](https://sv.wikipedia.org/wiki/Bohuslän) | Vid freden i Roskilde 1658 avträddes Bohuslän till Sverige |
| kungahalla-1563 | exact | [page](https://sv.wikipedia.org/wiki/Bohusläns_historia) | Kungahälla brändes 1563 och Uddevalla året efter |
| hannibal | exact | [page](https://sv.wikipedia.org/wiki/Bohusläns_historia) | Under Hannibalsfejden 1643–1645 brändes återigen Uddevalla och Kungahälla ner |
| krabbe | formatting only: page spells the dash with spaces (1657 – 1658); otherwise identical | [page](https://sv.wikipedia.org/wiki/Bohusläns_historia) | Krabbefejden 1657–1658 innebar fler härjningar i Bohuslän |
| tanum-old | exact | [page](https://www.vastsverige.com/en/tanum/produkter/tanum-world-heritage/) | with the oldest figures dating back to around 1800 BCE |
| tanum-bronze | exact | [page](https://www.vastsverige.com/en/tanum/produkter/tanum-world-heritage/) | people from the Bronze Age (1700 BCE – 500 BCE) carved thousands of images |
| snl-1200 | exact | [page](https://snl.no/Marstrand) | Marstrand ble grunnlagt på 1200-tallet, trolig på basis av rike sildefiskerier |
| snl-1442 | exact | [page](https://snl.no/Marstrand) | byprivilegier i 1442 |
| snl-norway-1658 | exact | [page](https://snl.no/Marstrand) | inntil 1658 |
| snl-1882 | exact | [page](https://snl.no/Marstrand) | nedlagt 1882 |
| ne-bohus-1308 | exact | [page](https://www.ne.se/uppslagsverk/encyklopedi/lång/bohus-fästning) | Håkon Magnusson började bygga Bohus fästning 1308 |
| wiki-bohus-1308 | exact | [page](https://sv.wikipedia.org/wiki/Bohus_fästning) | 1308 |
| wiki-bohus-border | exact | [page](https://sv.wikipedia.org/wiki/Bohus_fästning) | Norges dåtida sydgräns |
| marstrand-1293 | exact | [page](https://sv.wikipedia.org/wiki/Marstrand) | Namnet Marstrand finns belagt från 1293 |
| carlsten-1658 | exact | [page](https://sv.wikipedia.org/wiki/Marstrand) | Samma år påbörjades byggnationen av Karlstens fästning |
| freeport-1775 | exact | [page](https://sv.wikipedia.org/wiki/Marstrand) | 15 augusti 1775 fick Marstrand frihamnsprivilegier av Gustav III |
| freeport-1794 | exact | [page](https://sv.wikipedia.org/wiki/Marstrand) | 15 maj 1794 |
| badhus-1822 | exact | [page](https://sv.wikipedia.org/wiki/Marstrand) | 1822 skapades det första |
| museum-badorten-1822 | exact | [page](https://www.bohuslansmuseum.se/samlingar-och-historia/gamla-historiska-artiklar/badorten-marstrand/) | 1822 startade badverksamheten i Marstrand |
| dm-1556 | exact | [page](https://digitaltmuseum.org/021029238579) | Skioldenborg bebyggdes under sillperioden 1556-1589 |
| uddevalla-1660 | formatting only: page encodes the word år as an HTML entity; otherwise identical | [page](https://www.vastsverige.com/uddevalla/guider1/Uddevallas-sillhistoria/) | 1660-1680 (20 år) |
| museum-periods | exact | [page](https://www.bohuslansmuseum.se/kunskapsbanken_bohuslans_historia/sladholmarna-trankokeri-och-tomtningar/) | De mest kända sillperioderna var under åren 1556–1589, 1660–1680, 1747–1809 |
| almobron-1960 | exact | [page](https://sv.wikipedia.org/wiki/Almöbron) | Bron invigdes den 15 juni 1960 |
| almobron-1980 | exact | [page](https://sv.wikipedia.org/wiki/Almöbron) | 18 januari 1980 |
| tjornbron-1981 | exact | [page](https://sv.wikipedia.org/wiki/Almöbron) | 9 november 1981 |
| skapesund | exact | [page](https://sv.wikipedia.org/wiki/Skåpesundsbron) | Den första bron byggdes 1938 och invigdes sommaren 1939 |
| notesund | exact | [page](https://sv.wikipedia.org/wiki/Nötesundsbron) | Den byggdes 1966 |
| hr-1960s | exact | [page](https://sv.wikipedia.org/wiki/Hallberg-Rassy) | mitten av 1960-talet |
| hr-1972 | exact | [page](https://sv.wikipedia.org/wiki/Hallberg-Rassy) | 1972 |
| orust-boat | exact | [page](https://sv.wikipedia.org/wiki/Orust) | Orust är sedan länge ett centrum för båtbyggande |
| orust-plastic | exact | [page](https://sv.wikipedia.org/wiki/Orust) | plast |
| najad-1971 | exact | [page](https://digitaltmuseum.se/021166009571/najadvarvet-varv) | första najaden som sjösattes 1971 |
| refugees-70000 | exact | [page](https://www.gu.se/nyheter/norska-flyktingar-forandrade-den-svenska-flyktingpolitiken) | över 70 000 civila och militära flyktingar 1940–1945 |
| fritidshus-1970 | exact | [page](https://sv.wikipedia.org/wiki/Fritidshus) | På 1970-talet var innehavet av sommarstuga statussymbol |
| fritidshus-208 | exact | [page](https://sv.wikipedia.org/wiki/Fritidshus) | 208 |
| ww2-skagerrack | exact | [page](https://sv.wikipedia.org/wiki/Sverige_under_andra_världskriget) | Skagerackspärren |
| ww2-hanstholm | exact | [page](https://sv.wikipedia.org/wiki/Sverige_under_andra_världskriget) | Hanstholm |
| ww2-lindesnes | exact | [page](https://sv.wikipedia.org/wiki/Sverige_under_andra_världskriget) | Lindesnes |
| guinchard-motors | exact | [page](https://runeberg.org/sweden14/2/0242.html) | from boats provided with motors |
| emigration-1903 | exact | [page](https://sv.wikipedia.org/wiki/Utvandringen_från_Sverige_till_Nordamerika) | nådde en ny topp 1903 då 35 000 lämnade landet |
| emigration-ww1 | exact | [page](https://sv.wikipedia.org/wiki/Utvandringen_från_Sverige_till_Nordamerika) | stoppade effektivt nästan all utvandring |
| motbok-1955 | exact | [page](https://sv.wikipedia.org/wiki/Motbok) | Brattsystemet upphörde 1955 |
| motbok-1917 | exact | [page](https://sv.wikipedia.org/wiki/Motbok) | Motbokskontrollen genomfördes fullt ut 1917 |
| norway-ban | exact | [page](https://snl.no/forbudssaken) | Norge hadde brennevinsforbud fra 1916 til 1927 og hetvinsforbud fra 1917 til 1923 |
| strömstad-smugglers | exact | [page](https://blog.zaramis.se/2020/12/29/spritsmugglarna-i-stromstad-pa-1920-talet/) | Strömstad för närvarande domineras av smugglarna |
| mollosund-1930 | exact | [page](https://ibiblio.org/lighthouse/swbohuc.htm) | 1930 |
| halleviks-1905 | exact | [page](https://www.vastsverige.com/orust/produkter/halleviksstrand/) | 1905 drabbades Hälleviksstrand av en omfattande brand |
| museum-periods-full | exact (read with curl) | [page](https://www.bohuslansmuseum.se/kunskapsbanken_bohuslans_historia/sladholmarna-trankokeri-och-tomtningar/) | De mest kända sillperioderna var under åren 1556–1589, 1660–1680, 1747–1809 (kallad Den stora sillperioden) och 1877–1906. |
| kungalv-pdf | exact (pdftotext) | [page](https://www.kungalv.se/contentassets/4202e7d5d8114f149113dce49275ee7f/kulturmiljounderlag-2014.pdf) | 1556–1589, 1660–1680, 1747–1809, 1877–1906, är de i historisk tid mer kända perioderna. |
| gu-refugees | exact (read; page says nothing on how they crossed) | [page](https://www.gu.se/nyheter/norska-flyktingar-forandrade-den-svenska-flyktingpolitiken) | Denna omfattade över 70 000 civila och militära flyktingar 1940–1945. |
| almobron-route | exact (read) | [page](https://sv.wikipedia.org/wiki/Almöbron) | Bron invigdes den 15 juni 1960 av landshövding Per Nyström, tillsammans med Stenungsöbron och Källösundsbron |
| skagerrak-barrier | exact (read) | [page](https://sv.wikipedia.org/wiki/Sverige_under_andra_världskriget) | Efter ockupationen av Danmark och Norge upprättade Tyskland en minspärr mellan Hanstholm på Jylland och Lindesnes i Norge, kallad Skagerackspärren. |
| fritidshus | exact (read) | [page](https://sv.wikipedia.org/wiki/Fritidshus) | 208 tusen 1961–1980 |
| orust-plastic | exact (read) | [page](https://sv.wikipedia.org/wiki/Orust) | Efter 1950 började flera av öns varv att tillverka plastbåtar |

46 of the 48 saved quotes match the page exactly; the other two differ only in formatting (noted per row). The last 7 rows were checked by other means (curl, pdftotext).
