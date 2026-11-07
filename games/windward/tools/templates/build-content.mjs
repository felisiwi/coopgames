// node games/windward/tools/templates/build-content.mjs [dataDir]
// Generates data/quests-1950.json, artifacts-1950.json and rumours-1950.json from the tables in quests.mjs, artifacts.mjs and rumours.mjs.
// Independent of build.mjs (the cross-file links are checked by src/templates-1950.test.js, not here). See README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTS, NOT_QUESTED } from './quests.mjs';
import { ART, HELD_BACK } from './artifacts.mjs';
import { RUMOURS } from './rumours.mjs';

const dir = process.argv[2] || fileURLToPath(new URL('../../data/', import.meta.url));
const by = (a) => { const o = {}; for (const x of a) o[x.category || x.kind || x.tier || x.truth] = (o[x.category || x.kind || x.tier || x.truth] || 0) + 1; return o; };
const write = (name, doc) => { fs.writeFileSync(path.join(dir, name), JSON.stringify(doc, null, 2) + '\n'); console.log('wrote', name, JSON.stringify(doc._counts)); };

const common = {
  _spec: 'games/windward/docs/ALIVE-SEA.md: "Grill: generated mini quests" (rounds 1 to 3), "the thing model" (rumours, regulars, warmth), "anchoring", "day and night". Ids link to data/things-1950.json (things), artifacts-1950.json, quests-1950.json, rumours-1950.json and data/island-lore.json.',
  _invented: 'Everything here is INVENTED unless a record says otherwise: each carries invented:true and a source {kind, refs}. Spoken lines are INVENTED-DIALOGUE, short, for Felix to rewrite by eye. No real private person is named.',
};

write('quests-1950.json', {
  _about: 'Quest templates for 1950 (data only, nothing reads them yet). A quest is a small chain: a NEED (a regular, a place or a happening) + 1 to 3 STEPS using existing verbs + a RESOLUTION. Slots are filled by the world from its seeds; each template must be good enough alone (ALIVE-SEA mini-quest grill 1-2). No quest log, no money, no time limits by default; at most one or two offered at once; ignored quests fade gently with a "fade" line.',
  ...common,
  _fields: {
    id: 'quest.<slug>', name: 'short title', kind: 'errand (one step) | chain', firstSlice: 'true for the three templates of the first quest slice (ALIVE-SEA mini quests, round 3, item 17)',
    giver: 'a people thing id, or a {slot}; null when the quest starts from a happening (see trigger)', trigger: '{ thing, note }: the quest is offered when the player meets this thing',
    slots: '{ name: { type, from?, rule?, label?, spawn?, spot?, nameable? } }: what the world fills in. type is one of _vocab.slotTypes',
    steps: '1 to 3 of { verb, what?, where?, to?, using?, when?, returns?, note? }; verb is one of _vocab.verbs; ids or {slots} in what/where/to',
    resolution: '{ text, receiver }: what happens at the end',
    reward: '{ warmth: small | medium, gift?: { artifacts: [ids] } | { tier, pool: [ids], teller?: slot }, rumour?: { from: thing id or slot }, knowledge?: text, nameGift?: true }. A gift is never a unique (those are only placed by Felix).',
    offeredWhen: '{ timeOfDay?, weather?, season?, storyPhase? } (same vocabulary as things-1950.json)', cooldown: '{ days }: per-template cooldown (ALIVE-SEA 15)',
    softDeadline: 'optional: a time that matters ("before the ferry"), not a limit; missing it triggers the fade line',
    lines: '{ offer, done: { gruff, chatty, shy }, fade }: short, in the giver\'s voice; {slots} are filled in',
    seeds: 'the island-lore.json quest seeds this template grows from: { place, hook: questSeeds, index }',
    source: '{ kind: grounded | invented, refs[], note }', invented: 'always true',
    loreTeller: 'the regular who tells the true story of a rare gift (ALIVE-SEA 13)',
  },
  _vocab: {
    slotTypes: ['regular', 'place', 'skerry', 'item', 'object', 'storm'],
    verbs: ['sail-to', 'find', 'pick-up', 'carry', 'deliver', 'be-there', 'hail', 'tell', 'name'],
    verbNotes: 'sail to, find, pick up, carry, deliver, be there at a time/weather are the settled existing verbs; hail, tell and name come from the tap, quest and names grills.',
    warmth: ['small', 'medium'],
    personalities: ['gruff', 'chatty', 'shy'],
  },
  _counts: { total: QUESTS.length, firstSlice: QUESTS.filter((q) => q.firstSlice).length },
  notQuested: NOT_QUESTED,
  templates: QUESTS,
});

write('artifacts-1950.json', {
  _about: 'Artifact templates for 1950 (data only). An artifact is a collectible with a TRUE STORY: the object is invented, the story it carries is sourced wherever story.kind is "sourced". Tiers: common, uncommon, rare. NO UNIQUES: those are only ever placed by Felix, from docs/UNIQUE-ARTIFACT-CANDIDATES.md; six lore artifacts are deliberately held back (see heldBack).',
  ...common,
  _fields: {
    id: 'artifact.<slug>', name: 'the object', tier: 'common | uncommon | rare (never unique)', madeEra: 'when it was made (text, as the lore gives it)', foundEra: 'eras it can be found in; ["1950"] here',
    story: '{ kind: sourced | invented, text, refs[], confidence: high | medium | low | none }: the true story it carries; sourced stories contain only claims in the refs',
    foundVia: 'thing ids (secrets, drift finds) that yield it', foundAt: 'anchor ids where a close look from an anchored boat finds it', givenBy: 'regulars who give it once they like you or after a quest',
    teller: 'the regular who tells the story ("lore is told by a regular who knows", ALIVE-SEA 13)', leadsTo: '{ quest: id | null, hook: text | null }: rare artifacts lead to small quests or story hooks (ALIVE-SEA 14)',
    sellable: '{ later, note }: common ones can be sold once there is an economy', drawing: 'silhouette slug for the logbook collection page', unique: 'always false',
    source: '{ kind, refs[], note }', invented: 'always true (the object is invented)', lore: '{ place, hook: artifacts, index } into island-lore.json',
  },
  _vocab: { tiers: ['common', 'uncommon', 'rare'], storyKinds: ['sourced', 'invented'], confidence: ['high', 'medium', 'low', 'none'] },
  _counts: { total: ART.length, byTier: by(ART.map((a) => ({ tier: a.tier }))), fromLore: ART.filter((a) => a.lore).length, fromDrift: ART.filter((a) => !a.lore).length },
  heldBack: HELD_BACK,
  templates: ART,
});

write('rumours-1950.json', {
  _about: 'Rumour records for 1950 (data only). A rumour POINTS AT a thing or a place, is TOLD through a 1950 channel (a person you hail, the evening shipping forecast on the radio, a harbour notice board, the post), lasts some days, and is TRUE or a TWIST (with what is actually so). Mostly true, sometimes a twist, never empty (ALIVE-SEA mini-quest grill round 3, item 16).',
  ...common,
  _fields: {
    id: 'rumour.<slug>', channel: 'person | radio | notice-board | post', target: '{ thing?: thing id, place?: name-list or island-lore id }: at least one',
    tellers: '[{ thing: id } | { channel: radio, program, at: place id, venue: keeper | shop-or-cafe, via?: thing id, note? } | { channel: notice-board | post, at: place id, note? }]. A radio rumour lists every place it can be heard: the Måseskär keeper\'s battery radio (venue keeper, via the keeper) and a shop or café radio in each harbour', text: 'what is said (never empty)', days: 'how many game days it keeps going round',
    truth: 'true | twist', twist: 'for a twist: what is actually so', dynamic: '"weather": truth follows the weather system (radio forecasts)', when: 'optional conditions, same vocabulary as things-1950.json',
    source: '{ kind, refs[], note? }', invented: 'always true', lore: '{ place, hook: rumours, index } into island-lore.json',
  },
  _vocab: { channels: ['person', 'radio', 'notice-board', 'post'], truth: ['true', 'twist'], radioVenues: ['keeper', 'shop-or-cafe'] },
  _counts: { total: RUMOURS.length, byChannel: by(RUMOURS.map((r) => ({ kind: r.channel }))), byTruth: by(RUMOURS.map((r) => ({ truth: r.truth }))), fromLore: RUMOURS.filter((r) => r.lore).length },
  templates: RUMOURS,
});
