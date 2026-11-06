# Sounds of 1950 (the sound lab)

Synthesised sounds for the 1950 home base, in `src/sounds-1950.js`, with a phone-first lab to judge them by ear: `sound-lab.html` (one button
per sound, sliders for the main parameters, every setting kept in the address; `?cpu=1` measures on load). No sample files and nothing third-party
(the same rule as `src/audio.js`, recorded in `docs/LURE.md`). Nothing here touches `game.js` or `src/audio.js`.

**Felix judges by ear.** This page says what is *documented* (a source I read says it), what is *derived* (our arithmetic) and what is a *guess*
(shaped by ear, not sourced). Where the research found nothing, the sound is a guess and says so on the page.

## Calling the sounds from the game

```js
import { createSounds1950 } from './src/sounds-1950.js';
const s = createSounds1950(ctx, destination);   // an existing AudioContext and the node to plug into (default ctx.destination)
const e = s.engine({ rpm: 330, cylinders: 1 }); // continuous sounds return a handle: setRpm / setDistance / setGain / setDoppler / stop
s.passingBoat({ speedMs: 5, closestM: 30 });    // comes, passes, goes: distance falloff, Doppler, pan; stops itself
s.relight1950({ flashes, period, cycles: 2 });  // flashes + period from src/light-glyph.js lightGlyph(light)
s.storm({ level: 1 });  s.thunder({ distanceKm: 2 });  s.wind({ strength }); s.rain({ intensity }); s.seaLap({ level });
s.mistSignal({ distance: 0 }); s.handBell(); s.halyards({ wind: 0.4 }); s.rowing({ spm: 22 }); s.gull({ type: 'kyow' }); s.gulls({ rate: 0.6 });
s.ambience('evening').setPreset('storm', 3);    // calm | evening | storm, with per-layer levels
s.setVolume(0.8);  s.stopAll();  s.stats();     // stats(): nodes made, live voices, running streams
```

Every function is silent-safe in the game's style (the caller owns the context and the first-tap unlock). `{ manual: true }` skips the timers and lets a
test or an offline render call `s.pump(untilSeconds)`; `{ random }` makes a run repeatable. The recipes (`ENGINE`, `TYFON`, `AGA`, `AMBIENCE`,
`beatInterval`, `engineGain`, `engineCutoff`, `dopplerRate`, `passingState`, `blastTimes`, `flasherSchedule`...) are exported as plain data and maths.

## 1. The hot-bulb engine (tändkulemotor)

**Documented**
- The hot-bulb engine is "the origin of the classic dunk-dunk sound of old fishing boats". It was mostly a **single-cylinder two-stroke**, and the bigger
  Bohuslän fishing boats often had **two-cylinder** versions of relatively large power. Because it ran at **low revs** it needed a heavy flywheel.
  [sv.wikipedia, Tändkulemotor, read; it cites Bohusläningen's "Klassiskt ljud fortsätter locka till Tändkulemotorns dag", 2019]
- "The engines' often low revs combined with large engine volume give them their liked and characteristic sound"; the fishing boats' "härliga och sköna
  **lunkande** ljud" (a plodding, rolling sound). [tandkulemotorer.se, read]
- A 1905 Bolinder marine semi-diesel: a vertical single-cylinder two-stroke, **9 hp at 375 rpm**; the exhaust goes through a muffler. [Powerhouse Collection
  object 208966: **seen only as a search summary**, weak]
- Before starting, the bulb is heated 10-20 minutes with a paraffin blowtorch (Primus, Sievert); then the engine's own heat keeps it going. [sv.wikipedia; tandkulemotorer.se]

**Derived.** A two-stroke fires once a revolution, so 375 rpm = 6.25 beats a second (`beatInterval(375) = 0.16 s`). Two cylinders fire twice a revolution.

**Guesses (by ear).** Idle 170 rpm (2.8 dunks/s) and cruise 330 rpm (5.5/s): "low revs" is documented, the numbers are ours. The two-cylinder firing split (42/58, an
uneven "dunk-dunk ... dunk-dunk") is ours. The exact timbre of the dunk: a falling low pulse, strong upper partials (so a **phone speaker, which plays almost nothing
below ~150 Hz, still carries it**), a pressure thud, a muffler puff, a small tail pulse; ±4.5% timing wobble and three slightly different dunks so it is not a metronome.
Distance: gain falls as `(14/(14+d))^1.15` and a low-pass closes with distance (air takes the top off); a passing boat adds a Doppler glide and a pan.

## 2. The AGA relight

**Documented** (`docs/PEOPLE-1950.md` section 2: fyr.org wiki and a 1955 US Coast Guard manual for the same apparatus)
- A light **"pop" is heard each time the flasher functions**. The flasher is a gas-pressure diaphragm valve; the burner makes a clear, soot-free flame lit from a permanent pilot.
- The pilot, when right, is a **large blue flame**; yellow means soot. In daylight you can test it with a match held over it.
- The **sun valve's seat is magnetised to give a clear open/closed snap**. The gas smells faintly of garlic.
- The light's pattern: Måseskär Bx(3) W 30 s (three flashes in 30 s) in 1950 (`docs/WORLD-1950.md`).

**Guesses.** The clunk of a heavy cylinder and a wrench on a brass nut, the rising hiss of the valve, the "whump" of the pilot catching, the quiet pilot hiss, the soft puff of
gas for each flash, the flash length at Måseskär (1.5 s). **Not documented anywhere I read:** any hiss, tick or click of an AGA light. The relight order follows PEOPLE-1950's
steps (clunk, clunk, gas, pilot lights, pilot burns, sun-valve snap, then the flasher's pops in the light's own pattern).
Hättan (two flashes / 6 s) and Gäven (three / 9 s) use **today's** patterns from the game's data: the 1950 ones are not documented.

## 3. Storm

Wind, rain, thunder, and the sea under them. **All character is ours**, shaped by ear: noise beds made once by maths with the filtering built in (wind: a low rumble under a band,
gusts from two slow oscillators and a wail that appears only in a real blow; rain: drops in handfuls; sea: swells that come and go); thunder is a crack (only if near) and a long
falling rumble with several swells as it rolls round the skerries, delayed by distance (shortened so a game need not wait; the real figure is ~0.34 km/s).

## 4. Harbour and coast

- **The mist signal: a tyfon.** **Documented:** a metal diaphragm set vibrating by steam, later compressed air; invented 1920 by H. Rydberg at Kockums, Malmö; theoretical range about
  5 nautical miles; Swedish tyfons were often **two-tone, about 210 Hz and 260 Hz** (the Draghällan "supertyfon"), one at 255 Hz; Måseskär's from 1950 gave **two blasts every 30 s
  (2 + 4 + 2 + 22 s)**. [fyrwiki Tyfon; fyrwiki Mistsignal ljud; fyrwiki Måseskär via PEOPLE-1950 A01; all read.] The International Collision Regulations put a fog signal's
  fundamental in 70-700 Hz (a regulation, search summary). **Guess:** the buzzy, leaning-up timbre (a saw and a square per tone, a diaphragm "rasp"), the dulling with distance.
- **Gulls, hand bell, halyards, oars:** **not sourced.** Three gull calls (a short mew, the falling "kyow", the laughing long call) with a formant filter and vibrato; a brighter, shorter
  bell than the harbour bell in `audio.js`, in pairs like a ship's bell; wooden "tock"s of halyards slapping a mast with the odd bright "tink" of a block, random in time and busier
  with wind; an oar stroke as splash, creak, clunk of the rowlock and a few drips. The game's own gull and bell (`src/audio.js`) are untouched; these are alternatives to compare.

## 5. Ambience mixer

`calm` (sea, a light breath of wind, gulls, a little halyard tap, a far engine), `evening` (sea, little wind, a few gulls, a bell now and then, a far mist signal, a fainter far engine),
`storm` (sea, a full wind, rain, thunder, halyards slapping hard, a mist signal, no gulls). Each layer has a level 0-1 you can move by hand; changing preset fades over a few
seconds, starting and stopping layers as they cross zero. The levels are a design guess.

## CPU and levels (reported)

Measured in the lab by rendering each sound in an `OfflineAudioContext` at 44.1 kHz and timing the render (no speakers): **cpu % = render time / audio time, on one desktop thread**,
best of two renders. A phone will cost more; the audio runs on its own thread in the browser, not the game's. Peak must stay under 1.0. Four runs on 2026-11-06 (Chrome on a Mac that was also doing other work).

| sound | cpu % best (quiet machine) | cpu % worst (machine busy) | peak | rms | nodes made |
|---|---|---|---|---|---|
| engine, cruising (1 cylinder), 20 s | 0.37 | 1.5 | 0.364 | 0.112 | 117 |
| engine, two cylinders, 20 s | 0.59 | 3.91 | 0.504 | 0.15 | 207 |
| passing boat (a 56 s pass) | 0.86 | 5.69 | 0.094 | 0.017 | 315 |
| AGA relight (Måseskär, 2 periods, 70 s) | 0.19 | 1.11 | 0.318 | 0.01 | 72 |
| wind + rain, 30 s | 0.34 | 2.26 | 0.516 | 0.093 | 14 |
| storm (wind, rain, sea, thunder), 60 s | 0.53 | 2.85 | 0.57 | 0.101 | 32 |
| mist signal (tyfon), 62 s | 0.18 | 1.1 | 0.482 | 0.049 | 46 |
| halyards, windy, 20 s | 0.56 | 3.57 | 0.24 | 0.015 | 240 |
| rowing, 20 s | 0.36 | 2.01 | 0.174 | 0.006 | 114 |
| gulls, 40 s | 0.07 | 0.45 | 0.105 | 0.004 | 32 |
| ambience: calm, 30 s | 1.02 | 7.18 | 0.13 | 0.02 | 302 |
| ambience: evening, 60 s | 1.53 | 9.9 | 0.207 | 0.026 | 533 |
| ambience: storm, 60 s | 2.54 | 2.83 | 0.544 | 0.098 | 987 |

Every sound peaks well under 1.0 and nothing clips. The loudest are the storm layers (rms about 0.10) and the engine (0.11 for one cylinder), kept below the game's own bell (peak 0.22 for one strike plus its second strike) on purpose: these are background sounds. The heaviest case, the full storm ambience, is about 2.5-2.8% of one desktop thread whether the machine is quiet or busy; the calm and evening mixes vary most (1-10%) because they are many small short-lived voices that suffer when the machine is busy. **Not measured:** a real phone, and any sound through real speakers (the lab runs the graph on a real `AudioContext` at 48 kHz with 5 ms base latency, and every control was exercised with sound playing: no errors).

How it stays cheap: the engine's "dunk" is synthesised once into a 0.36 s buffer and each beat just plays it (one buffer voice per beat, no per-beat oscillators, three variants); the
wind, rain, sea and the engine's mechanical bed are looped buffers **made once with the filtering and the slow movement baked in**, so a running layer is a source, one filter and a gain
(the first version ran white noise through 3-5 live filters per layer and cost about **8 times** as much: the storm ambience read 21% before and about 2.6% after); the master is a
waveshaper soft limiter (linear to 0.7, then a knee that never reaches 1) instead of a DynamicsCompressor; event sounds are scheduled a fraction of a second ahead from one timer each.
`stats()` reports nodes made and live voices (an engine keeps 5 persistent nodes; wind + rain 14; a storm about 30-40; the storm ambience creates about 930-990 nodes over a minute, because events, halyards and thunder create short-lived ones). Screenshots: `docs/sound-lab/lab-top.png` and `lab-cpu.png` (the lab in a 390x844 frame; the table there is one single-render run, before the best-of-two change).

## Sources

| id | source | read |
|---|---|---|
| S1 | sv.wikipedia, Tändkulemotor (https://sv.wikipedia.org/wiki/T%C3%A4ndkulemotor) | yes |
| S2 | tandkulemotorer.se, Tändkulemotorer och råoljemotorer (https://www.tandkulemotorer.se/) | yes |
| S3 | Powerhouse Collection, Bolinder semi-diesel two-stroke marine engine (https://collection.powerhouse.com.au/object/208966) | search summary only |
| S4 | fyrwiki, Tyfon (https://wiki.fyr.org/index.php/Tyfon) | yes |
| S5 | fyrwiki, Mistsignal ljud (https://wiki.fyr.org/index.php/Mistsignal_ljud) | yes |
| S6 | fyrwiki, Måseskär (https://wiki.fyr.org/index.php/M%c3%a5sesk%c3%a4r), via `docs/PEOPLE-1950.md` A01 | yes (earlier) |
| S7 | `docs/PEOPLE-1950.md` section 2 (fyr.org pages AGA-ljus, Klippventil, Solventil, Acetylen; US Coast Guard Aids to Navigation Manual 1955) | yes (earlier) |
| S8 | Askerö histories, "Askerömotorer för alla sinnen" (https://www.askerohistorier.se/askeromotorer-for-alla-sinnen/): old engines "have a lovely sound" (a Skandia, a Bolinder) | yes |
| S9 | `docs/WORLD-1950.md` (Måseskär Bx(3) W 30 s; the 1950 tyfon) | yes (earlier) |

Not found: actual rpm for Bolinder or Skandia engines of the 1950s in any source (so idle and cruise are guesses); the frequency or spectrum of the "dunk"; any source for halyard, oar,
gull or bell sounds; any documented hiss, tick or click of an AGA light.

## Tests

`node games/windward/src/sounds-1950.test.js` (17 checks): the pure recipes (beat interval, falloff, Doppler, the pass, the mist pattern, the flasher schedule, presets), the synthesised dunk
(finite, headroom, ends at zero, a low thump with harmonics a phone can play, the same at any sample rate) and the noise beds (periodic, normalised, each the right character), exactly what is
scheduled when on a recording fake `AudioContext` (beat counts and pace, jitter bound, passes, tyfon blast times, pops on the flash starts), no leaks (every voice reaches the output, every
loop is told to stop, no stream left after `stopAll`), node budgets, no sample files anywhere, and the lab page's wiring.
