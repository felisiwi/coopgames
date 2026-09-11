// PeerJS host/join-link networking — STUB, and hub-internal. Per AGENTS.md's
// game contract, the hub owns the PeerJS connection; games never import this
// file. The hub calls host()/joinFromUrl() itself, then builds the small
// `net` object the contract promises ({ send, onMessage, peerId, isHost })
// from whatever these resolve to and passes it into the game's start().
//
// No PeerJS code yet (that lands in the multiplayer-sync stage, AGENTS.md
// build plan step 3). This file documents the intended API so the hub can
// be written against it now and wired up later without changing call sites.
//
// Intended shape, once implemented:
//
//   import { host, joinFromUrl, send, onMessage } from '../../shared/net.js';
//
//   host(gameParams)
//     Creates a PeerJS Peer with default ICE config (Step 0 audit #1 — the
//     shipped PeerJS DEFAULT_CONFIG already includes a TURN pair, no custom
//     config needed). Once the peer ID is assigned, embeds it in the URL
//     alongside gameParams (e.g. ?host=<peerId>&seed=<n>, AGENTS.md risk #7
//     — world-defining data travels in the URL, only positions cross the
//     wire) and exposes a "copy link" affordance. Returns a promise that
//     resolves once a peer connects.
//
//   joinFromUrl()
//     Reads the host's peer ID + gameParams off the current URL on load,
//     connects automatically — nothing typed or misread by the joining
//     player. Returns a promise that resolves once the connection opens.
//
//   send(data)
//     Sends a JSON-serializable payload over the open DataConnection.
//     No-op (or throws) if no connection is open yet.
//
//   onMessage(callback)
//     Registers callback(data) for every message received on the open
//     DataConnection. Multiple listeners may be registered.
//
// Until implemented, every export throws so a caller finds out immediately
// rather than silently doing nothing.

function notImplemented(name) {
  return () => {
    throw new Error(`shared/net.js: ${name}() is a stub — networking lands in the multiplayer-sync stage`);
  };
}

export const host = notImplemented('host');
export const joinFromUrl = notImplemented('joinFromUrl');
export const send = notImplemented('send');
export const onMessage = notImplemented('onMessage');
