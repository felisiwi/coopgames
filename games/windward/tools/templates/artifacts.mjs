// Artifact templates for 1950. NO uniques. The OBJECT is invented; the STORY it carries is true wherever story.kind is "sourced".
export const ART = [];
const S = (text, refs, confidence = 'medium') => ({ kind: 'sourced', text, refs, confidence });
const I = (text) => ({ kind: 'invented', text, refs: [], confidence: 'none' });

function A(slug, name, tier, madeEra, foundEra, o) {
  ART.push({
    id: `artifact.${slug}`, name, tier, madeEra, foundEra,
    story: o.story,
    ...(o.foundVia ? { foundVia: o.foundVia } : {}),
    ...(o.foundAt ? { foundAt: o.foundAt } : {}),
    ...(o.givenBy ? { givenBy: o.givenBy } : {}),
    ...(o.teller ? { teller: o.teller } : {}),
    leadsTo: o.leadsTo || { quest: null, hook: null },
    sellable: { later: tier === 'common', note: tier === 'common' ? 'a common find: can be sold or traded once there is an economy' : 'kept for its story: it leads to lore, not to a sale' },
    drawing: o.drawing,
    unique: false,
    source: o.lore
      ? { kind: 'grounded', refs: [`lore:${o.lore.place}#artifacts[${o.lore.index}]`, ...(o.refs || [])], note: 'the object is an INVENTED find from island-lore.json; the story is sourced where story.kind says so' }
      : { kind: 'invented', refs: o.refs || ['docs/ALIVE-SEA.md'], note: 'the object is INVENTED (a drift-find souvenir)' },
    invented: true,
    ...(o.lore ? { lore: { place: o.lore.place, hook: 'artifacts', index: o.lore.index } } : {}),
    ...(o.note ? { note: o.note } : {}),
  });
}

// ---- from island-lore.json (1950 artifacts) --------------------------------------------------------------------------
A('lamp-mantle-tin', 'Spare lamp mantle in its tin', 'common', '1950', ['1950'], {
  lore: { place: 'light:Måseskär', index: 0 }, givenBy: ['place.maseskar.assistant'], drawing: 'tin',
  story: S('Måseskär burned a Lux paraffin lamp until the station was electrified in 1950; the power came by cable and an electric bulb replaced the lamp.', ['people:M04', 'lore:light:Måseskär (SVW-masesk)'], 'medium'),
});
A('cannon-wad-tarred-rope', 'Cannon wad of tarred rope', 'uncommon', '1873', ['1950'], {
  lore: { place: 'light:Måseskär', index: 2 }, foundVia: ['secret.maseskar.signal-cannon'], teller: 'place.maseskar.keeper', drawing: 'rope-wad',
  story: S('In 1873 two signal cannons on carriages were set up at Måseskär to warn ships in fog; a coal-fired steam siren replaced them in the mid-1880s.', ['history-start-area.md (sv.wikipedia Måseskär)'], 'medium'),
});
A('clay-pipe-ship-initial', 'White clay pipe, stamped with a ship\'s initial', 'common', '1800s', ['1950'], {
  lore: { place: 'village:Käringön', index: 0 }, foundVia: ['secret.karingon.boys-loft'], drawing: 'pipe',
  story: S('Clay pipes are recorded as finds on this coast (RAÄ L1960:5596); this one\'s ship initial is our invention.', ['lore:village:Käringön artifacts[0] (RAÄ L1960:5596)'], 'low'),
});
A('rice-sack-stencil-paula', 'Rice-sack stencil from the Paula', 'rare', '1872', ['1950'], {
  lore: { place: 'village:Käringön', index: 1 }, foundVia: ['secret.karingon.boys-loft'], teller: 'place.karingon.pilot-lotsberget', drawing: 'stencil',
  story: S('The bark Paula was wrecked on the rocks near Käringön in the November storm of 1872, which is why they are called Paulapallarna. Eight hundred sacks of her rice were auctioned on 12 November 1872.', ['lore:village:Käringön facts (RAÄ L1960:6080)'], 'medium'),
  leadsTo: { quest: null, hook: 'ask the Käringön pilot who bought the rice, and where the rest of the Paula\'s cargo went' },
});
A('mackerel-tin-ship-label', 'Mackerel tin with a painted ship label', 'common', '1950', ['1950'], {
  lore: { place: 'village:Gullholmen', index: 1 }, givenBy: ['place.gullholmen.cannery-woman'], drawing: 'tin',
  story: S('Gullholmen\'s cannery packed fish in tins; it was rebuilt in 1938-39 and again in 1950-52, and girls started there after confirmation.', ['people:Q02', 'people:Q03'], 'medium'),
});
A('wheel-spoke-brass-capped', 'Ship\'s wheel spoke, brass-capped', 'uncommon', '1860', ['1950'], {
  lore: { place: 'relation/10604591', index: 0 }, givenBy: ['place.gaso.retired-skipper'], teller: 'place.gaso.retired-skipper', drawing: 'wheel-spoke',
  story: S('After the great herring period Gåsö became a skipper community: about 20 larger sailing ships in 1860, until steamships ended it.', ['lore:relation/10604591 (SVW-gaso)'], 'medium'),
});
A('stoneware-shard-blue-band', 'Stoneware shard with a blue band', 'common', '1800s', ['1950'], {
  lore: { place: 'relation/10094463', index: 0 }, foundAt: ['relation/10094463'], drawing: 'shard',
  story: S('Train-oil boileries and salteries were built on Stora Kornö in the 1790s herring boom (1791 and 1798-99); fishing and freight carried the island\'s economy.', ['lore:relation/10094463 (SVW-korno)'], 'medium'),
});
A('lantern-glass-cracked', 'Ship\'s-lantern glass, cracked', 'common', '1900s', ['1950'], {
  lore: { place: 'village:Fiskebäckskil', index: 0 }, foundAt: ['village:Fiskebäckskil'], drawing: 'lantern-glass',
  story: S('Fiskebäckskil was a skipper community with the largest freight fleet in Bohuslän in the 1800s, and a bath resort from 1867.', ['lore:village:Fiskebäckskil (SVW-fbk)'], 'medium'),
});
A('sextant-case-empty', 'Shipmaster\'s brass sextant case, empty', 'uncommon', '1880s', ['1950'], {
  lore: { place: 'village:Fiskebäckskil', index: 1 }, givenBy: ['place.fiskebackskil.shipmaster-bench'], teller: 'place.fiskebackskil.shipmaster-bench', drawing: 'case',
  story: S('Fiskebäckskil was a skipper community with the largest freight fleet in Bohuslän in the 1800s; the sextant case itself is our invention.', ['lore:village:Fiskebäckskil (SVW-fbk)'], 'medium'),
  leadsTo: { quest: null, hook: 'ask the shipmaster where the sextant went, and whose it was' },
});
A('mackerel-tin-bovik', 'Mackerel tin, Bovik label', 'common', '1950', ['1950'], {
  lore: { place: 'village:Grundsund', index: 0 }, givenBy: ['place.grundsund.cutter-skipper'], drawing: 'tin',
  story: S('Grundsund had a Bovik cannery that packed mackerel in tomato sauce (undated), and fished mackerel with English-built cutters from the early 1900s.', ['lore:village:Grundsund (W1950, SVW-grundsund)'], 'medium'),
});
A('seine-cork-float', 'Seine-net cork float', 'common', '1900s', ['1950'], {
  lore: { place: 'village:Grundsund', index: 1 }, foundVia: ['drift.cork-float'], drawing: 'float',
  story: S('Grundsund grew on its herring and mackerel fisheries; by 1920 it was Bohuslän\'s largest fishing village.', ['lore:village:Grundsund', 'people:Q13'], 'medium'),
});
A('skandia-engine-plate', 'Skandia engine builder\'s plate', 'uncommon', '1920s-1950', ['1950'], {
  lore: { place: 'village:Lysekil', index: 0 }, givenBy: ['place.lysekil.engine-fitter'], teller: 'place.lysekil.engine-fitter', drawing: 'plate',
  story: S('Lysekils Mekaniska Verkstad (founded 1899) made the Skandia hot-bulb engines; they were made in Lysekil until 1966.', ['lore:village:Lysekil (W1950)', 'people:P11'], 'high'),
});
A('keepers-logbook-islandsberg', 'Keeper\'s logbook, last pages blank', 'rare', '1883-1938', ['1950'], {
  lore: { place: 'light:Islandsberg', index: 0 }, foundVia: ['secret.islandsberg.keepers-logbook'], givenBy: ['place.islandsberg.family'], drawing: 'logbook',
  story: S('Islandsberg\'s light was manned from 1883 to 1938; its old keeper\'s-house light went dark in 1938 and an automatic tower 425 m north took over.', ['lore:light:Islandsberg (SVW-islandsberg, W1950)'], 'high'),
  leadsTo: { quest: null, hook: 'the blank pages are not blank under a lamp: what did the last keeper write down?' },
});
A('feldspar-chunk', 'Feldspar chunk, pink and glassy', 'common', '1900s', ['1950'], {
  lore: { place: 'relation/5463706', index: 0 }, foundVia: ['secret.harmano.feldspar-stack'], drawing: 'rock',
  story: S('Feldspar was quarried at Höpallen and Stenvik on Härmanö until about 1950.', ['lore:relation/5463706 (W1950, HSA)', 'history-start-area.md'], 'high'),
});
A('svecia-anchor-shackle', 'Brass stock-anchor shackle from the Svecia', 'rare', '1924', ['1950'], {
  lore: { place: 'relation/5463706', index: 1 }, givenBy: ['place.harmano.quarryman'], teller: 'place.harmano.quarryman', drawing: 'shackle',
  story: S('The Svecia was wrecked in 1926 off Härmanö; Danish scrap divers are recorded working the wreck (RAÄ L1960:6452).', ['lore:relation/5463706 (RAÄ L1960:6452)'], 'medium'),
  leadsTo: { quest: null, hook: 'the rudder is said to be still standing on the bottom off the huvud: find where' },
});
A('caulking-mallet', 'Shipwright\'s caulking mallet', 'common', '1900s', ['1950'], {
  lore: { place: 'village:Hälleviksstrand', index: 0 }, givenBy: ['place.hallevik.shipwright'], drawing: 'mallet',
  story: S('Caulking ("driva") drives tarred yarn into the seams of carvel hulls and decks; Hälleviksstrand\'s boatyard dates from 1907.', ['people:P14', 'lore:village:Hälleviksstrand'], 'medium'),
});
A('acetylene-valve-washer', 'Acetylene valve washer, brass', 'common', '1938', ['1950'], {
  lore: { place: 'light:Hättan', index: 0 }, foundAt: ['light:Hättan'], drawing: 'washer',
  story: S('AGA\'s automatic lights run on acetylene: a flasher valve (1905) makes the flashes and a sun valve (1907) lights the lamp at dusk and puts it out at dawn.', ['people:G04', 'people:G05'], 'medium'),
});
A('sheep-shears-rusted', 'Sheep-shearing shears, rusted open', 'common', '1900s', ['1950'], {
  lore: { place: 'relation/10237443', index: 0 }, givenBy: ['place.fredagsholmen.sheep-farmer'], drawing: 'shears',
  story: S('A light has stood on Fredagsholmen since 1883, a prefab wooden light house with an eight-day paraffin lamp.', ['lore:relation/10237443 (fyr.org)'], 'medium'),
});
A('mason-chisel-stump', 'Mason\'s chisel, worn to a stump', 'common', '1900s', ['1950'], {
  lore: { place: 'relation/10238557', index: 0 }, foundVia: ['secret.torno.mason-block'], givenBy: ['place.torno.quarryman-dora'], drawing: 'chisel',
  story: S('Granite quarrying and stonemasonry were among Lysekil\'s industries between 1850 and 1950, and five quarries were working in 1909.', ['lore:village:Lysekil (W1950)'], 'medium'),
});
A('oil-jar-shard', 'Stoneware oil-jar shard', 'common', '1700s-1800s', ['1950'], {
  lore: { place: 'relation/7455712', index: 0 }, foundVia: ['secret.lavon.sludge-pond'], drawing: 'shard',
  story: S('A train-oil boilery site is recorded in Morlanda parish that matches "Lavön": 130 by 70 m with a sludge pond and five house foundations. Not confirmed to be on the island.', ['lore:relation/7455712 (RAÄ L1968:1956)'], 'low'),
});
A('freya-ships-bell', 'Ship\'s bell, green with age', 'rare', '1924', ['1950'], {
  lore: { place: 'relation/10250169', index: 0 }, foundVia: ['secret.harpo.ships-bell'], teller: 'place.harpo.long-liner', drawing: 'bell',
  story: S('The Freya, a coal and coke carrier, was lost near Stora Harpö in 1940; salvage was judged too hard, and the old fishermen know where she lies from their snagged lines.', ['lore:relation/10250169 (RAÄ L1960:6443)'], 'medium'),
  leadsTo: { quest: 'quest.buoy-the-freya', hook: null },
});
A('linseed-cake-fragment', 'Linseed-cake fragment, hard as stone', 'common', '1878', ['1950'], {
  lore: { place: 'relation/11020202', index: 0 }, foundVia: ['secret.silleskar.linseed-cask'], drawing: 'cake',
  story: S('Silleskär ("herring skerry") has one recorded event: a ship stranded on it in 1878 (RAÄ L1960:5700). That the cargo was linseed cake is our invention.', ['lore:relation/11020202 (RAÄ L1960:5700)'], 'medium'),
});
A('marine-paint-tin-red', 'Tin of red marine paint, dried solid', 'common', '1900s', ['1950'], {
  lore: { place: 'relation/10237897', index: 0 }, givenBy: ['place.jamningarna.pilot'], drawing: 'paint-tin',
  story: S('Two white stone cairns with painted belts, Jämningarna and Byxeskären, guide ships in from the sea to Lysekil\'s western inlet.', ['lore:relation/10237897'], 'high'),
});
A('granite-chip-stangholmen', 'Granite chip, polished by the waves', 'common', 'natural', ['1950', 'today'], {
  lore: { place: 'relation/10237903', index: 0 }, foundAt: ['relation/10237903', 'light:Stångehuvud'], drawing: 'stone',
  story: S('The red Bohus granite of Stångehuvud formed about 920 million years ago; its rounded shapes come from the melting ice sheet.', ['sv.wikipedia Stångehuvuds naturreservat'], 'medium'),
});
A('granite-chisel-mark-sample', 'Granite sample with a Berlin firm\'s chisel mark', 'uncommon', '1890s', ['1950'], {
  lore: { place: 'light:Stångehuvud', index: 0 }, foundVia: ['secret.stangehuvud.pedestal-stone'], givenBy: ['place.stangehuvud.retired-quarryman'], teller: 'place.stangehuvud.retired-quarryman', drawing: 'stone-sample',
  story: S('A Berlin firm, Kessel & Röhl, quarried Stångehuvud from the early 1870s; the works were sold in 1904.', ['stangehuvud.se (via lore:light:Stångehuvud)'], 'medium'),
  note: 'The lore lists "found today" only; the quarry waste lay on the headland in 1950 too (the quarry closed in 1904), so foundEra here is 1950.',
});

// ---- derived from the drift finds (invented objects; the stories are plain and flagged invented) --------------------------
A('fish-box-stencil-board', 'End board of a fish box, stencilled with a port', 'common', '1940s', ['1950'], {
  foundVia: ['drift.fish-box'], drawing: 'box-board', refs: ['things:drift.fish-box'],
  story: I('Fish boxes were stencilled with the home port so they came back to the right quay.'),
});
A('oar-with-name-burned-in', 'Oar with a name burned into the loom', 'common', '1940s', ['1950'], {
  foundVia: ['drift.oar'], drawing: 'oar', refs: ['things:drift.oar'],
  story: I('A name burned into the loom meant the oar could be sent home from wherever it washed up.'),
});
A('green-glass-float', 'Green glass net float', 'uncommon', '1930s', ['1950'], {
  foundVia: ['drift.glass-float'], drawing: 'glass-float', refs: ['things:drift.glass-float'],
  story: I('Glass floats carried a net\'s line; some drifted far from the net they were made for.'),
});
A('bottle-with-note', 'Bottle with a damp note', 'uncommon', '1940s', ['1950'], {
  foundVia: ['drift.bottle'], drawing: 'bottle', refs: ['things:drift.bottle'],
  story: I('A note in a bottle: who wrote it, and where, is for a rumour or a quest to say.'),
  leadsTo: { quest: null, hook: 'the note names a place on the chart' },
});
A('crate-lid-stencil', 'Crate lid, stencilled with a ship\'s name', 'uncommon', '1940s', ['1950'], {
  foundVia: ['drift.crate-stencilled'], drawing: 'crate-lid', refs: ['things:drift.crate-stencilled'],
  story: I('After a blow a ship may lose deck cargo; the stencil says whose.'),
  leadsTo: { quest: null, hook: 'find which ship the crate came from' },
});
A('barrel-stave-cooper-mark', 'Barrel stave with a cooper\'s mark', 'common', '1900s', ['1950'], {
  foundVia: ['drift.barrel'], drawing: 'stave', refs: ['things:drift.barrel'],
  story: I('Coopers branded their barrels; the mark tells where the barrel was made.'),
});

// Lore artifacts deliberately NOT made (the test pins this list and the reasons).
export const HELD_BACK = {
  'light:Måseskär#1': 'brass gear wheel: this is unique candidate 3 (the clockwork pinion) in UNIQUE-ARTIFACT-CANDIDATES.md; Felix places it',
  'village:Gullholmen#0': 'oak treenail from the harbour wreck: the same wreck as unique candidate 7 (the Tordenskjold plank); held so Felix can choose',
  'relation/10250201#0': 'Anna Maria chain link: unique candidate 14',
  'light:Gäven#0': 'iron ring from the pole mark: unique candidate 13',
  'light:Kråksundsgap Södra#0': 'brass lantern plate 1954: unique candidate 1 and the lore itself says rarity unique',
  'relation/10239114#0': 'pilot-boat nameboard 1939: the lore finds it only "today"; a boat in service in 1950 cannot be found as an artifact in 1950',
};
