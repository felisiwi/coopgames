// Rumour records for 1950. A rumour = a target (a thing or a place it points at), who tells it (a person, the radio, a notice board, the post),
// the text, how many days it lasts, and whether it is true or a twist. Mostly true, sometimes a twist, never empty (ALIVE-SEA mini-quest grill round 3, item 16).
export const RUMOURS = [];
const P = (thing) => ({ thing });
function R(id, o) {
  RUMOURS.push({
    id, target: o.target, tellers: o.tellers, text: o.text, days: o.days || 4,
    truth: o.truth, ...(o.twist ? { twist: o.twist } : {}), ...(o.dynamic ? { dynamic: o.dynamic } : {}),
    when: o.when || {},
    channel: o.channel || 'person',
    source: { kind: o.lore ? 'grounded' : 'invented', refs: [...(o.lore ? [`lore:${o.lore.place}#rumours[${o.lore.index}]`] : []), ...(o.refs || [])], ...(o.note ? { note: o.note } : {}) },
    invented: true,
    ...(o.lore ? { lore: { place: o.lore.place, hook: 'rumours', index: o.lore.index } } : {}),
  });
}
const lr = (place, index) => ({ place, index });

// ---- the 26 rumours in island-lore.json for 1950, each with its truth classified from its grounding ----------------------
R('rumour.maseskar-burned-red', { target: { place: 'light:Måseskär' }, tellers: [P('place.karingon.pilot-lotsberget')], lore: lr('light:Måseskär', 0), truth: 'true', days: 6,
  text: 'They say it burned red once, in the old days, and the fishermen from Käringön still call that a bad omen.',
  refs: ['W1950: the light was fixed red 1865 to 1887'], note: 'the red light is sourced; the omen is invented' });
R('rumour.maseskar-fish-taste', { target: { place: 'light:Måseskär' }, tellers: [P('place.lysekil.engine-fitter')], lore: lr('light:Måseskär', 1), truth: 'twist', days: 5,
  text: 'The Lysekil harbour men say the fish off Måseskär taste of something since the war.',
  twist: 'There are post-war wrecks west of Måseskär (low-confidence source); whether the fish taste of them is not known.' });
R('rumour.paulapallarna', { target: { thing: 'secret.karingon.boys-loft', place: 'village:Käringön' }, tellers: [P('place.karingon.pilot-lotsberget'), P(NET())], lore: lr('village:Käringön', 0), truth: 'true', days: 6,
  text: '\'You\'ll want to give Paulapallarna a wide berth when the wind is south-west. They\'ve had one ship already.\'', refs: ['RAÄ L1960:6080: the bark Paula, November 1872'] });
R('rumour.gullholmen-tordenskiold-wreck', { target: { thing: 'secret.gullholmen.saturday-argument', place: 'village:Gullholmen' }, tellers: [P('place.gullholmen.long-line-fisherman')], lore: lr('village:Gullholmen', 0), truth: 'twist', days: 7,
  text: '\'That wreck is Tordenskiold\'s, sure as I\'m standing. A man from the museum said otherwise but he never fished a day.\'',
  twist: 'Bohusläns museum (rapport 2012:39) dates the timber to felling in 1727-1827 and rejects the Tordenskiold link.' });
R('rumour.gaso-hotel-closing', { target: { place: 'relation/10604591' }, tellers: [P('place.gaso.boarding-house-keeper')], lore: lr('relation/10604591', 0), truth: 'twist', days: 5,
  text: '\'The hotel will close after this summer. The last of the Göteborg families are coming for the season.\'',
  twist: 'The beach hotel closed about 1960, ten years later (SVW-gaso).' });
R('rumour.korno-military-south-point', { target: { place: 'relation/10094463' }, tellers: [P('place.korno.teacher'), P('place.korno.coaster-skipper')], lore: lr('relation/10094463', 0), truth: 'true', days: 6,
  text: '\'They say the military will want the south point one day. Don\'t tell the sheep.\'',
  note: 'FORESIGHT: a coastal battery was built there in 1970. In 1950 it is a hunch; for the player it is a wink across time. KEPT (Felix, 2026-11-07).' });
R('rumour.fiskebackskil-ferry-late', { target: { place: 'village:Fiskebäckskil' }, tellers: [P('place.fiskebackskil.ferry-deckhand')], lore: lr('village:Fiskebäckskil', 0), truth: 'true', days: 4,
  text: '\'The ferry\'s late again, and they say the lights are out since the storm.\'', when: { storyPhase: ['beats:help', 'task:gas', 'task:lights'] }, refs: ['GAME-DESIGN.md canon: the four AGA lights out since the storm'] });
R('rumour.grundsund-mackerel-are-in', { target: { thing: 'wildlife.mackerel-jumping', place: 'village:Grundsund' }, tellers: [P('place.grundsund.cutter-skipper')], lore: lr('village:Grundsund', 0), truth: 'true', days: 3,
  text: '\'Mackerel are in. The cutters are going out Saturday.\'', when: { season: ['early-summer', 'summer'] }, refs: ['things:wildlife.mackerel-jumping speciesCheck (sv.wikipedia Makrill, Grundsund)'] });
R('rumour.lysekil-skandia-engine', { target: { place: 'village:Lysekil' }, tellers: [P('place.lysekil.engine-fitter')], lore: lr('village:Lysekil', 0), truth: 'twist', days: 5,
  text: '\'The Skandia works has a new engine that won\'t fail you in a calm.\'', twist: 'Hot-bulb engines were reliable but not that reliable; the fitter is selling.' });
R('rumour.bonden-anna-maria', { target: { place: 'relation/10250201' }, tellers: [P('place.bonden.dare-lad'), P('place.grundsund.cutter-skipper')], lore: lr('relation/10250201', 0), truth: 'true', days: 6,
  text: '\'Mind Bonden\'s west side in a north-wester: that took the Anna Maria.\'', refs: ['RAÄ L1960:6098: the schooner Anna Maria, 10 February 1905, three dead'] });
R('rumour.islandsberg-old-keeper', { target: { place: 'light:Islandsberg' }, tellers: [P('place.islandsberg.family')], lore: lr('light:Islandsberg', 0), truth: 'twist', days: 6,
  text: '\'The light is automatic now but the old keeper still sits on the rock some evenings.\'', twist: 'No ghost: a man from Grundsund fishes off the rock in the evenings, sits like a keeper and was one once.' });
R('rumour.harmano-svecia-rudder', { target: { place: 'relation/5463706' }, tellers: [P('place.harmano.quarryman'), P('place.harmano.egg-farmer')], lore: lr('relation/5463706', 0), truth: 'true', days: 6,
  text: '\'The Svecia\'s rudder is still standing up on the bottom off the huvud. The Danes took the rest.\'', refs: ['RAÄ L1960:6452: wreck of the Svecia 1926; Danish scrap divers recorded'] });
R('rumour.hallevik-fire-1905', { target: { place: 'village:Hälleviksstrand' }, tellers: [P('place.hallevik.cannery-worker')], lore: lr('village:Hälleviksstrand', 0), truth: 'true', days: 6,
  text: '\'Strana had a fire in 1905 and rebuilt in one summer. Ask anyone over sixty.\'', refs: ['vastsverige.com: the 1905 fire (via history-start-area.md)'] });
R('rumour.storon-seal-pups', { target: { thing: 'wildlife.seal-pups-storon', place: 'relation/10604590' }, tellers: [P('place.storon.pup-counter')], lore: lr('relation/10604590', 0), truth: 'true', days: 4,
  text: '\'The seals west of Storön have pups again. Don\'t go near, the mothers watch.\'', when: { season: ['early-summer'] } });
R('rumour.hattan-dark', { target: { place: 'light:Hättan' }, tellers: [P('place.hattan.fisherman')], lore: lr('light:Hättan', 0), truth: 'true', days: 5,
  text: '\'Hättan has been dark since the storm. We rowed round the point by feel last night.\'', when: { storyPhase: ['task:gas', 'task:lights'] }, refs: ['GAME-DESIGN.md canon'] });
R('rumour.gaven-old-pole', { target: { thing: 'secret.gaven.initials', place: 'light:Gäven' }, tellers: [P('place.gaven.pilot')], lore: lr('light:Gäven', 0), truth: 'true', days: 6,
  text: '\'My father kept watch from the platform on the old pole. The light does it better but it\'s lonelier.\'', refs: ['RAÄ: Gäven pole mark 1835 with a pilots\' lookout platform'] });
R('rumour.fredagsholmen-why-friday', { target: { thing: 'secret.fredagsholmen.calendar', place: 'relation/10237443' }, tellers: [P('place.fredagsholmen.sheep-farmer')], lore: lr('relation/10237443', 0), truth: 'twist', days: 5,
  text: '\'Why Friday? Ask the first man who was stuck on it all week.\'', twist: 'Nobody knows where the name comes from; the sheep-farmer is telling a story.' });
R('rumour.kraksundsgap-second-light', { target: { thing: 'secret.kraksundsgap.white-tower', place: 'light:Kråksundsgap Södra' }, tellers: [P('place.kraksundsgap.pilot')], lore: lr('light:Kråksundsgap Södra', 0), truth: 'true', days: 7,
  text: '\'Mind the gap at night. They say there\'s a second light that isn\'t a light.\'', when: { timeOfDay: ['dusk', 'night'] }, refs: ['GAME-DESIGN.md canon: the Kråksundsgap glimpse'] });
R('rumour.torno-dora', { target: { place: 'relation/10238557' }, tellers: [P('place.torno.quarryman-dora')], lore: lr('relation/10238557', 0), truth: 'twist', days: 6,
  text: '\'The Dora sank in the quarry sound on a calm day. Nobody was hurt, and nobody can say whose fault it was.\'',
  twist: 'Two records (11 Dec 1925 and 11 Apr 1928) probably describe one steamer; the date, and so the weather, is not settled.' });
R('rumour.harpo-freya-coal', { target: { thing: 'secret.harpo.ships-bell', place: 'relation/10250169' }, tellers: [P('place.harpo.long-liner')], lore: lr('relation/10250169', 0), truth: 'true', days: 6,
  text: '\'Coal and coke, she carried. The Red Company wouldn\'t touch her.\'', refs: ['RAÄ L1960:6443: cargo coal and coke; salvage judged too hard'] });
R('rumour.rora-eats-ships', { target: { place: 'relation/10250171' }, tellers: [P('place.fiskebackskil.shipmaster-bench')], lore: lr('relation/10250171', 0), truth: 'twist', days: 5,
  text: '\'Röra eats ships at Christmas. Watch it on the twenty-first.\'', twist: 'One ship, the Neptun, was lost on Röra on 21-22 December 1908; once, not every year.' });
R('rumour.stangholmen-dark-too', { target: { place: 'relation/10237903' }, tellers: [P('place.stangholmen.ferryman')], lore: lr('relation/10237903', 0), truth: 'true', days: 5,
  text: '\'Stångehuvud has been dark since the war started. Now Stångholmen is dark too.\'', when: { storyPhase: ['task:gas', 'task:lights'] }, refs: ['sv.wikipedia Stångehuvuds naturreservat: the light was put out in 1940'] });
R('rumour.stangehuvud-glows', { target: { thing: 'secret.stangehuvud.nets-in-dark-house', place: 'light:Stångehuvud' }, tellers: [P('place.stangehuvud.retired-quarryman')], lore: lr('light:Stångehuvud', 0), truth: 'twist', days: 4,
  text: 'Boys swear the dark light house still glows on the night of a big storm.', twist: 'It is lightning in the glazed gallery, and the fisherman\'s hurricane lamp where his nets hang.' });
R('rumour.stangehuvud-academy-flowers', { target: { place: 'light:Stångehuvud' }, tellers: [P('place.stangehuvud.retired-quarryman')], lore: lr('light:Stångehuvud', 1), truth: 'twist', days: 5,
  text: 'The Academy of Sciences is said to be sending people to count flowers on the headland.', twist: 'The Academy of Sciences has owned the headland since 1925 (a gift via Calla Curman); counting flowers is the story, not the plan.', refs: ['sv.wikipedia Stångehuvuds naturreservat: donated to the Academy in 1925'] });
R('rumour.karingon-pilot-boat-faster', { target: { thing: 'people.pilot-boat', place: 'relation/10239114' }, tellers: [P('place.karingon-island.net-mender-north-pier')], lore: lr('relation/10239114', 0), truth: 'twist', days: 5,
  text: 'The new pilot boat is faster than anything the Marstrand men have.', twist: 'The pilot boat was built in 1939 and is no faster than the Marstrand boats; the Käringön men are proud.' });
R('rumour.maseskar-no-clockwork', { target: { place: 'light:Måseskär' }, tellers: [P('place.karingon-island.pilots-widow')], lore: lr('relation/10239114', 1), truth: 'true', days: 6,
  text: 'There will be a light at Måseskär with no clockwork in it before long.', refs: ['SVW-masesk: in 1955 an electric motor replaced the clockwork and plumb-weight'] });

// ---- new: the other 1950 channels (the radio, notice boards, the post) and more people pointing at things ---------------------
// WHERE the evening forecast is heard (Felix, 2026-11-07): the Måseskär keeper's battery radio, AND a radio in the shop or café of each harbour.
// The keeper's radio is sourced (people:M03). The harbour radios are Felix's decision and INVENTED: radio in Skaftö households in the 1940s was NOT found.
const PROGRAM = 'the evening shipping forecast';
const RADIO_HARBOURS = ['village:Käringön', 'village:Gullholmen', 'village:Hälleviksstrand', 'village:Grundsund', 'village:Fiskebäckskil', 'village:Lysekil'];
const RADIO = [
  { channel: 'radio', program: PROGRAM, at: 'light:Måseskär', venue: 'keeper', via: 'place.maseskar.keeper', note: 'the keeper\'s battery radio' },
  ...RADIO_HARBOURS.map((at) => ({ channel: 'radio', program: PROGRAM, at, venue: 'shop-or-cafe', note: 'the radio in the harbour shop or café' })),
];
R('rumour.radio.gale-warning', { channel: 'radio', target: { place: 'light:Måseskär' }, tellers: RADIO, days: 1, truth: 'true', dynamic: 'weather',
  text: 'Skagerrak: south-westerly gale expected tomorrow, rain from the west. Small craft keep to harbour.',
  note: 'DYNAMIC: truth follows the next day\'s weather; the weather system picks the wording. A wrong forecast makes it a twist. HEARD at the Måseskär keeper\'s battery radio (sourced: people:M03) and at a radio in the shop or café of each harbour (Felix\'s decision, 2026-11-07; INVENTED, because radio in Skaftö homes in the 1940s was not found: people:Q11, Q14).',
  refs: ['people:M03 (Måseskär: battery radio reserved for the weather report, wartime Christmas 1941)', 'people:Q11,Q14 (radio in Skaftö households in the 1940s: not found)', 'docs/ALIVE-SEA.md: rumours without radio / the evening shipping forecast'] });
R('rumour.radio.fine-weather', { channel: 'radio', target: { place: 'light:Måseskär' }, tellers: RADIO, days: 1, truth: 'true', dynamic: 'weather',
  text: 'Skagerrak: fine weather tomorrow, light westerly, a sea breeze by midday.', note: 'DYNAMIC, heard where the gale warning is heard (see rumour.radio.gale-warning).', refs: ['docs/ALIVE-SEA.md weather grill: fine sea-breeze day type', 'people:M03 (the radio forecast at Måseskär)'] });
R('rumour.radio.fog-banks', { channel: 'radio', target: { place: 'light:Måseskär' }, tellers: RADIO, days: 1, truth: 'true', dynamic: 'weather',
  text: 'Fog banks off the Skagerrak coast; poor visibility in the morning, clearing by midday.', note: 'DYNAMIC, heard where the gale warning is heard (see rumour.radio.gale-warning).', refs: ['docs/ALIVE-SEA.md weather grill: calm misty morning that clears', 'people:M03 (the radio forecast at Måseskär)'] });
R('rumour.notice.lights-dark', { channel: 'notice-board', target: { place: 'light:Gäven' }, tellers: [{ channel: 'notice-board', at: 'village:Lysekil', note: 'the harbour office board' }], days: 7, truth: 'true',
  text: 'NOTICE TO MARINERS: the lights at Hättan, Gäven, Stångholmen and Fredagsholmen are reported dark since the storm. Keep to the marked channel.',
  when: { storyPhase: ['task:gas', 'task:lights'] }, refs: ['GAME-DESIGN.md canon: the four AGA lights out since the storm'] });
R('rumour.notice.mackerel-cutters', { channel: 'notice-board', target: { thing: 'wildlife.mackerel-jumping', place: 'village:Grundsund' }, tellers: [{ channel: 'notice-board', at: 'village:Grundsund', note: 'the quay board' }], days: 4, truth: 'true',
  text: 'Cutters sail for the mackerel on Saturday. Crews to report on the quay at four.', when: { season: ['early-summer', 'summer'] } });
R('rumour.notice.ferry-timetable', { channel: 'notice-board', target: { thing: 'place.fiskebackskil.ferry-deckhand', place: 'village:Fiskebäckskil' }, tellers: [{ channel: 'notice-board', at: 'village:Fiskebäckskil', note: 'the ferry quay' }], days: 5, truth: 'twist',
  text: 'The Lysekil ferry runs every half hour in summer. Last crossing in the evening, weather permitting.', twist: 'The timetable is more a hope: it runs when the deckhand says it runs.', refs: ['lore:village:Fiskebäckskil (the Lysekil ferry); the times are INVENTED'] });
R('rumour.post.guest-postcard', { channel: 'post', target: { place: 'relation/10604591' }, tellers: [{ channel: 'post', at: 'relation/10604591', note: 'a card on the boarding-house hall table' }], days: 4, truth: 'true',
  text: 'A card from a Göteborg family on the hall table: "Same rooms as last summer, if you will have us."' });
R('rumour.post.new-assistant', { channel: 'post', target: { place: 'light:Måseskär' }, tellers: [{ channel: 'post', at: 'village:Käringön', note: 'the post boat\'s news' }], days: 5, truth: 'twist',
  text: 'The post boat brought word that Måseskär\'s assistant is to be relieved in September.', twist: 'Reliefs are by the Lotsverket\'s own timetable; the post boat only hears gossip.', refs: ['people:M01, M03 (staff and supply boat)'] });
R('rumour.post.letter-for-gaven-pilot', { channel: 'post', target: { thing: 'place.gaven.pilot', place: 'light:Gäven' }, tellers: [{ channel: 'post', at: 'village:Lysekil', note: 'the post office window' }], days: 6, truth: 'true',
  text: 'A letter for the pilot who works under Gäven has lain at the post office for a month.', note: 'a hook for a delivery quest' });
R('rumour.person.birds-working', { target: { thing: 'wildlife.diving-flock' }, tellers: [P('people.fisherman-out-at-dawn')], days: 2, truth: 'true', when: { timeOfDay: ['dawn', 'morning'] },
  text: 'Birds are working off the point this morning. Mackerel under them, you\'ll see.' });
R('rumour.person.small-whale', { target: { thing: 'wildlife.porpoises' }, tellers: [P('people.rowing-guests')], days: 4, truth: 'true',
  text: 'My husband swears he saw a small whale off the outer rocks yesterday. I said it was a seal.', refs: ['things:wildlife.porpoises speciesCheck (sv.wikipedia Vanlig tumlare)'] });
R('rumour.person.bread-in-the-cave', { target: { thing: 'secret.korno.cave-loaf' }, tellers: [P('place.korno.teacher')], days: 6, truth: 'true',
  text: 'Somebody leaves bread and water in the cave on the island. Not me. Not the children, I asked.' });
R('rumour.person.calendar-on-the-rock', { target: { thing: 'secret.fredagsholmen.calendar' }, tellers: [P('place.fredagsholmen.sheep-farmer')], days: 5, truth: 'true',
  text: 'Somebody cut a calendar in the south rock, seven strokes and six crossed out. Look if you pass.' });
R('rumour.person.loft-of-wrecks', { target: { thing: 'secret.karingon.boys-loft' }, tellers: [P('place.karingon.net-mender-quay')], days: 6, truth: 'true',
  text: 'The boy in the boathouse loft keeps half the sea in there. Ask him nicely and he might show you.' });
R('rumour.person.green-glass-float', { target: { thing: 'drift.glass-float' }, tellers: [P('place.harpo.long-liner')], days: 3, truth: 'true',
  text: 'A green glass float has been seen drifting outside the skerries. Whoever has the sharpest eyes.' });
R('rumour.person.logbook-in-the-wall', { target: { thing: 'secret.islandsberg.keepers-logbook' }, tellers: [P('place.fiskebackskil.shipmaster-bench')], days: 6, truth: 'true',
  text: 'They found something in the wall when they bought the old keeper\'s house. Won\'t say what.' });

// ---- one each for the regulars who offer a rumour (never empty) ---------------------------------------------------------
R('rumour.person.pots-under-the-ledge', { target: { place: 'relation/10237443' }, tellers: [P('people.pot-hauler')], days: 3, truth: 'twist', when: { season: ['autumn'] },
  text: 'The lobster are thick under the ledge at Fredagsholmen this autumn.', twist: 'They are thick everywhere; he just does not want company on his ledge.' });
R('rumour.person.cod-on-the-harpo-bank', { target: { place: 'relation/10250169' }, tellers: [P('people.long-line-crew')], days: 3, truth: 'true',
  text: 'Cod are on the bank off Stora Harpö. But mind the old Freya; she eats hooks.', refs: ['lore:relation/10250169 (the Freya, snagged lines)'] });
R('rumour.person.ship-due-off-maseskar', { target: { place: 'light:Måseskär' }, tellers: [P('people.pilot-boat')], days: 1, truth: 'true', dynamic: 'weather',
  text: 'Ship due off Måseskär by noon. The pilot is going out to meet her.', note: 'pairs with the pilot-boat thing', refs: ['lore:relation/10239114 (Käringön pilot station staffed in 1950)'] });
R('rumour.person.supply-boat-thursday', { target: { place: 'light:Måseskär' }, tellers: [P('place.maseskar.assistant')], days: 4, truth: 'true',
  text: 'The supply boat comes on Thursday, if the weather lets it. We are down to the last of the coffee.', refs: ['people:M03 (the supply boat to Käringön three or four times a month)'] });
R('rumour.person.rescue-boat-out', { target: { place: 'village:Käringön' }, tellers: [P('place.karingon.rescue-volunteer')], days: 4, truth: 'twist',
  text: 'The rescue boat has been out twice this month for people who misjudged the tide.', twist: 'Only once, and for a rowing boat with a boy and a very large fish.', refs: ['lore:village:Käringön (a Sea Rescue Society station on the island)'] });
R('rumour.person.cannery-rebuilt', { target: { place: 'village:Gullholmen' }, tellers: [P('place.gullholmen.cannery-woman')], days: 6, truth: 'true',
  text: 'They are going to rebuild the cannery again, bigger this time. Work for everyone.', refs: ['people:Q03 (the Gullholmen cannery was rebuilt in 1938-39 and again in 1950-52)'] });
R('rumour.person.twenty-ships', { target: { place: 'relation/10604591' }, tellers: [P('place.gaso.retired-skipper')], days: 6, truth: 'true',
  text: 'Twenty big sailing ships we had on Gåsö in my grandfather\'s day. Now not one.', refs: ['lore:relation/10604591 (SVW-gaso: about 20 larger sailing ships in 1860)'] });
R('rumour.person.oilskin-works-hiring', { target: { place: 'village:Grundsund' }, tellers: [P('place.grundsund.seamstress')], days: 5, truth: 'true',
  text: 'The oilskin works takes on more girls after the summer. Mind, you have to like the smell.', refs: ['lore:village:Grundsund (rain-clothes manufacture)'] });
R('rumour.person.bath-jetty-mended', { target: { place: 'village:Fiskebäckskil' }, tellers: [P('place.fiskebackskil.bath-house-attendant')], days: 5, truth: 'twist',
  text: 'They say the cold-bath jetty is to be mended before next summer. New planks all along.', twist: 'Nothing is planned; she has asked for new planks three years running.' });
R('rumour.person.iceland-boat-on-the-slip', { target: { place: 'village:Hälleviksstrand' }, tellers: [P('place.hallevik.shipwright')], days: 6, truth: 'true',
  text: 'An Iceland boat is on the slip. Half of Gullholmen has put its name down for her.', refs: ['ISLAND-LORE.md: Hälleviksstrand\'s yard builds Iceland boats under a roof'] });
R('rumour.person.mind-the-trousers', { target: { place: 'relation/10237897' }, tellers: [P('place.jamningarna.pilot')], days: 4, truth: 'true',
  text: 'Coming in, keep the Trousers on your port side. And mind the west wind pushing you onto the belts.', refs: ['lore:relation/10237897 (the two white cairns with painted belts guide ships into the western inlet)'] });

function NET() { return 'place.karingon.net-mender-quay'; }
