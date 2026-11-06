// Names in the world: a small painted-looking label over each place you have discovered (or sighted), announced
// when found and settling over the island while you are near. DOM text over the canvas (crisp on a phone, no font
// texture), pointer-events off so it never blocks the controls.
import * as THREE from '../vendor/three/three.module.js';
import { displayName } from './names.js';
import { edgeSpot, screenDirection, formatDistance } from './nav-target.js';

// How long a name stays, and where (bug fix, 2026-11-05: names used to live on a 6.5 s timer, so one faded away while
// you sat next to its island, and several off-screen names piled up on the same screen edge, under the compass).
//   - A new name is announced for at least LABEL_MIN_SHOW_S, wherever it is (off-screen ones as edge tags).
//   - After that it stays while the boat is near the place (keepDistance): over the island when the island is on screen,
//     as an edge tag pointing the way when it is not (a portrait phone sees only about 20 m to each side, so a place can
//     be near and still off-screen: the first fix kept names only for on-screen places and they still vanished).
//     It fades (LABEL_FADE_S) only when you sail away, or when it would be cluttered. Edge tags keep a shorter distance.
//   - Names never overlap each other or the HUD (layoutLabels): nearest first, the rest stack or collapse.
export const LABEL_MIN_SHOW_S = 5;
export const LABEL_FADE_S = 1.5;
export const KEEP_EXTRA_M = 140; // a name stays while the boat is within (reach of the place + this), game metres
export const LABEL_MAX_SHOWN = 6; // on a wide screen; a narrow (phone) screen shows at most LABEL_MAX_SHOWN_NARROW
export const LABEL_MAX_SHOWN_NARROW = 4;
export const NARROW_PX = 600;
// Which names win a crowded edge: the nearest, but a village, harbour, island or described place counts as this many
// metres nearer than a bare skerry (so Gåsö at 200 m beats an unnamed-by-description skerry at 120 m).
export const IMPORTANCE_BONUS_M = { village: 140, harbour: 100, light: 120, island: 100, skerry: 0 };
export const DESCRIBED_BONUS_M = 60;
export const labelScore = (entry, dist) => dist - (IMPORTANCE_BONUS_M[entry.kind] ?? 0) - (entry.desc ? DESCRIBED_BONUS_M : 0);
export const EDGE_KEEP_EXTRA_M = 60; // an edge tag (place off-screen) is kept for this long instead
export const keepDistance = (entry, onScreen = true) => entry.radius + (onScreen ? KEEP_EXTRA_M : EDGE_KEEP_EXTRA_M);

// Quiet names (1c phone test): once an island or skerry has been announced, its name settles into a small, low-opacity label that
// shows only while the island is on screen as you sail past. Villages, harbours and lighthouses keep their sticky edge tags.
export const QUIET_KINDS = new Set(['island', 'skerry']);
export const QUIET_OPACITY = 0.6;
export const QUIET_SCALE = 0.78;
export const QUIET_PENALTY_M = 150; // a quiet name yields its screen spot to a place that matters more
export const isQuiet = (entry, hint) => QUIET_KINDS.has(entry.kind) && !hint;
// Should a label be up now? announced: still in its first seconds; near: within keepDistance; onScreen: its place is in view.
// A quiet label needs its place on screen (no edge tag); anything else stays while near, on screen or not.
export const wantsLabel = ({ quiet, announced, near, onScreen }) => announced || (quiet ? near && onScreen : near);

// Layout, pure so it can be tested. items: [{ id, x, y, w, h }] in the order of importance (the caller puts the
// nearest, and the ones already showing, first); (x, y) is where the label wants its CENTRE; W, H the screen;
// reserved: [{ x, y, w, h }] boxes to keep clear of (compass, HUD). Returns Map id -> { x, y, hidden }.
// Each label is clamped inside the screen using its OWN size, then tried in this order: where it wants to be, beside
// or below any HUD box it hits, then one and two label-rows up or down. The first spot that is clear of every label
// already placed and of the HUD wins; if none is, the label is hidden (collapsed). At most `maxShown` are shown.
export function layoutLabels(items, W, H, reserved = [], { margin = 8, gap = 6, maxShown = LABEL_MAX_SHOWN } = {}) {
  const out = new Map();
  const placed = [];
  const hit = (a, b, g) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
  for (const it of items) {
    if (placed.length >= maxShown) { out.set(it.id, { x: it.x, y: it.y, hidden: true }); continue; }
    const cl = (x, y) => [
      Math.min(W - margin - it.w / 2, Math.max(margin + it.w / 2, x)),
      Math.min(H - margin - it.h / 2, Math.max(margin + it.h / 2, y)),
    ];
    const rectAt = (x, y) => ({ x: x - it.w / 2, y: y - it.h / 2, w: it.w, h: it.h });
    const [bx, by] = cl(it.x, it.y);
    const cands = [[bx, by]];
    for (const r of reserved) {
      if (!hit(rectAt(bx, by), r, gap)) continue;
      cands.push(cl(r.x - gap - it.w / 2, by)); // beside the HUD box
      cands.push(cl(bx, r.y + r.h + gap + it.h / 2)); // below it
    }
    for (const k of [1, -1, 2, -2]) cands.push(cl(bx, by + k * (it.h + gap)));
    const ok = cands.find(([x, y]) => {
      const r = rectAt(x, y);
      return !placed.some((p) => hit(r, p, gap)) && !reserved.some((q) => hit(r, q, 2));
    });
    if (ok) { placed.push(rectAt(ok[0], ok[1])); out.set(it.id, { x: ok[0], y: ok[1], hidden: false }); }
    else out.set(it.id, { x: bx, y: by, hidden: true });
  }
  return out;
}

// Several names can be found at once (a skerry archipelago): show at most LABEL_MAX_ACTIVE, LABEL_GAP_S apart,
// the most important kind first, and drop ones that waited too long (the name is still discovered and remembered).
export const LABEL_MAX_ACTIVE = 3;
export const LABEL_GAP_S = 0.8;
export const LABEL_STALE_S = 8;
const PRIORITY = { village: 0, harbour: 1, light: 1.5, island: 2, skerry: 3 };
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
    // Drops every pending item the predicate matches (a place's older announcement, when it is announced again).
    remove(pred) { pending = pending.filter((p) => !pred(p)); },
    get size() { return pending.length; },
  };
}

const KIND_NOTE = { island: 'island', skerry: 'skerry', harbour: 'natural harbour', village: '', light: 'lighthouse' };
const BOTTOM_STRIP_PX = 44; // the phone's speed / places line

export function createNameLabels(container = document.body, { onCancelTarget = () => {} } = {}) {
  const labels = new Map(); // id -> { entry, wy, hint, el, w, h, born, fade, vis, placed }   (el null = not on screen now)
  const queue = createLabelQueue();
  const v = new THREE.Vector3();
  let lastNowS = null;
  let hidden = false; // the chart is up: it draws its own names
  let reservedAt = -Infinity;
  let reservedRects = [];
  const v2 = new THREE.Vector3();
  let target = null; // the 'Navigate here' tag: { entry, wy, titleFn, el, textEl, arrowEl, distEl, w, h, placed, vis, fade, isTarget }

  function build(l, nowS, announce = true) {
    const { entry, hint } = l;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none;z-index:6;opacity:0;'
      + 'text-align:center;font:italic 600 18px/1.15 Georgia,"Times New Roman",serif;color:#fbf3e2;letter-spacing:.02em;'
      + 'text-shadow:0 1px 3px rgba(12,28,44,.85),0 0 10px rgba(12,28,44,.55);white-space:nowrap';
    // hint: still undiscovered, so only the description; otherwise the real name over its description.
    const { title, sub } = displayName(entry, !hint);
    el.textContent = title;
    const note = hint ? '' : sub || KIND_NOTE[entry.kind];
    if (note) {
      const s = document.createElement('div');
      s.dataset.note = '1';
      s.style.cssText = 'font:11px/1.2 system-ui,sans-serif;font-style:normal;font-weight:500;opacity:.8;letter-spacing:.08em;text-transform:uppercase';
      s.textContent = note;
      el.appendChild(s);
    }
    container.appendChild(el);
    el.style.visibility = hidden ? 'hidden' : 'visible';
    l.el = el;
    l.w = el.offsetWidth;
    l.h = el.offsetHeight;
    l.born = announce ? nowS : nowS - LABEL_MIN_SHOW_S; // met again later (not just discovered): no announcement
    l.q = announce ? 0 : 1;
    l.fade = 0;
    l.vis = 0;
    l.placed = false;
  }
  const drop = (l) => { l.el?.remove(); l.el = null; };

  function register(entry, wy, hint) {
    const old = labels.get(entry.id);
    if (old && old.hint === hint) { old.wy = wy; return old; }
    if (old) drop(old); // a sighting is replaced by the real name (never both on one island)
    const l = { entry, wy, hint, el: null, w: 0, h: 0, born: 0, fade: 0, vis: 0, placed: false, q: 0 };
    labels.set(entry.id, l);
    return l;
  }

  function textOfTarget() {
    const t = target.titleFn();
    if (target.textEl.textContent !== t) target.textEl.textContent = t;
  }

  return {
    // A place named for the first time (or sighted: hint). Announced, one at a time, wherever it is.
    show(entry, wy, nowS, hint = false) {
      register(entry, wy, hint);
      queue.remove((p) => p.item.entry.id === entry.id); // one pending name per place
      queue.push({ entry, wy, hint }, nowS);
    },
    // A place already known from an earlier session: no announcement, but its name is shown when you are near it.
    track(entry, wy) { register(entry, wy, false); },
    // The 'Navigate here' tag: one target at a time (null clears it). titleFn() gives the name as the discovery rules allow.
    setTarget(entry, wy, titleFn = () => entry.name) {
      if (target) { target.el.remove(); target = null; }
      if (!entry) return;
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:0;top:0;transform:translate(-50%,-50%);z-index:6;opacity:0;pointer-events:none;text-align:center;'
        + 'font:italic 600 18px/1.15 Georgia,"Times New Roman",serif;color:#f2c46d;letter-spacing:.02em;white-space:nowrap;'
        + 'text-shadow:0 1px 3px rgba(12,28,44,.9),0 0 10px rgba(12,28,44,.6)';
      const textEl = document.createElement('span');
      const sub = document.createElement('div');
      sub.style.cssText = 'font:italic 600 14px/1.3 Georgia,"Times New Roman",serif;letter-spacing:.03em;color:#fbf3e2;display:flex;align-items:center;justify-content:center;gap:6px';
      const arrowEl = document.createElement('span');
      arrowEl.textContent = '➤';
      arrowEl.style.cssText = 'display:inline-block;font-size:13px;color:#f2c46d';
      const distEl = document.createElement('span');
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '✕';
      cancel.setAttribute('aria-label', 'Stop navigating');
      cancel.style.cssText = 'pointer-events:auto;touch-action:manipulation;font:600 14px Georgia,"Times New Roman",serif;color:#f3e6c8;background:#3a2a1a;border:1px solid #3a2a1a;border-radius:4px;padding:3px 9px;margin-left:4px;cursor:pointer';
      cancel.addEventListener('click', (ev) => { ev.stopPropagation(); onCancelTarget(); });
      sub.append(arrowEl, distEl, cancel);
      el.append(textEl, sub);
      container.appendChild(el);
      el.style.visibility = hidden ? 'hidden' : 'visible';
      target = { entry, wy, titleFn, el, textEl, arrowEl, distEl, w: 0, h: 0, placed: false, vis: 0, fade: 0, q: 0, isTarget: true };
      textOfTarget(0);
    },
    // Hide / show every name (the chart covers the view). Cheap: only does work when it changes.
    setHidden(h) {
      if (h === hidden) return;
      hidden = h;
      for (const l of labels.values()) if (l.el) l.el.style.visibility = h ? 'hidden' : 'visible';
      if (target) target.el.style.visibility = h ? 'hidden' : 'visible';
    },
    // Call every frame after the camera moved. boat: { x, z }; reserved(): [{ x, y, w, h }] HUD boxes (asked ~2x a second).
    update(camera, width, height, nowS, boat, reserved = () => []) {
      const dt = lastNowS === null ? 0 : Math.min(0.25, nowS - lastNowS);
      lastNowS = nowS;
      if (nowS - reservedAt > 0.5) { reservedRects = reserved(); reservedAt = nowS; }
      const announcing = [...labels.values()].filter((l) => l.el && nowS - l.born < LABEL_MIN_SHOW_S).length; // settled names do not hold up new ones
      const next = queue.pop(nowS, announcing);
      if (next) {
        const l = labels.get(next.entry.id);
        if (l && l.hint === next.hint) { if (!l.el) build(l, nowS); else l.born = nowS; } // announced: stays at least LABEL_MIN_SHOW_S
      }
      const items = [];
      for (const l of labels.values()) {
        const e = l.entry;
        const dist = Math.hypot(e.x - boat.x, e.z - boat.z);
        v.set(e.x, l.wy, e.z).project(camera);
        const sx = ((v.z > 1 ? 0 : v.x) + 1) / 2 * width;
        const sy = (1 - (v.z > 1 ? -1 : v.y)) / 2 * height;
        const onScreen = v.z <= 1 && sx > 24 && sx < width - 24 && sy > 24 && sy < height - BOTTOM_STRIP_PX;
        if (target && target.entry.id === e.id) { if (l.el) l.el.style.opacity = '0'; continue; } // the navigate tag carries this name
        const quiet = isQuiet(e, l.hint);
        const near = dist < keepDistance(e, onScreen);
        if (!l.el && near && (!quiet || onScreen)) build(l, nowS, false); // met again: its name shows (quietly, or as an edge tag)
        if (!l.el) continue;
        const announced = nowS - l.born < LABEL_MIN_SHOW_S;
        const wanted = wantsLabel({ quiet, announced, near, onScreen });
        l.dbg = { sx: Math.round(sx), sy: Math.round(sy), onScreen, near, announced, wanted, quiet, dist: Math.round(dist), fade: +l.fade.toFixed(2), vis: +l.vis.toFixed(2) };
        l.fade = Math.max(0, Math.min(1, l.fade + (wanted ? dt / 0.4 : -dt / LABEL_FADE_S)));
        if (!wanted && l.fade <= 0) { drop(l); continue; }
        // after its announcement a quiet name settles: smaller, fainter, no note line (l.q eases 0 -> 1)
        l.q = Math.max(0, Math.min(1, l.q + (quiet && !announced ? dt / 1.2 : -dt / 0.4)));
        const k = 1 - (1 - QUIET_SCALE) * l.q;
        items.push({ l, id: e.id, x: sx, y: sy, w: l.w * k, h: l.h * k, score: labelScore(e, dist) + (l.q > 0.5 ? QUIET_PENALTY_M : 0) });
      }
      if (target) { // the navigate tag: always up, first in line, on the edge towards the place when it is out of view
        const e = target.entry;
        const dx = e.x - boat.x;
        const dz = e.z - boat.z;
        v.set(e.x, target.wy, e.z).project(camera);
        const sx = (v.x + 1) / 2 * width;
        const sy = (1 - v.y) / 2 * height;
        const inFront = v.z <= 1;
        const onScreen = inFront && sx > 24 && sx < width - 24 && sy > 24 && sy < height - BOTTOM_STRIP_PX;
        const me = camera.matrixWorld.elements;
        const [ddx, ddy] = screenDirection(dx, dz, [me[0], me[1], me[2]], [me[4], me[5], me[6]]);
        textOfTarget(nowS);
        target.arrowEl.style.display = onScreen ? 'none' : 'inline-block';
        target.arrowEl.style.transform = `rotate(${Math.atan2(ddy, ddx)}rad)`;
        target.distEl.textContent = formatDistance(Math.hypot(dx, dz));
        target.w = target.el.offsetWidth; target.h = target.el.offsetHeight;
        let x = sx;
        let y = sy;
        if (!onScreen) {
          v2.set(boat.x, 0.5, boat.z).project(camera);
          [x, y] = edgeSpot((v2.x + 1) / 2 * width, (1 - v2.y) / 2 * height, ddx, ddy, width, height, target.w / 2 + 10, target.h / 2 + 10, BOTTOM_STRIP_PX);
        }
        target.fade = Math.min(1, target.fade + dt / 0.4);
        items.push({ l: target, id: '__target', x, y, w: target.w, h: target.h, score: -1e9 });
      }
      // nearest first (labelScore: places that matter count as nearer), but a label already showing keeps its place
      // over a newcomer, so two names do not swap in and out as their distances cross
      items.sort((a, b) => (b.l.isTarget ? 1 : 0) - (a.l.isTarget ? 1 : 0) || (b.l.placed ? 1 : 0) - (a.l.placed ? 1 : 0) || a.score - b.score);
      const rects = [...reservedRects, { x: 0, y: height - BOTTOM_STRIP_PX, w: width, h: BOTTOM_STRIP_PX }];
      const spots = layoutLabels(items, width, height, rects, { maxShown: width < NARROW_PX ? LABEL_MAX_SHOWN_NARROW : LABEL_MAX_SHOWN });
      for (const it of items) {
        const spot = spots.get(it.id);
        const l = it.l;
        l.placed = !spot.hidden;
        l.vis = Math.max(0, Math.min(1, l.vis + (spot.hidden ? -dt / 0.35 : dt / 0.35)));
        l.el.style.left = `${spot.x}px`;
        l.el.style.top = `${spot.y}px`;
        if (l.isTarget) { l.el.style.opacity = String(Math.min(l.fade, l.vis)); continue; }
        const k = 1 - (1 - QUIET_SCALE) * l.q;
        l.el.style.transform = `translate(-50%,-50%) scale(${k.toFixed(3)})`;
        l.el.style.opacity = String(Math.min(l.fade, l.vis) * (1 - (1 - QUIET_OPACITY) * l.q));
        const note = l.el.firstElementChild;
        if (note) note.style.opacity = String(0.8 * (1 - l.q));
      }
    },
    // What each label is doing (headless checks): where its place projects, and why it stays or goes.
    debug: () => [...labels.values()].filter((l) => l.el).map((l) => ({ name: l.entry.name, w: l.w, h: l.h, ...l.dbg })),
    get activeCount() { return [...labels.values()].filter((l) => l.el).length; },
    get target() { return target ? target.entry : null; },
  };
}
