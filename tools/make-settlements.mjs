#!/usr/bin/env node
// Assembles games/windward/data/settlements-history.json.
//
//   node tools/make-settlements.mjs
//
// Inputs: games/windward/assets/coast/places.json (OSM coordinates, from build-coast.mjs) and
// tools/data/scb-tatort-population.json (Statistics Sweden, CC0, read by POST from the PxWeb API).
// Everything else below was read by hand from the cited pages; nothing comes from memory. A year is
// recorded only if a fetched page states it. Century-only or decade-only statements are kept as notes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const places = JSON.parse(fs.readFileSync(`${ROOT}/games/windward/assets/coast/places.json`, 'utf8')).places;
const scb = JSON.parse(fs.readFileSync(`${ROOT}/tools/data/scb-tatort-population.json`, 'utf8'));

const W = (title) => encodeURI(`https://sv.wikipedia.org/wiki/${title}`);
const U = {
  scb: scb.source,
  sillperiod: W('Sillperiod'), herripedia: 'https://www.herripedia.com/bohuslan/',
  museumHerring: 'https://www.bohuslansmuseum.se/kunskapsbanken_bohuslans_historia/sladholmarna-trankokeri-och-tomtningar/',
  kungalv: 'https://www.kungalv.se/contentassets/4202e7d5d8114f149113dce49275ee7f/kulturmiljounderlag-2014.pdf',
  museumMarstrand: 'https://www.bohuslansmuseum.se/samlingar-och-historia/gamla-historiska-artiklar/badorten-marstrand/',
  smogenTour: 'https://www.vastsverige.com/sotenas/artiklar/smogen/',
  lysekilWalk: 'https://www.vastsverige.com/lysekil/artiklar/historisk-stadspromenad',
  ockeroFishing: 'https://www.vastsverige.com/visitockero/centrum-for-fiske/',
  grundsundMuseum: 'https://digitaltmuseum.org/021017762068',
  gullholmenMuseum: 'https://digitaltmuseum.org/011014337355/gullholmen',
  karingonTour: 'https://www.vastsverige.com/orust/produkter/karingon/',
  stromstadTour: 'https://www.vastsverige.com/stromstad/artikel/historia/',
  goteborgDoc: 'https://www5.goteborg.se/prod/fastighetskontoret/etjanst/planobygg.nsf/vyFiler/Br%C3%A4nn%C3%B6%20-%20Handel%20och%20bost%C3%A4der-Plan%20ut%C3%B6kat%20f%C3%B6rfarande%20-%20granskning-Kulturmilj%C3%B6/$File/11.%20Kultur.pdf',
  kyrkesundMuseum: 'https://www.bohuslansmuseum.se/rapport/trankokeriet-kalhuvudet/',
  museumGullholmen: 'https://www.bohuslansmuseum.se/wp-content/uploads/2016/11/BM_Rapport_2012-39.pdf',   // Bohusläns museum rapport 2012:39 (read as text)
  lansstyrelsenHarmano: 'https://www.lansstyrelsen.se/vastra-gotaland/besok-och-upptack/naturreservat/harmano.html',
  harmanoFolder: 'https://vastkuststiftelsen.se/wp-content/uploads/2025/07/harmano_naturreservat_karta_folder.pdf',        // read as text
  hallevikTour: 'https://www.vastsverige.com/orust/produkter/halleviksstrand/',
};
const RANK = { low: 0, medium: 1, high: 2 };
const DDB = 'ddb-restricted';   // upstream is Tabellverket / the Demographic Data Base (Umea): terms forbid bulk copying and commercial use

// ---- population helpers --------------------------------------------------------------------------
// scbRows(code, {from, to}) -> rows read straight from the stored SCB response (CC0)
const scbRows = (code, from = 0, to = 9999, counts = 'tätort (SCB)') =>
  Object.entries(scb.data[code] || {}).filter(([y]) => +y >= from && +y <= to).map(([y, v]) => ({ year: +y, value: v, counts, source: U.scb }));
// rows([[year, value], ...], counts, sourceUrl, {licence, note})
const rows = (list, counts, source, extra = {}) => list.map(([year, value]) => ({ year, value, counts, source, ...extra }));
const island2020 = (title, value) => rows([[2020, value]], 'island residents (SCB islands list, via sv.wikipedia)', W(title));
const smaort = (title, list) => rows(list, 'småort (SCB, via sv.wikipedia)', W(title));

function entry(name, { first = null, phases = [], pop = [], parish = null, notes = [], sources = [] }) {
  const place = places.find((p) => p.name === name);
  if (!place) throw new Error('no OSM place for ' + name);
  const urls = [];
  const idx = (u) => { if (!u) return -1; let i = urls.indexOf(u); if (i < 0) { urls.push(u); i = urls.length - 1; } return i; };
  sources.forEach(idx);
  const ph = phases.map((p) => ({ from: p.from, to: p.to, kind: p.kind, note: p.note, confidence: p.conf, src: p.src.map(idx) }));
  const fr = first ? { year: first.year, note: first.note, confidence: first.conf, src: idx(first.src) } : null;
  const obs = pop.map((o) => ({ year: o.year, value: o.value, counts: o.counts, src: idx(o.source), ...(o.licence ? { licence: o.licence } : {}), ...(o.note ? { note: o.note } : {}) }))
    .sort((a, b) => a.year - b.year);
  const confs = [...phases.map((p) => p.conf), ...(first ? [first.conf] : [])];
  return {
    name, lat: place.lat, lon: place.lon, osm: place.osm,
    firstRecorded: fr ? fr.year : null, firstRecordedNote: fr ? fr.note : 'no year found in the sources read',
    firstRecordedSrc: fr ? fr.src : null,
    phases: ph, population: obs, parish: parish ? { name: parish.name, mapping: parish.mapping, src: idx(parish.src) } : null,
    sources: urls, confidence: confs.length ? ['low', 'medium', 'high'][Math.min(...confs.map((c) => RANK[c]))] : 'low', notes,
  };
}
const herring = (from, to, conf, note, src) => ({ from, to, kind: 'herring-boom', conf, note, src });
const H1 = (conf, note, src) => herring(1747, 1809, conf, note, src);
const H2 = (conf, note, src) => herring(1877, 1906, conf, note, src);
const REG = 'Years are the regional herring period (Bohusläns museum: 1747-1809 and 1877-1906).';

const settlements = [
  entry('Smögen', {
    first: { year: 1594, conf: 'medium', note: '"Första gången Smögen nämndes i litteraturen var 1594" (vastsverige.com).', src: U.smogenTour },
    phases: [{ from: 1900, to: null, kind: 'resort', conf: 'medium', note: 'Hotell Smögens Hafvsbad completed 1900; summer guests came for seaweed baths. No end year stated.', src: [U.smogenTour] }],
    pop: [...rows([[1900, 1113]], 'municipalsamhälle ("Befolkning runt ett municipalsamhälle 1900")', W('Smögen'), { note: 'upstream: Folkräkningen 1900' }), ...scbRows('1427TB106')],
    parish: { name: 'Kungshamns socken', mapping: 'the village lies in this parish; counts are for the Smögen locality, not the parish', src: W('Smögen') },
    sources: [W('Smögen')], notes: ['Granite quarrying "tog fart under 1800-talets slut": century only, left out. No place-specific herring years found.'],
  }),
  entry('Kungshamn', {
    phases: [H1('low', 'Place page: permanent settlement came with "den stora sillperioden under 1700-talet". ' + REG, [W('Kungshamn'), U.museumHerring]),
      { from: 1943, to: null, kind: 'canning/industry', conf: 'medium', note: 'Abba\'s whole production moved to Rösholmen in 1943 (Munkens cannery was there before, year not stated); moved to Hagaberg, Kungshamn, in the early 1970s.', src: [W('Kungshamn')] }],
    pop: scbRows('1427TC104', 1960, 9999, 'tätort Kungshamn (SCB unit "Smögen, Kungshamn och Väjern")'),
    parish: { name: 'Kungshamns socken (formed 1772)', mapping: 'counts are the Kungshamn locality; from 2020 SCB counts Smögen, Kungshamn and Väjern as one tätort, so the later numbers include Smögen', src: W('Kungshamn') },
    notes: ['Name appears on a sea chart "från tidigt 1600-tal" (no year). A 1933 sale to Bröderne Ameln was not confirmed on the page and is left out.'],
  }),
  entry('Hunnebostrand', {
    phases: [{ from: 1863, to: 1978, kind: 'canning/industry', conf: 'medium', note: 'Stone industry: first quarry 1863 on Skalbergen; the epoch ended when the Lahälla quarry closed in 1978.', src: [W('Hunnebostrand')] }],
    pop: [...rows([[1900, 1314]], 'köpingsliknande samhälle, includes Ellene', W('Hunnebostrand'), { note: 'upstream: Folkräkningen 1900' }), ...scbRows('1427TB103')],
    parish: { name: 'Tossene socken', mapping: 'the village lies in this parish; counts are for the locality', src: W('Hunnebostrand') },
    notes: ['"Kustsamhälle med anor från 1200-talet" (century only).'],
  }),
  entry('Lysekil', {
    first: { year: 1578, conf: 'medium', note: 'Name form "Lusekijll" 1578. The 1317 form "Lysa" refers to the church village, not the town.', src: W('Lysekil') },
    phases: [{ from: 1770, to: 1820, kind: 'decline', conf: 'medium', note: 'Population peaked at 536 in 1770 and fell to 391 in 1820.', src: [W('Lysekil')] },
      { from: 1846, to: null, kind: 'resort', conf: 'medium', note: '"Lysekils historia som badort börjar 1846" when consul Mollén built the first bath house. No end year stated (the old bath buildings burned in 1939, which is not the end of the era).', src: [U.lysekilWalk] }],
    pop: [...rows([[1750, 226], [1760, 332], [1770, 536], [1820, 391]], 'personer (Hansson 1983, via sv.wikipedia)', W('Lysekil')), ...scbRows('1484TC105')],
    parish: { name: 'Lysekils församling (since 1700; earlier Lyse socken)', mapping: 'counts are for the town/locality', src: W('Lysekil') },
    notes: ['Sladholmarna saltery and train-oil works (1788) are near Lysekil but not in the town; left out. Town rights 1 April 1903 are administrative.'],
  }),
  entry('Fiskebäckskil', {
    pop: [...rows([[1750, 202], [1760, 245], [1769, 360], [1775, 381], [1785, 523], [1795, 688], [1805, 773], [1810, 755], [1820, 675], [1830, 792], [1840, 728], [1850, 812]],
      'kapellförsamling/kommun, excl. Östersidan (table T1)', W('Fiskebäckskil'), { licence: DDB, note: 'upstream: Tabellverket (Demographic Data Base, Umeå)' }),
      ...rows([[1860, 647], [1870, 664], [1880, 712], [1890, 689], [1900, 665], [1910, 587], [1920, 559], [1930, 497], [1940, 409], [1950, 370]],
        'kapellförsamling/kommun, excl. Östersidan (table T1)', W('Fiskebäckskil'), { note: 'upstream: SCB Folk- och bostadsräkningarna' }),
      ...scbRows('1484TB103')],
    parish: { name: 'Fiskebäckskils socken (formerly Morlanda; later Skaftö socken)', mapping: 'the pre-1960 rows are the chapel parish of Fiskebäckskil, whose main village this is', src: W('Fiskebäckskil') },
    notes: ['Fishing village "sedan 1500-talet" (century only). Kristineberg marine station 1877 is not herring or industry, left out.'],
  }),
  entry('Grundsund', {
    phases: [H1('medium', 'Bohusläns museum record: "Nuvarande samhället Grundsund har sitt ursprung i 1700-talets sillperiod". ' + REG, [U.grundsundMuseum, U.museumHerring]),
      H2('low', 'Place page: growth in "de stora sillperioderna"; museum record: sjöbodar and salteries built "mot slutet av 1800-talet". ' + REG, [W('Grundsund'), U.grundsundMuseum])],
    pop: [...rows([[1810, 379], [1820, 466], [1830, 535], [1840, 473], [1850, 555]], 'parish (Grundsunds församling; merged into Skaftö 1888)', W('Grundsund'), { licence: DDB, note: 'upstream: Tabellverket (Demographic Data Base, Umeå)' }),
      ...rows([[1860, 567], [1870, 628], [1880, 800], [1890, 965], [1900, 1036], [1910, 1093], [1920, 1212], [1930, 1141], [1940, 976], [1950, 983]], 'parish/locality as printed', W('Grundsund'), { note: 'upstream: SCB Folk- och bostadsräkningarna' }),
      ...scbRows('1484TB104')],
    parish: { name: 'Grundsunds socken', mapping: 'Grundsund is the kyrkby (main village) of this parish; the pre-1960 rows are the parish', src: W('Grundsund') },
    notes: ['Church built 1798-99 and the scattered settlements took the name Grundsund (museum record); 1920 "ett av länets största fiskelägen". Single events, not phases.'],
    sources: [U.grundsundMuseum],
  }),
  entry('Gullholmen', {
    first: { year: 1588, conf: 'high', note: 'The oldest secure evidence of settlement is a 1588 letter mentioning Jens Opekop "paa Guldholmen" (Bohusläns museum rapport 2012:39).', src: U.museumGullholmen },
    phases: [H1('medium', 'Bohusläns museum: "Som en följd av 1700-talets stora sillperiod upplevde fiskeläget en mycket kraftig bebyggelseexpansion", about a hundred houses by 1800. ' + REG, [U.museumGullholmen, U.museumHerring]),
      H2('medium', 'Bohusläns museum: building "åter ta fart på 1870-talet då nästa stora sillperiod inträffade". ' + REG, [U.museumGullholmen, U.museumHerring]),
      { from: 1919, to: null, kind: 'decline', conf: 'medium', note: 'Länsstyrelsen: after the First World War fishing paid less, people moved, many houses became summer homes, the school and the cannery closed. The page gives no year; 1919 is the year after the war ended.', src: [U.lansstyrelsenHarmano] }],
    pop: [...rows([[1810, 357], [1820, 246], [1830, 293], [1840, 341], [1850, 391], [1860, 464], [1870, 485], [1880, 539], [1890, 685], [1900, 724], [1910, 811], [1920, 796], [1930, 692], [1940, 524], [1950, 466]],
      'parish (Gullholmens församling, includes Härmanö)', W('Gullholmen'), { licence: DDB, note: 'upstream: Folkmängdsdatabasen (Demographic Data Base, Umeå); the page says the parish figures run "några tiotal högre" than the built-up area' }),
      ...scbRows('1421TB110'), ...smaort('Gullholmen', [[2023, 98]])],
    parish: { name: 'Gullholmens socken', mapping: 'the pre-1960 rows are the parish, which also holds Härmanö; Gullholmen is its main village. Härmanö has its own entry: do not add the two', src: W('Gullholmen') },
    sources: [U.gullholmenMuseum, U.harmanoFolder],
    notes: ['A kronoholme (state-owned, free to build on) until 1999. Counts from the museum report: 24 resident strandsittare in 1610, about 39 households in 1645, 20 fishing families in the late 1600s, about 100 houses around 1800. Church: chapel parish permitted 1798, church finished autumn 1799. Municipalsamhälle 29 January 1886 (sv.wikipedia).'],
  }),
  entry('Härmanö', {
    first: { year: 1673, conf: 'high', note: 'Figure 5 of Bohusläns museum rapport 2012:39: Felterus\'s map of 1673 "visande Gullholmen och Stora och Lilla Hermanö". The earlier mentions (the saga date 1253, a royal letter of 1565, a customs officer in 1572, the 1587 toll accounts) are of Hermanösund, the sound, whose location is disputed, so they are not taken as a first record of the island.', src: U.museumGullholmen },
    phases: [{ from: 1900, to: 1950, kind: 'canning/industry', conf: 'low', note: 'Feldspar quarried at Höpallen and Stenvik "under 1900-talets första hälft" (half-century only; the folder says the same).', src: [W('Härmanö'), U.harmanoFolder] }],
    pop: [...rows([[2000, 138]], 'island residents on Härmanö (118 of them in the built-up area)', W('Gullholmen'), { note: 'sv.wikipedia: "Av befolkningen år 2000 var det 20 som bodde på ön Gullholmen och 138 på Härmanö, varav 118 i tätbebyggelsen" (read verbatim). 138 + 20 = 158, the Gullholmen parish figure for 2000' }),
      ...rows([[2012, 92]], 'permanent residents on Härmanö', W('Gullholmen'), { note: 'sv.wikipedia: "2012 fanns som fastboende endast 10 personer på Gullholmen och 92 på Härmanö" (read verbatim)' })],
    parish: { name: 'Gullholmens socken', mapping: 'the island lies in this parish; counts are island residents. The Gullholmen parish rows (to 2000) already include Härmanö, so the two are not additive', src: W('Härmanö') },
    sources: [U.harmanoFolder],
    notes: ['Farm settlement on the east side "åtminstone sedan 1500-talet", combined with home fishing and freight sailing; the farm Härm is the oldest (Västkuststiftelsen folder). About ten house platforms from the 1500s and 1600s excavated at Skållehus. Laga skifte 1831 divided the farms in five. Nature reserve 1967. No herring, decline or resort years are stated for Härmanö itself.'],
  }),
  entry('Käringön', {
    first: { year: 1659, conf: 'medium', note: '"Käringön skrevs 1659 Kierlingøon"', src: W('Käringön') },
    phases: [H1('low', 'Tourism page: "Redan på 1700-talet sattes Käringön på kartan i och med den stora sillperioden". ' + REG, [U.karingonTour, U.museumHerring])],
    pop: [...rows([[1900, 568], [1909, 614]], 'municipalsamhälle', W('Käringön'), { note: 'upstream: Folkräkningen 1900; Almanack för alla' }),
      ...rows([[1925, 548], [1944, 336]], 'as printed (unlabelled)', W('Käringön'), { note: 'upstream: Nordisk Familjebok; När, var, hur? 1945' }),
      ...scbRows('1421TB111'), ...island2020('Käringön', 80), ...smaort('Käringön', [[2023, 73]])],
    parish: { name: 'Käringöns socken', mapping: 'Käringön is the kyrkby of this one-island parish', src: W('Käringön') },
    notes: ['The 1900 table says 515 but the text 568 for the municipalsamhälle; the labelled 568 is used. Chapel parish formed 19 November 1795, church taken into use 1796 (Svenska kyrkan). Olof Knape (later Strömstierna) was born here in 1664.'],
  }),
  entry('Åstol', {
    phases: [{ from: 1970, to: 1979, kind: 'decline', conf: 'low', note: '"Fiskenäringen upphörde på 1970-talet." Decade only.', src: [W('Åstol')] }],
    pop: [...rows([[1900, 338]], 'municipalsamhälle ("Befolkning runt ett municipalsamhälle 1900")', W('Åstol'), { note: 'the page text says 365 for the same year' }),
      ...rows([[1925, 448]], 'as printed (unlabelled)', W('Åstol')), ...scbRows('1419TB112'), ...smaort('Åstol', [[2015, 189], [2023, 159]])],
    parish: { name: 'Stenkyrka socken', mapping: 'the island lies in this parish; counts are for the Åstol locality', src: W('Åstol') },
    notes: ['No first mention or place-specific herring years found. A search snippet puts settlement in the mid-1700s; no year, not used.'],
  }),
  entry('Klädesholmen', {
    first: { year: 1594, conf: 'medium', note: '"På holländska kartor från 1594 kallades ön Cleefsholmen"', src: W('Klädesholmen') },
    phases: [H1('medium', '"under den stora sillperioden 1747–1809" (place page).', [W('Klädesholmen'), U.museumHerring]),
      { from: 1808, to: 1830, kind: 'decline', conf: 'low', note: '"Under 1808 försvann sillen." Population just over 400 by 1830 (end year not re-checked).', src: [W('Klädesholmen')] },
      { from: 1877, to: 1900, kind: 'herring-boom', conf: 'medium', note: '"sillen kom in till kusten på nytt 1877–1900" (place page).', src: [W('Klädesholmen')] },
      { from: 1950, to: 1969, kind: 'canning/industry', conf: 'low', note: '"omkring 1950 fanns det 25 konservfabriker"; since 1970 only herring pickling. Snapshot years, not start and end dates.', src: [W('Klädesholmen')] }],
    pop: [...rows([[1900, 755]], 'fiskeläge incl. Koholmen', W('Klädesholmen'), { note: 'upstream: Folkräkningen 1900' }), ...rows([[1944, 751]], 'as printed (unlabelled)', W('Klädesholmen')),
      ...scbRows('1419TB103'), ...smaort('Klädesholmen', [[2020, 322]])],
    parish: { name: 'Klädesholmens socken', mapping: 'Klädesholmen is the kyrkby of this one-island parish', src: W('Klädesholmen') }, notes: [],
  }),
  entry('Skärhamn', {
    first: { year: 1724, conf: 'medium', note: 'Name first appears in the Orust and Tjörn district court, 8 October 1724.', src: W('Skärhamn') },
    phases: [H1('low', 'Place page: herring handling with train-oil works and salteries "under 1700-talet". ' + REG, [W('Skärhamn'), U.museumHerring])],
    pop: [...rows([[1900, 589]], 'municipalsamhälle', W('Skärhamn'), { note: 'the page text says 598' }), ...scbRows('1419TC110')],
    parish: { name: 'Stenkyrka socken', mapping: 'the village lies in this parish; counts are for the locality', src: W('Skärhamn') }, notes: ['Shipyard years not on the page.'],
  }),
  entry('Mollösund', {
    phases: [H1('low', 'Place page: "Med sillens återkomst på 1750-talet blomstrade samhället åter". ' + REG, [W('Mollösund'), U.museumHerring]),
      { from: 1970, to: 1979, kind: 'decline', conf: 'low', note: 'Herring fishing "inte upphörde helt förrän på 1970-talet". Decade only.', src: [W('Mollösund')] }],
    pop: [...rows([[1750, 190], [1760, 207], [1769, 249], [1780, 351], [1790, 385], [1795, 432], [1805, 430], [1810, 388], [1820, 380], [1830, 393], [1840, 381], [1850, 482], [1860, 575], [1870, 618], [1880, 708], [1890, 891]],
      'parish as printed (the page does not say what each row counts)', W('Mollösund'), { licence: DDB, note: 'upstream: Tabellverket and Folkmängdsdatabasen (Demographic Data Base, Umeå)' }),
      ...rows([[1900, 903], [1910, 965], [1920, 959], [1930, 782], [1940, 580], [1950, 500]], 'as printed', W('Mollösund'), { note: 'upstream: SCB Folkräkningen' }), ...scbRows('1421TB105')],
    parish: { name: 'Mollösunds socken', mapping: 'Mollösund is the kyrkby of this parish; the pre-1960 rows are the parish', src: W('Mollösund') }, notes: ['"Med anor tillbaka till 1500-talet": century only. A medieval cog (built 1345-1365) was recovered off Mollösund in 1981. The first church was probably built in the herring period 1556-1588 (Svenska kyrkan); the current church was consecrated 26 June 1866.'],
  }),
  entry('Marstrand', {
    first: { year: 1293, conf: 'medium', note: '"Namnet Marstrand finns belagt från 1293"', src: W('Marstrand') },
    phases: [H1('high', 'Kungälvs kommun heritage document lists the herring periods 1747-1809 and 1877-1906 and ties Marstrand\'s growth (free port 1775, population about 500 to 1500) to herring and the free port.', [U.kungalv, U.museumHerring]),
      H2('medium', 'Period years from the same municipal document and Bohusläns museum; Marstrand-specific effect in 1877-1906 is not spelled out.', [U.kungalv, U.museumHerring]),
      { from: 1822, to: null, kind: 'resort', conf: 'high', note: 'Bath operations started in 1822 (Bohusläns museum and Kungälvs kommun both state it); Oscar II visited 1887-1907. No end year stated.', src: [U.museumMarstrand, U.kungalv] },
      { from: 1904, to: 1991, kind: 'canning/industry', conf: 'medium', note: 'Marstrands Mekaniska Verkstad: limited company formed 1904 (repair yard before), closed 1991.', src: [W('Marstrands_Mekaniska_Verkstad')] }],
    pop: scbRows('1482TB110', 1960, 9999, 'tätort (SCB); 2015 drop = boundary change, east of the sound became Arvidsvik'),
    parish: { name: 'Marstrands församling', mapping: 'counts are the Marstrand locality', src: W('Marstrand') },
    notes: ['Free port 15 Aug 1775 to 15 May 1794 (page states both). City privileges 1442 (municipal document).'], sources: [W('Marstrand')],
  }),
  entry('Hälleviksstrand', {
    first: { year: 1617, conf: 'medium', note: '"nämns i skriftliga källor första gången 1617"', src: W('Hälleviksstrand') },
    phases: [H1('low', 'Place page: herring fishing and salteries grew "under 1700-talets stora sillperiod". ' + REG, [W('Hälleviksstrand'), U.museumHerring]),
      { from: 1905, to: null, kind: 'canning/industry', conf: 'medium', note: 'A large fire in 1905 destroyed much of the village; the shipyard, a cannery and a stonemason\'s yard started at the same time. No end year stated.', src: [U.hallevikTour] }],
    pop: [...rows([[1900, 438], [1910, 503], [1920, 484], [1930, 415], [1940, 346], [1950, 277]], 'folkräkning (as printed)', W('Hälleviksstrand')), ...scbRows('1421TB103'), ...smaort('Hälleviksstrand', [[2015, 187], [2023, 181]])],
    parish: { name: 'Morlanda socken', mapping: 'the village lies in this parish; counts are for the locality', src: W('Hälleviksstrand') }, notes: ['Warm-bath houses and guesthouses for summer guests (a late-1800s wording, no year). Church built 1904 (a paraphrase, not confirmed verbatim).'],
  }),
  entry('Kyrkesund', {
    phases: [H1('medium', 'A trankokeri (train-oil works) was built on Kålhuvudet in 1780 (place page). ' + REG, [W('Kyrkesund'), U.museumHerring]),
      H2('low', 'Place page: the last herring period ended in 1906. Start year is the regional one.', [W('Kyrkesund'), U.museumHerring])],
    pop: [...rows([[1909, 498], [1924, 369], [1944, 283]], 'as printed (municipalsamhälle Kyrkesund och Björholmen)', W('Kyrkesund'), { note: 'upstream: Nordisk Familjebok; När, var, hur? 1945' }),
      ...scbRows('1419TB113'), ...smaort('Kyrkesund', [[2010, 76]]), ...scbRows('1419TB105', 2015, 9999, 'tätort (SCB); small localities merged into a tätort in 2015')],
    parish: { name: 'Klövedals socken', mapping: 'the village lies in this parish (Bohusläns museum); counts are for the locality', src: U.kyrkesundMuseum }, notes: ['The page\'s 1900 figure (515) equals Käringön\'s and is left out as a possible copy error.'],
  }),
  entry('Gottskär', {
    phases: [{ from: 1881, to: null, kind: 'resort', conf: 'medium', note: '1881 inn rights taken over by Gottskära Badhus AB; first hot-bath house 1882; regular steamboat from Kungsbacka 1883. No end year stated.', src: [W('Gottskär')] }],
    pop: scbRows('1384TB109', 0, 9999, 'tätort Gottskär (SCB); the 1990-1995 jump is a boundary change'),
    parish: { name: 'Onsala socken (not stated outright on the page; "Se även Onsala socken")', mapping: 'counts are the Gottskär locality, later part of the Onsala tätort', src: W('Gottskär') },
    notes: ['The page says it was a köpstad "till 1539": an end of status, not a first mention.'],
  }),
  entry('Vrångö', {
    first: { year: 1254, conf: 'medium', note: 'Named "Wranghø" in King Valdemar\'s land register, 1254.', src: W('Vrångö') },
    pop: scbRows('1480TB123'), parish: { name: 'Styrsö socken', mapping: 'counts are the Vrångö locality; the island lies in this parish', src: W('Vrångö') }, notes: [],
  }),
  entry('Hönö', {
    phases: [H2('low', 'Öckerö-area fishing page (municipal tourism): "När sillen kom tillbaka till kusten hösten 1877". Area-wide, not Hönö-specific; end year is the regional one.', [U.ockeroFishing, U.museumHerring])],
    pop: [...scbRows('1407TB105'), ...island2020('Hönö', 5555)],
    parish: { name: 'Öckerö socken', mapping: 'counts are the Hönö locality; from 2018 SCB merges it with Öckerö, so 2020 uses the island residents figure', src: W('Hönö') },
    notes: ['Fishing motorised 1903, ice store 1915, Hönökakan 1904: single events, not phases.'],
  }),
  entry('Öckerö', {
    pop: [...scbRows('1407TC109', 0, 2015, 'tätort Öckerö (SCB unit 1407TC109, merged with Hönö from 2018)'), ...island2020('Öckerö (ö)', 3570)],
    parish: { name: 'Öckerö socken', mapping: 'Öckerö is the main village of this parish; counts are the locality', src: W('Öckerö_(ö)') }, notes: ['New church 1906: a single event.'],
  }),
  entry('Donsö', {
    pop: [...scbRows('1480TB105'), ...island2020('Donsö', 1551)],
    parish: { name: 'Styrsö socken', mapping: 'counts are the Donsö locality; the island lies in this parish', src: W('Donsö') }, notes: ['Name written "Dunsø" in the 1200s: century only.'],
  }),
  entry('Styrsö', {
    phases: [H1('low', 'Göteborgs Stad heritage document (2021): the former saltery on Vargö (in Styrsö parish) "tillkom under den långa sillperioden på 1700-talet". ' + REG, [U.goteborgDoc, U.museumHerring]),
      { from: 1902, to: 1969, kind: 'resort', conf: 'low', note: 'Styrsö Hafsbad\'s restaurant opened 1902 and burned in 1969; the page does not call the island a resort, the city document mentions "badortstiden" buildings.', src: [W('Styrsö'), U.goteborgDoc] }],
    pop: [...scbRows('1480TB121', 0, 2018, 'tätort Styrsö (SCB unit "Styrsö och Donsö", merged with Donsö from 2020)'), ...island2020('Styrsö', 1341)],
    parish: { name: 'Styrsö socken', mapping: 'Styrsö is the kyrkby of this parish; counts are the locality', src: W('Styrsö') }, notes: ['Name from the 1200s: century only.'],
  }),
  entry('Rörö', {
    phases: [herring(1747, 1808, 'medium', 'A salting works and train-oil works stood on the islet Rammen east of Rörö during the great herring period, 1747-1808 (place page).', [W('Rörö')]),
      { from: 1808, to: 1824, kind: 'decline', conf: 'medium', note: 'By 1824 the whole installation on Rammen had been dismantled.', src: [W('Rörö')] }],
    pop: scbRows('1407TB108'), parish: { name: 'Öckerö socken', mapping: 'Rörö is the northernmost inhabited island of this parish; counts are the locality', src: W('Rörö') }, notes: ['Sea-rescue station 1917: a single event.'],
  }),
  entry('Göteborg', {
    first: { year: 1621, conf: 'medium', note: '"fick sina stadsprivilegier 1621" (town charter).', src: W('Göteborg') },
    phases: [{ from: 1910, to: null, kind: 'canning/industry', conf: 'medium', note: 'Göteborgs fiskhamn (fish harbour) started in 1910 (Öckerö-area fishing page).', src: [U.ockeroFishing] }],
    pop: [...rows([[1900, 152172]], 'stad med förstäder', W('Göteborg')), ...scbRows('1480TC108', 0, 9999, 'tätort (SCB)')],
    parish: { name: 'n/a (city)', mapping: 'counts are the city/tätort', src: W('Göteborg') },
    notes: ['A fetched page that states Göteborg\'s own role in the herring trade was not found; snippet-only claims are left out.'],
  }),
  // ---- Koster extension (pass 3) ----
  entry('Strömstad', {
    first: { year: 1667, conf: 'medium', note: '"Strömmen fick köpingsrättigheter 1667" (köping rights, not a first mention of the name).', src: W('Strömstad') },
    phases: [{ from: 1782, to: null, kind: 'resort', conf: 'low', note: 'Spring-water drinking at Lejonkällan 1782; the page says the start of the bath resort "inte klarlagt". No end year.', src: [U.stromstadTour] }],
    pop: scbRows('1486TC103'), parish: { name: 'Strömstads församling (since 1670, out of Skee socken)', mapping: 'counts are the town/tätort', src: W('Strömstad') },
    notes: ['Town rights confirmed 15 April 1676. Herring "under den stora sillfiskeperioden under 1700-talets andra hälft": no years.'],
  }),
  entry('Fjällbacka', {
    first: { year: 1617, conf: 'medium', note: '"Fjällbacka omnämns första gången 1617 som Fieldbacke."', src: W('Fjällbacka') },
    pop: [...rows([[1900, 714]], 'municipalsamhälle', W('Fjällbacka'), { note: 'upstream: Folkräkningen 1900' }), ...scbRows('1435TB101')],
    parish: { name: 'Kville socken', mapping: 'the village lies in this parish; counts are the locality', src: W('Fjällbacka') }, notes: ['Fish canning "ända in på 1960-talet": decade only.'],
  }),
  entry('Hamburgsund', {
    first: { year: 1585, conf: 'medium', note: 'Mentioned in 1585 as a customs station (Öresundstullen documents).', src: W('Hamburgsund') },
    phases: [H1('low', 'Place page: several trankokerier along the sound "under 1700-talets sillperiod". ' + REG, [W('Hamburgsund'), U.museumHerring])],
    pop: scbRows('1435TB103'), parish: { name: 'Kville socken (not stated in the text; inferred from the Kville distrikt)', mapping: 'counts are the locality', src: W('Hamburgsund') }, notes: [],
  }),
  entry('Havstenssund', {
    first: { year: 1196, conf: 'low', note: 'The area is first mentioned in connection with a sea battle in 1196 (the area, not necessarily the village).', src: W('Havstenssund') },
    pop: smaort('Havstenssund', [[2023, 127]]), parish: { name: 'Tanums socken', mapping: 'counts are the småort', src: W('Havstenssund') }, notes: [],
  }),
  entry('Nordkoster', {
    first: { year: 1388, conf: 'low', note: 'The Koster page dates the first written information about a resident population on Koster to 1388; the split between Nord- and Sydkoster was only seen in a fetch summary.', src: W('Koster') },
    pop: [...rows([[1917, 190]], 'island residents', W('Nordkoster')), ...rows([[2005, 105], [2012, 125], [2020, 118]], 'bofasta (permanent residents) on the island', W('Nordkoster'))],
    parish: { name: 'Tjärnö socken', mapping: 'the island lies in this parish; counts are the island', src: W('Nordkoster') }, notes: [],
  }),
  entry('Sydkoster', {
    first: { year: 1388, conf: 'medium', note: 'First written information about a resident population on Koster, 1388 (six of seven farms were on Sydkoster).', src: W('Koster') },
    pop: rows([[1917, 323], [1975, 215], [2012, 238], [2020, 193]], 'island residents / bofasta', W('Sydkoster')),
    parish: { name: 'Tjärnö socken', mapping: 'the island lies in this parish; counts are the island', src: W('Sydkoster') }, notes: ['1754: 54 people on Syd- and Nordkoster together; left out (not split).'],
  }),
];

const out = {
  about: 'Fishing villages and towns on the Coast Lab map, with SOURCED phases and population counts for the lab\'s year slider (1700-2025). Written by hand from fetched pages; nothing here comes from memory.',
  generated: new Date().toISOString().slice(0, 10),
  kinds: ['hamlet', 'herring-boom', 'decline', 'canning/industry', 'resort'],
  confidenceKey: {
    high: 'a museum, heritage-agency or municipal document states the year(s) for the place',
    medium: 'sv.wikipedia or a tourism site states the year for the place; OR a museum/municipal source says the place took part in a named period and a museum gives that period\'s years',
    low: 'a decade or century only, years borrowed from the regional period on a weaker statement, a reading of population numbers, or the page flags its own claim as unsourced. An entry carries its weakest dated fact.',
  },
  phaseRule: 'At a given year the phase that covers it is shown; if several cover it, the one with the latest "from" wins. "to": null means no end year is stated (shown through 2025). A place is hidden before firstRecorded; with firstRecorded null it is drawn at every year. Years with no phase show as plain "settled" (a display default, not data).',
  populationRule: 'population[] holds COUNTED observations only. At a year the lab uses the exact count, a straight-line interpolation between two counts at most 60 years apart, or the nearest count within 15 years; otherwise the house is drawn as an outline sized by its phase ("estimated"). Counts differ in what they measure (see each row\'s "counts" and the entry\'s "parish.mapping"); series have boundary breaks, noted in the rows.',
  populationSources: {
    scb: { what: 'Statistics Sweden (SCB) Folkmängd per tätort, 1960-2023, read by POST from the PxWeb API; stored in tools/data/scb-tatort-population.json', licence: 'CC0 1.0', url: U.scb },
    wikipedia: { what: 'Figures as printed on sv.wikipedia (each row cites its page; "note" gives the upstream source it names: SCB småorter/islands, Folkräkningen 1900, Nordisk Familjebok, Hansson 1983)', licence: 'text CC BY-SA 4.0; the figures are facts', url: 'https://sv.wikipedia.org' },
    ddbRestricted: { what: 'Rows tagged licence "ddb-restricted" come from Tabellverket / the Demographic Data Base (Umeå), as printed on sv.wikipedia. Their terms forbid bulk download into your own database and commercial use. Kept as a handful of individually cited figures for a non-commercial preview. TODO(felix): confirm with CEDAR (Umeå) before any commercial release, or drop these rows (the lab has a switch).', licence: 'restricted', url: 'https://www.umu.se/en/centre-for-demographic-and-ageing-research/infrastructure-at-cedar/open-data/tabverk-on-the-web' },
  },
  herringPeriods: {
    note: 'Regional periods for all of Bohuslän; per-place phases copy these years only where a source about that place says it took part.',
    list: [
      { from: 1747, to: 1809, label: 'the great herring period', confidence: 'high', sources: [U.museumHerring, U.kungalv, U.sillperiod, U.herripedia], variants: ['1747-1808: sv.wikipedia Marstrand, Rörö; vastsverige.com Uddevalla page'] },
      { from: 1877, to: 1906, label: 'the later herring period', confidence: 'high', sources: [U.museumHerring, U.kungalv, U.sillperiod, U.herripedia], variants: ['1877-1900: sv.wikipedia Klädesholmen', '1878-1898: vastsverige.com Uddevalla page'] },
    ],
  },
  settlements,
  unsourced: [
    'firstRecorded year: Kungshamn, Hunnebostrand, Fiskebäckskil, Grundsund, Åstol, Mollösund, Kyrkesund, Gottskär, Hönö, Öckerö, Donsö, Styrsö, Rörö (pages give a century or nothing)',
    'place-specific herring years for: Smögen, Åstol, Fiskebäckskil, Lysekil, Vrångö, Öckerö, Donsö, Gottskär, Göteborg, Strömstad, Fjällbacka, Havstenssund',
    'canning / fish-industry years: Smögen, Lysekil, Fiskebäckskil, Grundsund, Käringön, Mollösund, Skärhamn (shipyards), Hönö, Öckerö, Donsö, Styrsö',
    'granite quarrying years: Smögen, Kungshamn (only "1800-talets slut")',
    'resort END years: every resort phase (Smögen, Lysekil, Marstrand, Gottskär, Strömstad)',
    'population before 1960 for: Smögen/Kungshamn/Marstrand (only 1900 or none), Vrångö, Hönö, Öckerö, Donsö, Styrsö, Rörö, Strömstad, Fjällbacka (1900 only), Hamburgsund, Havstenssund, Gottskär',
    'Tabellverket / Demographic Data Base: not readable by the tools (JavaScript search tool, no download), terms restrictive; no counts were taken from it directly',
    'SCB parish-level historical statistics: no readable source found; SCB tätort tables start in 1960',
    'bebyggelseregistret.raa.se, kmr.raa.se, sotenas.se, orust.se, tjorn.se, kungsbacka.se, Länsstyrelsen pages were not reachable; Bohusläns museum, Kungälvs kommun, Göteborgs Stad and digitaltmuseum.org (Bohusläns museum records) were',
  ],
  licenceNote: 'Text of sv.wikipedia is CC BY-SA 4.0; this file stores facts (dates, counts) and the page URL as the source. Lantmäteriet Historiska kartor was NOT used (its licence for the service could not be confirmed).',
};
fs.mkdirSync(`${ROOT}/games/windward/data`, { recursive: true });
fs.writeFileSync(`${ROOT}/games/windward/data/settlements-history.json`, JSON.stringify(out, null, 1) + '\n');
const n = settlements.reduce((a, s) => a + s.population.length, 0), ddb = settlements.reduce((a, s) => a + s.population.filter((o) => o.licence).length, 0);
console.log(`wrote ${settlements.length} settlements, ${n} population rows (${ddb} tagged ${DDB}), ${fs.statSync(`${ROOT}/games/windward/data/settlements-history.json`).size} bytes`);
for (const s of settlements) console.log(`${s.name.padEnd(15)} first=${String(s.firstRecorded).padEnd(5)} pop=${String(s.population.length).padStart(2)} phases=${s.phases.map((p) => `${p.kind[0]}${p.from}-${p.to ?? ''}`).join(',') || '-'} conf=${s.confidence}`);
