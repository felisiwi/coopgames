// Contract entry point (games/README.md). The hub (or the solo dev entry in
// this folder's index.html) calls this directly; it never imports PeerJS or
// shared/net.js itself — `net` is handed in.
import { generateIsland } from './src/island.js';
import { renderIsland, loadTileImages } from './src/render.js';

// net/players are unused this batch — movement and position sync land in
// Stage 2 Batches 2-3.
export default function start({ canvas, net, seed, role, players }) {
  const ctx = canvas.getContext('2d');
  const island = generateIsland(seed);
  const spawn = role === 'guest' ? island.spawnB : island.spawnA;
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  loadTileImages().then((images) => {
    function draw() {
      renderIsland(ctx, canvas, island, images, { debug, camera: spawn });
    }
    draw();
    window.addEventListener('resize', draw);
  });
}
