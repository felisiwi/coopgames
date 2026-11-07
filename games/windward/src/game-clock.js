// The game clock: wall time minus the time spent paused (Next run, batch 1a). Pure: no DOM, no THREE; `wall` is injectable so a test can drive it.
//
// Why it exists: the busy coast's traffic and ferry (src/busy-coast.js) and the host's wind controller (src/wind.js) are functions of a CLOCK, not of
// frames, so a hidden tab (requestAnimationFrame stops) used to come back to boats and wind that had jumped ahead by the whole absence. Everything that
// keeps its own time reads this one clock instead of Date.now() / performance.now(); pausing it for N seconds and resuming advances it by exactly 0.
//
//   const clock = createGameClock();   // seconds, wall-clock based (Date.now() / 1000)
//   clock.now()                        // game seconds
//   clock.pause() / clock.resume()     // freeze / give the frozen time back
//   clock.resync()                     // rejoin the wall clock (drop everything paused so far): used when a friend joins, see src/pause.js
export function createGameClock(wall = () => Date.now() / 1000) {
  let pausedTotal = 0; // wall seconds already spent frozen, subtracted from every reading
  let pausedAt = null; // the wall time the current freeze began, or null while running
  return {
    now: () => (pausedAt === null ? wall() : pausedAt) - pausedTotal,
    pause() { if (pausedAt === null) pausedAt = wall(); },
    resume() { if (pausedAt !== null) { pausedTotal += wall() - pausedAt; pausedAt = null; } },
    resync() { pausedTotal = 0; pausedAt = null; },
    get frozen() { return pausedAt !== null; },
    get offset() { return pausedTotal + (pausedAt === null ? 0 : wall() - pausedAt); }, // how far behind the wall clock the game clock is right now
  };
}
