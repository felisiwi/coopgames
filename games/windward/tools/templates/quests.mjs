// Quest templates for 1950. A quest = a need + 1 to 3 steps (existing verbs) + a resolution. Slots are filled by the world; each template is good alone.
export const QUESTS = [];
const L = (offer, done, fade) => ({
  offer: { gruff: offer[0], chatty: offer[1], shy: offer[2] },
  done: { gruff: done[0], chatty: done[1], shy: done[2] },
  fade,
});
const seed = (place, index) => ({ place, hook: 'questSeeds', index });

function Q(id, name, o) {
  QUESTS.push({
    id, name, kind: o.steps.length === 1 ? 'errand' : 'chain', firstSlice: !!o.firstSlice,
    ...(o.giver !== undefined ? { giver: o.giver } : {}),
    ...(o.trigger ? { trigger: o.trigger } : {}),
    slots: o.slots || {},
    steps: o.steps,
    resolution: o.resolution,
    reward: o.reward,
    offeredWhen: o.offeredWhen || {},
    cooldown: { days: o.cooldown || 3 },
    ...(o.softDeadline ? { softDeadline: o.softDeadline } : {}),
    lines: o.lines,
    seeds: o.seeds || [],
    source: { kind: o.seeds && o.seeds.length ? 'grounded' : 'invented', refs: [...(o.seeds || []).map((s) => `lore:${s.place}#questSeeds[${s.index}]`), ...(o.refs || ['docs/ALIVE-SEA.md: mini quests grill'])], note: o.note || 'the need, the steps and the lines are INVENTED; the lore quest seed is itself an invented hook' },
    invented: true,
    ...(o.loreTeller ? { loreTeller: o.loreTeller } : {}),
  });
}

const NET = 'place.karingon.net-mender-quay', CANN = 'place.gullholmen.cannery-woman', ASST = 'place.maseskar.assistant', SHIPW = 'place.hallevik.shipwright', DECK = 'place.fiskebackskil.ferry-deckhand';

// ---------------------------------------------------------------------------------------------------------------
// The three first-slice templates (ALIVE-SEA mini quests, round 3, item 17): generic, with the lore seeds as variants
// ---------------------------------------------------------------------------------------------------------------
Q('quest.first.lost-item', 'Lost in the blow', {
  firstSlice: true,
  giver: '{giver}',
  slots: {
    giver: { type: 'regular', from: [NET, CANN, ASST, SHIPW, DECK] },
    item: { type: 'item', from: ['drift.fish-box', 'drift.oar', 'drift.cork-float'] },
    skerry: { type: 'skerry', rule: 'a skerry within sight of the giver, on the lee side of where the last blow came from' },
    storm: { type: 'storm', rule: 'a label for the last blow, given by the weather system (last night\'s blow, the gale on Tuesday)' },
  },
  steps: [
    { verb: 'find', what: '{item}', where: '{skerry}', using: 'boathook' },
    { verb: 'deliver', what: '{item}', to: '{giver}' },
  ],
  resolution: { text: 'The giver is glad to have it back. Word gets round the quay that you are good with small things.', receiver: '{giver}' },
  reward: { warmth: 'small', gift: { tier: 'common', pool: ['artifact.mackerel-tin-ship-label', 'artifact.seine-cork-float', 'artifact.barrel-stave-cooper-mark', 'artifact.fish-box-stencil-board'] } },
  offeredWhen: { weather: ['after-squall'] }, cooldown: 2,
  lines: L(
    ['{storm} took my {item}. Find it and I\'ll not forget.', 'You\'ll never guess! {storm} took my {item}. Out by the skerries, I\'d say. Would you look?', 'Excuse me... {storm} took my {item}. Could you look for it?'],
    ['That\'s mine. Good. Take this.', 'My {item}! You found it! Here, take this, I insist!', 'Oh. Thank you. I had given it up.'],
    'Never mind. It washed up by itself in the end.'),
  seeds: [seed('village:Gullholmen', 0), seed('light:Måseskär', 1), seed('village:Käringön', 0)],
  note: 'Generic template. Lore variants: Gullholmen (a fish box for a tin of mackerel), Måseskär (a winch handle: also its own template), Käringön (a net float). The need and lines are INVENTED.',
});

Q('quest.first.delivery', 'A parcel across the water', {
  firstSlice: true,
  giver: '{giver}',
  slots: {
    giver: { type: 'regular', from: ['place.lysekil.depot-clerk', 'place.harmano.egg-farmer', 'place.lysekil.engine-fitter', SHIPW, 'place.malo.shipwrights-widow'] },
    receiver: { type: 'regular', from: ['place.gaso.boarding-house-keeper', 'place.korno.teacher', 'place.grundsund.cutter-skipper', 'place.gullholmen.long-line-fisherman', DECK] },
    object: { type: 'object', from: ['a letter', 'a bundle of newspapers', 'a bag of mackerel', 'a sack of flour', 'a tin of paint'] },
    destination: { type: 'place', rule: 'the receiver\'s own place' },
  },
  steps: [
    { verb: 'carry', what: '{object}', to: '{destination}' },
    { verb: 'deliver', what: '{object}', to: '{receiver}' },
  ],
  resolution: { text: 'The receiver is glad of it and talks for a minute: that is how you hear things.', receiver: '{receiver}' },
  reward: { warmth: 'small', rumour: { from: '{receiver}' } },
  cooldown: 2,
  lines: L(
    ['Take {object} to {receiver}. Don\'t drop it.', 'Would you take {object} across to {receiver}? You\'d be doing me a real kindness!', 'Um... could you take {object} to {receiver}? If it\'s on your way.'],
    ['Good. Right on time. Sit down a minute.', 'Oh, wonderful! {object}, just what I wanted. Have you heard the news?', 'Thank you. Please, stay a moment.'],
    'Never mind. It went with the ferry in the end.'),
  seeds: [seed('village:Grundsund', 1), seed('relation/10604591', 0), seed('relation/10094463', 0), seed('village:Hälleviksstrand', 0), seed('village:Lysekil', 1)],
  note: 'Generic template; the lore variants are each a sourced errand pattern. A tin of paint is the folded-in version of the Jämningarna "repaint the belt" seed (repainting is not an existing verb).',
});

Q('quest.first.after-the-squall', 'Adrift after the blow', {
  firstSlice: true,
  giver: null,
  trigger: { thing: 'drift.drifting-skiff', note: 'offered when you find a drifting boat after a blow' },
  slots: {
    skiff: { type: 'item', from: ['drift.drifting-skiff'] },
    area: { type: 'skerry', from: ['relation/10239187'] },
    owner: { type: 'regular', from: [NET, 'place.gaso.retired-skipper', 'place.korno.coaster-skipper', 'place.gullholmen.long-line-fisherman'] },
    teller: { type: 'regular', from: ['place.maseskar.keeper'] },
  },
  steps: [
    { verb: 'find', what: '{skiff}', where: '{area}' },
    { verb: 'tell', to: '{owner}' },
    { verb: 'hail', to: '{teller}' },
  ],
  resolution: { text: 'The owner is relieved. The keeper reads the drift for you and tells the true story of an old thing from the sea, which he gives you.', receiver: '{owner}' },
  reward: { warmth: 'medium', gift: { tier: 'rare', pool: ['artifact.rice-sack-stencil-paula', 'artifact.freya-ships-bell', 'artifact.svecia-anchor-shackle'], teller: '{teller}' } },
  offeredWhen: { weather: ['after-squall'] }, cooldown: 5,
  loreTeller: 'place.maseskar.keeper',
  lines: L(
    ['That\'s my boat. Where did you find her?', 'My boat! My boat! I thought she was gone for good! Where was she?', 'That... that is my boat. Where was she?'],
    ['Good lad. Go and ask the keeper where she came from.', 'You have no idea what this means! The keeper knows the currents. Go on, ask him!', 'Thank you. The keeper may know where she drifted from.'],
    'Never mind. She came home on the next tide.'),
  seeds: [seed('village:Käringön', 1)],
  note: 'Generic template. For this template the offer lines are the OWNER\'s first words, because the quest starts when you find the boat. The keeper is story-owned: his scene is Felix\'s, the lore he tells is the artifact\'s true story. The rare gifts are three wreck relics; none is a unique candidate.',
});

// ---------------------------------------------------------------------------------------------------------------
// Fifteen more, each from a lore quest seed
// ---------------------------------------------------------------------------------------------------------------
Q('quest.winch-handle', 'The slip\'s winch handle', {
  giver: ASST,
  slots: { handle: { type: 'object', label: 'the slip\'s winch handle', spawn: { anchor: 'berth', place: 'light:Måseskär', rule: 'in the shallows at the landing, visible when the boat is slow' } } },
  steps: [{ verb: 'find', what: '{handle}', where: 'light:Måseskär', using: 'boathook' }, { verb: 'deliver', what: '{handle}', to: ASST }],
  resolution: { text: 'He is so relieved he talks about the mainland for ten minutes.', receiver: ASST },
  reward: { warmth: 'small', gift: { artifacts: ['artifact.lamp-mantle-tin'] } },
  lines: L(
    ['Dropped the winch handle in the harbour. Find it.', 'I\'ve done something stupid! The winch handle went over the side at the landing. Could you fish it out? Please?', 'The winch handle... I dropped it. At the landing. Could you...?'],
    ['Good. Here, a spare mantle.', 'You found it! I could kiss you. Have a mantle, we have loads. Now tell me about Lysekil!', 'Thank you. Please, take this.'],
    'Never mind. The keeper made a new one from a boathook.'),
  seeds: [seed('light:Måseskär', 1)],
});
Q('quest.net-float-torno', 'A float for the quarry sound', {
  giver: NET,
  slots: { float: { type: 'object', from: ['a tarred cork float'] } },
  steps: [{ verb: 'carry', what: '{float}', to: 'relation/10238557' }, { verb: 'deliver', what: '{float}', to: 'place.torno.quarryman-dora' }],
  resolution: { text: 'The quarryman turns it over in his hands; it is his father\'s.', receiver: 'place.torno.quarryman-dora' },
  reward: { warmth: 'small', rumour: { from: 'place.torno.quarryman-dora' } },
  lines: L(
    ['This float is not mine. Take it to Tornö.', 'See this float? It\'s a Tornö float, it came back with the storm. Could you take it over?', 'This float... it belongs on Tornö. Would you take it?'],
    ['Hm. His. Thank you.', 'It is! It\'s my father\'s! Sit down, sit down, let me tell you about the Dora!', 'Thank you. It means a lot.'],
    'Never mind. Somebody else took it over.'),
  seeds: [seed('village:Käringön', 0)],
});
Q('quest.newspapers-to-gaso', 'Newspapers for the boarding house', {
  giver: 'place.lysekil.depot-clerk',
  slots: { parcel: { type: 'object', from: ['a parcel of newspapers and a letter'] } },
  steps: [{ verb: 'carry', what: '{parcel}', to: 'relation/10604591' }, { verb: 'deliver', what: '{parcel}', to: 'place.gaso.boarding-house-keeper' }],
  resolution: { text: 'She is cross that it is late and glad that it came.', receiver: 'place.gaso.boarding-house-keeper' },
  reward: { warmth: 'small', rumour: { from: 'place.gaso.boarding-house-keeper' } },
  lines: L(
    ['Parcel for Gåsö. Boarding house. Go.', 'There\'s a parcel for the boarding house on Gåsö, papers and a letter. Would you take it? She hates to wait!', 'Is it too much to ask? A parcel for Gåsö. For the boarding house.'],
    ['Hmph. Late. But here. Sit.', 'At last! Two weeks of papers at once. Come in, come in, I have news!', 'Oh. Thank you. I was getting worried.'],
    'Never mind. It went with the post boat.'),
  seeds: [seed('relation/10604591', 0)],
});
Q('quest.name-seal-skerry', 'A name for the seal skerry', {
  giver: 'place.storon.pup-counter',
  slots: { skerry: { type: 'skerry', rule: 'an unnamed skerry within 300 m of the seal rocks west of Storön', nameable: true } },
  steps: [{ verb: 'sail-to', where: '{skerry}' }, { verb: 'be-there', where: '{skerry}', when: { still: 'about a minute, so the seals come back' } }, { verb: 'name', where: '{skerry}' }],
  resolution: { text: 'The boy writes the name in his notebook. From now on it is on your chart with the name you gave it.', receiver: 'place.storon.pup-counter' },
  reward: { warmth: 'medium', nameGift: true },
  offeredWhen: { season: ['early-summer'] }, cooldown: 7,
  lines: L(
    ['That skerry has no name. Give it one.', 'You know, that skerry has no name at all. And the seals sleep on it! Will you name it with me?', 'It has no name. The seals sleep there. Could you... name it?'],
    ['Good name. I\'ll remember it.', 'That\'s the best name! I\'m writing it down. Now it is real!', 'I like it. Thank you.'],
    'Never mind. We just called it the seal rock.'),
  seeds: [seed('relation/10604590', 0), seed('relation/10604591', 1)],
  note: 'The names grill (ALIVE-SEA 19): only skerries with no real name; era-fitting suggestions plus free text; the name lives in the host\'s world.',
});
Q('quest.bakery-parcel-korno', 'Buns for the schoolteacher', {
  giver: 'place.fiskebackskil.bath-house-attendant',
  note: 'the need, the steps and the lines are INVENTED; the lore seed (Stora Kornö, questSeeds[0]) says the Lysekil bakery, but the giver now stands at Fiskebäckskil, so the parcel is simply from "the bakery"',
  slots: { parcel: { type: 'object', from: ['a wrapped parcel of buns from the bakery'] } },
  steps: [{ verb: 'carry', what: '{parcel}', to: 'relation/10094463', when: { timeOfDay: ['morning'] } }, { verb: 'deliver', what: '{parcel}', to: 'place.korno.teacher' }],
  softDeadline: { timeOfDay: 'morning', note: 'before the teacher\'s Saturday boat leaves for Lysekil; after that she has gone' },
  resolution: { text: 'The teacher unwraps the buns on the pier and shares one.', receiver: 'place.korno.teacher' },
  reward: { warmth: 'small', gift: { artifacts: ['artifact.stoneware-shard-blue-band'] } },
  lines: L(
    ['Bakery parcel. Stora Kornö. The teacher. Morning.', 'There\'s a parcel from the bakery for the teacher on Kornö! Before the Saturday boat, or she\'ll be gone!', 'A parcel for the teacher on Kornö. If you could. Before she leaves.'],
    ['Mm. Still warm. Here.', 'Buns! Still warm! You are a saint. Look what I found on the beach.', 'Thank you. Please, take this.'],
    'Never mind. She had her buns in Lysekil in the end.'),
  seeds: [seed('relation/10094463', 0)],
});
Q('quest.mackerel-for-flour', 'Mackerel across, flour back', {
  giver: DECK,
  slots: { basket: { type: 'object', from: ['a basket of mackerel'] }, flour: { type: 'object', from: ['a sack of flour'] }, stall: { type: 'place', from: ['village:Lysekil'], spot: 'the market stall' } },
  steps: [{ verb: 'carry', what: '{basket}', to: '{stall}' }, { verb: 'deliver', what: '{basket}', to: '{stall}', returns: '{flour}' }, { verb: 'deliver', what: '{flour}', to: DECK }],
  resolution: { text: 'A swap that suited everyone, and the deckhand has a bit of gossip to go with the flour.', receiver: DECK },
  reward: { warmth: 'small', rumour: { from: DECK } },
  lines: L(
    ['Mackerel to the Lysekil stall. Flour back. Simple.', 'Take this basket of mackerel over to the Lysekil market stall and bring back flour! You\'ll see: it\'s a good swap!', 'Could you take mackerel to the stall in Lysekil? And bring back flour? If it\'s not too much.'],
    ['Right. Flour. Good.', 'Flour! Perfect! You can have the first bun, I mean it!', 'Thank you. It saves me the crossing.'],
    'Never mind. I went over myself in the end.'),
  seeds: [seed('village:Fiskebäckskil', 0)],
});
Q('quest.repaired-part-to-grundsund', 'The repaired part', {
  giver: 'place.lysekil.engine-fitter',
  slots: { part: { type: 'object', from: ['a repaired engine part wrapped in oily cloth'] } },
  steps: [{ verb: 'carry', what: '{part}', to: 'village:Grundsund' }, { verb: 'deliver', what: '{part}', to: 'place.grundsund.cutter-skipper' }],
  resolution: { text: 'The skipper bolts it on while you wait and the engine starts first swing.', receiver: 'place.grundsund.cutter-skipper' },
  reward: { warmth: 'medium', gift: { artifacts: ['artifact.skandia-engine-plate'] } },
  lines: L(
    ['Repaired part for Grundsund. Skipper waits. Go.', 'This is the part the Grundsund skipper has been howling about! Fixed at last. Take it over!', 'The part for the Grundsund skipper. It\'s done. Could you take it?'],
    ['Good. She starts. Take this plate.', 'It runs! Swing, thump, thump! Look at that, take this as thanks!', 'Thank you. It works. Please.'],
    'Never mind. He bought a new one in Göteborg.'),
  seeds: [seed('village:Lysekil', 1)],
});
Q('quest.bonden-cap', 'A cap on the cairn', {
  giver: 'place.bonden.dare-lad',
  slots: { cap: { type: 'object', label: 'the lad\'s cap', spawn: { anchor: 'skerry', place: 'relation/10250201', rule: 'on top of the cairn, held down by a stone' } } },
  steps: [{ verb: 'sail-to', where: 'relation/10250201' }, { verb: 'pick-up', what: '{cap}', where: 'relation/10250201' }, { verb: 'deliver', what: '{cap}', to: 'place.bonden.dare-lad' }],
  resolution: { text: 'He puts it on with great dignity and does not mention the dare.', receiver: 'place.bonden.dare-lad' },
  reward: { warmth: 'small', rumour: { from: 'place.bonden.dare-lad' } },
  offeredWhen: { season: ['summer', 'late-summer'] },
  lines: L(
    ['My cap is on Bonden. Fetch it.', 'I touched it! I did! But my cap blew off and it\'s still up there! Would you get it?', 'I left my cap on Bonden. Please...'],
    ['Good. Thanks.', 'My cap! You\'re the best! Do you want to hear about the Anna Maria?', 'Thank you. Mamma would have noticed.'],
    'Never mind. Mamma knitted me another.'),
  seeds: [seed('relation/10250201', 0)],
});
Q('quest.eggs-for-guests', 'Eggs before the guests wake', {
  giver: 'place.harmano.egg-farmer',
  slots: { eggs: { type: 'object', from: ['a crate of eggs packed in straw'] }, guesthouse: { type: 'place', from: ['village:Gullholmen'], spot: 'the guest-house steps' } },
  steps: [{ verb: 'carry', what: '{eggs}', to: '{guesthouse}' }, { verb: 'be-there', where: '{guesthouse}', when: { timeOfDay: ['dawn'] } }, { verb: 'deliver', what: '{eggs}', to: '{guesthouse}' }],
  softDeadline: { timeOfDay: 'dawn', note: 'before the guests wake; later the cook has gone elsewhere' },
  resolution: { text: 'The cook takes the crate at the kitchen door with a nod and a bun.', receiver: '{guesthouse}' },
  reward: { warmth: 'small', rumour: { from: 'place.harmano.egg-farmer' } },
  offeredWhen: { season: ['summer'], timeOfDay: ['dawn', 'morning'] },
  lines: L(
    ['Eggs to the Gullholmen guest house. Before they wake.', 'The guests on Gullholmen want eggs for breakfast, and they wake at seven! Can you be there by dawn?', 'Eggs for the guest house. Early. Could you?'],
    ['Good. In time.', 'In time! The cook was getting anxious! Have you heard about the Svecia?', 'Thank you. They are fussy.'],
    'Never mind. They ate bread this morning.'),
  seeds: [seed('relation/5463706', 0)],
});
Q('quest.oakum-for-gullholmen', 'Oakum for the long-liner', {
  giver: 'place.gullholmen.long-line-fisherman',
  slots: { oakum: { type: 'object', from: ['a bag of caulking oakum'] } },
  steps: [{ verb: 'sail-to', where: 'village:Hälleviksstrand' }, { verb: 'pick-up', what: '{oakum}', where: 'place.hallevik.shipwright' }, { verb: 'deliver', what: '{oakum}', to: 'place.gullholmen.long-line-fisherman' }],
  resolution: { text: 'The fisherman starts to caulk his seams that afternoon and invites you to watch.', receiver: 'place.gullholmen.long-line-fisherman' },
  reward: { warmth: 'small', gift: { artifacts: ['artifact.caulking-mallet'], giver: 'place.hallevik.shipwright' } },
  lines: L(
    ['Need oakum from the Hälleviksstrand yard. Fetch it.', 'My seams are weeping! The Hälleviksstrand yard has the best oakum. Would you fetch me a bag?', 'I need oakum. From the yard at Hälleviksstrand. If you pass.'],
    ['Good. Tar next.', 'You\'re a star! Now the tar. Stay and watch an old man work!', 'Thank you. I\'ll start at once.'],
    'Never mind. I borrowed some from a neighbour.'),
  seeds: [seed('village:Hälleviksstrand', 0)],
});
Q('quest.foreman-lunch', 'The foreman\'s lunch', {
  giver: 'place.torno.quarryman-dora',
  slots: { lunch: { type: 'object', from: ['the foreman\'s lunch in a cloth'] } },
  steps: [{ verb: 'carry', what: '{lunch}', to: 'relation/10238558', when: { timeOfDay: ['midday'] } }, { verb: 'deliver', what: '{lunch}', to: 'relation/10238558' }],
  softDeadline: { timeOfDay: 'midday', note: 'the foreman eats at noon; after that he is cross' },
  resolution: { text: 'A hungry man on the Vallerö side takes it, grunts and gives you something off the spoil heap.', receiver: 'relation/10238558' },
  reward: { warmth: 'small', gift: { artifacts: ['artifact.mason-chisel-stump'] } },
  lines: L(
    ['Foreman\'s lunch. Vallerö. By noon.', 'The foreman\'s lunch has to be across the sound by noon, or there\'ll be a riot! Can you row it over?', 'The foreman\'s lunch. For Vallerö. By noon. Please.'],
    ['Hm. Warm. Good. Take this.', 'Still warm! Hero! Here, a chisel the foreman wore to a stump!', 'Thank you. He was getting cross.'],
    'Never mind. He shared a colleague\'s.'),
  seeds: [seed('relation/10238557', 0)],
});
Q('quest.letter-from-malo', 'A letter before the ferry', {
  giver: 'place.malo.shipwrights-widow',
  slots: { letter: { type: 'object', from: ['a letter to the Fiskebäckskil post'] } },
  steps: [{ verb: 'carry', what: '{letter}', to: 'village:Fiskebäckskil' }, { verb: 'be-there', where: 'village:Fiskebäckskil', when: { before: 'the ferry leaves for Lysekil' } }, { verb: 'deliver', what: '{letter}', to: DECK }],
  softDeadline: { note: 'before the ferry leaves Fiskebäckskil; after that it waits for the next one' },
  resolution: { text: 'The deckhand puts it in the post sack with a nod.', receiver: DECK },
  reward: { warmth: 'small', knowledge: 'the ferry\'s turn-round time at Fiskebäckskil: how long you have to make it' },
  lines: L(
    ['Letter to the Fiskebäckskil post. Before the ferry.', 'I have a letter that has to be on the ferry to Lysekil! Can you row it to Fiskebäckskil in time?', 'It\'s only a letter. But the ferry... could you?'],
    ['Good. In time.', 'On the sack, just in time! The ferry man winked at me!', 'Thank you. It\'s important to me.'],
    'Never mind. It went on the next boat.'),
  seeds: [seed('relation/5214486', 0)],
});
Q('quest.buoy-the-freya', 'A buoy for the wreck', {
  giver: 'place.harpo.long-liner',
  slots: { buoy: { type: 'object', from: ['a painted buoy on a short line'] } },
  steps: [{ verb: 'pick-up', what: '{buoy}', where: 'place.harpo.long-liner' }, { verb: 'sail-to', where: 'relation/10250169' }, { verb: 'deliver', what: '{buoy}', to: 'relation/10250169', note: 'drop it at the marked spot over the wreck' }],
  resolution: { text: 'Now his lines miss the wreck and the wreck ground is on your chart.', receiver: 'place.harpo.long-liner' },
  reward: { warmth: 'medium', knowledge: 'the Freya wreck ground is marked on your chart' },
  lines: L(
    ['Buoy the Freya. My lines keep snagging.', 'Every hook I own is on that wreck! If you buoy her, I\'ll keep clear. Would you?', 'The Freya... she catches my lines. Could you mark her?'],
    ['Good. Finally.', 'Finally! No more snagging! You are a lifesaver! Come and see something later.', 'Thank you. I\'m grateful.'],
    'Never mind. I\'ve moved my lines.'),
  seeds: [seed('relation/10250169', 0)],
  note: 'Warmth medium unlocks secret.harpo.ships-bell (requires warm). The verb "deliver at a spot" stands in for dropping a buoy.',
});
Q('quest.kerosene-can', 'The keeper\'s kerosene can', {
  giver: 'place.stangehuvud.retired-quarryman',
  slots: { can: { type: 'object', label: 'a weathered kerosene can', spawn: { anchor: 'light', place: 'light:Stångehuvud', rule: 'wedged in the rocks near the light house; visible when slow and close' } } },
  steps: [{ verb: 'find', what: '{can}', where: 'light:Stångehuvud', using: 'boathook' }, { verb: 'deliver', what: '{can}', to: 'place.stangehuvud.retired-quarryman' }],
  resolution: { text: 'He turns it over and says it is exactly the one: the boys carried it over the hills to the light.', receiver: 'place.stangehuvud.retired-quarryman' },
  reward: { warmth: 'small', gift: { artifacts: ['artifact.granite-chisel-mark-sample'] } },
  lines: L(
    ['Old kerosene can in the rocks by the light. Find it.', 'There\'s a keeper\'s can wedged in the rocks by the light house, I know there is! Would you look?', 'A can. Old. In the rocks by the light. Could you...?'],
    ['That\'s it. Here, a stone for you.', 'That\'s the one! Look at that rust! Here, a sample from the old works!', 'Thank you. I\'d almost forgotten it.'],
    'Never mind. It was the wrong can anyway.'),
  seeds: [seed('light:Stångehuvud', 0)],
});
Q('quest.toy-boat', 'A toy boat adrift', {
  giver: NET,
  slots: { toy: { type: 'item', from: ['drift.toy-boat'] } },
  steps: [{ verb: 'find', what: '{toy}', where: 'relation/10239114' }, { verb: 'deliver', what: '{toy}', to: NET }],
  resolution: { text: 'She sends it to the child with a smile and a note.', receiver: NET },
  reward: { warmth: 'medium', rumour: { from: NET } },
  lines: L(
    ['Child lost a toy boat off the pier. It drifted. Find it.', 'A little one lost their toy boat off the pier, it drifted toward Saltskär! Would you look? It means the world.', 'A child lost a toy boat. It drifted away. Could you...?'],
    ['Good. She\'ll be pleased.', 'You found it! I could weep. She\'ll sleep tonight!', 'Thank you. You\'ve made a child happy.'],
    'Never mind. Her father is making a new one.'),
  seeds: [seed('relation/10239114', 0), seed('light:Stångehuvud', 1)],
});

// Lore 1950 quest seeds with no quest template of their own, with the reason (the test pins this list)
export const NOT_QUESTED = {
  'light:Måseskär#0': 'canon chapter-1 task (mantles and gas to the keeper): story script',
  'village:Grundsund#0': 'canon first errand (repair parts): story script',
  'village:Lysekil#0': 'canon chapter-1 task (gas tanks from the depot): story script',
  'light:Islandsberg#0': 'canon relight: story script',
  'light:Hättan#0': 'canon relight: story script',
  'light:Gäven#0': 'canon relight, and the iron ring is unique candidate 13: story script and Felix',
  'relation/10237443#0': 'canon relight: story script',
  'light:Kråksundsgap Södra#0': 'canon relight and the glimpse: story script',
  'relation/10237903#0': 'canon relight: story script',
  'relation/10237897#0': 'repainting a belt is not an existing verb; folded into quest.first.delivery as the object "a tin of paint"',
};
