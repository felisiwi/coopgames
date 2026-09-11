// Contract entry point — every game default-exports exactly this shape.
// The hub creates the PeerJS connection, then calls start() with it; the
// solo dev entry in this folder's index.html fakes `net` and calls
// start() directly, no hub or connection involved. Either way, this file
// never imports PeerJS or shared/net.js — `net` is handed to it.
//
//   canvas   <canvas> element, already sized and inserted into the page.
//   net      { send(msg), onMessage(fn), peerId, isHost } — the only way
//            this game talks to the other peer(s).
//   seed     number, identical on every peer — seed your generator with
//            it rather than inventing separate randomness for anything
//            that must match across peers.
//   role     'host' | 'guest'.
//   players  info about the session's participants (shape not finalized
//            until multiplayer sync lands — treat as informational).
//
// This template is deliberately the simplest possible two-player check:
// each side is a coloured dot (host blue, guest orange), WASD moves your
// own, and your position broadcasts to the other side 20 times a second.
// No collision, no world, nothing seeded beyond a shared start position.
import { createInputState } from '../../shared/input.js';

const SPEED = 220; // px/sec
const BROADCAST_HZ = 20;
const COLORS = { host: '#3a7dff', guest: '#ff9a3a' };

export default function start({ canvas, net, role }) {
  const ctx = canvas.getContext('2d');
  const input = createInputState();

  const self = { x: canvas.width * (role === 'host' ? 0.3 : 0.7), y: canvas.height * 0.5 };
  const otherRole = role === 'host' ? 'guest' : 'host';
  let other = null;

  net.onMessage((msg) => {
    if (msg?.type === 'pos') other = { x: msg.x, y: msg.y };
  });

  const broadcast = setInterval(() => {
    net.send({ type: 'pos', x: self.x, y: self.y });
  }, 1000 / BROADCAST_HZ);

  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;

    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }
    self.x = Math.min(canvas.width, Math.max(0, self.x + dx * SPEED * dt));
    self.y = Math.min(canvas.height, Math.max(0, self.y + dy * SPEED * dt));

    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (other) drawDot(ctx, other, COLORS[otherRole]);
    drawDot(ctx, self, COLORS[role]);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    clearInterval(broadcast);
    input.destroy();
  });
}

function drawDot(ctx, pos, color) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
