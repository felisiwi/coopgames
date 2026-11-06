// The words of the 1950 start (stage 1e, batch 2): the opening scene's captions, the waking cards and Britta's card. One file, so the story can be edited without
// touching code. Pure data, no THREE and no DOM.
//
// ALL OF THIS IS DRAFT COPY. The design (GAME-DESIGN.md "The flow, revised: wake in 1950") fixes the BEATS, not the sentences, so the sentences here are mine.
// TODO(felix): confirm every line. Spoken lines are INVENTED-DIALOGUE (no source says them). Real facts used: Britta is about 14 (story/characters/britta-1950.md);
// the granddad of 1950 is a boatbuilder's son (GAME-DESIGN.md, Svalan's loop); he is NOT named anywhere in the design, so he is not named here either.
// Not said on purpose: Britta's finale line ("I've been waiting for you since 1950") stays for the finale. The year is not stated on a card: TODO(felix): say
// "1950" out loud, or let the player work it out (the boats, the lights and the ferry are the clue)?

// ---- the opening scene: today, ~30 s, not playable, skippable, shown once --------------------------------------------------------------------------------
// scene: which picture src/opening.js draws (kitchen | jetty | storm | flash | dark). caption: one short line (empty = none). at/dur in seconds.
export const OPENING_BEATS = [
  { id: 'kitchen', at: 0, dur: 6, scene: 'kitchen', caption: 'Britta’s kitchen, Fiskebäckskil. Today.' },
  { id: 'window', at: 6, dur: 5, scene: 'kitchen', caption: 'Through the window: granddad’s koster, Svalan, at the jetty.' },
  { id: 'wind', at: 11, dur: 5, scene: 'jetty', caption: 'The wind is getting up.' },
  { id: 'out', at: 16, dur: 5, scene: 'storm', caption: 'You go out to make her fast.' },
  { id: 'wave', at: 21, dur: 5, scene: 'flash', caption: 'A wave. A flash.' },
  { id: 'dark', at: 26, dur: 4, scene: 'dark', caption: '' },
];
export const OPENING_TOTAL_S = OPENING_BEATS.reduce((t, b) => Math.max(t, b.at + b.dur), 0);
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
// The task itself is still "bring the lights back"; batch 3 changes what that means (gas for the automatic lights, Måseskär's keeper).
export const START_CARD_1950 = {
  title: 'Britta',
  lines: [
    '“I’m Britta. I found you first.”', // INVENTED-DIALOGUE
    '“The storm has put the lights out along the coast.”',
    '“Take the eka, sail to each one and bring its light back.”',
    '“Then come and tell me, in Fiskebäckskil.”', // TODO(felix): confirm where Britta waits (Fiskebäckskil is also the report target in the code)
  ],
  go: 'Set sail',
  skip: 'Skip',
};

// What game.js hands to createTaskUi for the 1950 game.
export const STORY_1950 = { start: START_CARD_1950, wake: WAKE_CARDS };
