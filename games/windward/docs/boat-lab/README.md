# Boat Lab

Two low-poly boats from `docs/BOAT-BRIEF.md`, behind the same API as `src/boat.js`, plus a phone-first
lab page to look at them. Nothing here is wired into `game.js` yet.

- `src/boats.js`: `createBoatMesh(color, { type, rig, deck, night, wear, sailTone }) -> { group, setSailAngle, ... }`
- `boat-lab.html` + `src/boat-lab.js`: the lab (the game's own sea, sky, light and fixed camera)
- `src/boats.test.js`: `node games/windward/src/boats.test.js`
- Screenshots in this folder (390x844, Felix's defaults): `koster-day/night.png` and `eka-day/night.png` at true
  game-camera scale; `closeups-day-night.png` is the same angle at 0.4x the distance; `rigs-reference.png` and
  `eka-sail-tones.png` are the reference rigs and the three eka sail tones.

## Felix's picks (2026-11-05) are the defaults

Svalan with **gaff + jib** (the only koster rig in the lab UI), **all three deck items**, **wear 0.8**. Defaults for the
lab link: items crate,barrel,chest; wear 0.8; sail angle 24; heading 305. The other rigs stay for reference behind
`?rig=sprit-jib` / `?rig=gaff` (and `rig` in `createBoatMesh` / `setRig`).

## The two boats

| | triangles (all options on) | notes |
|---|---|---|
| `koster` "Svalan" | ~1,030 | 8.0 m x 2.4 m (3.3:1), double-ended and pointed at BOTH ends, honey clinker strakes, deck, cuddy hatch, rudder, white sails. **No name board**: the name lives in the story, not on the model. |
| `eka` (~1700) | ~840 | 4.8 m, open clinker, tarred hull, thwarts, oars inside, one spritsail |

Both: pennant at the masthead in `color` (the player colour; sails are not tinted), three deck slots
(`deck: ['crate'|null, 'barrel'|null, 'chest'|null]`), a lantern, worn details.

### Koster hull

The plan tapers almost straight to a point at both ends; the stems rake (the keel line ends 0.5 m inboard of the sheer
line) and the forefoot / heel rise out of the water, so at the waterline each end is a knife, not a blunt box
(`waterlineHalfBeam()` in the tests). Sheer: both ends about 0.5 m above amidships. The rudder hangs on the raked stern
post, its blade going well below the waterline, with a short tiller stub.

### The gaff

`gaff-jib`: the gaff is its own mesh (`gaff-spar`), 10 cm radius and dark, so it reads as a line along the top of the
main at game scale (about 2 px). The boom is thicker and darker too. Both swing with the sail.

### Eka sail colour (`sailTone`, URL `esail=`)

`terracotta` (default, the original), `rust` (rust-brown), `bark` (dark bark-brown). `setSailTone(name)` repaints at
runtime. TODO(felix): pick one by eye. Note `bark` almost disappears against the tarred hull and the sea at night.

## Contract kept from `boat.js`

Bow = local +Z. The boom points aft at angle 0 and swings about the mast by `setSailAngle(angle)` (pass
`leewardSign * trim` as today), so the sail is to leeward by construction. `Object3D` named `boom-end` marks the clew;
`sail-pivot` is the mast step. `loadBoatModel` and `BOW_LOCAL_DIRECTION` are re-exported. The waterline is y = 0.

Extras on the returned object: `setNight(bool)`, `setWear(0..1)`, `setDeck([...])`, `setRig(name)`, `setSailTone(name)`,
`setPennantColor(hex)`, `describe()` (triangles, meshes, patches, ...).

## Porting into the game (when Felix says so)

1. `game.js`: change the import to `./src/boats.js` and the two `createBoatMesh(selfColor)` calls to
   `createBoatMesh(color, { type: 'koster' })` (the defaults are Felix's picks). The bob and tilt code, wake and phone
   controls need no change (same group, same `setSailAngle`).
2. Night: call `boat.setNight(true)` from the day-night cycle (the lab only fakes night with dim `CONFIG` colours).
3. `src/boat.js` can stay for `toFlatLambert` (used by `stage1.test.js`) or be retired once nothing imports it.

## Things to know

- **No real light for the lantern.** A new `PointLight` makes three.js recompile every material in the scene (a hitch
  on phones). The lantern is a glowing bulb, a soft additive halo sprite and a light pool on the deck / floor.
- **The eka's floor is above the waterline.** The sea plane is opaque at y = 0 and would show through an open boat.
- **Plank lines are finer than ART.md's 2-5 m facet guideline on purpose**: the brief asks for visible clinker planks.
  Wear and mending (patches, one repaired plank) are recoloured triangles, so they cost no geometry.
- Shadows: the hulls cast and receive, like `boat.js`. The lab uses the game's `normalBias` of 0.25.
