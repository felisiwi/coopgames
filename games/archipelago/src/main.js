import { CONFIG } from './config.js';
import { generateIsland } from './island.js';
import { renderIsland } from './render.js';

const params = new URLSearchParams(window.location.search);
const seed = params.has('seed') ? Number(params.get('seed')) : Math.floor(Math.random() * 1_000_000);
const debug = params.get('debug') === '1';

document.getElementById('seed-label').textContent = `seed: ${seed}${debug ? ' (debug)' : ''}`;

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');

const island = generateIsland(seed);

function draw() {
  renderIsland(ctx, canvas, island, { config: CONFIG, debug });
}

draw();
window.addEventListener('resize', draw);
