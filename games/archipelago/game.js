// Contract entry point (games/README.md). The hub (or the solo dev entry in
// this folder's index.html) calls this directly; it never imports PeerJS or
// shared/net.js itself — `net` is handed in.
import { CONFIG } from './src/config.js';
import { generateIsland } from './src/island.js';
import { renderIsland, loadTileImages } from './src/render.js';
import { createInputState } from '../../shared/input.js';

const WATER_TYPES = new Set(['deep_water', 'shallow_water']);

function isLandTile(island, x, y) {
  if (x < 0 || y < 0 || x >= island.size || y >= island.size) return false;
  return !WATER_TYPES.has(island.grid[y][x].type);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// players is unused this batch — the message shape only carries a position,
// nothing about who's who beyond the two peers net already distinguishes.
export default function start({ canvas, net, seed, role, players }) {
  const ctx = canvas.getContext('2d');
  const island = generateIsland(seed);
  const spawn = role === 'guest' ? island.spawnB : island.spawnA;
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  // Player position is a grid tile (x, y) plus an in-flight move: while
  // `t < 1` the render position is lerped from (fromX, fromY) toward
  // (toX, toY); at `t === 1` the player is at rest on (x, y).
  const player = {
    x: spawn.x,
    y: spawn.y,
    fromX: spawn.x,
    fromY: spawn.y,
    toX: spawn.x,
    toY: spawn.y,
    t: 1,
  };

  // The other peer's last-known position, straight off the wire — never
  // smoothed further, per the "one hour" cut list (AGENTS.md #5).
  const other = { x: null, y: null };

  // Per-player fog: 0 unseen / 1 seen / 2 visible, indexed y * size + x.
  // Local only — never synced (Stage 2 audit resolution #3).
  const fog = new Uint8Array(island.size * island.size);

  const input = createInputState();

  function renderPos() {
    return { x: lerp(player.fromX, player.toX, player.t), y: lerp(player.fromY, player.toY, player.t) };
  }

  function updateFog(cx, cy) {
    const size = island.size;
    const r = CONFIG.VISION_RADIUS;
    const r2 = r * r;
    for (let i = 0; i < fog.length; i++) {
      if (fog[i] === 2) fog[i] = 1; // demote last frame's visible tiles to seen
    }
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(size - 1, Math.ceil(cy + r));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(size - 1, Math.ceil(cx + r));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) fog[y * size + x] = 2;
      }
    }
  }

  function tryStartMove(dx, dy) {
    if (player.t < 1) return; // mid-move — no move queuing in v1
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!isLandTile(island, nx, ny)) return; // water/off-map is a wall
    player.fromX = player.x;
    player.fromY = player.y;
    player.toX = nx;
    player.toY = ny;
    player.t = 0;
  }

  net.onMessage((msg) => {
    if (msg && msg.t === 'pos') {
      other.x = msg.x;
      other.y = msg.y;
    }
  });

  setInterval(() => {
    const pos = renderPos();
    net.send({ t: 'pos', x: pos.x, y: pos.y });
  }, 1000 / CONFIG.NET_SEND_HZ);

  loadTileImages().then((images) => {
    let lastTime = performance.now();

    function frame(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (player.t < 1) {
        player.t = Math.min(1, player.t + dt / CONFIG.MOVE_SECONDS_PER_TILE);
        if (player.t >= 1) {
          player.x = player.toX;
          player.y = player.toY;
        }
      } else if (input.up) {
        tryStartMove(0, -1);
      } else if (input.down) {
        tryStartMove(0, 1);
      } else if (input.left) {
        tryStartMove(-1, 0);
      } else if (input.right) {
        tryStartMove(1, 0);
      }

      const pos = renderPos();
      updateFog(pos.x, pos.y);

      const entities = [{ x: pos.x, y: pos.y, color: '#ffcc66' }];
      if (other.x !== null) {
        const tileX = Math.min(island.size - 1, Math.max(0, Math.round(other.x)));
        const tileY = Math.min(island.size - 1, Math.max(0, Math.round(other.y)));
        if (fog[tileY * island.size + tileX] === 2) {
          entities.push({ x: other.x, y: other.y, color: '#66ccff' });
        }
      }

      renderIsland(ctx, canvas, island, images, { debug, camera: pos, entities, fog });

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });
}
