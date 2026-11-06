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
// Two or three minimal lines, no explanation of time travel (design). DRAFT: TODO(felix): confirm.
export const OPENING_LINES = [
  { from: 3, to: 9, text: 'Granddad’s koster, Svalan, at the jetty.' },
  { from: 11, to: 15.5, text: 'The wind is getting up.' },
  { from: 17, to: 23, text: 'You go out to make her fast.' },
];
// Lightning (seconds into the opening) and the thunder that follows each (seconds later, by distance).
export const OPENING_FLASHES = [{ at: 17.2, thunderAfter: 1.6 }, { at: 18.7, thunderAfter: 0.9 }, { at: 19.1, thunderAfter: 0.7 }, { at: 21.4, thunderAfter: 0.4 }, { at: 22.6, thunderAfter: 0.3 }];
export const OPENING_SKIP = 'Skip';

// ---- waking: three short cards over the first view of 1950 -----------------------------------------------------------------------------------------------
// Card 1 and 2 have a Next button; the last card is Britta's (START_CARD_1950), which is also what the chart's Task button reopens later.
export const WAKE_CARDS = [
  {
    title: 'Skaftö',
    lines: [
      'Gulls. Cold shingle under your cheek.',
      'Svalan lies on her side a few metres up the beach, planking stove in, her mast gone.',
    ],
    button: 'Next',
  },
  {
    title: 'The boatbuilder’s son',
    lines: [
      'A boy about your age is already walking round her, one hand on the planks.',
      '“My father builds boats. We’ll haul her up and mend her.”', // INVENTED-DIALOGUE
      '“You can’t go anywhere in that. Take our old eka until she’s ready.”', // INVENTED-DIALOGUE
    ],
    button: 'Next',
  },
];

// Britta's card: replaces the old storm card ("After the storm"). Same job: what happened, what to do. In her voice, ~14, a fisherman's daughter on Skaftö.
// Batch 3: the automatic (AGA) lights need new gas, which waits at the Lysekil quay ("gas from Erholmen, delivered to Lysekil": Felix).
export const START_CARD_1950 = {
  title: 'Britta',
  lines: [
    '“I’m Britta. I found you first.”', // INVENTED-DIALOGUE
    '“The storm has put the gas lights out along the coast.”',
    '“New gas from Erholmen is waiting on the quay in Lysekil.”', // INVENTED-DIALOGUE (the quay: Felix; her words: mine)
    '“Take the eka, fetch it, and bring four lights back.”',
    '“And Måseskär’s keeper is waiting for his post.”', // INVENTED-DIALOGUE
    '“Then come and tell me, in Fiskebäckskil.”', // TODO(felix): confirm where Britta waits (Fiskebäckskil is also the report target in the code)
  ],
  go: 'Set sail',
  skip: 'Skip',
};

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
export const STORY_1950 = { start: START_CARD_1950, wake: WAKE_CARDS, depot: DEPOT_CARD, keeper: KEEPER_CARDS, report: REPORT_CARDS, keeperNudge: KEEPER_NUDGE };
