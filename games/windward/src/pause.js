// Pause (Next run, batch 1a): what happens when the app is hidden or minimised, and when the player taps to come back. Pure logic around two injected
// event targets (document, window) and a few callbacks, so it can be tested in node with fakes. The DOM card itself is src/pause-ui.js.
//
// THE RULE (written once, here):
//  - The pause STARTS when the page is hidden (visibilitychange -> hidden) or leaves (pagehide), and ENDS only when the player taps the card. Becoming
//    visible again does NOT resume: the card says "Tap to continue" and the game waits, exactly where it was.
//  - SOLO: the game clock (src/game-clock.js) freezes, so traffic, the ferry and the wind do not move while you are away or reading the card.
//  - CO-OP EXCEPTION: busy-route.js keeps both phones' traffic in step by using the WALL clock, and the host's wind is broadcast to the guest. If the
//    shared clock froze on one phone while the friend keeps sailing, that phone's traffic would be minutes out of step with the friend's. So while a
//    peer is connected the card still appears (and our own boat is held), but the clock keeps running on wall time. Pausing a boat is local; the sea is shared.
export function pauseFreezesClock(peerConnected) { return !peerConnected; }

// opts: { clock, hasPeer() -> bool, doc, win, showCard(), hideCard(), onPause(), onResume() }
// Returns { get paused, resume(), pause(), destroy() }. `resume()` is what the card's tap calls.
export function createPause({ clock, hasPeer = () => false, doc = globalThis.document, win = globalThis.window, showCard = () => {}, hideCard = () => {}, onPause = () => {}, onResume = () => {} }) {
  let paused = false;
  let frozeClock = false;
  function pause() {
    if (paused) return; // already waiting for the tap (a second hidden event changes nothing)
    paused = true;
    frozeClock = pauseFreezesClock(hasPeer());
    if (frozeClock) clock.pause();
    showCard();
    onPause();
  }
  function resume() {
    if (!paused) return;
    paused = false;
    if (frozeClock) clock.resume();
    frozeClock = false;
    hideCard();
    onResume();
  }
  const onVisibility = () => { if (doc && doc.visibilityState === 'hidden') pause(); };
  doc?.addEventListener('visibilitychange', onVisibility);
  win?.addEventListener('pagehide', pause);
  return {
    get paused() { return paused; },
    pause,
    resume,
    // A friend just connected while this phone's clock is behind the wall clock (we paused solo earlier): rejoin the wall clock so both phones show the same traffic.
    // One small jump of the ambient boats at the moment of joining, never a lasting offset.
    peerJoined() { if (!paused) clock.resync(); else if (frozeClock) { clock.resync(); frozeClock = false; } },
    destroy() { doc?.removeEventListener('visibilitychange', onVisibility); win?.removeEventListener('pagehide', pause); },
  };
}
