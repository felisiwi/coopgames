// A newly discovered name, shown briefly in the world: a small painted-looking label that
// follows the place on screen for a few seconds, then fades. DOM text over the canvas (crisp on a
// phone, no font texture), pointer-events off so it never blocks the controls.
import * as THREE from '../vendor/three/three.module.js';
import { displayName } from './names.js';

export const LABEL_SHOW_S = 5; // fully visible
export const LABEL_FADE_S = 1.5; // then fades out
const EDGE = 0.1; // keep labels this far (fraction of the screen) inside the edges so an off-screen island still shows its name

// NDC (-1..1, y up) -> CSS pixels, clamped inside the screen margin. Pure, so it can be tested.
export function labelScreenPos(ndcX, ndcY, width, height, edge = EDGE) {
  const fx = Math.min(1 - edge, Math.max(edge, (ndcX + 1) / 2));
  const fy = Math.min(1 - edge, Math.max(edge, (1 - ndcY) / 2));
  return { x: fx * width, y: fy * height };
}

// Several names can be found at once (a skerry archipelago): show at most LABEL_MAX_ACTIVE, LABEL_GAP_S apart,
// the most important kind first, and drop ones that waited too long (the name is still discovered and remembered).
export const LABEL_MAX_ACTIVE = 3;
export const LABEL_GAP_S = 0.8;
export const LABEL_STALE_S = 8;
const PRIORITY = { village: 0, harbour: 1, island: 2, skerry: 3 };
export function createLabelQueue({ max = LABEL_MAX_ACTIVE, gapS = LABEL_GAP_S, staleS = LABEL_STALE_S } = {}) {
  let pending = [];
  let lastAt = -Infinity;
  let seq = 0;
  return {
    push(item, nowS) { pending.push({ item, at: nowS, seq: seq++ }); },
    // The next label to show now, or null.
    pop(nowS, activeCount) {
      pending = pending.filter((p) => nowS - p.at <= staleS);
      if (!pending.length || activeCount >= max || nowS - lastAt < gapS) return null;
      // A sighting (descriptive name only) ranks half a step ahead of a discovery of its own kind: a place with a
      // description is a notable one, so in a dense archipelago it is not buried behind a dozen bare skerries
      // (it would go stale unseen). Villages and harbours still come first.
      const rank = (p) => (PRIORITY[p.item.entry.kind] ?? 9) - (p.item.hint ? 0.5 : 0);
      pending.sort((a, b) => rank(a) - rank(b) || a.seq - b.seq);
      lastAt = nowS;
      return pending.shift().item;
    },
    get size() { return pending.length; },
  };
}

const KIND_NOTE = { island: 'island', skerry: 'skerry', harbour: 'natural harbour', village: '' };

export function createNameLabels(container = document.body) {
  const active = []; // { el, wx, wy, wz, born }
  const queue = createLabelQueue();
  const v = new THREE.Vector3();
  function spawn(entry, wy, nowS, hint) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none;z-index:6;'
        + 'text-align:center;font:italic 600 18px/1.15 Georgia,"Times New Roman",serif;color:#fbf3e2;letter-spacing:.02em;'
        + 'text-shadow:0 1px 3px rgba(12,28,44,.85),0 0 10px rgba(12,28,44,.55);white-space:nowrap';
      // hint: still undiscovered, so only the description; otherwise the real name over its description.
      const { title, sub } = displayName(entry, !hint);
      el.textContent = title;
      const note = hint ? '' : sub || KIND_NOTE[entry.kind];
      if (note) {
        const sub = document.createElement('div');
        sub.style.cssText = 'font:11px/1.2 system-ui,sans-serif;font-style:normal;font-weight:500;opacity:.8;letter-spacing:.08em;text-transform:uppercase';
        sub.textContent = note;
        el.appendChild(sub);
      }
      container.appendChild(el);
      active.push({ el, wx: entry.x, wy, wz: entry.z, born: nowS });
  }
  return {
    // wy: height of the label above the water at the place. Shown when the queue allows.
    // hint: true for a sighting (the descriptive name, before discovery).
    show(entry, wy, nowS, hint = false) { queue.push({ entry, wy, hint }, nowS); },
    // Call every frame after the camera moved.
    update(camera, width, height, nowS) {
      const next = queue.pop(nowS, active.length);
      if (next) spawn(next.entry, next.wy, nowS, next.hint);
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i];
        const age = nowS - a.born;
        if (age > LABEL_SHOW_S + LABEL_FADE_S) { a.el.remove(); active.splice(i, 1); continue; }
        v.set(a.wx, a.wy, a.wz).project(camera);
        const p = labelScreenPos(v.z > 1 ? 0 : v.x, v.z > 1 ? -1 : v.y, width, height);
        a.el.style.left = `${p.x}px`;
        a.el.style.top = `${p.y}px`;
        a.el.style.opacity = String(Math.min(1, Math.min(age / 0.4, (LABEL_SHOW_S + LABEL_FADE_S - age) / LABEL_FADE_S)));
      }
    },
    get activeCount() { return active.length; },
  };
}
