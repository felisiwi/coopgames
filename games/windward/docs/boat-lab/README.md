# Boat Lab

Two low-poly boats from `docs/BOAT-BRIEF.md`, behind the same API as `src/boat.js`, plus a phone-first
lab page to look at them. Nothing here is wired into `game.js` yet.

- `src/boats.js`: `createBoatMesh(color, { type, rig, deck, night, wear }) -> { group, setSailAngle, ... }`
- `boat-lab.html` + `src/boat-lab.js`: the lab (the game's own sea, sky, light and fixed camera)
- `src/boats.test.js`: `node games/windward/src/boats.test.js`
- Screenshots (390x844, true game-camera scale, day + night): this folder. `closeups-day-night.png` is the same
  camera angle at 0.4x the distance, to see the detail.

## The two boats

| | triangles (all options on) | notes |
|---|---|---|
| `koster` "Svalan" | ~980 to ~1,030 | 7 m, double-ended, honey clinker strakes, deck, cuddy hatch, white sails, name on both stern quarters |
| `eka` (~1700) | ~840 | 4.8 m, open clinker, tarred hull, thwarts, oars inside, one tanned red-brown spritsail |

Both: pennant at the masthead in `color` (the player colour; the sails are no longer tinted), three deck slots
(`deck: ['crate'|null, 'barrel'|null, 'chest'|null]`), a lantern, worn details.

## Koster rigs (`rig`, koster only; the eka has one fixed spritsail)

| `rig` | from above (52 deg) | |
|---|---|---|
| `gaff-jib` (default) | trapezoid main with the gaff spar along its top edge, plus a triangular jib | richest silhouette |
| `sprit-jib` | four-cornered main cut by a bold diagonal sprit, plus a jib | the older Bohuslan look; the diagonal is thin at true scale |
| `gaff` | one big main, no jib | simplest to read, fewest triangles |

TODO(felix): pick by eye on the phone. Switching is `boat.setRig(name)` at runtime.

## Contract kept from `boat.js`

Bow = local +Z. The boom points aft at angle 0 and swings about the mast by `setSailAngle(angle)` (pass
`leewardSign * trim` as today), so the sail is to leeward by construction. `Object3D` named `boom-end` marks the clew;
`sail-pivot` is the mast step. `loadBoatModel` and `BOW_LOCAL_DIRECTION` are re-exported. The waterline is y = 0.

Extras on the returned object: `setNight(bool)`, `setWear(0..1)`, `setDeck([...])`, `setRig(name)`,
`setPennantColor(hex)`, `describe()` (triangles, meshes, patches, ...).

## Porting into the game (when Felix picks)

1. `game.js`: change the import to `./src/boats.js` and the two `createBoatMesh(selfColor)` calls to
   `createBoatMesh(color, { type: 'koster', rig: 'gaff-jib', deck: ['crate', 'barrel'], wear: 0.5 })`.
   The bob and tilt code, wake and phone controls need no change (same group, same `setSailAngle`).
2. Night: call `boat.setNight(true)` from the day-night cycle (the lab only fakes night with dim `CONFIG` colours).
3. `src/boat.js` can stay for `toFlatLambert` (used by `stage1.test.js`) or be retired once nothing imports it.

## Things to know

- **No real light for the lantern.** A new `PointLight` makes three.js recompile every material in the scene (a hitch
  on phones). The lantern is a glowing bulb, a soft additive halo sprite and a light pool on the deck / floor.
- **The eka's floor is above the waterline.** The sea plane is opaque at y = 0 and would show through an open boat.
- **Plank lines are finer than ART.md's 2-5 m facet guideline on purpose**: the brief asks for visible clinker planks.
  Wear and mending (patches, one repaired plank) are recoloured triangles, so they cost no geometry.
- **The name texture needs a browser canvas.** In node (tests) the plaques fall back to a plain board colour.
- Shadows: the hulls cast and receive, like `boat.js`. The lab uses the game's `normalBias` of 0.25.
