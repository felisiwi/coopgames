// node games/windward/tools/templates/build.mjs [out.json]
// Generates data/things-1950.json from the tables in things-nature.mjs (wildlife, drift finds, ambient life) and things-people.mjs (people and secrets),
// then applies the sourced species check below. Independent of build-content.mjs. See README.md.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VOCAB, out } from './things-nature.mjs';
import './things-people.mjs';

// ---- the sourced species check (gate 2): applied to the wildlife templates --------------------------------------------
// status: confirmed-1950 (sourced as present around 1950) | confirmed-today (sourced as occurring on this coast now; 1950 not sourced)
//         | not-1950 (sourced as absent or not yet established) | not-checked
const W = (a) => `https://sv.wikipedia.org/wiki/${a}`;
const CHECK = {
  'wildlife.gulls-follow-boat': ['not-checked', [], 'ported from src/life.js; gulls were not part of the species check (they are everywhere on this coast)'],
  'wildlife.gulls-on-marks': ['not-checked', [], 'ported from src/life.js; gulls were not part of the species check'],
  'wildlife.eider-raft': ['confirmed-1950', [W('Ejder')], 'Resident on the west coast (sv.wikipedia: stannfågel in western Sweden; dialect name "knubbgås" on parts of Västkusten). 1950 was a LOW: the population kept falling into the early 1900s and recovered after spring hunting of sea-ducks was banned in the mid-1950s. The raft numbers are ported from today\'s code; consider a lower chance for 1950.'],
  'wildlife.eider-ducklings': ['confirmed-1950', [W('Ejder')], 'Same species as the raft (present, at a low in 1950). Early summer is the design; the article does not give a breeding month.'],
  'wildlife.harbour-seals': ['confirmed-today', [W('Knubbsäl')], 'Harbour seal (knubbsäl) is Bohuslän\'s provincial animal and lives along the west coast. 1950: protection began only in the 1970s, so seals were hunted then; present, abundance unknown. The 1988 distemper epidemic is the later event the article stresses.'],
  'wildlife.seal-pups-storon': ['confirmed-today', [W('Knubbsäl'), 'lore:relation/10604590 (county page: the seal skerries by Gåsö are a breeding area)'], 'Species sourced; pups in early summer and this skerry are the lore\'s hook (INVENTED detail on a real breeding area).'],
  'wildlife.cormorants-drying': ['not-1950', [W('Storskarv'), W('Toppskarv'), 'search summary of a Länsstyrelsen Västernorrland report (not read in full): the cormorant re-established as a Swedish breeder at the end of the 1940s, at Kalmarsund'], 'Exterminated from Sweden in the late 1800s; back as a breeder only from the late 1940s on the Baltic side; fast growth in the late 1990s. The shag (toppskarv), the other cormorant of this coast, only became a Bohuslän breeder in 2004. So neither belongs on a 1950 Bohuslän mark. years narrowed to [1990, 2030] so the 1950 engine never spawns it.'],
  'wildlife.herons-shallows': ['confirmed-today', [W('Gråhäger')], 'Grey heron is a resident (stannfågel) on Sweden\'s west coast and a fairly common breeder in the south. 1950 status not in the article.'],
  'wildlife.porpoises': ['confirmed-today', [W('Vanlig_tumlare')], 'The harbour porpoise lives along Sweden\'s coasts in the Skagerrak and Kattegatt and is the only whale regularly in Swedish waters. The article says a strong decline since the 1960s (citation needed), so it was probably commoner in 1950.'],
  'wildlife.diving-flock': ['confirmed-today', [W('Silvertärna'), W('Makrill')], 'Rests on gulls, terns and mackerel, each checked on its own; the behaviour (a flock working a shoal) is the design.'],
  'wildlife.mackerel-jumping': ['confirmed-1950', [W('Makrill'), W('Grundsund')], 'Mackerel is Bohuslän\'s provincial fish; it enters the Skagerrak and Kattegatt to spawn in April and May and is fished on the west coast mainly in spring and summer. Grundsund fished mackerel with English-built cutters from the early 1900s. The season is corrected from "late summer" to spring to summer.'],
  'wildlife.terns-dive-bomb': ['confirmed-today', [W('Silvertärna')], 'The Arctic tern breeds on coasts and in the outer archipelago along the west coast. That terns nest on Tärneskär in 1950 is INVENTED. The common tern\'s Swedish range was not found in the article read.'],
  'wildlife.storm-petrels-maseskar': ['confirmed-1950', [W('Stormsvala'), 'people:M10'], 'People:M10 records Käringön names for the bird and the belief that it foretells storms: that is the 1950-era source. Today it is seen yearly in strong westerlies off Bohuslän; the first one ringed in Sweden was caught on Härmanö huvud in 1988, so it is rare and mostly unseen.'],
  'wildlife.mareld': ['confirmed-today', [W('Mareld')], 'Mareld (mostly the dinoflagellate Noctiluca scintillans) is "most common in late summer" (sv.wikipedia). The article is not specific to the west coast or to 1950.'],
  'wildlife.jellyfish': ['confirmed-today', [W('Öronmanet'), W('Brännmanet')], 'The moon jelly (called blåmanet on the west coast) is the commonest jellyfish in Sweden; the red lion\'s mane lives on the west coast. The late-summer timing is the design, not sourced.'],
};
for (const t of out) {
  if (t.category !== 'wildlife') continue;
  const c = CHECK[t.id];
  if (!c) throw new Error('no species check for ' + t.id);
  t.speciesCheck = { status: c[0], refs: c[1], note: c[2] };
  // invented (nothing behind it) -> grounded (the species is sourced); the scene itself stays invented
  if (t.source.kind === 'invented' && (c[0] === 'confirmed-today' || c[0] === 'confirmed-1950')) {
    t.source = { ...t.source, kind: 'grounded', refs: [...t.source.refs, ...c[1]], note: 'the SPECIES is sourced (see speciesCheck); its behaviour, timing and placement here are INVENTED design' };
  }
}
const corm = out.find((t) => t.id === 'wildlife.cormorants-drying'); corm.years = [1990, 2030];
const mack = out.find((t) => t.id === 'wildlife.mackerel-jumping'); mack.when = { ...mack.when, season: ['early-summer', 'summer'] };

const byCat = {};
for (const t of out) byCat[t.category] = (byCat[t.category] || 0) + 1;
const doc = {
  _about: 'Thing templates for 1950 (Windward). A THING is something physically out there: wildlife, a drift find, a person at work, a secret. Templates are written once and PLACED by rules on real anchors from the coast data, not at coordinates; the world seed and the day seed (ALIVE-SEA.md thing model, round 1 to 3) choose which exist in a given world and on a given day. This file is DATA ONLY: nothing reads it yet. Every template marks where it comes from (source.kind) and carries invented:true when any part of it is invented. Spoken lines are INVENTED-DIALOGUE, short, for Felix to rewrite by eye.',
  _spec: 'games/windward/docs/ALIVE-SEA.md: "Grill: the thing model" (rounds 1 to 3, fields in item 7), "mini quests", "anchoring close-ups", "day and night", "logbook". Linked files (later): quests-1950.json (givers and targets by id), artifacts-1950.json (foundVia: thing ids), rumours-1950.json (teller and target: thing or place ids).',
  _fields: {
    id: 'unique, "<category>.<slug>"; stable (the change log keys on template + anchor)',
    category: 'wildlife | people | drift | secret | ashore | gear',
    years: '[from, to]: the era range the template is valid for (guessed from the sources where possible)',
    where: '{ anchor: anchor type, places?: [name-list ids to restrict it to], spot?: a spot at the place, rule: how it is placed, params?: numbers }. Placement is a fixed function of world seed + day seed + anchor + template (ALIVE-SEA 9).',
    density: '{ chance, cap, areaM, stormBoost? }: rarity per template and a cap per area (ALIVE-SEA 10)',
    when: '{ timeOfDay?, dayType?, weather?, season?, storyPhase? }: arrays; absent means any (ALIVE-SEA 7)',
    routine: 'what it does on its own, in a sentence; movement is its type',
    reactions: '{ tap, approach, anchored }: each { effect, line?, reach? (tap only: small | medium | large, scales with the thing\'s size) }',
    personality: 'people only: gruff | chatty | shy (quest line variants key on it)',
    lines: 'people only: { hail, hailAfter? }. INVENTED-DIALOGUE.',
    offers: 'people only: what hailing may lead to: rumour, errand',
    speciesCheck: 'wildlife only: { status, refs[], note }. status: confirmed-1950 | confirmed-today | not-1950 | not-checked (see _vocab.speciesStatus). A confirmed species makes source.kind grounded instead of invented; invented stays true because behaviour, timing and placement are design. not-1950 narrows years so the template does not spawn in 1950.',
    requires: '{ regular: template id, warmth: friendly | warm }: a secret that a regular reveals once they like you (hidden warmth, ALIVE-SEA 18)',
    sighting: '{ kind, line, drawing }: the logbook entry, first person, short; {place} is filled with the nearest named place; drawing is the silhouette slug',
    rarity: 'common | uncommon | rare (thing spawn rarity)',
    source: '{ kind: ported | researched | grounded | invented, refs[], note? }; see _vocab.sourceKinds',
    invented: 'true when any part is invented (source kind grounded or invented); false for ported and researched',
    lore: '{ place, hook, index }: the exact hook in data/island-lore.json (places[place].eras[1950][hook][index])',
    storyOwned: 'true: hand-placed by the story (Britta, the boy, the keeper, the depot clerk, scripted moments); the placement engine never spawns it. Kept so quests can name it and so lore links are tracked.',
  },
  _vocab: { ...VOCAB, speciesStatus: ['confirmed-1950', 'confirmed-today', 'not-1950', 'not-checked'] },
  _counts: { total: out.length, byCategory: byCat },
  templates: out,
};
const target = process.argv[2] || fileURLToPath(new URL('../../data/things-1950.json', import.meta.url));
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
console.log('wrote', target, JSON.stringify(doc._counts));
