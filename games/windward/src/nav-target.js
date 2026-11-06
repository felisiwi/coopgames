// "Navigate here" (stage 1c revision): one sail target at a time, shown as a sticky tag that follows the screen edge
// towards it, with the distance, until you arrive or cancel. Pure helpers here (testable in node); the tag itself is drawn
// by src/name-labels.js and the card that starts it by src/chart-ui.js.

// How close counts as "arrived", game metres (the same units as the HUD's knots: 1 m/s = 1.94 kn).
export const ARRIVE_M = { light: 60, village: 70, harbour: 45, island: 90, skerry: 50 };
export const arriveDistance = (entry) => ARRIVE_M[entry.kind] ?? 60;

export function createNavTarget() {
  let entry = null;
  return {
    get entry() { return entry; },
    set(e) { entry = e; },
    clear() { entry = null; },
    // Call every frame. Returns the target if the boat has just arrived (and clears it), else null.
    update(x, z) {
      if (!entry) return null;
      if (Math.hypot(entry.x - x, entry.z - z) > arriveDistance(entry)) return null;
      const done = entry;
      entry = null;
      return done;
    },
  };
}

// "320 m", "1.4 km". Game metres.
export function formatDistance(m) {
  if (!(m >= 0)) return '';
  if (m < 100) return `${Math.round(m / 5) * 5 || 5} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// Where an edge tag goes: from the boat's screen point (bx, by), along the screen direction (dx, dy), to the edge of the
// box inset by (padX, padY) from the screen. Returns [x, y] (the tag's centre) or the boat point if the direction is zero.
export function edgeSpot(bx, by, dx, dy, W, H, padX, padY, bottom = 0) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [bx, by];
  const ux = dx / len;
  const uy = dy / len;
  const maxX = W - padX;
  const maxY = H - bottom - padY;
  const tx = ux > 1e-6 ? (maxX - bx) / ux : ux < -1e-6 ? (padX - bx) / ux : Infinity;
  const ty = uy > 1e-6 ? (maxY - by) / uy : uy < -1e-6 ? (padY - by) / uy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return [bx + ux * t, by + uy * t];
}

// The screen direction (y down) of a ground vector (gx, gz) from the camera's own right and up axes (world space), so it is
// right for places behind the camera too, where projecting the point would flip it.
export function screenDirection(gx, gz, right, up) {
  return [gx * right[0] + gz * right[2], -(gx * up[0] + gz * up[2])];
}
