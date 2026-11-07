// Thing tables, people half: generic people and the per-place regulars and secrets. Every per-place template links to its island-lore.json hook.
// Edit here, then regenerate (README.md). Imported by build.mjs after things-nature.mjs.
import { add, src } from './things-nature.mjs';

const DAY = ['morning', 'midday', 'afternoon'];
const NOT_NIGHT = ['dawn', 'morning', 'midday', 'afternoon', 'dusk'];

// A regular from island-lore.json (hook "regulars"). o: place + idx (the lore hook it grows from), at (where it actually stands, when that
// differs from the lore place), anchor, spot, personality, hail, ...
function reg(slug, name, o) {
  add({
    id: `place.${slug}`, name, category: 'people', years: o.years || [1948, 1953],
    where: { anchor: o.anchor || 'village', places: [o.at || o.place, ...(o.more || [])], spot: o.spot },
    density: { chance: 1, cap: 1, areaM: 300 },
    when: o.when || { timeOfDay: DAY },
    routine: o.routine, movement: o.move || 'stationary',
    personality: o.personality,
    lines: { hail: o.hail, ...(o.hailAfter ? { hailAfter: o.hailAfter } : {}) },
    offers: o.offers || ['rumour'],
    tap: o.tap || { effect: 'hail', reach: 'medium', line: o.hail },
    approach: o.approach || { effect: 'wave-back' },
    anchored: o.anchored,
    sighting: { kind: 'people', line: o.sight, drawing: o.drawing || 'person' },
    rarity: o.rarity || 'common',
    source: src(o.kind || 'grounded', [`lore:${o.place}#regulars[${o.idx}]`, ...(o.refs || [])], o.srcNote || 'the role is an INVENTED regular from island-lore.json; the lines are INVENTED-DIALOGUE for Felix to rewrite'),
    lore: { place: o.place, hook: 'regulars', index: o.idx },
    ...(o.storyOwned ? { storyOwned: true } : {}),
    ...(o.note ? { note: o.note } : {}),
  });
}
// A secret from island-lore.json (hook "secrets"): found by looking close from an anchored boat, or told by a warm regular.
function sec(slug, name, o) {
  add({
    id: `secret.${slug}`, name, category: 'secret', years: o.years || [1930, 1990],
    where: { anchor: o.anchor || 'skerry', places: [o.place, ...(o.more || [])], spot: o.spot,
      rule: o.storyOwned ? 'story-owned: not placed by the engine' : (o.requires ? 'revealed by a regular once they like you; otherwise nothing to see' : 'one per place; noticed by looking close from an anchored boat') },
    density: { chance: 1, cap: 1, areaM: 300 },
    when: o.when || {},
    routine: o.routine, movement: 'stationary',
    ...(o.requires ? { requires: o.requires } : {}),
    tap: o.tap || { effect: 'look-closer', reach: 'medium', line: o.look },
    approach: o.approach, anchored: o.anchored || { effect: 'look-closer', line: o.look },
    sighting: { kind: o.kind || 'places', line: o.sight, drawing: o.drawing || 'detail' },
    rarity: o.rarity || 'uncommon',
    source: src(o.srcKind || 'grounded', [`lore:${o.place}#secrets[${o.idx}]`, ...(o.refs || [])], o.srcNote || 'the secret is an INVENTED hook from island-lore.json'),
    lore: { place: o.place, hook: 'secrets', index: o.idx },
    ...(o.storyOwned ? { storyOwned: true } : {}),
    ...(o.note ? { note: o.note } : {}),
  });
}

// ---------------------------------------------------------------------------------------------------------------
// GENERIC PEOPLE (not tied to one place)
// ---------------------------------------------------------------------------------------------------------------
add({
  id: 'people.fisherman-out-at-dawn', name: 'A fisherman out at dawn, home at dusk', category: 'people', years: [1940, 1959],
  where: { anchor: 'harbour', places: ['village:Grundsund', 'village:Gullholmen', 'village:Fiskebäckskil', 'village:Käringön'], rule: 'leaves the home harbour at first light and returns at dusk with gulls behind' },
  density: { chance: 0.7, cap: 4, areaM: 600 },
  when: { timeOfDay: ['dawn', 'dusk'] }, routine: 'Out through the gap at dawn, working the grounds, home at dusk with the catch and a cloud of gulls.', movement: 'commute',
  personality: 'gruff', lines: { hail: 'Birds are working off the point. Go and see.' }, offers: ['rumour'],
  tap: { effect: 'hail', reach: 'large', line: 'Birds are working off the point. Go and see.' }, approach: { effect: 'wave-back' },
  sighting: { kind: 'boats', line: 'A fishing boat heading out of {place} at first light, gulls already behind her.', drawing: 'fishing-boat' },
  source: src('grounded', ['docs/ALIVE-SEA.md day/night grill 5: "fishermen out at dawn, home at dusk"', 'people:Q03,Q04 (Grundsund and Gullholmen fishing families)'], 'the rhythm is a settled design rule; the lines are INVENTED'),
});
add({
  id: 'people.pot-hauler', name: 'A fisherman hauling pots', category: 'people', years: [1940, 1959],
  where: { anchor: 'skerry', rule: 'beside a line of pot floats along a rocky shore' },
  density: { chance: 0.5, cap: 2, areaM: 500 },
  when: { season: ['autumn'], timeOfDay: ['dawn', 'morning'] }, routine: 'Standing in a small boat, hauling pot after pot hand over hand, tipping crabs into a tub.', movement: 'stationary',
  personality: 'gruff', lines: { hail: 'Keep your wash off my floats, will you.' }, offers: ['rumour'],
  tap: { effect: 'hail', reach: 'medium', line: 'Keep your wash off my floats, will you.' }, approach: { effect: 'shout', line: 'Slow down! Pots!' },
  sighting: { kind: 'boats', line: 'A man hauling pots at {place}. Went slow past.', drawing: 'pot-hauler' },
  source: src('invented', ['docs/ALIVE-SEA.md: "fishermen shout if you sail through"'], 'not researched for 1950; autumn lobster season to be checked'),
});
add({
  id: 'people.long-line-crew', name: 'Two small boats setting long lines', category: 'people', years: [1940, 1959],
  where: { anchor: 'open-water', rule: 'a big boat at anchor on the bank with two small boats rowing away from it paying out line' },
  density: { chance: 0.15, cap: 1, areaM: 800 },
  when: { timeOfDay: ['dawn', 'morning'] }, routine: 'The small boats row out and back, setting and hauling the line while the big boat waits.', movement: 'patrol',
  personality: 'chatty', lines: { hail: 'Mind the line! Pass astern of us, there\'s a good lad.' }, offers: ['rumour'],
  tap: { effect: 'hail', reach: 'large', line: 'Mind the line! Pass astern of us, there\'s a good lad.' }, approach: { effect: 'shout', line: 'Astern! Astern of us!' },
  sighting: { kind: 'boats', line: 'Long-liners setting line off {place}, two dories and the mother boat.', drawing: 'dory' },
  source: src('researched', ['people:Q17 (long-line fishing, storbacka: set from the small boat while the big boat lay at anchor on the bank)']),
  note: 'The method is sourced (people:Q17); the lines are INVENTED-DIALOGUE.',
});
add({
  id: 'people.pilot-boat', name: 'The pilot boat heading out', category: 'people', years: [1939, 1960],
  where: { anchor: 'harbour', places: ['village:Lysekil', 'relation/10239114'], rule: 'a pilot boat leaves the pilot station to meet an inbound ship in the outer approaches' },
  density: { chance: 0.4, cap: 1, areaM: 1200 },
  when: { timeOfDay: DAY.concat(['dawn']) }, routine: 'Out from the pilot station at speed, a man standing in the stern, to meet a ship; back an hour later.', movement: 'commute',
  personality: 'gruff', lines: { hail: 'Ship due off Måseskär. Clear the fairway.' }, offers: ['rumour'],
  tap: { effect: 'toot-back', reach: 'large' }, approach: { effect: 'toot-back', line: 'One short blast: it means thank you, and keep clear.' },
  sighting: { kind: 'boats', line: 'The pilot boat running out of {place} to meet a ship.', drawing: 'pilot-boat' },
  rarity: 'uncommon',
  source: src('grounded', ['lore:relation/10239114 (Käringön pilot station: staffed in 1950, new pilot boat 1939, closed 1960)', 'lore:village:Lysekil (pilot station from the early 1700s)'], 'stations and the 1939 boat are sourced in the lore (lotsarnastockholm.se, medium); the moment is INVENTED'),
});
add({
  id: 'people.summer-swimmers', name: 'Swimmers and children diving from the rocks', category: 'people', years: [1900, 2030],
  where: { anchor: 'island', places: ['village:Fiskebäckskil', 'relation/10604591', 'village:Hälleviksstrand'], rule: 'smooth rocks near a summer-guest village or hotel; shrieks carry across the water' },
  density: { chance: 0.6, cap: 3, areaM: 300 },
  when: { season: ['summer', 'late-summer'], timeOfDay: ['midday', 'afternoon'], dayType: ['fine-sea-breeze'] }, routine: 'A line of children, one after another off the same rock, with a cold shriek each.', movement: 'stationary',
  personality: 'chatty', lines: { hail: 'Watch this! Watch! Did you see?' }, offers: [],
  tap: { effect: 'wave-back', reach: 'medium', line: 'Watch this! Watch! Did you see?' }, approach: { effect: 'wave-back', line: 'They wave madly and dive again, harder.' },
  sighting: { kind: 'people', line: 'Children diving off the rocks by {place}. I waved.', drawing: 'swimmers' },
  source: src('grounded', ['people:Q10 (Fiskebäckskil a bath resort from the late 1800s, mainly a summer resort in the 1900s)', 'lore:relation/10604591 (Gåsö: bath resort)'], 'the setting is sourced; the scene is INVENTED'),
});
add({
  id: 'people.rowing-guests', name: 'Summer guests out rowing', category: 'people', years: [1900, 2030],
  where: { anchor: 'island', places: ['village:Fiskebäckskil', 'relation/10604591'], rule: 'a hired rowing boat with a family aboard, rowing in circles near the guest houses' },
  density: { chance: 0.5, cap: 2, areaM: 400 },
  when: { season: ['summer'], timeOfDay: ['morning', 'afternoon'] }, routine: 'One rows, three advise; the boat goes in slow arcs.', movement: 'patrol',
  personality: 'chatty', lines: { hail: 'Is it far to the lighthouse? Is that the lighthouse?' }, offers: ['rumour'],
  tap: { effect: 'hail', reach: 'medium', line: 'Is it far to the lighthouse? Is that the lighthouse?' }, approach: { effect: 'wave-back' },
  sighting: { kind: 'people', line: 'Summer guests rowing in slow arcs off {place}.', drawing: 'rowing-boat' },
  source: src('grounded', ['people:Q10 (summer guests at Fiskebäckskil)', 'docs/ALIVE-SEA.md: "Summer guests: rowing boats"'], 'INVENTED scene'),
});
add({
  id: 'people.snipa-racer', name: 'A local snipa that wants a race', category: 'people', years: [1940, 1959],
  where: { anchor: 'open-water', rule: 'a clinker snipa edging up alongside near a village, on a fine breezy day; the race is to the harbour mouth' },
  density: { chance: 0.1, cap: 1, areaM: 900 },
  when: { dayType: ['fine-sea-breeze'], timeOfDay: ['midday', 'afternoon'] }, routine: 'Sails parallel for a minute, sizing you up, then edges ahead.', movement: 'patrol',
  personality: 'chatty', lines: { hail: 'Race you to the harbour! Loser buys the buns.' }, offers: [],
  tap: { effect: 'race-invite', reach: 'large', line: 'Race you to the harbour! Loser buys the buns.' }, approach: { effect: 'race-invite' },
  sighting: { kind: 'boats', line: 'Raced a snipa in to {place}. Close.', drawing: 'snipa' },
  rarity: 'uncommon', source: src('invented', ['docs/ALIVE-SEA.md: "A local snipa edges alongside and races you to the harbour"']),
});
add({
  id: 'people.the-boy', name: 'The boy (young Grandpa), Grundsund boatyard', category: 'people', years: [1950, 1950],
  where: { anchor: 'village', places: ['village:Grundsund'], spot: 'the yard beach' },
  density: { chance: 1, cap: 1, areaM: 300 }, routine: 'Story-owned: lends the eka, sends you to Grundsund, then to Britta.', movement: 'stationary',
  personality: 'shy', lines: { hail: '(story-owned: lines live in src/story-1950.js)' }, offers: ['errand'],
  sighting: { kind: 'people', line: 'The boatbuilder\'s boy at {place}.', drawing: 'person' },
  source: src('grounded', ['GAME-DESIGN.md story canon (the boy = young Grandpa, a boatbuilder\'s son)', 'docs/MISSION-CONTROL.md section 3'], 'hand-placed by the story; a stub so quests can name him as giver'),
  storyOwned: true,
});
add({
  id: 'people.britta', name: 'Britta, Fiskebäckskil', category: 'people', years: [1950, 1950],
  where: { anchor: 'village', places: ['village:Fiskebäckskil'], spot: 'her jetty' },
  density: { chance: 1, cap: 1, areaM: 300 }, routine: 'Story-owned: about 17, a fisherman\'s daughter; her father tends the lights and has a broken arm; her family\'s shed holds the gas tanks.', movement: 'stationary',
  personality: 'chatty', lines: { hail: '(story-owned: lines live in src/story-1950.js)' }, offers: ['errand'],
  sighting: { kind: 'people', line: 'Britta on her jetty at {place}.', drawing: 'person' },
  source: src('grounded', ['GAME-DESIGN.md story canon', 'lore:village:Fiskebäckskil#regulars[0] and secrets[0] (the shed holding the gas tanks, canon)'], 'hand-placed by the story; a stub so quests can name her as giver'),
  lore: { place: 'village:Fiskebäckskil', hook: 'regulars', index: 0 }, storyOwned: true,
});

// ---------------------------------------------------------------------------------------------------------------
// PER-PLACE: Måseskär
// ---------------------------------------------------------------------------------------------------------------
reg('maseskar.keeper', 'The keeper of Måseskär', { place: 'light:Måseskär', idx: 0, anchor: 'light', spot: 'the gallery or the landing', personality: 'gruff',
  hail: 'Fog gun\'s tested. Lamp\'s trimmed. State your business.', years: [1950, 1950], when: { timeOfDay: NOT_NIGHT.concat(['night']) }, offers: ['rumour', 'errand'],
  routine: 'Story-owned. Trims the lamp, polishes the lens, winds the clockwork weight, keeps the log to the minute (people:M06); night watch.',
  sight: 'The keeper on Måseskär, watching us come in.', refs: ['people:M01', 'people:M06', 'people:M14'], storyOwned: true, rarity: 'uncommon',
  srcNote: 'hand-placed by the story (no 1950 keeper is named in any source: people:M02); the lines are INVENTED-DIALOGUE', note: 'storyOwned: the placement engine never spawns him.' });
reg('maseskar.assistant', 'The keeper\'s assistant, rowing the supply boat', { place: 'light:Måseskär', idx: 1, anchor: 'light', spot: 'the landing', personality: 'chatty',
  hail: 'Any news from the mainland? Anything at all?', move: 'commute', rarity: 'uncommon', offers: ['rumour', 'errand'],
  routine: 'Rows or runs the station motor boat to Käringön for post, shop and school, three or four times a month (people:M03); talks the whole way.',
  sight: 'The keeper\'s assistant, out in the supply boat toward Käringön.', refs: ['people:M03'], srcNote: 'the role is an INVENTED regular; the supply rhythm is sourced (people:M03)' });
reg('maseskar.wife', 'The keeper\'s wife, hanging the wash', { place: 'light:Måseskär', idx: 2, anchor: 'light', spot: 'the stone-walled plots', personality: 'shy',
  hail: 'Mind the rock at the landing. It is greasy in the morning.', when: { timeOfDay: ['morning', 'midday'] }, offers: [],
  routine: 'Pegs out sheets on the lee side of the plot walls; her washing can be seen from the sea.',
  sight: 'Washing on a line on Måseskär, a speck of white on the rock.', drawing: 'washing', kind: 'grounded' });
sec('maseskar.second-book', 'The keeper\'s second book of lights', { place: 'light:Måseskär', idx: 0, anchor: 'light', storyOwned: true, rarity: 'rare',
  requires: { regular: 'place.maseskar.keeper', warmth: 'warm' }, routine: 'Story-owned. A second book beside the log, where he writes lights that should not be there, with the date and the bearing.',
  look: '(story-owned: told by the keeper in his scene)', sight: 'The keeper keeps a second book. He did not say what is in it.', drawing: 'book',
  refs: ['GAME-DESIGN.md canon: Måseskär\'s keeper hints about a light that should not be there'], srcNote: 'INVENTED, canon-grounded. This is unique candidate 2 in UNIQUE-ARTIFACT-CANDIDATES.md: no artifact is created here.',
  note: 'storyOwned; links to unique candidate 2, which Felix places.' });
sec('maseskar.signal-cannon', 'The old signal cannon', { place: 'light:Måseskär', idx: 1, anchor: 'light', spot: 'by the engine house', routine: 'A black iron cannon on a carriage, lashed down; the fog gun of 1873.',
  look: 'One of the two 1873 fog cannons, still lashed to its carriage. The keeper says it holds a charge of damp powder "just in case".', sight: 'An old iron cannon by the engine house on {place}.', drawing: 'cannon',
  refs: ['history-start-area.md: 1873 two signal cannons installed for fog, replaced by a steam siren in the mid-1880s'], rarity: 'uncommon',
  srcNote: 'the cannons are sourced (sv.wikipedia Måseskär, medium); the damp powder is an INVENTED detail' });

// ---------------------------------------------------------------------------------------------------------------
// Käringön (the village row and the island row)
// ---------------------------------------------------------------------------------------------------------------
reg('karingon.pilot-lotsberget', 'A pilot ashore on Lotsberget', { place: 'village:Käringön', idx: 0, anchor: 'village', spot: 'Lotsberget, the pilots\' hill', personality: 'gruff',
  hail: 'The rocks outside are famous. So are we. Don\'t test either.', offers: ['rumour'], when: { timeOfDay: NOT_NIGHT },
  routine: 'Sits on the hill with a pipe and a glass, watching the approaches.', sight: 'A pilot on Lotsberget at {place}, glass up.', drawing: 'pilot',
  refs: ['lore:relation/10239114 (an 1804 report: the rocks outside are as famous for wrecks as the pilots are for skill)'], srcNote: 'INVENTED regular; the line paraphrases a sourced 1804 report in the lore' });
reg('karingon.net-mender-quay', 'A net-mender on the Käringön quay', { place: 'village:Käringön', idx: 1, anchor: 'berth', spot: 'the quay', personality: 'chatty',
  hail: 'The storm took half the floats on this coast. Find any, you bring them here.', offers: ['rumour', 'errand'],
  routine: 'Unhurried; a net across her knees, a needle going, remembers every storm.', sight: 'A net-mender on the quay at {place}, not looking up until we spoke.', drawing: 'net-mender',
  refs: ['people:Q09'] });
reg('karingon.rescue-volunteer', 'A rescue-station volunteer', { place: 'village:Käringön', idx: 2, anchor: 'berth', spot: 'the rescue station slip', personality: 'gruff',
  hail: 'Late out. Got a bailer? A light? Good. Off you go, then.', when: { timeOfDay: ['afternoon', 'dusk'] }, offers: ['rumour'],
  routine: 'Checks every boat that leaves late in the day; kindly, and without saying so.', sight: 'The rescue volunteer at {place} checking boats going out late.', drawing: 'person',
  refs: ['vastsverige.com: Swedish Sea Rescue Society station on Käringön (low, via lore)'], rarity: 'uncommon' });
sec('karingon.boys-loft', 'A boy\'s collection from the wrecks', { place: 'village:Käringön', idx: 0, anchor: 'berth', spot: 'a boathouse loft', rarity: 'uncommon',
  requires: { regular: 'place.karingon.net-mender-quay', warmth: 'friendly' },
  routine: 'A boy keeps what the sea has given: a brass porthole, a rice-sack stencil, a clay pipe.',
  look: 'A boy leans out of the loft door: "Want to see? This is from the Paula."', sight: 'A boy at {place} showed us what he has fished up from the wrecks.', drawing: 'porthole', kind: 'finds',
  refs: ['ISLAND-LORE.md: the bark Paula, wrecked 1 Nov 1872, gave Paulapallarna its name (medium)'], srcNote: 'the collection is an INVENTED hook; the Paula wreck is sourced' });
reg('karingon-island.pilots-widow', 'The pilot\'s widow in the lookout window', { place: 'relation/10239114', idx: 0, anchor: 'island', spot: 'the Lotsutkiken lookout window', personality: 'shy',
  hail: 'I keep the lamp lit for the ones still out. Habit, nothing more.', when: { timeOfDay: ['dusk', 'night'] }, rarity: 'uncommon', offers: ['rumour'],
  routine: 'A small lamp in the lookout window from dusk until the last boat is in.', sight: 'A lamp in the lookout window at {place}, lit for the boats still out.', drawing: 'lamp',
  refs: ['vastsverige.com: a small former pilot dwelling Lotsutkiken at the island\'s south-west tip (low, via lore)'], srcNote: 'INVENTED regular; the lookout house is in the lore (low)' });
reg('karingon-island.net-mender-north-pier', 'A net-mender on the north pier who knows every boat by its sound', { place: 'relation/10239114', idx: 1, anchor: 'berth', spot: 'the north pier', personality: 'chatty',
  hail: 'I heard you before I saw you. Engine\'s fine, sail\'s a bit loose.', offers: ['rumour'], approach: { effect: 'show', line: 'She calls your boat\'s name before you are in sight.' }, rarity: 'uncommon',
  routine: 'Hears each boat coming round the point and says whose it is without looking.', sight: 'A net-mender on the north pier at {place} named our boat by its sound.', drawing: 'net-mender' });

// ---------------------------------------------------------------------------------------------------------------
// Gullholmen, Gåsö, Stora Kornö
// ---------------------------------------------------------------------------------------------------------------
reg('gullholmen.long-line-fisherman', 'A long-line fisherman home from the Iceland grounds', { place: 'village:Gullholmen', idx: 0, anchor: 'harbour', spot: 'the harbour mouth', personality: 'chatty',
  hail: 'Iceland? Cold and honest. The sea there tells you what it thinks.', when: { timeOfDay: ['afternoon', 'dusk'], season: ['summer', 'late-summer'] }, offers: ['rumour', 'errand'],
  routine: 'Home after weeks away; coiling line on the quay and telling anyone who stops.', sight: 'A long-liner back from Iceland at {place}, still telling it.', drawing: 'fisherman', rarity: 'uncommon',
  refs: ['lore:village:Gullholmen (regular: a long-line fisherman home from the Iceland grounds)', 'ISLAND-LORE.md: Hälleviksstrand yard builds Iceland boats'] });
reg('gullholmen.cannery-woman', 'A cannery woman packing mackerel in tins', { place: 'village:Gullholmen', idx: 1, anchor: 'berth', spot: 'the quay by the cannery', personality: 'chatty',
  hail: 'Bring me mackerel and I\'ll bring you a tin with a ship on it.', offers: ['errand', 'rumour'],
  routine: 'Packs and seams tins on the quay; sings under her breath; offers a tin to anyone who helps.', sight: 'A cannery woman at {place} packing mackerel in tins.', drawing: 'cannery-woman',
  refs: ['people:Q02,Q03 (Gullholmen cannery: girls start after confirmation; rebuilt 1938-39 and 1950-52)'] });
reg('gullholmen.sketching-guest', 'A summer guest sketching the harbour', { place: 'village:Gullholmen', idx: 2, anchor: 'harbour', spot: 'a rented cottage porch above the harbour', personality: 'shy',
  hail: 'Oh, do keep sailing. You\'re better moving, honestly.', when: { season: ['summer'], timeOfDay: ['morning', 'afternoon'] }, offers: [], approach: { effect: 'show', line: 'She holds up the sketch for a second: your boat is in it.' }, rarity: 'uncommon',
  routine: 'Sits with a board on her knee; every boat that passes ends up in the drawing.', sight: 'A summer guest at {place} drew us into her sketch.', drawing: 'sketcher',
  refs: ['people:Q10 (summer guests)'] });
sec('gullholmen.saturday-argument', 'The old men and the harbour wreck', { place: 'village:Gullholmen', idx: 0, anchor: 'berth', spot: 'the quay bench', when: { timeOfDay: ['afternoon'] }, rarity: 'uncommon',
  routine: 'Every Saturday the old men argue about the wreck in the harbour; one swears he saw its stem when it was dredged in 1936.',
  look: 'A knot of old men on the quay, arguing with their hands.', sight: 'The old men at {place} arguing about the harbour wreck again.', drawing: 'old-men', kind: 'people',
  anchored: { effect: 'hail', line: 'One calls across: "Settle it for us! Tordenskiold, or not?"' },
  refs: ['Bohusläns museum rapport 2012:39 via lore: the wreck found in 1936; the museum rejects the Tordenskiold link'],
  srcNote: 'the wreck, the 1936 dredge and the legend are sourced (high, via lore); the Saturday argument is INVENTED' });

reg('gaso.retired-skipper', 'A retired skipper on his steps who names every sail', { place: 'relation/10604591', idx: 0, anchor: 'island', spot: 'his steps above the landing', personality: 'gruff',
  hail: 'Gaff cutter. No, don\'t tell me. Eight years a mate under sail, I can read a cut from here.', offers: ['rumour'], approach: { effect: 'show', line: 'He names your sail aloud as you pass, and is right.' },
  routine: 'Sits and names every sail by cut; has an opinion about each.', sight: 'A retired skipper on the steps at {place} named our sail from fifty metres.', drawing: 'skipper', rarity: 'uncommon',
  refs: ['lore:relation/10604591 (Gåsö: a skipper community, about 20 larger sailing ships in 1860)'] });
reg('gaso.rooms-girl', 'A girl whose family rents rooms to summer guests', { place: 'relation/10604591', idx: 1, anchor: 'island', spot: 'the guest-house steps', personality: 'shy',
  hail: 'Mamma asks if the post boat has come. It hasn\'t, has it?', offers: ['errand'], when: { season: ['summer'], timeOfDay: DAY },
  routine: 'Runs errands between the guest house and the landing; watches the water for the post boat.', sight: 'A girl at {place} watching for the post boat.', drawing: 'girl' });
reg('gaso.boarding-house-keeper', 'A boarding-house keeper hanging sheets over the rock', { place: 'relation/10604591', idx: 2, anchor: 'island', spot: 'the rock behind the boarding house', personality: 'gruff',
  hail: 'If that is the post boat I\'ll eat a sheet. Is it?', offers: ['errand', 'rumour'], when: { season: ['summer'], timeOfDay: ['morning', 'midday'] },
  routine: 'Hangs white sheets over the sun-warmed rock to dry; wars with the gulls.', sight: 'White sheets spread on the rock at {place} to dry.', drawing: 'washing' });
sec('gaso.vrakevik-wreck', 'The wreck behind Vrakevik', { place: 'relation/10604591', more: ['harbour:Vrakevik'], idx: 0, anchor: 'harbour', spot: 'the bay behind Vrakevik', rarity: 'rare',
  routine: 'The old men say a wreck lies in the bay: nobody has dived it, but nets catch on it.',
  look: 'A fisherman\'s net-float jerks and drags as if held from below.', sight: 'A net caught on something below, at {place}. The old men say it is a wreck.', drawing: 'net-snag', kind: 'finds',
  refs: ['lore:relation/10604590 (Vrakevik is a natural harbour at Gåsö sund; the origin of its name was not found)'], srcNote: 'the wreck is an INVENTED hook; "Vrakevik" is a real name in the name list. Do NOT present the wreck as the origin of the name: the origin was not found.' });

reg('korno.coaster-skipper', 'A coaster skipper loading stone blocks', { place: 'relation/10094463', idx: 0, anchor: 'island', spot: 'the pier', personality: 'gruff',
  hail: 'Stone for Göteborg. Don\'t block my gangplank.', move: 'commute', when: { timeOfDay: ['morning', 'midday', 'afternoon'] }, offers: ['rumour'],
  routine: 'Loads cut blocks from the pier by crane and hand; sails when the hold is full.', sight: 'A coaster loading stone blocks at {place}.', drawing: 'coaster',
  refs: ['people:Q10; ISLAND-LORE.md: Stora Kornö train-oil works 1791 and 1799, timber sea huts'], srcNote: 'INVENTED regular on an island with a real pier; the stone trade is not researched for Kornö' });
reg('korno.teacher', 'The schoolteacher who rows to Lysekil on Saturdays', { place: 'relation/10094463', idx: 1, anchor: 'island', spot: 'the school landing', personality: 'shy',
  hail: 'I row to Lysekil every Saturday. Today I am late.', offers: ['errand', 'rumour'], when: { timeOfDay: ['morning'] }, move: 'commute', rarity: 'uncommon',
  routine: 'Rows a small boat to Lysekil on Saturdays for the post and the bakery.', sight: 'The schoolteacher rowing for Lysekil from {place}.', drawing: 'rowing-boat' });
sec('korno.cave-loaf', 'Water and a loaf left in the cave', { place: 'relation/10094463', idx: 0, anchor: 'island', spot: 'the cave Klingkyrka', rarity: 'rare',
  routine: 'Someone leaves a bottle of water and a loaf in the cave, and takes the old ones away.',
  look: 'On a ledge inside the cave mouth: a bottle of water and a loaf in a cloth. Fresh.', sight: 'A loaf and water left in the cave at {place}. For whom?', drawing: 'loaf', kind: 'finds',
  refs: ['ISLAND-LORE.md: the cave Klingkyrka on Stora Kornö (no legend found)'], srcNote: 'the cave exists in the lore; the loaf and the mystery are INVENTED. Do not present it as a legend.' });

// ---------------------------------------------------------------------------------------------------------------
// Fiskebäckskil, Grundsund, Lysekil
// ---------------------------------------------------------------------------------------------------------------
reg('fiskebackskil.shipmaster-bench', 'A retired shipmaster on a bench on Kaptensgatan', { place: 'village:Fiskebäckskil', idx: 1, anchor: 'village', spot: 'a bench on Kaptensgatan', personality: 'chatty',
  hail: 'That sky wants a reef by noon. I\'m too old to be wrong about it.', offers: ['rumour'], when: { timeOfDay: DAY },
  routine: 'Reads the sky from a bench above the harbour and tells passers-by what it will do.', sight: 'An old shipmaster on a bench at {place}, reading the sky.', drawing: 'shipmaster',
  refs: ['people:Q10; lore:village:Fiskebäckskil (captains\' villas)'], srcNote: 'INVENTED regular; Fiskebäckskil\'s skipper community is sourced (sv.wikipedia)' });
reg('fiskebackskil.ferry-deckhand', 'A ferry deckhand who knows everyone\'s business', { place: 'village:Fiskebäckskil', idx: 2, anchor: 'berth', spot: 'the Lysekil ferry quay', personality: 'chatty',
  hail: 'The ferry\'s late again, and they say the lights are out since the storm.', offers: ['rumour', 'errand'], when: { timeOfDay: NOT_NIGHT },
  routine: 'Throws the line, takes the fare, hears everything on the crossing and repeats most of it.', sight: 'The ferry deckhand at {place}, passing on the news.', drawing: 'deckhand',
  refs: ['lore:village:Fiskebäckskil (the Lysekil ferry)'] });

reg('grundsund.cutter-skipper', 'A cutter skipper who talks about the English builders', { place: 'village:Grundsund', idx: 1, anchor: 'harbour', spot: 'the canal quay', personality: 'chatty',
  hail: 'English-built, she is. They knew how to make a boat in England. Mackerel are in.', move: 'commute', offers: ['rumour'], when: { timeOfDay: NOT_NIGHT },
  routine: 'Takes the cutter out for mackerel and back; will talk about her lines for as long as you stand there.', sight: 'A mackerel cutter at {place}, English-built, they say.', drawing: 'cutter',
  refs: ['sv.wikipedia Grundsund: many fishing cutters bought from England, mackerel fishing early 1900s (medium)'], srcNote: 'INVENTED regular; the English cutters and mackerel fishing are sourced' });
reg('grundsund.seamstress', 'A raincoat-factory seamstress on her break', { place: 'village:Grundsund', idx: 2, anchor: 'berth', spot: 'the quay by the factory', personality: 'shy',
  hail: 'Break is fifteen minutes. I spend it looking at the water.', when: { timeOfDay: ['midday'] }, offers: ['rumour'],
  routine: 'Sits on a crate in her apron with a cup, looking at the boats.', sight: 'A seamstress from the oilskin works at {place}, on her break.', drawing: 'seamstress',
  refs: ['lore:village:Grundsund (Didriksons began in Grundsund in 1913; Grundéns began oilskin clothes there in 1911; company-history pages, medium)'], srcNote: 'INVENTED regular; the rain-clothes industry is sourced' });
sec('grundsund.bonden-ball', 'The red ball on Bonden at sunset', { place: 'village:Grundsund', idx: 0, anchor: 'berth', spot: 'the quay', when: { timeOfDay: ['dusk'] }, rarity: 'uncommon',
  routine: 'At sunset the pole ball on the Bonden cairn catches the last light and glows red.', look: 'Far out west, a pinprick of red sits on the skerry at sunset.',
  sight: 'The ball on Bonden glowed red at sunset, seen from {place}.', drawing: 'red-ball', kind: 'lights', more: ['relation/10250201'],
  refs: ['ISLAND-LORE.md: Bonden, white 8 m cairn with pole and red ball (1875)'], srcNote: 'the cairn and ball are sourced; "it flashes red at sunset" is the old men\'s INVENTED saying' });

reg('lysekil.engine-fitter', 'A hot-bulb engine fitter with oil to his elbows', { place: 'village:Lysekil', idx: 1, anchor: 'berth', spot: 'the Skandia yard slip', personality: 'chatty',
  hail: 'Blowlamp on the head, wait for it to glow, swing the wheel. Thump. Never fails. Almost.', offers: ['rumour', 'errand'], when: { timeOfDay: DAY },
  routine: 'Working on a hot-bulb engine on its stand; blowlamp roaring.', sight: 'A Skandia engine fitter at {place}, up to the elbows in oil.', drawing: 'fitter',
  refs: ['people:P11 (Skandia hot-bulb engines made in Lysekil, founded 1899)'], srcNote: 'INVENTED regular; Skandia engines in Lysekil are sourced (people:P11)' });
reg('fiskebackskil.bath-house-attendant', 'The bath-house attendant sweeping the cold-bath jetty', { place: 'village:Lysekil', idx: 2, at: 'village:Fiskebäckskil', anchor: 'berth', spot: 'the cold-bath jetty', personality: 'shy',
  hail: 'The sea is eleven degrees. The guests insist. I only sweep.', when: { season: ['summer'], timeOfDay: ['morning'] }, offers: ['rumour', 'errand'],
  routine: 'Sweeps the planks and wipes the benches before the first bathers.', sight: 'The bath-house attendant sweeping the jetty at {place}.', drawing: 'attendant',
  refs: ['lore:village:Fiskebäckskil (a bath resort since 1867)', 'people:Q10 (Fiskebäckskil a bath resort from the late 1800s, mainly a summer resort in the 1900s)'],
  srcNote: 'INVENTED regular. The lore lists her as a Lysekil regular (regulars[2]); on Felix\'s call (2026-11-07) she stands at Fiskebäckskil, where the lore documents the bath resort. The lore link stays on the Lysekil hook she grew from.' });
sec('lysekil.gunboats', 'The gunboats that came at night', { place: 'village:Lysekil', idx: 0, anchor: 'harbour', spot: 'Norra hamnen', when: { timeOfDay: ['dusk', 'night'] }, rarity: 'uncommon',
  routine: 'An old fisherman says wartime gunboats came into Norra hamnen at night with their lights out, and he never saw them.',
  look: 'An old fisherman at the end of the quay, looking out at the dark as if something were coming in.', sight: 'An old man at {place} says the gunboats came in at night with no lights.', drawing: 'quay-night', kind: 'people',
  anchored: { effect: 'hail', line: '"Never saw a thing," he says, and looks you in the eye until you nod.' },
  refs: ['lore:village:Lysekil (Operation Bridford: fast gunboats run Lysekil to Hull with ball bearings through the Skagerrak blockade, 1943-45)'], srcNote: 'Operation Bridford is a sourced event; the fisherman, his claim and his silence are INVENTED' });
add({
  id: 'place.lysekil.depot-clerk', name: 'The depot clerk in the Lysekil harbour shed', category: 'people', years: [1950, 1950],
  where: { anchor: 'berth', places: ['village:Lysekil'], spot: 'the depot shed on the quay' },
  density: { chance: 1, cap: 1, areaM: 300 }, routine: 'Story-owned: hands out the gas tanks and paraffin for the lights (canon).', movement: 'stationary',
  personality: 'gruff', lines: { hail: '(story-owned: lines live in src/story-1950.js)' }, offers: ['errand'],
  sighting: { kind: 'people', line: 'The depot clerk at {place}.', drawing: 'person' },
  source: src('grounded', ['lore:village:Lysekil#regulars[0] (canon)', 'GAME-DESIGN.md canon: the depot on the Lysekil quay'], 'hand-placed by the story; a stub so quests can name him as giver'),
  lore: { place: 'village:Lysekil', hook: 'regulars', index: 0 }, storyOwned: true,
});
add({
  id: 'place.grundsund.boatbuilder', name: 'The boatbuilder at Grundsund (the boy\'s father)', category: 'people', years: [1950, 1950],
  where: { anchor: 'village', places: ['village:Grundsund'], spot: 'the yard' },
  density: { chance: 1, cap: 1, areaM: 300 }, routine: 'Story-owned: takes Svalan into the yard and says it will be a while.', movement: 'stationary',
  personality: 'gruff', lines: { hail: '(story-owned: lines live in src/story-1950.js)' }, offers: ['errand'],
  sighting: { kind: 'people', line: 'The boatbuilder at {place}.', drawing: 'person' },
  source: src('grounded', ['lore:village:Grundsund#regulars[0] (canon)', 'people:P01-P19 (boatbuilding); GAME-DESIGN.md canon'], 'hand-placed by the story; a stub so quests can name him as giver'),
  lore: { place: 'village:Grundsund', hook: 'regulars', index: 0 }, storyOwned: true,
});

// ---------------------------------------------------------------------------------------------------------------
// The skerries, lights and the rest
// ---------------------------------------------------------------------------------------------------------------
reg('bonden.dare-lad', 'A Grundsund lad who rows out to touch the cairn on a dare', { place: 'relation/10250201', idx: 0, anchor: 'skerry', spot: 'the Bonden cairn', personality: 'chatty',
  hail: 'Dare you! Dare you to touch it! I did!', when: { season: ['summer', 'late-summer'], timeOfDay: ['afternoon'] }, offers: ['errand', 'rumour'], rarity: 'uncommon',
  tap: { effect: 'show', reach: 'medium', line: 'He slaps the cairn, whoops, and is nearly in the water.' },
  routine: 'Rows out on a dare, touches the cairn and rows back as fast as he can.', sight: 'A lad rowed out to touch the cairn on {place}. Dared by his mates.', drawing: 'lad',
  refs: ['ISLAND-LORE.md: Bonden, white 8 m cairn (1875); the Anna Maria wrecked on its west side in 1905'] });
reg('islandsberg.family', 'The family in the old keeper\'s house', { place: 'light:Islandsberg', idx: 0, anchor: 'light', spot: 'the porch of the old keeper\'s house', personality: 'chatty',
  hail: 'The wind finds every crack. Seventeen so far. We are counting.', when: { timeOfDay: ['morning', 'afternoon'] }, offers: ['rumour'],
  routine: 'A family who bought the house in 1948, learning its quirks: the light above them is automatic and dark upstairs.', sight: 'The family in the old keeper\'s house at {place}, waving from the porch.', drawing: 'family',
  refs: ['ISLAND-LORE.md: Islandsberg\'s old light dark since 1938, the house sold 1948 (private family not named)'], srcNote: 'INVENTED regular; the sale in 1948 is sourced (fyr.org); no private person is named' });
sec('islandsberg.keepers-logbook', 'A keeper\'s logbook in the wall cupboard', { place: 'light:Islandsberg', idx: 0, anchor: 'light', spot: 'the old keeper\'s house', rarity: 'rare',
  requires: { regular: 'place.islandsberg.family', warmth: 'warm' }, routine: 'The family found a keeper\'s logbook in a wall cupboard and have not shown it to anyone.',
  look: 'A face at the upstairs window, and a hand holding something square and dark.', sight: 'The family at {place} showed us a logbook found in a wall cupboard.', drawing: 'book', kind: 'finds',
  refs: ['ISLAND-LORE.md: Islandsberg 1883 combined light and dwelling, dark 1938'], srcNote: 'INVENTED hook grounded in the sourced house history' });

reg('harmano.quarryman', 'A quarryman about to be out of work', { place: 'relation/5463706', idx: 0, anchor: 'island', spot: 'the feldspar quarry landing', personality: 'gruff', years: [1948, 1952],
  hail: 'Last season on the stone. After that, who knows.', offers: ['rumour'], when: { timeOfDay: DAY },
  routine: 'Drills and splits the pink feldspar by hand at Höpallen or Stenvik; talks about what he will do next.', sight: 'A quarryman at {place}, the quarry going quiet.', drawing: 'quarryman',
  refs: ['history-start-area.md: feldspar quarried at Höpallen and Stenvik in the first half of the 1900s (high)'], srcNote: 'INVENTED regular; the quarrying is sourced' });
reg('harmano.egg-farmer', 'A farmer who sells eggs to summer guests', { place: 'relation/5463706', idx: 1, anchor: 'island', spot: 'Härm, the old farm on the east shore', personality: 'chatty',
  hail: 'Eggs for the guests on Gullholmen. They don\'t know what they\'re asking.', offers: ['errand', 'rumour'], when: { timeOfDay: ['morning', 'midday'], season: ['summer'] },
  routine: 'Packs eggs in straw for the guest houses; will trade them for news.', sight: 'A farmer at {place} with a crate of eggs for the summer guests.', drawing: 'farmer',
  refs: ['history-start-area.md: farm Härm on the east shore, farming with fishing and freight sailing (high)'] });
sec('harmano.feldspar-stack', 'Cut feldspar blocks under a tarpaulin', { place: 'relation/5463706', idx: 0, anchor: 'island', spot: 'the quarry landing', rarity: 'common',
  routine: 'A stack of cut blocks, never shipped, tarpaulin-covered and weighted with stones.', look: 'A neat stack under a grey tarpaulin: pink stone, cut square.',
  sight: 'Cut feldspar blocks, never shipped, at {place}.', drawing: 'blocks', kind: 'finds', refs: ['history-start-area.md: feldspar quarrying (high)'] });

reg('hallevik.shipwright', 'A boatyard shipwright who builds under a roof in winter', { place: 'village:Hälleviksstrand', idx: 0, anchor: 'berth', spot: 'the yard slip', personality: 'gruff',
  hail: 'Caulking oakum, tar, patience. In that order. Need a hand with any?', offers: ['errand', 'rumour'], when: { timeOfDay: DAY },
  routine: 'Planks, steam box, rivets; a half-built Iceland boat on the slip.', sight: 'A shipwright at {place}, a half-planked hull behind him.', drawing: 'shipwright',
  refs: ['ISLAND-LORE.md: Hälleviksstrand boatyard 1907; people:P03-P08 (clinker building)'] });
reg('hallevik.cannery-worker', 'A cannery worker', { place: 'village:Hälleviksstrand', idx: 1, anchor: 'berth', spot: 'the cannery quay', personality: 'chatty',
  hail: 'Strana burned in 1905 and was rebuilt in a summer. Ask anyone over sixty.', offers: ['rumour'], when: { timeOfDay: ['midday', 'afternoon'] },
  routine: 'Smoke and steam from the cannery; she comes out for air.', sight: 'A cannery worker taking air at {place}.', drawing: 'cannery-woman',
  refs: ['vastsverige.com: the 1905 fire, a cannery and shipyard start the same year (medium, via history-start-area.md)'] });
sec('hallevik.half-model', 'A half-model nobody ordered', { place: 'village:Hälleviksstrand', idx: 0, anchor: 'berth', spot: 'the yard loft', rarity: 'uncommon',
  requires: { regular: 'place.hallevik.shipwright', warmth: 'friendly' }, routine: 'In the yard loft: a half-model of a boat nobody has ordered, a hull the shipwright draws for himself.',
  look: 'Up in the loft window, a pale carved shape on a board.', sight: 'A half-model of a boat nobody ordered, in the yard loft at {place}.', drawing: 'half-model', kind: 'finds' });

reg('storon.pup-counter', 'A boy who counts seal pups from a rock', { place: 'relation/10604590', idx: 0, anchor: 'island', spot: 'a lookout rock', personality: 'chatty',
  hail: 'Eleven! No, twelve! One keeps moving.', when: { season: ['early-summer'], timeOfDay: ['morning', 'midday'] }, offers: ['errand', 'rumour'],
  routine: 'Lies on his stomach on a rock with a stub of pencil and a notebook, counting pups.', sight: 'A boy counting seal pups from a rock at {place}.', drawing: 'boy' });
reg('hattan.fisherman', 'A Gullholmen fisherman who complains when the light is dark', { place: 'light:Hättan', idx: 0, anchor: 'light', spot: 'a boathouse in sight of Hättan', personality: 'gruff',
  hail: 'Hättan\'s dark. Three nights now. We rowed round the point by feel.', hailAfter: 'It\'s back. Right on time. A man can sleep.', when: { timeOfDay: NOT_NIGHT },
  offers: ['rumour'], routine: 'Sees the Hättan light every night from the boathouse and complains when it is not there.',
  sight: 'A fisherman at {place} grumbling that Hättan has been dark since the storm.', drawing: 'fisherman', refs: ['GAME-DESIGN.md canon: the four AGA lights out since the storm'] });
reg('gaven.pilot', 'A Lysekil pilot who still says "out at the old pole"', { place: 'light:Gäven', idx: 0, anchor: 'light', spot: 'a pilot boat close under Gäven', personality: 'chatty',
  hail: 'My father kept watch on the platform of the old pole. The light does it better, but it\'s lonelier.', when: { timeOfDay: DAY }, offers: ['rumour'], move: 'patrol', rarity: 'uncommon',
  routine: 'Cruises under the rock between jobs, still calling it the pole.', sight: 'A pilot at {place} still calling it "the old pole".', drawing: 'pilot',
  refs: ['ISLAND-LORE.md: Gäven pole mark 1835 with a pilots\' lookout platform; it blew over; the light came in 1917'] });
sec('gaven.initials', 'Initials cut in the rock beside Gäven', { place: 'light:Gäven', idx: 0, anchor: 'light', spot: 'the rock beside the tower', rarity: 'uncommon',
  routine: 'Initials and years, cut over a century, going back to the pole mark\'s day.', look: 'Close beside the tower, the rock is cut with initials and years, some older than the light.',
  sight: 'Initials and dates cut into the rock beside {place}, going back before the tower.', drawing: 'initials', kind: 'places',
  refs: ['ISLAND-LORE.md: Gäven pole mark 1835'], srcNote: 'INVENTED hook; carved initials are an ALIVE-SEA idea ("carved initials: cute, niche")' });
reg('fredagsholmen.sheep-farmer', 'A Gullholmen sheep-farmer who lands sheep on the islet', { place: 'relation/10237443', idx: 0, anchor: 'skerry', spot: 'the grass on the islet', personality: 'chatty',
  hail: 'Seven out, seven back. Mostly.', when: { season: ['summer'], timeOfDay: ['morning', 'midday'] }, offers: ['rumour'], rarity: 'uncommon',
  routine: 'Rows out with a few sheep each summer and leaves them to graze; rows back for them in autumn.', sight: 'Sheep on the grass of {place}, and a farmer in a rowboat.', drawing: 'sheep',
  refs: ['ISLAND-LORE.md: Fredagsholmen, a light since 1883'] });
sec('fredagsholmen.calendar', 'A calendar cut in the rock', { place: 'relation/10237443', idx: 0, anchor: 'skerry', spot: 'the south point', rarity: 'uncommon',
  routine: 'Seven strokes cut in the rock, six crossed out: someone was stuck here for a week.', look: 'On the south point: seven strokes cut in the rock, six crossed through.',
  sight: 'A week\'s tally cut in the rock at {place}. Six days crossed out.', drawing: 'calendar', kind: 'places',
  refs: ['ISLAND-LORE.md: do not present "Friday islet" as the etymology'], srcNote: 'INVENTED hook. The name\'s meaning is unknown: the line must not claim to explain it.' });
reg('kraksundsgap.pilot', 'A Hälleviksstrand pilot who complains about the concrete marks', { place: 'light:Kråksundsgap Södra', idx: 0, anchor: 'pass', spot: 'the leading line', personality: 'gruff',
  hail: 'I\'ve used the line every day for thirty years. They want to put up concrete. Concrete!', when: { timeOfDay: DAY }, offers: ['rumour'], rarity: 'uncommon', move: 'patrol',
  routine: 'Takes the leading line in and out of the gap, steering by the cairns, scorning the new marks.', sight: 'A pilot in the gap at {place}, steering by the old line.', drawing: 'pilot',
  refs: ['people:K01-K07 (Kråksundsgap Södra: a working AGA light long before 1954)'] });
sec('kraksundsgap.white-tower', 'A tall white tower not on the chart', { place: 'light:Kråksundsgap Södra', idx: 0, anchor: 'light', storyOwned: true, rarity: 'rare', when: { timeOfDay: ['night'] },
  routine: 'Story-owned. At night someone has seen a tall white tower here that is not on the chart: the 1954 tower, glimpsed.', look: '(story-owned: the Kråksundsgap glimpse is scripted)',
  sight: 'A tall white tower at {place} that is not on the chart. Gone when I looked again.', drawing: 'tower', kind: 'lights',
  refs: ['people:K02 (1954: a 13 m concrete tower replaced the former lantern)', 'GAME-DESIGN.md canon: the Kråksundsgap glimpse'], srcNote: 'canon: scripted; this stub exists so the lore link is tracked, not spawned', note: 'storyOwned.' });
reg('torno.quarryman-dora', 'A quarryman who talks of the sunk steamer as if she were a person', { place: 'relation/10238557', idx: 0, anchor: 'skerry', spot: 'the quarry sound landing', personality: 'chatty', years: [1948, 1955],
  hail: 'She went down on a calm day. Calm! And no man can say whose fault.', offers: ['rumour', 'errand'], when: { timeOfDay: DAY },
  routine: 'Cuts stone at Tornö; looks across the sound at the place where the Dora lies.', sight: 'A quarryman at {place} talking about the Dora like an old friend.', drawing: 'quarryman',
  refs: ['ISLAND-LORE.md: the Dora in the quarry sound; two records (1925, 1928) probably one steamer'], srcNote: 'INVENTED regular; the Dora records conflict (flagged in the lore)' });
sec('torno.mason-block', 'A cut block with a mason\'s mark', { place: 'relation/10238557', idx: 0, anchor: 'skerry', spot: 'under the black cairn', rarity: 'common',
  routine: 'A cut block under the Tornö black cairn, with a mason\'s mark on its face.', look: 'A squared block of granite, a mason\'s mark chiselled in its face.',
  sight: 'A cut stone with a mason\'s mark under the black cairn at {place}.', drawing: 'stone', kind: 'finds', refs: ['ISLAND-LORE.md: Tornö black cairn 1886'] });
reg('malo.shipwrights-widow', 'A shipwright\'s widow who rents out the old yard shed', { place: 'relation/5214486', idx: 0, anchor: 'island', spot: 'the shed beside the old slip', personality: 'shy',
  hail: 'My husband built three boats in that shed. Do you want to see the slip?', offers: ['errand'], when: { timeOfDay: DAY },
  routine: 'Sweeps the shed for summer lodgers; looks at the slip when she thinks no one is watching.', sight: 'A woman at the old yard on {place}, sweeping.', drawing: 'widow',
  refs: ['sv.wikipedia Malö: shipyard and shipping at Malö in the 1800s (medium)'], srcNote: 'INVENTED regular; Malö\'s 1800s yard is sourced (medium)' });
sec('malo.half-built-hull', 'A half-built hull under tarpaulins', { place: 'relation/5214486', idx: 0, anchor: 'island', spot: 'the old yard slip', rarity: 'uncommon',
  routine: 'The old slip still holds a half-built hull, ribs showing, under tarpaulins.', look: 'Ribs like a whale\'s on the old slip, a tarpaulin over the bow.',
  sight: 'A hull half-built on the old slip at {place}. Nobody has finished her.', drawing: 'hull', kind: 'finds', refs: ['sv.wikipedia Malö (medium)'] });
sec('lavon.sludge-pond', 'The old fish-oil pond', { place: 'relation/7455712', idx: 0, anchor: 'island', spot: 'the old train-oil works', when: { weather: ['calm'], season: ['summer'], timeOfDay: ['midday', 'afternoon'] }, rarity: 'common',
  routine: 'On a hot day the old sludge pond still smells of fish oil.', look: 'A warm breeze brings a rich, rank smell of old fish oil off the shore.',
  sight: 'The old fish-oil pond at {place} still smells on a hot day.', drawing: 'pond', kind: 'places', refs: ['ISLAND-LORE.md: Lavön train-oil boilery (not confirmed to be on the island)'], srcNote: 'INVENTED detail on an unconfirmed site' });
reg('harpo.long-liner', 'A long-liner who curses the Freya for every snagged hook', { place: 'relation/10250169', idx: 0, anchor: 'skerry', spot: 'a small boat over the wreck ground', personality: 'gruff',
  hail: 'The Freya! Every hook. Coal and coke, and she\'s still costing me.', when: { timeOfDay: ['dawn', 'morning'] }, offers: ['errand', 'rumour'], move: 'patrol',
  routine: 'Works his lines near the wreck and swears at her by name.', sight: 'A long-liner cursing the Freya off {place}.', drawing: 'fisherman',
  refs: ['ISLAND-LORE.md: the wreck of the Freya (1940) near Stora Harpö'] });
sec('harpo.ships-bell', 'A ship\'s bell pulled up on a line', { place: 'relation/10250169', idx: 0, anchor: 'skerry', spot: 'the long-liner\'s boathouse', rarity: 'rare',
  requires: { regular: 'place.harpo.long-liner', warmth: 'warm' }, routine: 'The skipper has pulled a green brass ship\'s bell up on a line and never told anyone.',
  look: 'A glint of old green brass in the dark of a boathouse door.', sight: 'A ship\'s bell, green with age, pulled up on a fishing line near {place}.', drawing: 'bell', kind: 'finds',
  refs: ['ISLAND-LORE.md: the wreck of the Freya'], srcNote: 'INVENTED hook on a sourced wreck' });
sec('silleskar.linseed-cask', 'A cask of linseed cake in a cleft', { place: 'relation/11020202', idx: 0, anchor: 'skerry', spot: 'a cleft on the lee side', rarity: 'common',
  routine: 'A cask of linseed cake still sits in a rock cleft: nobody wants to eat it, or move it.', look: 'A black stave cask wedged in a cleft, hard and weathered.',
  sight: 'An old cask of linseed cake, stuck in a cleft at {place}.', drawing: 'cask', kind: 'finds', refs: ['ISLAND-LORE.md: a linseed-cake cargo wrecked in 1878'] });
reg('jamningarna.pilot', 'A Lysekil pilot who calls the two marks the Trousers', { place: 'relation/10237897', idx: 0, anchor: 'sea-mark', spot: 'a pilot boat between the cairns', personality: 'chatty',
  hail: 'Two legs, one belt each. Keep the Trousers on your port side and you can\'t go wrong.', when: { timeOfDay: DAY }, offers: ['rumour', 'errand'], move: 'patrol',
  routine: 'Takes a short cut through the western inlet between the two cairns.', sight: 'A pilot at {place} calling the two marks the Trousers.', drawing: 'pilot',
  refs: ['ISLAND-LORE.md: painted cairns Jämningarna and Byxeskären (1874); byxa = trousers'] });
reg('stangholmen.ferryman', 'A Lysekil ferryman who passes Stångholmen on every crossing', { place: 'relation/10237903', idx: 0, anchor: 'light', spot: 'the ferry bridge', personality: 'chatty',
  hail: 'I\'ve gone past Stångholmen forty times today. It\'s dark. Fix it, will you?', when: { timeOfDay: NOT_NIGHT }, move: 'commute', offers: ['rumour'],
  routine: 'Shuttles across the mouth of Gullmarn between Lysekil and Fiskebäckskil; counts the lights.', sight: 'The Lysekil ferry crossing past {place}.', drawing: 'ferry',
  refs: ['lore:village:Fiskebäckskil (the Lysekil ferry)'] });
sec('stangehuvud.nets-in-dark-house', 'Nets drying in the dark light house', { place: 'relation/10237903', more: ['light:Stångehuvud'], idx: 0, anchor: 'light', spot: 'the dark wooden light house', rarity: 'uncommon',
  routine: 'In the dark Stångehuvud light house a fisherman keeps his nets dry.', look: 'Through the glazed gallery: brown nets hung where the lamp used to be.',
  sight: 'Nets hung to dry in the dark light house on Stångehuvud.', drawing: 'nets', kind: 'places', refs: ['sv.wikipedia Stångehuvuds naturreservat: the wooden light house remains, light extinguished 1940'], srcNote: 'INVENTED use of a sourced dark light house' });
reg('stangehuvud.retired-quarryman', 'A retired quarryman who walks the headland', { place: 'light:Stångehuvud', idx: 0, anchor: 'light', spot: 'the granite slabs below the headland', personality: 'chatty', years: [1945, 1959],
  hail: 'That slab was split in \'88. See the wedge marks? Berliners paid for it.', when: { timeOfDay: ['afternoon', 'dusk'] }, offers: ['rumour', 'errand'],
  routine: 'Walks the headland most evenings and tells you which slabs were split and when.', sight: 'An old quarryman on the slabs at {place}, naming them.', drawing: 'quarryman',
  refs: ['stangehuvud.se: quarrying from the early 1870s (Kessel & Röhl, Berlin) to 1904 (medium, via lore)'], srcNote: 'INVENTED regular; the quarry history is sourced (medium)' });
reg('stangehuvud.gas-courier', 'A courier who rows tubes out to the dark light house', { place: 'light:Stångehuvud', idx: 1, anchor: 'light', spot: 'a small rowing boat below the headland', personality: 'shy',
  hail: 'A Marstrand crew brought the tubes once. I row them out when they ask.', when: { timeOfDay: DAY }, offers: ['errand'], move: 'commute', rarity: 'uncommon',
  routine: 'Rows a gas tube out to the light house when asked.', sight: 'A man rowing a gas tube to the dark light house at {place}.', drawing: 'rowing-boat', refs: ['people:G01-G03 (AGA tube service)'] });
sec('stangehuvud.pedestal-stone', 'A pedestal stone with a number', { place: 'light:Stångehuvud', idx: 0, anchor: 'light', spot: 'among the scrap heaps', rarity: 'uncommon',
  routine: 'A pedestal stone with a number chiselled in it was never shipped; it lies among the scrap heaps.', look: 'A squared granite block with a number cut in its top, among the quarry waste.',
  sight: 'A pedestal stone with a number cut in it, never shipped, at {place}.', drawing: 'stone', kind: 'finds', refs: ['stangehuvud.se: monument bases shipped from Stångehuvud (medium, via lore)'] });
