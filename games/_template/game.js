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
export default function start({ canvas, net, seed, role, players }) {
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a1a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '16px monospace';
  ctx.fillText(`template game — seed ${seed}, role ${role}`, 20, 30);
  ctx.fillText(`net.peerId ${net.peerId}, isHost ${net.isHost}`, 20, 52);

  net.onMessage((msg) => {
    console.log('[template] received', msg);
  });

  // Example: net.send({ type: 'hello' });
}
