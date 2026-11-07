// Thing tables, nature half: the vocabulary, the add() helper, wildlife, drift finds, gear and ambient life ashore.
// Edit here, then regenerate (README.md). The sourced species check is applied afterwards, in build.mjs.
export const VOCAB = {
  anchors: ['skerry', 'island', 'harbour', 'village', 'light', 'sea-mark', 'berth', 'pass', 'open-water'],
  categories: ['wildlife', 'people', 'drift', 'secret', 'ashore', 'gear'],
  movement: ['stationary', 'patrol', 'drift', 'follows-boat', 'commute', 'perched'],
  timeOfDay: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
  dayType: ['fine-sea-breeze', 'grey-westerly', 'calm-misty-morning', 'unsettled'],
  weather: ['mist', 'rain', 'squall', 'after-squall', 'calm', 'fresh'],
  season: ['spring', 'early-summer', 'summer', 'late-summer', 'autumn', 'winter'],
  storyPhase: ['beats:find', 'beats:errand', 'beats:return', 'beats:help', 'beats:free', 'task:gas', 'task:lights', 'task:keeper', 'task:report', 'task:done'],
  effects: ['none', 'sighting', 'flee', 'dive', 'lift-off', 'wave-back', 'toot-back', 'hail', 'pickup', 'look-closer', 'give', 'race-invite', 'show', 'circle', 'dive-bomb', 'shout'],
  reach: ['small', 'medium', 'large'],
  personality: ['gruff', 'chatty', 'shy'],
  rarity: ['common', 'uncommon', 'rare'],
  sightingKinds: ['birds', 'mammals', 'fish', 'boats', 'people', 'finds', 'places', 'lights', 'weather'],
  sourceKinds: {
    ported: 'taken from existing game code (src/life.js); not invented',
    researched: 'the template is a sourced fact (refs name the source id)',
    grounded: 'INVENTED content that grows from a sourced fact or lore hook (refs name it)',
    invented: 'INVENTED, no source behind it (design idea from ALIVE-SEA.md or ours)',
  },
};

const NONE = { effect: 'none' };
export const out = [];
export function add(o) {
  const kind = o.source.kind;
  out.push({
    id: o.id, name: o.name, category: o.category,
    years: o.years || [1940, 1959],
    where: o.where,
    density: o.density || { chance: 0.3, cap: 2, areaM: 400 },
    when: o.when || {},
    routine: o.routine,
    movement: o.movement || 'stationary',
    ...(o.personality ? { personality: o.personality } : {}),
    ...(o.lines ? { lines: o.lines } : {}),
    ...(o.offers ? { offers: o.offers } : {}),
    reactions: { tap: o.tap || NONE, approach: o.approach || NONE, anchored: o.anchored || NONE },
    sighting: o.sighting,
    rarity: o.rarity || 'common',
    source: o.source,
    invented: kind === 'grounded' || kind === 'invented',
    ...(o.requires ? { requires: o.requires } : {}),
    ...(o.lore ? { lore: o.lore } : {}),
    ...(o.storyOwned ? { storyOwned: true } : {}),
    ...(o.note ? { note: o.note } : {}),
  });
}
export const src = (kind, refs, note) => ({ kind, refs, ...(note ? { note } : {}) });
const DESIGN = (note) => src('invented', ['docs/ALIVE-SEA.md'], note || 'a design idea from ALIVE-SEA.md, section B; the species and behaviour are plausible for the Skagerrak coast but were not researched');

// ---------------------------------------------------------------------------------------------------------------
// WILDLIFE. Ported first (numbers copied from src/life.js), then the ALIVE-SEA ideas.
// ---------------------------------------------------------------------------------------------------------------
add({
  id: 'wildlife.gulls-follow-boat', name: 'Gulls following the boat', category: 'wildlife', years: [1900, 2030],
  where: { anchor: 'open-water', rule: 'a dozen gulls trail the boat while it is near land; more near a fishing boat' },
  density: { chance: 1, cap: 12, areaM: 200 },
  routine: 'Wheel and glide behind the stern; peel off when the boat stops.', movement: 'follows-boat',
  tap: { effect: 'lift-off', reach: 'large', line: 'The gulls scatter, shrieking, then settle again.' },
  anchored: { effect: 'look-closer', line: 'A few land on the water and sit about, hoping.' },
  sighting: { kind: 'birds', line: 'Gulls following us in from {place}.', drawing: 'gull' },
  source: src('ported', ['src/life.js: "a dozen gulls that follow the boat" (header comment)']),
});
add({
  id: 'wildlife.gulls-on-marks', name: 'Gulls perched on sea marks', category: 'wildlife', years: [1900, 2030],
  where: { anchor: 'sea-mark', rule: 'on a buoy top, a cairn or a lighthouse rock (src/life.js perchSpots)' },
  density: { chance: 0.6, cap: 3, areaM: 300 },
  routine: 'Sit on the mark, preen, watch the water.', movement: 'perched',
  tap: { effect: 'lift-off', reach: 'medium' },
  approach: { effect: 'lift-off', line: 'They lift off a boat-length before you reach the mark.' },
  sighting: { kind: 'birds', line: 'Gulls on the mark by {place}, one always facing the wind.', drawing: 'gull' },
  source: src('ported', ['src/life.js: perchSpots(marks, lights)', 'src/life.js: placeMarks, MARKS_PER_PLACE = 2']),
});
add({
  id: 'wildlife.eider-raft', name: 'A raft of eiders', category: 'wildlife', years: [1900, 2030],
  where: { anchor: 'open-water', rule: 'sea 1.5 to 10 m deep with open water round it, one raft per 150 m cell with chance 0.4, 4 birds (src/life.js raftInCell)',
    params: { cellM: 150, chance: 0.4, perRaft: 4, depthM: [1.5, 10], fleeDistM: 28, fleeMaxM: 16 } },
  density: { chance: 0.4, cap: 1, areaM: 150 },
  routine: 'Drift in a loose raft over the shallows, diving for mussels. Drakes white, ducks brown.', movement: 'patrol',
  tap: { effect: 'flee', reach: 'medium' },
  approach: { effect: 'flee', line: 'Inside about 28 m they paddle away, then drift back to the raft centre once you have passed.' },
  anchored: { effect: 'look-closer', line: 'After a while they forget you and drift closer.' },
  sighting: { kind: 'birds', line: 'A raft of eiders off {place}. Soft, low voices.', drawing: 'eider' },
  source: src('ported', ['src/life.js: raftInCell, RAFT_CELL_M = 150, RAFT_CHANCE = 0.4, RAFT_SIZE = 4, fleeOffset, FLEE_DIST_M = 28, FLEE_MAX_M = 16']),
});
add({
  id: 'wildlife.eider-ducklings', name: 'Eider ducks with ducklings', category: 'wildlife', years: [1900, 2030],
  where: { anchor: 'skerry', rule: 'in the lee of a low skerry, near where eider rafts form; replaces the plain raft' },
  density: { chance: 0.25, cap: 1, areaM: 400 },
  when: { season: ['early-summer'], timeOfDay: ['morning', 'midday', 'afternoon'] },
  routine: 'A duck leads a line of ducklings along the shore rocks; a "nursery" crèche of several ducks may gather.', movement: 'patrol',
  tap: { effect: 'flee', reach: 'small', line: 'The mother herds them behind a rock, quick, quick.' },
  approach: { effect: 'flee', line: 'They bunch up and keep their distance.' },
  anchored: { effect: 'look-closer', line: 'One duckling is bolder than the rest and paddles over to look.' },
  sighting: { kind: 'birds', line: 'Eider ducks with ducklings in the lee of {place}. Eleven, counting twice.', drawing: 'eider-ducklings' },
  rarity: 'uncommon',
  source: DESIGN('"Eiders with ducklings (early summer)" is an ALIVE-SEA idea; the raft numbers above are ported, this is not'),
});
add({
  id: 'wildlife.harbour-seals', name: 'Harbour seals hauled out on a skerry', category: 'wildlife', years: [1900, 2030],
  where: { anchor: 'skerry', rule: 'a low rock 0.25 to 1.6 m above the sea with water about it, one per 100 m cell with chance 0.3 (src/life.js sealRockInCell)',
    params: { cellM: 100, chance: 0.3, rockHeightM: [0.25, 1.6], alertM: 30 } },
  density: { chance: 0.3, cap: 1, areaM: 100 },
  routine: 'Lie in a heap on the warm rock, one head up on watch. Slip into the water when something comes close.', movement: 'stationary',
  tap: { effect: 'dive', reach: 'medium', line: 'Splash, splash. Heads pop up further out, looking back.' },
  approach: { effect: 'dive', line: 'Within about 30 m they slide off one by one (sealDive).' },
  anchored: { effect: 'look-closer', line: 'After about a minute of stillness the heads come back, curious.' },
  sighting: { kind: 'mammals', line: 'Harbour seals on a skerry by {place}. Fog lifting.', drawing: 'seal' },
  source: src('ported', ['src/life.js: sealRockInCell, SEAL_CELL_M = 100, SEAL_CHANCE = 0.3, sealDive, SEAL_ALERT_M = 30', 'docs/ALIVE-SEA.md anchoring grill 5: seals come back after about a minute of stillness'],
    'Species: the county page for Gåsö says knubbsäl, harbour seals (island-lore.json, Gåsö).'),
});
add({
  id: 'wildlife.seal-pups-storon', name: 'Seal pups west of Storön', category: 'wildlife',
  where: { anchor: 'skerry', places: ['relation/10604590'], rule: 'the seal skerry west of Storön', },
  density: { chance: 1, cap: 1, areaM: 200 },
  when: { season: ['early-summer'] },
  routine: 'Mothers guard the pups from the water; the pups lie on the rock.', movement: 'stationary',
  tap: { effect: 'dive', reach: 'small', line: 'The mothers slip in at once and circle. You feel watched.' },
  approach: { effect: 'dive', line: 'The mothers slip in well before you are close; the pups stay put.' },
  anchored: { effect: 'look-closer', line: 'From far enough away: a pup yawns, and goes back to sleep.' },
  sighting: { kind: 'mammals', line: 'Seal pups west of {place}. Kept my distance. The mothers were watching.', drawing: 'seal-pup' },
  rarity: 'uncommon',
  source: src('grounded', ['lore:relation/10604590#rumours', 'lore:relation/10604590#regulars[0]'], 'the lore rumour "The seals west of Storön have pups again" and the boy who counts pups from a rock are INVENTED hooks'),
  lore: { place: 'relation/10604590', hook: 'regulars', index: 0 },
});
add({
  id: 'wildlife.cormorants-drying', name: 'Cormorants drying their wings', category: 'wildlife',
  where: { anchor: 'sea-mark', rule: 'on a mark or a bare skerry head, a few birds in a row' },
  density: { chance: 0.3, cap: 1, areaM: 400 },
  when: { timeOfDay: ['morning', 'midday'] },
  routine: 'Stand with wings hung open like washing, after fishing.', movement: 'perched',
  tap: { effect: 'lift-off', reach: 'medium' }, approach: { effect: 'lift-off', line: 'One at a time, low over the water, grudgingly.' },
  sighting: { kind: 'birds', line: 'Cormorants on the mark by {place}, wings hung out to dry.', drawing: 'cormorant' },
  source: DESIGN('"cormorants drying their wings on marks" is an ALIVE-SEA idea'),
});
add({
  id: 'wildlife.herons-shallows', name: 'A heron in the shallows', category: 'wildlife',
  where: { anchor: 'island', rule: 'a sheltered shallow shore of a larger island, water under 1.5 m' },
  density: { chance: 0.15, cap: 1, areaM: 500 },
  when: { timeOfDay: ['dawn', 'dusk'], dayType: ['calm-misty-morning', 'fine-sea-breeze'] },
  routine: 'Stands motionless on one leg; a stab; stands again.', movement: 'stationary',
  tap: { effect: 'lift-off', reach: 'small', line: 'It unfolds, slow and enormous, and flaps away over the rocks.' },
  approach: { effect: 'lift-off', line: 'It watches until you are very close, then goes.' },
  anchored: { effect: 'look-closer', line: 'If you keep still it goes on fishing, ignoring you completely.' },
  sighting: { kind: 'birds', line: 'A grey heron in the shallows at {place}. Did not move for ten minutes.', drawing: 'heron' },
  rarity: 'uncommon', source: DESIGN('"Herons standing in shallow bays" is an ALIVE-SEA idea'),
});
add({
  id: 'wildlife.porpoises', name: 'Harbour porpoises', category: 'wildlife',
  where: { anchor: 'open-water', rule: 'outside the skerries, on the Skagerrak side, deep water' },
  density: { chance: 0.08, cap: 1, areaM: 1500 },
  when: { dayType: ['fine-sea-breeze'], weather: ['calm'] },
  routine: 'A small dark back rolls up, a puff, gone; two or three together, heading somewhere.', movement: 'patrol',
  tap: { effect: 'none', reach: 'large', line: 'Too quick: by the time you look, there is only a ring on the water.' },
  approach: { effect: 'show', line: 'They surface once, close by, and are gone.' },
  sighting: { kind: 'mammals', line: 'Porpoises, two, outside {place}. Gone as quick as they came.', drawing: 'porpoise' },
  rarity: 'uncommon', source: DESIGN('"Harbour porpoises surfacing now and then (Skagerrak)" is an ALIVE-SEA idea'),
});
add({
  id: 'wildlife.diving-flock', name: 'A flock diving on a shoal', category: 'wildlife',
  where: { anchor: 'open-water', rule: 'over a shoal of fish, in water a fishing boat would work; draws fishing boats' },
  density: { chance: 0.12, cap: 1, areaM: 800 },
  when: { timeOfDay: ['dawn', 'morning', 'dusk'], season: ['summer', 'late-summer'] },
  routine: 'Gulls and terns fold and drop one after another into the same patch; the water boils faintly.', movement: 'stationary',
  tap: { effect: 'lift-off', reach: 'large', line: 'They rise in a cloud and come straight back down.' },
  approach: { effect: 'show', line: 'Fish scatter silver at the edge of the patch.' },
  anchored: { effect: 'hail', line: 'A fishing boat comes to the spot and shouts a greeting.' },
  sighting: { kind: 'birds', line: 'Birds diving on a shoal off {place}. A fishing boat already on its way.', drawing: 'flock' },
  rarity: 'uncommon', source: DESIGN('"A diving flock = a shoal of fish below" is an ALIVE-SEA idea; the fishing line / fishing-for-gifts ladder is a later system'),
});
add({
  id: 'wildlife.mackerel-jumping', name: 'Mackerel jumping', category: 'wildlife',
  where: { anchor: 'open-water', rule: 'beside a diving flock or a school, summer evenings' },
  density: { chance: 0.1, cap: 1, areaM: 600 },
  when: { season: ['summer', 'late-summer'], timeOfDay: ['afternoon', 'dusk'] },
  routine: 'Sudden silver arcs and a patter on the surface.', movement: 'stationary',
  tap: { effect: 'none', reach: 'medium' }, approach: { effect: 'show', line: 'The patter moves away across the water as you come.' },
  sighting: { kind: 'fish', line: 'Mackerel jumping off {place}. The cutters should know.', drawing: 'mackerel' },
  source: src('grounded', ['docs/ALIVE-SEA.md', 'people:Q02 / lore:village:Grundsund rumour "Mackerel are in"'], 'mackerel fishing from Grundsund in this period is sourced; the jumping fish is an INVENTED visual'),
});
add({
  id: 'wildlife.terns-dive-bomb', name: 'Terns on a nesting skerry', category: 'wildlife',
  where: { anchor: 'skerry', places: ['relation/10211341'], rule: 'Tärneskär: the name is the tern skerry' },
  density: { chance: 1, cap: 1, areaM: 200 },
  when: { season: ['early-summer'], timeOfDay: ['morning', 'midday', 'afternoon'] },
  routine: 'A noisy colony: white birds hang in the air, then fold and dive at anything near the nests.', movement: 'patrol',
  tap: { effect: 'dive-bomb', reach: 'medium', line: 'A tern dives close past your ear, scolding. Harmless, and very sure of itself.' },
  approach: { effect: 'dive-bomb', line: 'The whole colony goes up, shrieking. Time to keep away.' },
  sighting: { kind: 'birds', line: 'Terns at {place}, screaming at us to leave. We left.', drawing: 'tern' },
  rarity: 'uncommon',
  source: src('grounded', ['assets/coast/names.json: "Tärneskär" (relation/10211341)'], 'the name means tern skerry; that terns nest on it in 1950 is INVENTED'),
});
add({
  id: 'wildlife.storm-petrels-maseskar', name: 'Small black birds round the Måseskär lamp', category: 'wildlife',
  where: { anchor: 'light', places: ['light:Måseskär'], rule: 'circling the lantern in a blow, at dusk or night' },
  density: { chance: 1, cap: 1, areaM: 200 },
  when: { weather: ['squall', 'fresh', 'after-squall'], timeOfDay: ['dusk', 'night'] },
  routine: 'Flutter in and out of the beam like moths.', movement: 'patrol',
  tap: { effect: 'look-closer', reach: 'medium', line: 'Storm petrels, small and black and quick. Käringön folk call them stormtrollet.' },
  approach: { effect: 'circle' },
  sighting: { kind: 'birds', line: 'Small black birds circling the lamp at {place}. The Käringön folk say they foretell a storm.', drawing: 'petrel' },
  rarity: 'rare',
  source: src('researched', ['people:M10 (storm petrels, Käringön names sjöpink and stormtrollet, believed to foretell storms and carry sailors\' souls)', 'people:M12 (INVENTED-DIALOGUE built on it)']),
  note: 'The folk belief is people:M10 (Käringön names for the bird); no island-lore hook backs it, so there is no lore link.',
});
add({
  id: 'wildlife.mareld', name: 'Sea sparkle (mareld)', category: 'wildlife',
  where: { anchor: 'open-water', rule: 'any dark water, strongest where the boat or an oar disturbs it' },
  density: { chance: 0.5, cap: 1, areaM: 1500 },
  when: { timeOfDay: ['night'], season: ['late-summer'], weather: ['calm'] },
  routine: 'The wake and every oar dip glow green-blue and fade.', movement: 'follows-boat',
  tap: { effect: 'show', reach: 'small', line: 'You trail a hand over the side: sparks run off your fingers.' },
  anchored: { effect: 'look-closer', line: 'The boat swinging on the anchor stirs a faint glow all round.' },
  sighting: { kind: 'weather', line: 'Mareld off {place}. Every oar-dip a handful of sparks.', drawing: 'mareld' },
  rarity: 'uncommon', source: DESIGN('"Mareld (sea sparkle)" is an ALIVE-SEA idea, a night reward for the day/night stage'),
});
add({
  id: 'wildlife.jellyfish', name: 'Jellyfish drifting', category: 'wildlife',
  where: { anchor: 'open-water', rule: 'in the shallows near villages and harbours, drifting with the current' },
  density: { chance: 0.2, cap: 3, areaM: 300 },
  when: { season: ['late-summer'], timeOfDay: ['morning', 'midday', 'afternoon'] },
  routine: 'Pale bells pulse slowly just under the surface.', movement: 'drift',
  tap: { effect: 'look-closer', reach: 'small', line: 'Pretty, and best looked at from the boat.' },
  sighting: { kind: 'fish', line: 'Jellyfish drifting in at {place}. The bathers will know.', drawing: 'jellyfish' },
  source: DESIGN('"Jellyfish drifting in late-summer water" is an ALIVE-SEA idea'),
});

// ---------------------------------------------------------------------------------------------------------------
// DRIFT FINDS. In reach = yours (tap reach, no aiming). Storm weather raises the chance. Artifacts link here from artifacts-1950.json.
// ---------------------------------------------------------------------------------------------------------------
const STORM = { weather: ['after-squall'] };
function drift(id, name, chance, rule, line, sight, drawing, extra = {}) {
  add({
    id, name, category: 'drift', years: [1900, 1990],
    where: { anchor: 'open-water', rule },
    density: { chance, cap: 2, areaM: 500, stormBoost: 3 },
    when: extra.when || {},
    routine: extra.routine || 'Drifts with the wind and current; the same box seen twice will be somewhere else.', movement: 'drift',
    tap: { effect: 'pickup', reach: 'small', line }, approach: extra.approach || NONE_APPROACH,
    sighting: { kind: 'finds', line: sight, drawing },
    rarity: extra.rarity || 'common',
    source: extra.source || DESIGN('a drift-find idea from ALIVE-SEA.md ("flotsam from the storm as souvenirs", "a lost oar or fish box")'),
    ...(extra.lore ? { lore: extra.lore } : {}),
  });
}
const NONE_APPROACH = { effect: 'none' };
drift('drift.fish-box', 'A fish box', 0.3, 'afloat in open water; heavier after a blow; stencilled with a port (Grundsund, Käringön, Gullholmen or Lysekil)',
  'You hook it with the boathook and lift it aboard. A stencilled name on the end.', 'A fish box adrift off {place}, stencilled with a port.', 'box',
  { source: src('grounded', ['docs/ALIVE-SEA.md (lost item template: a fish box)', 'lore:village:Gullholmen quest seed (a fisherman has lost a fish box in the storm)'], 'the box and its owner are INVENTED; fish boxes are the right kind of object for a 1950 mackerel coast') });
drift('drift.oar', 'A lost oar', 0.25, 'afloat, blade up, usually near a landing or a skerry where someone has been rowing',
  'You fish it out. It has been used hard; the loom is worn smooth.', 'An oar drifting off {place}. Somebody is walking home.', 'oar');
drift('drift.cork-float', 'A cork net float', 0.3, 'afloat in a line or alone, near fishing grounds; sometimes a few still on a bit of rope',
  'A cork float, tarred. Some net is missing it.', 'A cork float off {place}, tarred and salted.', 'float',
  { source: src('grounded', ['people:Q09 (nets and net boxes)', 'lore:village:Grundsund artifact "seine-net cork float"'], 'the drifting float is INVENTED; the cork seine float is in the lore') });
drift('drift.glass-float', 'A green glass float', 0.05, 'bobbing in open water, far from any net; a rare find',
  'Green glass, thick, with a seam. It rolls in your hand like a heavy bubble.', 'A glass net-float adrift outside {place}. Green as bottle glass.', 'glass-float',
  { rarity: 'uncommon', source: DESIGN('an invented rare find; glass net floats existed on the Scandinavian coast but this one was not researched for Bohuslän') });
drift('drift.bottle', 'A bottle with a note', 0.04, 'riding low in the water in a quiet bay or lee',
  'A corked bottle with a paper rolled inside, very damp.', 'A bottle with a note off {place}. The paper points somewhere.', 'bottle',
  { rarity: 'uncommon', source: DESIGN('"A message in a bottle that points somewhere on the chart" is an ALIVE-SEA idea; what the notes say is for the rumour/quest files') });
drift('drift.crate-stencilled', 'A crate stencilled with a ship\'s name', 0.12, 'after a blow, drifting among broken planks; a ship\'s name painted on the lid',
  'The stencil is half washed off. A ship that lost a deck load.', 'A crate off {place} stencilled with a ship\'s name.', 'crate',
  { when: STORM, rarity: 'uncommon', source: DESIGN('"a crate stencilled with a ship\'s name" is an ALIVE-SEA idea; the name on each crate is drawn from a short INVENTED list') });
drift('drift.barrel', 'A drifting barrel', 0.15, 'afloat, stave-built, usually empty; one end stamped',
  'Hollow and loud when you knock it. It floats high.', 'A barrel adrift off {place}. Empty, and glad of it.', 'barrel',
  { when: STORM, source: src('grounded', ['docs/ALIVE-SEA.md and GAME-DESIGN.md: pair net sweeps "drifting barrels"', 'lore:storm-day wrecks with salt, coal, petroleum barrels (ISLAND-LORE.md)'], 'barrels from wrecks are real in the register; this one is INVENTED') });
drift('drift.driftwood-plank', 'A plank from a wreck', 0.2, 'afloat after a blow, with rusted nails or treenails still in it',
  'Oak, black with age. Nails as thick as your finger.', 'A plank off {place}, with a treenail still in it. From which ship?', 'plank',
  { when: STORM, source: src('grounded', ['lore:village:Gullholmen (treenails in the harbour wreck)', 'lore:relation/10239114 (the old keel)'], 'a drifting plank is INVENTED; wrecks and treenails are in the lore') });
drift('drift.pot-float-lost', 'A lost pot float with a flag', 0.1, 'adrift with a short rope and a scrap of cloth for a flag',
  'Someone\'s pot float, lost from its line. The flag is a rag on a stick.', 'A pot float with a little flag off {place}, cut loose.', 'pot-float',
  { source: DESIGN('"lobster and pot floats with little flags" is an ALIVE-SEA idea; this is the lost one') });
drift('drift.net-tangle', 'A tangle of net', 0.2, 'afloat in a ball of cork floats and knotted twine',
  'It takes some hauling. Mostly floats and weed, and a single crab.', 'A tangle of net adrift off {place}. Somebody will want the floats.', 'net-tangle',
  { source: src('grounded', ['people:Q09 (nets froze stiff in the net box)'], 'the drifting tangle is INVENTED') });
add({
  id: 'drift.toy-boat', name: 'A child\'s wooden toy boat', category: 'drift', years: [1930, 1990],
  where: { anchor: 'open-water', places: ['relation/10239114', 'light:Stångehuvud'], rule: 'drifted from the Käringön pier toward Saltskär, or from the rocks below the dark Stångehuvud light' },
  density: { chance: 0.4, cap: 1, areaM: 300 },
  routine: 'Floats upright with a stubby mast; the sail is a scrap of sheet.', movement: 'drift',
  tap: { effect: 'pickup', reach: 'small', line: 'Whittled by someone who loved it. There is a name cut under the keel.' },
  sighting: { kind: 'finds', line: 'A toy boat adrift off {place}. A child is looking for it.', drawing: 'toy-boat' },
  source: src('grounded', ['lore:relation/10239114 questSeeds[0]', 'lore:light:Stångehuvud questSeeds[1]'], 'both lore quest seeds are INVENTED hooks'),
  lore: { place: 'relation/10239114', hook: 'questSeeds', index: 0 },
});
add({
  id: 'drift.drifting-skiff', name: 'A small boat adrift', category: 'drift', years: [1900, 2030],
  where: { anchor: 'open-water', rule: 'a small open boat, unmanned, drifting loose near a landing (src/life.js has a drifting small boat)' },
  density: { chance: 0.08, cap: 1, areaM: 800, stormBoost: 4 },
  when: STORM, routine: 'Wallows slowly downwind, an oar trailing.', movement: 'drift',
  tap: { effect: 'hail', reach: 'large', line: 'No one aboard. Take her in tow, or tell the owner where she went?' },
  approach: { effect: 'look-closer' },
  sighting: { kind: 'boats', line: 'An empty boat adrift near {place}. Whose?', drawing: 'skiff' },
  rarity: 'uncommon',
  source: src('ported', ['src/life.js: "the drifting small boat"', 'docs/ALIVE-SEA.md: "a boat in trouble", "after the squall" quest template'], 'the drifting boat is ported; its owner and the tow are quest content'),
});

// ---------------------------------------------------------------------------------------------------------------
// GEAR and AMBIENT LIFE ASHORE (the cheap ones: smoke, washing, bells, nets drying).
// ---------------------------------------------------------------------------------------------------------------
add({
  id: 'gear.pot-floats', name: 'Pot floats with little flags', category: 'gear',
  where: { anchor: 'skerry', rule: 'bobbing in lines along rocky shores in bays and lees; skerries and island shores' },
  density: { chance: 0.3, cap: 4, areaM: 300 },
  when: { season: ['autumn'] },
  routine: 'A line of floats, each with a little flag; a fisherman hauls them at dawn.', movement: 'stationary',
  tap: { effect: 'look-closer', reach: 'small', line: 'Somebody\'s pots. Leave them be.' },
  approach: { effect: 'shout', line: 'If you sail right through the line, the fisherman shouts. Not angry, just loud.' },
  sighting: { kind: 'boats', line: 'Pot floats with little flags at {place}. Sailed round them.', drawing: 'pot-floats' },
  source: src('invented', ['docs/ALIVE-SEA.md: "Lobster and pot floats with little flags in bays; fishermen shout if you sail through"'], 'ALIVE-SEA notes the lobster season opens in autumn and that date rules changed over the years; not checked for 1950'),
});
add({
  id: 'ashore.chimney-smoke', name: 'Smoke from the chimneys', category: 'ashore',
  where: { anchor: 'village', rule: 'every village and fishing hamlet, thicker at dawn and dusk' },
  density: { chance: 1, cap: 1, areaM: 300 },
  when: { timeOfDay: ['dawn', 'dusk', 'morning'] },
  routine: 'Straight up in calm, flat along the roofs in a westerly: it tells you the wind.', movement: 'stationary',
  sighting: { kind: 'places', line: 'Smoke from the chimneys at {place}, leaning east.', drawing: 'chimney' },
  source: src('invented', ['docs/ALIVE-SEA.md: "Life ashore: smoke from chimneys"; "reading the wind: smoke and flags ashore"']),
});
add({
  id: 'ashore.washing-lines', name: 'Washing on the lines', category: 'ashore',
  where: { anchor: 'village', rule: 'between the houses and on the rocks above the quay' },
  density: { chance: 0.8, cap: 1, areaM: 300 },
  when: { timeOfDay: ['morning', 'midday'], dayType: ['fine-sea-breeze', 'calm-misty-morning'] },
  routine: 'Sheets, shirts and long woollen drawers, stiff and flapping.', movement: 'stationary',
  sighting: { kind: 'places', line: 'Washing out on the rocks at {place}. A good drying wind.', drawing: 'washing' },
  source: src('invented', ['docs/ALIVE-SEA.md: "washing on lines"']),
});
add({
  id: 'ashore.nets-drying', name: 'Nets hung to dry', category: 'ashore',
  where: { anchor: 'village', rule: 'on poles and over fences by the quay; brown tanned nets' },
  density: { chance: 0.7, cap: 2, areaM: 300 },
  when: { timeOfDay: ['morning', 'midday', 'afternoon'] },
  routine: 'Long brown curtains of net, with cork floats in a row along the top.', movement: 'stationary',
  tap: { effect: 'look-closer', reach: 'large', line: 'Tarred and cutch-brown. Every hole has been mended twice.' },
  sighting: { kind: 'places', line: 'Nets hung to dry at {place}.', drawing: 'nets' },
  source: src('grounded', ['people:Q09 (nets, net boxes)', 'lore:village:Käringön net-mender'], 'the scene is INVENTED from the sourced fishing life'),
});
add({
  id: 'ashore.church-bells', name: 'Church bells on a Sunday', category: 'ashore',
  where: { anchor: 'village', places: ['village:Grundsund', 'village:Fiskebäckskil', 'village:Käringön', 'village:Gullholmen'], rule: 'carries across the water to a boat within about 500 m' },
  density: { chance: 1, cap: 1, areaM: 600 },
  when: { timeOfDay: ['morning'] },
  routine: 'Rings the hour of service, once each Sunday morning.', movement: 'stationary',
  sighting: { kind: 'places', line: 'Church bells carrying across the water from {place}. A Sunday.', drawing: 'church' },
  source: src('grounded', ['people:Q12 (Fiskebäckskil church 1772 with votive ships; Grundsund church 1799)', 'history-start-area.md (Käringön church 1796, Gullholmen 1799)'], 'the churches are sourced; hearing the bells from a boat is INVENTED'),
});
add({
  id: 'ashore.dog-on-quay', name: 'A dog barking on the quay', category: 'ashore',
  where: { anchor: 'berth', rule: 'a working quay in a village; one dog, tied or free' },
  density: { chance: 0.4, cap: 1, areaM: 300 },
  when: { timeOfDay: ['morning', 'midday', 'afternoon'] },
  routine: 'Barks at every boat that comes close, then loses interest.', movement: 'stationary',
  approach: { effect: 'shout', line: 'A bark, then a second, politely.' },
  tap: { effect: 'wave-back', reach: 'medium', line: 'Wag, wag.' },
  sighting: { kind: 'people', line: 'A dog on the quay at {place}, barking us in.', drawing: 'dog' },
  source: src('invented', ['docs/ALIVE-SEA.md: "a dog barking as you pass"']),
});
add({
  id: 'ashore.aga-lights-at-dusk', name: 'The automatic lights coming on at dusk', category: 'ashore',
  where: { anchor: 'light', rule: 'every automatic (AGA) light in the window that is lit, one by one as the sun valve closes' },
  density: { chance: 1, cap: 1, areaM: 100 },
  when: { timeOfDay: ['dusk'], storyPhase: ['task:done'] },
  routine: 'The black rod cools, the valve opens, the flame catches: no one is there to see it.', movement: 'stationary',
  sighting: { kind: 'lights', line: 'The light at {place} came on by itself at dusk, as it should.', drawing: 'aga-light' },
  rarity: 'uncommon',
  source: src('researched', ['people:G04 (the sun valve 1907, light heats the black rod, a lever opens the gas)', 'docs/ALIVE-SEA.md day/night grill 5 and 9 (AGA lights switch themselves on at dusk; your lights come on one by one)'],
    'The template is the sourced mechanism applied to the story moment after the lights are relit.'),
});
