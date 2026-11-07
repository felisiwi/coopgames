// node shared/net.test.js: the hub's host/join networking (shared/net.js) against a FAKE PeerJS, so no browser, no
// WebRTC and no broker are needed. The fake covers only what net.js uses: Peer (on, connect, id) and a data
// connection (on, send, close, open). Real WebRTC is checked by hand (see docs/notes/KENNY-GUEST-REJOIN.md).
//
// The point of this file: ONE guest at a time is allowed, but the slot must be FREE again when that guest's
// connection closes or errors, so the same link works for a returning guest (easy in, easy out).
import assert from 'node:assert/strict';
import { host, joinFromUrl } from './net.js';

class Emitter {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] ||= []).push(fn); return this; }
  emit(ev, ...args) { for (const fn of [...(this.h[ev] || [])]) fn(...args); }
}
class FakeConn extends Emitter {
  constructor() { super(); this.open = false; this.sent = []; this.closeCalls = 0; this.peerConnection = null; }
  send(m) { this.sent.push(m); }
  close() { this.closeCalls += 1; this.open = false; this.emit('close'); } // PeerJS emits 'close' locally too
}
class FakePeer extends Emitter {
  constructor() { super(); this.id = 'HOST1'; queueMicrotask(() => this.emit('open')); }
  connect() { const c = new FakeConn(); this.lastConnect = c; queueMicrotask(() => { c.open = true; c.emit('open'); }); return c; }
}
function fakeWindow(search = '') {
  const peers = [];
  globalThis.window = { Peer: class extends FakePeer { constructor(o) { super(o); peers.push(this); } }, location: { search } };
  return peers;
}
// A guest arriving at the host: the host's Peer emits 'connection', then the data channel opens.
function guestArrives(hostPeer, { open = true } = {}) {
  const c = new FakeConn();
  hostPeer.emit('connection', c);
  if (open) { c.open = true; c.emit('open'); }
  return c;
}
async function hostWithSpies() {
  const peers = fakeWindow();
  const net = await host();
  const spy = { got: [], connects: 0, closes: 0 };
  net.onMessage((m) => spy.got.push(m));
  net.onConnect(() => { spy.connects += 1; });
  net.onClose(() => { spy.closes += 1; });
  return { net, peer: peers[0], spy };
}

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok - ${name}`); } catch (err) {
    failed += 1;
    console.log(`NOT OK - ${name}\n    ${String(err.message).split('\n')[0]}`);
  }
}

await check('the first guest connects: onConnect fires, messages flow both ways', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g = guestArrives(peer);
  assert.equal(spy.connects, 1);
  g.emit('data', { t: 'pos', x: 1 });
  assert.deepEqual(spy.got, [{ t: 'pos', x: 1 }]);
  net.send({ t: 'hi' });
  assert.deepEqual(g.sent, [{ t: 'hi' }]);
});

await check('a SECOND simultaneous guest is refused and cannot talk to the host', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  const g2 = guestArrives(peer);
  assert.equal(g2.closeCalls, 1, 'the second connection is closed straight away');
  g2.emit('data', { t: 'intruder' });
  assert.deepEqual(spy.got, [], 'nothing from the refused connection reaches the game');
  assert.equal(spy.connects, 1, 'no second onConnect');
  assert.equal(spy.closes, 0, 'refusing a guest is not a connection loss');
  net.send({ t: 'x' });
  assert.deepEqual(g1.sent, [{ t: 'x' }], 'the first guest still gets host messages');
  assert.deepEqual(g2.sent, []);
});

await check('REJOIN after the guest connection closes: a new guest is accepted and wired like the first', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  g1.close(); // the guest tab closed
  assert.equal(spy.closes, 1, 'onClose fires once for the drop');
  const g2 = guestArrives(peer);
  assert.equal(g2.closeCalls, 0, 'the returning guest is NOT refused');
  assert.equal(spy.connects, 2, 'onConnect fires again, so the hub can send launch again');
  g2.emit('data', { t: 'pos', x: 9 });
  assert.deepEqual(spy.got, [{ t: 'pos', x: 9 }], 'messages flow again');
  net.send({ t: 'back' });
  assert.deepEqual(g2.sent, [{ t: 'back' }], 'host sends reach the new guest');
  assert.deepEqual(g1.sent, [], 'and not the old one');
});

await check('REJOIN after the guest connection errors', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  g1.emit('error', new Error('ICE failed'));
  assert.equal(spy.closes, 1);
  const g2 = guestArrives(peer);
  assert.equal(g2.closeCalls, 0);
  g2.emit('data', { t: 'pos' });
  assert.equal(spy.got.length, 1);
  net.send({ t: 'ok' });
  assert.deepEqual(g2.sent, [{ t: 'ok' }]);
});

await check('late events from the OLD connection do not hurt the new guest', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  g1.close();
  const g2 = guestArrives(peer);
  g1.emit('close'); // a zombie closing late
  g1.emit('error', new Error('late'));
  g1.emit('data', { t: 'stale' });
  assert.equal(spy.closes, 1, 'no extra onClose while the new guest is connected');
  assert.deepEqual(spy.got, [], 'stale data from the old connection is ignored');
  net.send({ t: 'still' });
  assert.deepEqual(g2.sent, [{ t: 'still' }], 'the new guest is still the current one');
  const g3 = guestArrives(peer);
  assert.equal(g3.closeCalls, 1, 'and the slot is taken again, so a third guest is refused');
});

await check('a refused guest closing does not free the slot of the guest who is connected', async () => {
  const { peer } = await hostWithSpies();
  guestArrives(peer);
  const g2 = guestArrives(peer); // refused
  g2.emit('close');
  const g3 = guestArrives(peer);
  assert.equal(g3.closeCalls, 1, 'still refused: the first guest is still there');
});

await check('messages sent while nobody is connected are queued and flushed to a returning guest (existing behaviour kept)', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  g1.close();
  net.send({ t: 'while-away' });
  const g2 = guestArrives(peer);
  assert.deepEqual(g2.sent, [{ t: 'while-away' }]);
  assert.equal(spy.connects, 2);
});

await check('the send queue keeps only the newest 50 across a drop (existing cap kept)', async () => {
  const { net, peer } = await hostWithSpies();
  guestArrives(peer).close();
  for (let i = 0; i < 80; i++) net.send({ i });
  const g2 = guestArrives(peer);
  assert.equal(g2.sent.length, 50);
  assert.equal(g2.sent[0].i, 30);
});

await check('a guest joining by link: resolves when open; onClose fires when the host goes away (unchanged)', async () => {
  const peers = fakeWindow('?host=HOST1');
  const net = await joinFromUrl();
  assert.equal(net.isHost, false);
  let closed = 0;
  net.onClose(() => { closed += 1; });
  peers[0].lastConnect.emit('close');
  assert.equal(closed, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
