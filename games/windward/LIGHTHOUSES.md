# West-coast lighthouses — master list

All years and heights are from the Lighthouse Directory (ibiblio.org/lighthouse), read 2026-11-05:
[Göteborg](https://www.ibiblio.org/lighthouse/swgote.htm) ·
[Central Bohuslän](https://ibiblio.org/lighthouse/swbohuc.htm) ·
[Northern Bohuslän](https://ibiblio.org/lighthouse/swbohun.htm).

"Built" means the current tower. Where the light station is older, its date is given in brackets. "Our model" is the height in `src/lighthouses.js`.
The game scales distances to about 1:8, so towers don't have to be at real height. What matters is the order of heights and how each one looks.

## In the game (12, branch felix/windward-lighthouses)

| Lighthouse | Area | Built | Real height | Real look | Our model |
|---|---|---|---|---|---|
| Nordkoster | Koster | 1849 | ~7 m (+5 m twin) | Two round white masonry towers, grey lantern | 13.1 m, one tower, green dome ⚠ |
| Hållö | Smögen | 1842 (raised 1868) | 20 m | White stone, red cast-iron top, black lantern | 14.7 m |
| Måseskär | Käringön | 1865 | 27 m | Red/white checker cast-iron lattice | 15.6 m ⚠ should be among the tallest |
| Pater Noster (Hamneskär) | Marstrand | 1868 | 32 m | Red cast-iron lattice, red keeper's buildings | 17.6 m ⚠ tallest on the coast; all red |
| Vinga | Göteborg | 1890 (station 1841) | 29 m | Square unpainted granite tower, grey dome | 12.5 m + 9 m daymark ⚠ grey, not beige |
| Ursholmen | Koster | 1891 | 13 m (+10 m twin, no lantern) | White, black top band, black lantern | 13.1 m |
| Valö | Göteborg south | 1935 (station 1885) | 10 m | White, green band | 12.7 m (teal band) |
| Sandviksholmen | Hamburgö | 1939 | 7 m | White, red lantern roof | 12.7 m |
| Väcker (Tjurpannan) | Havstenssund | 1939 | 14 m | White, black band at top, red roof | 14.6 m |
| Ramskär | Havstenssund | 1939 (station 1917) | 19 m | White, one broad black band (twin of Väcker) | 14.3 m |
| Väderöbod | Fjällbacka | 1964 (station 1867) | 19 m | Round red concrete | 16.0 m |
| Södra Syster | Fjällbacka | 2020 (station 1951) | 9 m | White, black base | 13.5 m ⚠ ours is a black box with ladder |

## Missing — worth adding (characterful, between Göteborg and Koster)

| Lighthouse | Area | Built | Height | Look |
|---|---|---|---|---|
| Carlsten Fortress light | Marstrand | 1782 (dark since 1868) | — | Light on the fortress tower; the directory calls it the world's first flashing light |
| Böttö (1) | Göteborg | 1841 (dark since 1964) | — | Red lantern on the roof of a red-and-white wooden keeper's house |
| Islandsberg (1) | Lysekil | 1883 (dark since 1938) | 6 m | Wooden keeper's house, white seaward end, red behind |
| Stångehuvud | Lysekil | 1890 | 4 m | Small white wooden house, black A-frame roof |
| Eggskär | Klädesholmen | 1904 | 8 m | White round stone tower |
| Tistlarna | Göteborg south | 1905 | 14 m | Square white masonry, black trim, grey dome |
| Mollösund | Orust | 1930 | 7 m | White, black base band, red roof |
| Stora Pölsan | Rörö | 1934 | 10 m | Square masonry tower, black band |
| Mjölskär | Smögen | 1936 | 14 m | White, black base band |
| Hättan | Härmanö | 1938 | 9 m | White, one black band |
| Gäven | Lysekil | 1941 (station 1917) | 9.5 m | White, one black band |
| Kråksundsgap Södra | Orust | 1954 | 13 m | All-white round tower |
| Trubaduren | Off Vinga | 1965 (station 1929) | 26 m | Red over black, helipad |
| Lindholmen Västra / Mellersta | Skalhamn | 1974 | 15 m / 13 m | Red round towers, slatted red daymarks |
| Brandskärsflak | Off Smögen | 1974 | 26 m | White, green band (sea tower) |
| Dynabrott | Off Smögen | 1974 | 26 m | White, red band (sea tower) |
| Hätteberget | Marstrand | 1977 | 26 m | Red over black, helipad |

Skipped: dozens of 3–6 m harbour lanterns and fiberglass cabinets. Use one generic small-light model for all of them.

## Note for the trading game (GAME-DESIGN.md)

Bohuslän's great herring period was roughly 1747–1809. Of everything above, only Carlsten's light (1782) existed then.
- If the game is set in that era, the coast is dark, apart from cairns and daymarks.
- If it's set around 1880–1900, it fits most of the stone and iron towers. That's also the second herring boom, from 1877.
