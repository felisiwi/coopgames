# coop-check test scripts (2026-11-06) — throwaway, not part of the game

Playwright scripts that ran two real Windward games and compared them. Paths to Playwright and to a Chromium build are
hard-coded to Felix's machine (see harness.mjs): edit before reusing. Needs `node scripts/dev-server.js 5199` running.

- `lib.mjs` — two players in SEPARATE browser contexts (separate localStorage), messages relayed through node via
  `../bridge.html` (the game's real `net` contract over a relay instead of PeerJS).
- `t3.mjs` — PeerJS directly in one headless page: this sandbox could NOT open a WebRTC connection, even with no ICE servers.
- `t5.mjs` — traffic/ferry positions on both screens, then with the guest's clock 90 s fast.
- `t6.mjs` — lighthouse task: host relights Islandsberg, compare host/guest state.
- `t7.mjs` — ?year=1950 on one side, ping, friend leaving.
- `t8.mjs` — harbour arrival moment and deck card on both sides.
