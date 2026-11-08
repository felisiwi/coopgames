# Windward save bridge and frozen copy (split phase 4)

Windward is moving out of coopgames into its own repo and address (`felisiwi/windward`, `docs/WINDWARD-SPLIT-PLAN.md`). A player's progress is
`localStorage`, which the browser keeps **per web address**, so the new address cannot read the old one's saves. This folder carries them across.
**Everything here is built and OFF.** With both switches untouched, the old game and the hub behave exactly as before.

## The pieces

| File | What it is |
|---|---|
| `index.html` | The old entry page. Has a small first script holding the switch `REDIRECT_TO` (empty = off). |
| `src/save-bridge.js` | Reads every `windward.*` key from this address's storage and builds `<new-address>#import=<base64url JSON>`. Tested by `src/save-bridge.test.js`. |
| `frozen.html` | The old game, as it was, labelled "the old version of Windward (frozen...)" in an always-visible HUD line. **Never redirects, no bridge.** Stays playable at its own link. |
| `game.json` | Gets `"hidden": true` when the hub should stop listing Windward (switch 2). |

The receiving side is `src/save-import.js` in `felisiwi/windward` (branch `felix/save-import`). **The two must agree on the format**: `#import=` plus
base64url (no padding) of the UTF-8 JSON `{"windward.lights.v1": "<raw string>", ...}`. `src/save-bridge.test.js` pins a golden string produced by that repo's
`encodeImport`; if it ever fails, the repos have drifted.

What the importer does (so you know what a player will see): it imports **only if the new address has no Windward save yet** (progress there is never
overwritten), accepts only `windward.*.v<n>` keys, ignores bad data, then removes the fragment from the address bar. A fragment is never sent to a server.
If the saves are too big for one link (over ~900 KB, normally a few KB), the smallest keys are carried first and the rest are logged as dropped.

## Switching it on (do these together, in this order, only when Felix's final address exists)

Do not start until: the new address is live and final; windward's `index.html` calls `runSaveImport()` before `start(...)` (wiring note in windward's
`docs/MISSION-CONTROL.md` section 7a); and you have tested import on the new address with a real old save.

1. **Switch 1, the redirect:** in `games/windward/index.html` set `const REDIRECT_TO = 'https://<final-address>/';` (the end of the address must be where the
   game's `index.html` is served). Players who open the old link now carry their saves to the new address. `frozen.html` is unaffected.
2. **Switch 2, the hub list:** in `games/windward/game.json` add `"hidden": true`, then run `node scripts/manifest.js` and commit the regenerated
   `games/manifest.json` (Vercel regenerates it on deploy, but local testing uses the committed file). Windward leaves the hub picker; its URLs stay deployed.
   Same commit as switch 1.
3. Check: open the old link with a test save in storage and land on the new address with the progress there; open `frozen.html` and confirm it still plays and does not redirect.

## Switching it off again

Set `REDIRECT_TO = ''` and remove `"hidden": true` (or set it `false`), regenerate the manifest. Nothing is stored by the bridge, so there is nothing to clean up.

## Known limits

- Once switch 1 is on, the old `index.html` link always redirects, so nobody can keep playing the old version there; `frozen.html` is the link for the old version.
- Saves made at the new address first, then a visit to the old link later: the importer skips (new progress wins). That is on purpose.
- If the browser blocks storage on the old address, the bridge logs a warning and the page stays and plays as before.
