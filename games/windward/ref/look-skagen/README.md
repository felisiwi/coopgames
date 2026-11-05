# Look Skagen: before / after (2026-11-05)

Kept record of the look pass that moved Windward from the golden-hour Look Lab
port ("before") to the Skagen-painter palette ("after", now the default).
Seed 1, headless Chromium (software GL), so judge colour and mood, not frame rate.

| | desktop 1280x800 | iPhone 13 (1.5x) |
|---|---|---|
| before | `desktop-before.png` | `iphone13-before.png` |
| after | `desktop-after.png` | `iphone13-after.png` |

- **after** = a bare `/games/windward/index.html?seed=1` (no `tune`): Skagen is the
  default and no panel exists.
- **before** = `?seed=1&tune=1`, then the panel's "Before" button
  (`src/look-presets.js` `BEFORE`). Its small inland ponds show the pond fix too
  (they used to render solid white; see DESIGN.md "Look pass 3").
- Why the islands were dark: three.js r155+ gives a diffuse surface `intensity / pi`
  of its colour, so the old 0.45 fill lit ground at 14%. See DESIGN.md "Look pass 2".
