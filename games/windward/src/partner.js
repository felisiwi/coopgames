// Partner presence (Stage 1, 2026-11-04 — design audit check 4 "Graceful
// end"). The hub's "Connection lost" panel is hidden during play, and games
// can't see net.onClose, so a partner who closed their tab used to leave a
// boat frozen on the water forever.
//
// The partner sends 'pos' at CONFIG.NET_SEND_HZ (20/s). If none arrive for
// CONFIG.PARTNER_TIMEOUT_S, treat them as gone. A new 'pos' brings them back
// (drop-in play), so this never needs to be "reset".
import { CONFIG } from './config.js';

// lastPosAtS: seconds timestamp of the most recent 'pos', or null if never.
// Returns 'none' (never heard from), 'present', or 'left'.
export function partnerState(lastPosAtS, nowS, timeoutS = CONFIG.PARTNER_TIMEOUT_S) {
  if (lastPosAtS === null) return 'none';
  return nowS - lastPosAtS > timeoutS ? 'left' : 'present';
}
