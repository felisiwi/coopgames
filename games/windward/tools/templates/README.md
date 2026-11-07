# tools/templates: regenerate the 1950 content data

`data/things-1950.json`, `quests-1950.json`, `artifacts-1950.json` and `rumours-1950.json` are **generated** from the
tables in this folder. Edit the tables here and regenerate; **do not hand-edit the JSON**. A test
(`src/templates-1950.test.js`, the last check) fails with a message if the JSON and the generators drift apart.
Plain Node, no dependencies. What the data is and how it links: `docs/TEMPLATES-1950.md`.

## Regenerate

From the repo root:

```
node games/windward/tools/templates/build.mjs            # things-1950.json
node games/windward/tools/templates/build-content.mjs    # quests-1950.json, artifacts-1950.json, rumours-1950.json
node games/windward/src/templates-1950.test.js           # 38 checks: links, vocabulary, flags, generators match
```

Both scripts write to `games/windward/data/` by default; give `build.mjs` a file path or `build-content.mjs` a folder to
write somewhere else. They are independent of each other (any order).

## What is where

| File | Holds |
|---|---|
| `things-nature.mjs` | the thing **vocabulary** (anchor types, times of day, effects, ...), the `add()` helper, wildlife, drift finds, gear, ambient life ashore |
| `things-people.mjs` | generic people, and the per-place **regulars** (`reg()`) and **secrets** (`sec()`), each linked to its island-lore hook |
| `build.mjs` | assembles `things-1950.json` and applies the **sourced species check** (the `CHECK` table: which wildlife occurs, and when) |
| `quests.mjs` | the 18 quest templates (`Q()`), their lines, and `NOT_QUESTED` (lore seeds with no quest, with reasons) |
| `artifacts.mjs` | the 31 artifact templates (`A()`) and `HELD_BACK` (lore artifacts deliberately not made) |
| `rumours.mjs` | the 53 rumour records (`R()`), including the radio's venues |
| `build-content.mjs` | assembles the quests, artifacts and rumours files, with their headers and vocabularies |

## Changing something

- **Add or change a thing:** edit `things-nature.mjs` or `things-people.mjs`. A person who `offers` a rumour or an errand must have one
  to tell or give (the test checks).
- **Rename an id:** change it everywhere it is named (quests, rumours, artifacts); the test lists any that dangle.
- **A lore hook with no template** must be either made or listed with a reason (`NOT_TEMPLATED` in the test, `NOT_QUESTED`, `HELD_BACK`).
- **Never make a unique artifact here:** those are only placed by Felix, from `docs/UNIQUE-ARTIFACT-CANDIDATES.md`.
- Then run the three commands above.

## Note on direction

Felix and Pierre plan a **generative choose-your-own-adventure** quest layer on top of this data
(`docs/ALIVE-SEA.md`, "Direction: generative choose-your-own-adventure quests"). The **18 quests are placeholders**; the
solid part is the dataset underneath (things, regulars, places, items, wrecks, rumours, artifacts with true stories). A later
layer can read the JSON, or import these tables directly.
