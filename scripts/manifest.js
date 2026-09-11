#!/usr/bin/env node
// Scans games/*/game.json (skipping _template) and writes games/manifest.json,
// which the hub's index.html fetches at runtime to render its picker.
//
// Runs automatically as Vercel's buildCommand (see vercel.json). Run it
// manually too after adding or editing a game, and commit the regenerated
// games/manifest.json — local testing (python3 -m http.server) serves
// static files with no build step, so the committed copy is what it sees.
'use strict';
const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, '..', 'games');

const gameDirs = fs
  .readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '_template')
  .map((entry) => entry.name)
  .sort();

const manifest = [];
for (const name of gameDirs) {
  const gameJsonPath = path.join(gamesDir, name, 'game.json');
  if (!fs.existsSync(gameJsonPath)) continue; // no game.json -> not discoverable yet
  const game = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
  manifest.push({ ...game, path: `games/${name}/` });
}

fs.writeFileSync(path.join(gamesDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `wrote games/manifest.json with ${manifest.length} game(s): ${manifest.map((g) => g.id).join(', ') || '(none)'}`
);
