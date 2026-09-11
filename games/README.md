# Adding a game to the hub

1. Copy `games/_template/` to `games/<name>/`.
2. Build the game as a self-contained static folder: its own `index.html`,
   `src/`, and `assets/` as needed. Plain ES modules, no build step.
3. Import shared code from `../../shared/` (`noise.js`, `input.js`, `net.js`)
   rather than duplicating it. Only lift new code into `shared/` when a
   second game actually needs it.
4. Register the game in the root `index.html` hub list (title, one-line
   description, Host button linking to `games/<name>/`).
5. It's live at `/games/<name>/` with zero deploy config — Vercel serves the
   repo root as static.
