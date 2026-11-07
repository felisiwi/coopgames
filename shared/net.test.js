// node shared/net.test.js: the hub's host/join networking (shared/net.js) against a FAKE PeerJS, so no browser, no
// WebRTC and no broker are needed. The fake covers only what net.js uses: Peer (on, connect, id) and a data
// connection (on, send, close, open). Real WebRTC is checked by hand (see docs/notes/KENNY-GUEST-REJOIN.md).
//
// The rules under test:
//  - ONE guest at a time, always.
//  - A game that opted in ("rejoin": true in its game.json; the hub calls net.setRejoin(true) at pick time) gets the
//    slot back when its guest's connection closes or errors, so the same link works for a returning guest.
//  - A game that did NOT opt in behaves exactly as before: the guest who left holds the slot, a returning guest is
//    refused.
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
// rejoin: what the hub does when the host picks a game whose game.json says "rejoin": true.
async function hostWithSpies({ rejoin = false } = {}) {
  const peers = fakeWindow();
  const net = await host();
  if (rejoin) net.setRejoin(true);
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

// ---- always: one guest, normal flow -------------------------------------------------------------------------

await check('the first guest connects: onConnect fires, messages flow both ways', async () => {
  for (const rejoin of [false, true]) {
    const { net, peer, spy } = await hostWithSpies({ rejoin });
    const g = guestArrives(peer);
    assert.equal(spy.connects, 1);
    g.emit('data', { t: 'pos', x: 1 });
    assert.deepEqual(spy.got, [{ t: 'pos', x: 1 }]);
    net.send({ t: 'hi' });
    assert.deepEqual(g.sent, [{ t: 'hi' }]);
  }
});

await check('a SECOND simultaneous guest is refused and cannot talk to the host (opted in or not)', async () => {
  for (const rejoin of [false, true]) {
    const { net, peer, spy } = await hostWithSpies({ rejoin });
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
  }
});

await check('the hub-only switch is OFF by default and only exactly true turns it on', async () => {
  const { net } = await hostWithSpies();
  assert.equal(net.rejoinAllowed(), false);
  net.setRejoin('yes'); assert.equal(net.rejoinAllowed(), false, 'a truthy string is not an opt-in');
  net.setRejoin(1); assert.equal(net.rejoinAllowed(), false);
  net.setRejoin(undefined); assert.equal(net.rejoinAllowed(), false, 'a game.json without the field');
  net.setRejoin(true); assert.equal(net.rejoinAllowed(), true);
  net.setRejoin(false); assert.equal(net.rejoinAllowed(), false);
});

// ---- NOT opted in: exactly as before ------------------------------------------------------------------------

await check('NOT opted in: a guest who left holds the slot; a returning guest is refused (as before)', async () => {
  const { net, peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  g1.close(); // the guest tab closed
  assert.equal(spy.closes, 1, 'onClose still fires for the drop, so the hub can show "Connection lost"');
  const g2 = guestArrives(peer);
  assert.equal(g2.closeCalls, 1, 'the returning guest is refused');
  g2.emit('data', { t: 'pos', x: 9 });
  assert.deepEqual(spy.got, [], 'nothing from the refused guest reaches the game');
  assert.equal(spy.connects, 1, 'no second onConnect, so no second launch');
  assert.equal(spy.closes, 1);
});

await check('NOT opted in: an error also leaves the slot taken', async () => {
  const { peer, spy } = await hostWithSpies();
  const g1 = guestArrives(peer);
  g1.emit('error', new Error('ICE failed'));
  assert.equal(spy.closes, 1);
  assert.equal(guestArrives(peer).closeCalls, 1);
});

// ---- opted in: rejoin works ---------------------------------------------------------------------------------

await check('OPTED IN: after the guest connection closes, a new guest is accepted and wired like the first', async () => {
  const { net, peer, spy } = await hostWithSpies({ rejoin: true });
  const g1 = guestArrives(peer);
  g1.close();
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

await check('OPTED IN: after the guest connection errors, a new guest is accepted', async () => {
  const { net, peer, spy } = await hostWithSpies({ rejoin: true });
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

await check('OPTED IN: the choice is made when the new guest ARRIVES (game picked after the guest left still counts)', async () => {
  const { net, peer } = await hostWithSpies(); // not opted in yet: the host is still in the picker
  guestArrives(peer).close();
  net.setRejoin(true); // the host now picks a game that opted in
  assert.equal(guestArrives(peer).closeCalls, 0, 'the returning guest is accepted');
});

await check('switching back OFF before the guest returns refuses them again', async () => {
  const { net, peer } = await hostWithSpies({ rejoin: true });
  guestArrives(peer).close();
  net.setRejoin(false); // the host picked a game that did not opt in
  assert.equal(guestArrives(peer).closeCalls, 1);
});

await check('OPTED IN: late events from the OLD connection do not hurt the new guest', async () => {
  const { net, peer, spy } = await hostWithSpies({ rejoin: true });
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
  assert.equal(guestArrives(peer).closeCalls, 1, 'and the slot is taken again, so a third guest is refused');
});

await check('OPTED IN: a refused guest closing does not free the slot of the guest who is connected', async () => {
  const { peer } = await hostWithSpies({ rejoin: true });
  guestArrives(peer);
  const g2 = guestArrives(peer); // refused
  g2.emit('close');
  assert.equal(guestArrives(peer).closeCalls, 1, 'still refused: the first guest is still there');
});

await check('OPTED IN: messages sent while nobody is connected are queued and flushed to a returning guest', async () => {
  const { net, peer, spy } = await hostWithSpies({ rejoin: true });
  guestArrives(peer).close();
  net.send({ t: 'while-away' });
  const g2 = guestArrives(peer);
  assert.deepEqual(g2.sent, [{ t: 'while-away' }]);
  assert.equal(spy.connects, 2);
});

await check('OPTED IN: the send queue keeps only the newest 50 across a drop (existing cap kept)', async () => {
  const { net, peer } = await hostWithSpies({ rejoin: true });
  guestArrives(peer).close();
  for (let i = 0; i < 80; i++) net.send({ i });
  const g2 = guestArrives(peer);
  assert.equal(g2.sent.length, 50);
  assert.equal(g2.sent[0].i, 30);
});

// ---- the guest side is unchanged ----------------------------------------------------------------------------

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
