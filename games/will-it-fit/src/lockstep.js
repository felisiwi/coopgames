// Lockstep. Both peers run the identical simulation from the identical
// input stream; only inputs cross the wire, never grid state.
//
// This is only viable because the simulation is deterministic to the bit:
// seeded PRNG, fixed-point positions, integer trig tables, and the lean
// derived inside the sim rather than from mouse floats. If any of that
// slips, two peers diverge and it looks like material teleporting — so a
// checksum is exchanged periodically and a mismatch is reported loudly
// rather than left to drift (DESIGN.md risk 2).
//
// The cost is INPUT DELAY: what you do now takes effect `delay` frames
// later, because that is when the other peer will also have it. A pouring
// game tolerates that; a fighting game would not, which is why Dino Rumble
// went the opposite way.
//
// No imports from the network layer — the transport is injected, so this
// runs headlessly in tests with two instances wired to each other.
export const DEFAULT_DELAY = 3;
export const CHECKSUM_EVERY = 60;

export function createLockstep({ delay = DEFAULT_DELAY, send, onDesync } = {}) {
  const localInputs = new Map();
  const remoteInputs = new Map();
  const remoteChecksums = new Map();

  let frame = 0;          // the next frame to simulate
  let lastSent = -1;
  let desynced = false;
  let stalledFor = 0;

  // The opening `delay` frames have no inputs behind them — nobody has had
  // time to submit any — so both peers agree they are empty.
  const EMPTY = { bowl: 0, spout: 0, cork: 0 };
  for (let f = 0; f < delay; f++) {
    localInputs.set(f, null);
    remoteInputs.set(f, null);
  }

  return {
    get frame() { return frame; },
    get desynced() { return desynced; },
    get stalledFor() { return stalledFor; },
    get waiting() { return stalledFor > 0; },

    // Offer this frame's intent. It is scheduled `delay` frames ahead,
    // which is the whole trick: by the time frame F runs, both peers have
    // had F's inputs for `delay` frames already.
    submitLocal(input) {
      const target = frame + delay;
      if (target <= lastSent) return;
      lastSent = target;
      localInputs.set(target, input);
      if (send) send({ t: 'i', f: target, b: input.bowl | 0, s: input.spout | 0, c: input.cork ? 1 : 0 });
    },

    receive(msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'i') {
        remoteInputs.set(msg.f | 0, { bowl: msg.b | 0, spout: msg.s | 0, cork: msg.c ? 1 : 0 });
      } else if (msg.t === 'c') {
        remoteChecksums.set(msg.f | 0, msg.k >>> 0);
      }
    },

    // Can frame `frame` run? Only if BOTH peers' inputs for it are known.
    // Anything else would mean guessing, and a guess that turns out wrong
    // is a desync.
    ready() {
      return localInputs.has(frame) && remoteInputs.has(frame);
    },

    // Consume the frame. Returns both seats' inputs, or null if not ready
    // — in which case the caller should hold the picture still and show
    // that it is waiting rather than simulating ahead.
    step() {
      if (!this.ready()) {
        stalledFor += 1;
        return null;
      }
      stalledFor = 0;
      const local = localInputs.get(frame) || EMPTY;
      const remote = remoteInputs.get(frame) || EMPTY;
      const at = frame;
      frame += 1;
      // Old frames can never be needed again.
      localInputs.delete(at - 1);
      remoteInputs.delete(at - 1);
      return { local, remote, frame: at };
    },

    // Exchange a checksum every so often. A mismatch means the two
    // simulations have diverged, which must fail loudly: silently carrying
    // on shows each player a different game while both believe it is
    // shared.
    checkpoint(checksum) {
      if (frame % CHECKSUM_EVERY !== 0) return;
      if (send) send({ t: 'c', f: frame, k: checksum >>> 0 });
      const theirs = remoteChecksums.get(frame);
      if (theirs !== undefined && theirs !== (checksum >>> 0)) {
        desynced = true;
        if (onDesync) onDesync({ frame, mine: checksum >>> 0, theirs });
      }
      remoteChecksums.delete(frame - CHECKSUM_EVERY);
    },
  };
}

// Wire two locksteps directly to one another, with an optional lag in
// frames. Used by the tests to prove that two peers stay identical without
// needing a network — and to prove they still stay identical when messages
// arrive late.
export function connectForTest(a, b, lagFrames = 0) {
  const queues = { a: [], b: [] };
  return {
    pump() {
      for (const key of ['a', 'b']) {
        const target = key === 'a' ? b : a;
        const q = queues[key];
        while (q.length && q[0].at <= 0) target.receive(q.shift().msg);
        for (const item of q) item.at -= 1;
      }
    },
    sendFrom(key, msg) {
      queues[key].push({ msg, at: lagFrames });
    },
  };
}
