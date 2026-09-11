// PeerJS host/join-link networking — hub-internal. Per AGENTS.md's game
// contract, the hub owns the PeerJS connection; games never import this
// file, only the `net` object the hub builds from it and passes into
// start().
//
// Requires window.Peer from shared/vendor/peerjs.min.js, loaded via a plain
// <script> tag before this module runs (see shared/vendor/LICENSE.txt for
// version/provenance). No CDN at runtime.
//
// Custom ICE config required: PeerJS's shipped DEFAULT_CONFIG pairs Google
// STUN with a TURN relay at eu-0/us-0.turn.peerjs.com, but those hosts no
// longer resolve (dead DNS, confirmed 2026-09-11) — the AGENTS.md Step 0
// audit's "TURN comes free" resolution no longer holds. Both host() and
// joinFromUrl() now pass ICE_SERVERS explicitly to `new Peer()`.
//
// host() and joinFromUrl() both resolve with the same shape:
//
//   { send(msg), onMessage(fn), onClose(fn), onConnect(fn), peerId, isHost }
//
// send/onMessage/onClose are the documented contract (games/README.md).
// onConnect is an addition this stage needed: host()'s promise resolves as
// soon as the peer has an id (so the hub can render the copy-link UI
// immediately), before any guest has joined — onConnect(fn) fires once,
// when the guest's connection actually opens, which is what the hub uses
// to leave the "waiting for guest" step. send() before that point queues
// messages rather than dropping them.
//
// Payloads are plain JSON-serializable values (objects/arrays/strings/
// numbers) — PeerJS's default serialization handles them as-is, no manual
// stringify. Don't send functions, class instances, or binary data.
//
// Only one guest connection is supported (this hub is a 2-player affair
// today); a host peer that receives a second incoming connection while one
// is already open closes it immediately.
//
// Reconnect is explicitly out of scope: once the connection closes (or
// errors), onClose fires and nothing more is sent or received. The hub is
// responsible for telling the user to get a fresh link from the host.

// Google STUN plus the Open Relay Project's free public TURN service
// (https://www.metered.ca/tools/openrelay/). This is a shared, rate-limited
// relay meant for prototypes — fine for v1, but swap in a proper TURN
// provider (or a paid Open Relay plan) before this hub sees real traffic.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// Logs ICE connection state and gathered candidate types on failure/close,
// so a dead relay (like the peerjs.com one above) shows up in the console
// instead of a silent hang. `reason` is a short label ('closed' | 'errored').
async function logIceDiagnostics(conn, reason) {
  const pc = conn.peerConnection;
  if (!pc) {
    console.warn(`shared/net.js: connection ${reason}, no underlying RTCPeerConnection to inspect`);
    return;
  }
  console.warn(`shared/net.js: connection ${reason}, iceConnectionState=${pc.iceConnectionState}`);
  try {
    const stats = await pc.getStats();
    const candidateTypes = new Set();
    stats.forEach((report) => {
      if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
        candidateTypes.add(`${report.type}:${report.candidateType}`);
      }
    });
    console.warn(
      `shared/net.js: gathered candidate types — ${candidateTypes.size ? [...candidateTypes].join(', ') : '(none)'}`,
    );
  } catch (err) {
    console.warn('shared/net.js: getStats() failed', err);
  }
}

function buildNet({ peer, isHost }) {
  let conn = null;
  const messageListeners = [];
  const closeListeners = [];
  const connectListeners = [];
  const sendQueue = [];

  function fireClose() {
    for (const fn of closeListeners) fn();
  }

  function wireConnection(c) {
    conn = c;
    conn.on('data', (data) => {
      for (const fn of messageListeners) fn(data);
    });
    conn.on('open', () => {
      while (sendQueue.length) conn.send(sendQueue.shift());
      for (const fn of connectListeners) fn();
    });
    conn.on('close', () => {
      logIceDiagnostics(conn, 'closed');
      fireClose();
    });
    conn.on('error', (err) => {
      console.warn('shared/net.js: connection error', err);
      logIceDiagnostics(conn, 'errored');
      fireClose();
    });
  }

  const net = {
    peerId: peer.id,
    isHost,
    send(msg) {
      if (conn && conn.open) conn.send(msg);
      else sendQueue.push(msg);
    },
    onMessage(fn) {
      messageListeners.push(fn);
    },
    onClose(fn) {
      closeListeners.push(fn);
    },
    onConnect(fn) {
      connectListeners.push(fn);
    },
  };

  return { net, wireConnection };
}

function requirePeer() {
  if (typeof window.Peer !== 'function') {
    throw new Error('shared/net.js: window.Peer missing — load shared/vendor/peerjs.min.js first');
  }
}

export function host() {
  return new Promise((resolve, reject) => {
    requirePeer();
    const peer = new window.Peer({ config: { iceServers: ICE_SERVERS } });
    peer.on('error', reject);
    peer.on('open', () => {
      const { net, wireConnection } = buildNet({ peer, isHost: true });
      let guestConn = null;
      peer.on('connection', (conn) => {
        if (guestConn) {
          conn.close();
          return;
        }
        guestConn = conn;
        wireConnection(conn);
      });
      resolve(net);
    });
  });
}

export function joinFromUrl() {
  return new Promise((resolve, reject) => {
    requirePeer();
    const hostId = new URLSearchParams(window.location.search).get('host');
    if (!hostId) {
      reject(new Error('shared/net.js: joinFromUrl() found no ?host=<id> in the URL'));
      return;
    }
    const peer = new window.Peer({ config: { iceServers: ICE_SERVERS } });
    peer.on('error', reject);
    peer.on('open', () => {
      const { net, wireConnection } = buildNet({ peer, isHost: false });
      const conn = peer.connect(hostId);
      conn.on('open', () => resolve(net));
      wireConnection(conn);
    });
  });
}
