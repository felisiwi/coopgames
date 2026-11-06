// The words of the 1950 start (stage 1e, batch 2): the opening scene's captions, the waking cards and Britta's card. One file, so the story can be edited without
// touching code. Pure data, no THREE and no DOM.
//
// ALL OF THIS IS DRAFT COPY. The design (GAME-DESIGN.md "The flow, revised: wake in 1950") fixes the BEATS, not the sentences, so the sentences here are mine.
// TODO(felix): confirm every line. Spoken lines are INVENTED-DIALOGUE (no source says them). Real facts used: Britta is about 14 (story/characters/britta-1950.md);
// the granddad of 1950 is a boatbuilder's son (GAME-DESIGN.md, Svalan's loop); he is NOT named anywhere in the design, so he is not named here either.
// Not said on purpose: Britta's finale line ("I've been waiting for you since 1950") stays for the finale. The year is not stated on a card: TODO(felix): say
// "1950" out loud, or let the player work it out (the boats, the lights and the ferry are the clue)?

// ---- the opening: in the engine, ~42 s, not playable, skippable, shown once (batch 2b; replaces the SVG scene) ---------------------------------------------------
// Dusk over today's Fiskebäckskil (the Today world: modern boats, the ferry with its lights, lit windows), the camera settles on one house by the water with Svalan
// at its jetty; fog, thunder, darkness with flashes; then the lighthouse rewind in the dark (src/rewind.js); then it is 1950 and the game begins at dawn.
// `at`/`dur` in seconds. The rewind's length is REWIND.durationS in src/rewind.js (15 s): keep the two in step (the test checks).
export const OPENING_PLAN = [
  { id: 'dusk', at: 0, dur: 10 },     // blue hour, the camera settles on the house
  { id: 'fog', at: 10, dur: 6 },      // fog rolls in, the light goes
  { id: 'storm', at: 16, dur: 8 },    // thunder, darkness with flashes
  { id: 'rewind', at: 24, dur: 15 },  // the lighthouse rewind
  { id: 'hold', at: 39, dur: 2 },     // stopped at 1950
  { id: 'out', at: 41, dur: 1.5 },    // a last flash; the game takes over
];
export const OPENING_TOTAL_S = OPENING_PLAN.reduce((t, b) => Math.max(t, b.at + b.dur), 0);
// Three short cards, one at a time, in this order (Felix): where and when (tied to today; two lines), the fog, going down to Grandpa's boat. "Grandpa" everywhere in the game's text, never "Granddad". Then the lightning strikes, then dark, then
// the lighthouses: no line over those. No explanation of time travel. DRAFT wording of (a) is Felix's with "today" added: TODO(felix): confirm.
export const OPENING_LINES = [
  { from: 1.2, to: 7.2, text: 'Fiskebäckskil, today\nGrandma and Grandpa’s house' }, // two lines (Felix)
  { from: 10.4, to: 15.4, text: 'A strange fog is rolling in.' },
  { from: 16.4, to: 21.8, text: 'You go down to make Grandpa’s boat, Svalan, fast.' }, // Svalan is Grandpa's boat
];
// Lightning (seconds into the opening) and the thunder that follows each (seconds later). The last one is THE STRIKE: it is followed by the dark.
export const OPENING_FLASHES = [{ at: 18.6, thunderAfter: 1.5 }, { at: 20.3, thunderAfter: 0.9 }, { at: 22.3, thunderAfter: 0.25, strike: true }];
export const OPENING_DARK = { from: 22.55, full: 22.8, until: 23.9, back: 24.9 }; // after the strike the screen goes black; the lighthouses come up out of it at 24.9 (the rewind starts at 24)
export const OPENING_SKIP = 'Skip';

// ---- chapter 1, the first story beats (batch 2c; replaces the waking cards and Britta's old start card) -------------------------------------------------
// One speaker per card, no busy two-person cards. Every spoken line is INVENTED-DIALOGUE (no source says it). TODO(felix): confirm every line. The boy is the young granddad, a
// boatbuilder's son; the player does not know that, so he is only "The boy" (the design does not name him). Britta is NOT here: she is in Fiskebäckskil (batch 3).
//
// Beat 1, on the beach at dawn: the boy finds you, his father will take Svalan, he lends you the small boat (the eka), and asks you for a first errand.
export const FIND_CARDS = [
  { title: 'The boy', lines: ['“You’re alive. That was some storm.”', '“I saw a wave throw you up on the shingle.”'], button: 'Next' }, // INVENTED-DIALOGUE
  { title: 'The boy', lines: ['“Is that your boat? My father builds boats.”', '“He’ll haul her up and mend her.”'], button: 'Next' }, // INVENTED-DIALOGUE
  { title: 'The boy', lines: ['“You can’t go anywhere in that. Take our old eka until she’s ready.”'], button: 'Next' }, // INVENTED-DIALOGUE (the loan: GAME-DESIGN.md)
  { title: 'The boy', lines: ['“Father needs fittings from Grundsund for her.”', '“It’s a short sail south. Will you fetch them?”'], button: 'Set sail' }, // INVENTED-DIALOGUE (the errand: GAME-DESIGN.md)
];
// Beat 2: at Grundsund. One speaker (an invented chandler; the quay, the trade and the line are mine). TODO(felix): confirm who gives you the parts.
export const PARTS_CARD = { title: 'The chandler', lines: ['“For the boatbuilder? Here, a bundle of fittings.”', '“Mind they don’t go overboard.”'], button: 'Take the parts' }; // INVENTED-DIALOGUE
// Beat 3: back at the yard on the beach: "It'll be a while. Careful, the lights are out since the storm. Someone in Fiskebäckskil was asking for help." (Felix's text, split by speaker turns)
export const YARD_CARDS = [
  { title: 'The boy', lines: ['“Good, that’s them. It’ll be a while before she’s ready.”', '“Careful out there. The lights have been out since the storm.”'], button: 'Next' }, // INVENTED-DIALOGUE
  { title: 'The boy', lines: ['“Someone in Fiskebäckskil was asking for help.”', '“Go and see. Take the eka.”'], button: 'Set sail' }, // INVENTED-DIALOGUE
];
// What the "Now" card (the chart's Task button) says in each phase of the beats, and the one-line HUD text.
export const OBJECTIVES = {
  find: { hud: '', now: 'Someone is speaking to you.' },
  errand: { hud: 'fittings from Grundsund', now: 'Sail to Grundsund and fetch the fittings for the boatbuilder.' },
  return: { hud: 'back to the yard', now: 'Take the fittings back to the boatbuilder’s yard on Skaftö.' },
  free: { hud: 'Fiskebäckskil', now: 'Someone in Fiskebäckskil was asking for help.' },
};
export const NOW_TITLE = 'Now';
export const EASE_OFF_GRUNDSUND = 'Ease off to tie up at the quay in Grundsund';
export const EASE_OFF_YARD = 'Ease off to come alongside the yard';
export const FITTINGS_TOAST = 'Fittings aboard · back to the boatbuilder';
export const HELP_TOAST = 'Fiskebäckskil: someone asked for help';
export const YARD = { id: 'yard:boatbuilder', name: 'The boatbuilder’s yard', kind: 'yard', desc: 'The boatbuilder’s yard' };

// ----------------------------------------------------------------------------------------------------------- batch 3: the job, in 1950
// The stops, in order: the depot (gas), the four automatic lights, Måseskär's keeper, Britta in Fiskebäckskil. Names are the light names in src/lights-1950.js.
export const LIGHTS_1950 = ['Hättan', 'Gäven', 'Stångholmen', 'Fredagsholmen']; // the four AGA lights you relight (Felix, stage 1e)
export const KEEPER_LIGHT = 'Måseskär';
export const FUTURE_LIGHT_NAME = 'Kråksundsgap Södra'; // the small 1941 iron lantern; in the glimpse it is the 1954 tower
export const DEPOT = {
  id: 'depot:Lysekil', name: 'Gas depot, Lysekil quay', desc: 'Gas from Erholmen, delivered to Lysekil.',
  village: 'village:Lysekil', // where the quay is looked for: the water off Lysekil's village point
};

export const DEPOT_CARD = {
  title: 'Lysekil quay',
  lines: [
    'Gas from Erholmen, delivered to Lysekil.', // Felix's wording
    'Four heavy tubes go into the eka, one for each light.', // the tubes: docs/PEOPLE-1950.md (about 100-120 kg each)
    'On top, a sack of post and old newspapers for the keeper on Måseskär.', // INVENTED (grounded: keepers' families prized post and newspapers, PEOPLE-1950.md section 1)
  ],
  button: 'Cast off',
};
export const NO_GAS_HINT = 'No gas yet. Fetch the tubes from the quay in Lysekil.';
export const EASE_OFF_DEPOT = 'Ease off to tie up at the quay';

// What you do at an automatic light, as short lines while the camera circles it (the steps are the documented AGA routine: land the tubes, fit a full one, open the valve
// slowly, check the pilot flame; docs/PEOPLE-1950.md section 2). `at` = seconds after mooring (the lamp catches at 6.6 s: src/relight.js). The "pop" is the flasher.
export const RELIGHT_STEPS = [
  { at: 0.3, text: 'Land the tube on the rock' },
  { at: 2.6, text: 'Fit the full tube. Open the valve slowly' },
  { at: 4.6, text: 'Check the pilot: big and blue, no yellow' },
  { at: 5.9, text: 'Wait for the flasher…' },
];

// The keeper of Måseskär: INVENTED and unnamed (no named 1950 keeper exists in our sources; real people's names are not used). Lines grounded in docs/PEOPLE-1950.md section 1
// (storm-petrel lore, "stormtrollet"; the pattern three flashes in 30 s) and written by me: INVENTED-DIALOGUE. TODO(felix): confirm.
export const KEEPER_CARDS = [
  { title: 'Måseskär', lines: ['You tie up under the lighthouse. A keeper comes down the rock.', '“Post, and newspapers. Bless you.”'], button: 'Next' },
  { title: 'The keeper', lines: ['“Three flashes in thirty seconds. That is Måseskär, and nobody else may say it.”', '“Tonight there were more little black birds round my lamp than I like.”'], button: 'Next' },
  { title: 'The keeper', lines: ['“And there is a glow out east I can’t put a name to.”', '“It flashes twice and waits, like a proper light.”'], button: 'Sail on' },
];

// Back in Fiskebäckskil: Britta, then the boatbuilder's son (the lights talk, in person), then Svalan. Replaces grandma's card and the chest.
export const REPORT_CARDS = [
  { title: 'Britta', lines: ['“I watched them come on, one by one.”', '“Even Måseskär has its post.”'], button: 'Next' }, // INVENTED-DIALOGUE
  { title: 'The boatbuilder’s son', lines: ['“The lights talk, if you know how to listen.”'], quote: true, dusk: true, button: 'Next' }, // INVENTED-DIALOGUE (the line is Felix's, from grandma's card)
  { title: 'Svalan', lines: ['She is back in the water, mended and freshly painted.', 'The eka goes home. Svalan is yours to sail.'], button: 'Carry on sailing' },
];
// After the fourth light: a short nudge (not the ending): the keeper is still waiting. Its button sets Navigate to Måseskär.
export const KEEPER_NUDGE = { title: 'All four lights are burning.', lines: ['Måseskär’s keeper is still waiting for his post.', 'It is a long sail out to the rock.'], button: 'Navigate to Måseskär' };
export const GLOW_TOAST = 'A glow out east, the keeper said. Kråksundsgap is marked on the chart.';

// The glimpse (stage 1e): sail near Kråksundsgap Södra and, for a moment, the small iron lantern is the tall white tower with its new sectors, then it is gone.
export const FUTURE_CARD = { lines: ['That tower is not here yet.', 'But you saw it.'], button: 'Carry on sailing' };

// What game.js hands to createTaskUi for the 1950 game.
export const STORY_1950 = { find: FIND_CARDS, parts: PARTS_CARD, yard: YARD_CARDS, depot: DEPOT_CARD, keeper: KEEPER_CARDS, report: REPORT_CARDS, keeperNudge: KEEPER_NUDGE };
