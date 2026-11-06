// "Seen" (stage 1c revision): a place's name may only show once its land has been revealed by the fog (src/explored.js).
// A place counts as seen when the fog has lifted over any LAND within its reach, not only its centre: an island's label
// point is inland, and the boat's reveal (150 m) can never reach the middle of a big island from the water.
// Pure: explored and heightAt are passed in, so it is testable without a browser.
export const SEEN_MAX_REACH_M = 150; // look at most this far from the label point (bigger islands are seen by their shore)

export function createSeen({ explored = null, heightAt, step = 24, maxReach = SEEN_MAX_REACH_M } = {}) {
  let ex = explored;
  const yes = new Set(); // seen once = seen for good (the fog only grows)
  const no = new Map(); // id -> explored.version at which it was last found unseen (re-checked only when the fog changed)
  return {
    // The explored grid is created after the chart config loads: until then nothing is seen.
    setExplored(e) { ex = e; yes.clear(); no.clear(); },
    // entry: { id, x, z, radius }
    isSeen(entry) {
      if (!ex) return false;
      if (yes.has(entry.id)) return true;
      if (no.get(entry.id) === ex.version) return false;
      const reach = Math.min(entry.radius || 60, maxReach);
      let found = false;
      // the centre first (cheap, and the usual case for a skerry), then a grid of land points round it
      if (ex.isExplored(entry.x, entry.z) && heightAt(entry.x, entry.z) > 0) found = true;
      for (let dx = -reach; dx <= reach && !found; dx += step) {
        for (let dz = -reach; dz <= reach; dz += step) {
          if (dx * dx + dz * dz > reach * reach) continue;
          const x = entry.x + dx;
          const z = entry.z + dz;
          if (ex.isExplored(x, z) && heightAt(x, z) > 0) { found = true; break; } // fog first: heightAt only for lifted cells
        }
      }
      if (found) yes.add(entry.id); else no.set(entry.id, ex.version);
      return found;
    },
  };
}
