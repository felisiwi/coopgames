// Zoom, chart, minimap and the lighthouse visit, in one place (stage 1c). game.js calls update() once a frame and reads back
// what to do with the camera. Owns: the zoom (eased), the chart pan, the "focus" (where the camera looks: the boat, or a
// lighthouse during a visit), the explored fog, the minimap and chart renderers, and the controls (src/chart-ui.js).
//
// Nothing here costs anything while you sail in the boat view: the chart canvas is hidden (display none), the fog is only
// rebuilt when it changes and the chart is up, and the minimap is a few rows of height samples per frame.
import { LIGHTHOUSES } from './lighthouses.js';
import { createExplored } from './explored.js';
import { createMinimap } from './minimap.js';
import { createChart, boundsRect } from './chart.js';
import { createChartUi } from './chart-ui.js';
import { ZOOM_MIN, ZOOM_CHART_START, ZOOM_CHART_FULL, ZOOM_STEP, chartBlend, chartView, fitZoom, stepZoom, wheelFactor, screenToWorld, zoomForScale } from './zoom.js';
import { attachZoomInput } from './zoom-input.js';
import { deviceStorage } from './names.js';
import { createSeen } from './seen.js';
import { markKind } from './seamark-layer.js';
import { relightFrame, REVEAL_RADIUS_M } from './relight.js';
import { createNavTarget } from './nav-target.js';

export const VISIT_ZOOM = 0.8; // close enough to look at the lighthouse
export const RELIGHT_ZOOM = 1.05; // a little wider for the relight: the tower and the sea round it as the camera turns
export const ZOOM_EASE = 9; // 1/s: how fast the shown zoom follows the target
export const FOCUS_EASE = 3.2; // 1/s: how fast the view glides to a lighthouse and back
// How much the view centres on the whole coast: 0 until about half way (in log zoom) from the chart to the full chart, 1 at the full chart.
export const autoCentre = (logRatio) => { const t = Math.min(1, Math.max(0, (logRatio - 0.45) / 0.55)); return t * t * (3 - 2 * t); };
export const TAP_MAX_PX = 8;
export const TAP_MAX_MS = 450;

// What the visit card says for a lighthouse entry: the discovery rules (description until named), plus the year it was lit.
export function lightInfo(entry, known, lights = LIGHTHOUSES, dark = false) {
  const meta = lights.find((l) => l.name === entry.name);
  const title = known ? entry.name : (entry.desc || 'A lighthouse');
  const parts = [];
  if (dark) parts.push('Dark since the storm');
  if (known && entry.desc) parts.push(entry.desc);
  parts.push(meta && meta.built ? `Lighthouse · built ${meta.built}` : 'Lighthouse');
  return { title, sub: parts.join(' · ') };
}

// The lighthouses the chart shows: those in the playable window are name-list entries (discoverable, visitable); the rest of the
// coast's lights are icons only. toGame(lon, lat) -> [x, z].
export function chartLights(names, toGame, lights = LIGHTHOUSES) {
  const inWindow = names.filter((e) => e.kind === 'light');
  const have = new Set(inWindow.map((e) => e.name));
  const far = lights.filter((l) => !have.has(l.name)).map((l) => {
    const [x, z] = toGame(l.lon, l.lat);
    return { id: `light:${l.name}`, name: l.name, kind: 'light', desc: null, x, z, radius: 0, outside: true };
  });
  return { inWindow, far };
}

// What the card says for a place picked on the chart: its name, with what it is.
const KIND_LINE = { village: 'Village', harbour: 'Natural harbour', island: 'Island', skerry: 'Skerry', light: 'Lighthouse' };
export function placeInfo(entry) {
  return { title: entry.name, sub: [entry.desc, KIND_LINE[entry.kind]].filter(Boolean).join(' · ') };
}

// Stage 1d: isDark(id): a lighthouse the storm put out (the chart and minimap mark it "dark"); holdTarget(entry): a "Navigate here" target that does
// not clear on arrival (a dark light is cleared when it is lit); onRelit(entry) -> toast text: the light came back on (game.js saves the progress);
// onArrive(entry): a navigate target was reached.
// onTarget(entry | null, titleFn): the sail target changed (game.js shows its edge tag). onVisit(entry): a lighthouse visit began
// (game.js shows that lighthouse's name label, so its description is up while you look at it).
// What the chart draws of the sea (stage 1d): real marks, the shoals, the leading lines, in game metres.
export function chartSea(sea, toGame) {
  return {
    marks: sea.marks.map((spec) => { const [x, z] = toGame(spec.lon, spec.lat); return { x, z, kind: markKind(spec), invented: !!spec.invented, type: spec.type }; }),
    shoals: sea.shoalList,
    lines: sea.lines.map((l) => l.points.map(([lon, lat]) => toGame(lon, lat))),
  };
}

export function createChartController({ canvas, coast, nameBook, getMarks = () => [], debug = false, onJump = () => {}, onTarget = () => {}, onVisit = () => {}, isDark = () => false, holdTarget = () => false, onRelit = () => null, onArrive = () => {}, onTask = () => {}, parent = document.body, assetsBase, storage = deviceStorage() }) {
  const toGame = coast.world.toGame;
  const lights = chartLights(coast.names, toGame);
  const lightList = [...lights.inWindow, ...lights.far];
  const seen = createSeen({ heightAt: coast.heightAt }); // the fog gate for names (src/seen.js); the grid arrives with chart.json
  const nav = createNavTarget();
  const state = {
    zoom: 1, zoomTarget: 1, returnZoom: 1, pan: { x: 0, z: 0 }, focus: { x: NaN, z: NaN },
    visit: null, relight: null, card: null, explored: null, chart: null, cfg: null, W: 390, H: 844, dpr: 1, view: null, t: 0, drag: null, zooming: false, lastSave: 0,
  };

  const ui = createChartUi({
    parent, debug,
    onChart: () => toggleChart(), // the Boat button (shown only while the chart is up)
    onTask: () => onTask(), // the Task button (also chart mode only): reopens the start card
    onZoomStep: (f) => zoomBy(f),
    onBack: () => { if (state.visit) endVisit(); else closeCard(); },
    onNavigate: () => onNavigatePressed(),
    onJump: () => { if (state.visit) { onJump(state.visit.x, state.visit.z); endVisit(); } },
    onMiniTap: (px, py, size) => {
      const hit = mini.hitLight(px, py, size, lastBoat);
      if (hit) startVisit(hit.entry);
      else if (!state.visit && state.zoomTarget < ZOOM_CHART_START) toggleChart(); // a tap on the map itself opens the chart
    },
  });
  let lastBoat = { x: 0, z: 0, heading: 0 };
  const mini = createMinimap({
    canvas: ui.mini, heightAt: coast.heightAt, places: coast.names, isDark,
    lights: lights.inWindow.map((e) => ({ id: e.id, x: e.x, z: e.z, name: e.name, entry: e })),
    marks: [], // filled each frame from getMarks (the buoys exist once the life is built)
  });
  let marksSet = false;

  // chart config + pictures, fetched in the background: the chart is ready a moment after load
  fetch(assetsBase + 'chart.json').then((r) => r.json()).then((cfg) => {
    state.cfg = cfg;
    state.explored = createExplored(boundsRect(toGame, cfg.detail), { storage });
    seen.setExplored(state.explored);
    setTimeout(() => state.chart && state.chart.ensureLoaded(), 2500); // fetch the pictures soon after load, so a quick zoom-out is never held up
    state.chart = createChart({
      canvas: ui.chartCanvas, cfg, toGame, entries: lightList.concat(coast.names.filter((e) => e.kind !== 'light')), isKnown: (id) => nameBook.isKnown(id),
      explored: state.explored, seen: (e) => seen.isSeen(e), baseUrl: assetsBase, showInvented: debug, isDark,
      sea: coast.sea ? chartSea(coast.sea, toGame) : null,
    });
  }).catch((err) => { console.warn('chart data failed to load', err); });

  const maxZoom = () => {
    if (!state.chart || !state.chart.loaded) return ZOOM_CHART_START + 0.3; // the chart is not ready: stay in the boat view
    const o = state.cfg.overview;
    return fitZoom((o.w * o.mpp) / 10, (o.h * o.mpp) / 10, state.W, state.H); // whole coast on screen (100 m px = 10 game m)
  };
  function zoomBy(f) {
    state.zoomTarget = stepZoom(state.zoomTarget, f, maxZoom());
    if (state.zoomTarget > 2.5) state.chart?.ensureLoaded(); // fetch the pictures before the chart fades in
  }
  function toggleChart() {
    if (state.zoomTarget >= ZOOM_CHART_START) { state.zoomTarget = state.returnZoom; state.pan = { x: 0, z: 0 }; }
    else { state.returnZoom = Math.max(ZOOM_MIN, state.zoomTarget); state.chart?.ensureLoaded(); state.zoomTarget = maxZoom(); }
  }
  // ---- the sail target ("Navigate here"): one at a time
  const navTitle = (e) => (e.kind === 'light' ? lightInfo(e, nameBook.isKnown(e.id)).title : (nameBook.isKnown(e.id) ? e.name : (e.desc || e.name)));
  function setTarget(entry) { nav.set(entry); onTarget(entry, () => navTitle(entry)); }
  function clearTarget() { if (!nav.entry) return; nav.clear(); onTarget(null, null); }
  const cardFor = (entry, back) => ({ ...(entry.kind === 'light' ? lightInfo(entry, nameBook.isKnown(entry.id), undefined, isDark(entry.id)) : placeInfo(entry)), nav: entry.outside ? null : (nav.entry && nav.entry.id === entry.id ? 'stop' : 'start'), back });
  function closeCard() { state.card = null; ui.showVisit(null); }
  function onNavigatePressed() {
    const entry = state.visit ? state.visit.entry : state.card;
    if (!entry) return;
    if (nav.entry && nav.entry.id === entry.id) { // already sailing there: stop
      clearTarget();
      ui.toast('Stopped navigating.', 1800);
      ui.showVisit(cardFor(entry, state.visit ? 'boat' : 'close'));
      return;
    }
    setTarget(entry);
    ui.toast(`Sailing for ${navTitle(entry)}`, 2600);
    state.card = null;
    if (state.visit) endVisit(); // back to the boat, with the tag to follow
    else {
      ui.showVisit(null);
      if (state.zoomTarget >= ZOOM_CHART_START) { state.zoomTarget = Math.min(state.returnZoom, ZOOM_CHART_START - 0.5); state.pan = { x: 0, z: 0 }; }
    }
  }
  function startVisit(entry) {
    if (entry.outside) { ui.toast('That light is beyond your chart, for now.'); return; }
    if (!state.visit && state.zoomTarget < ZOOM_CHART_START) state.returnZoom = state.zoomTarget;
    else if (!state.visit) state.returnZoom = 1;
    state.card = null;
    state.visit = { entry, x: entry.x, z: entry.z };
    state.zoomTarget = VISIT_ZOOM;
    state.pan = { x: 0, z: 0 };
    ui.showVisit(cardFor(entry, 'boat'));
    onVisit(entry);
  }
  // The relight (stage 1d): the boat has moored at a dark lighthouse. The visit view, one slow turn round it, the light comes back on mid-turn,
  // the fog lifts in a wide circle, the camera returns to the boat (src/relight.js is the timeline).
  function startRelight(entry) {
    if (state.visit || state.relight || entry.outside) return false;
    state.returnZoom = state.zoomTarget < ZOOM_CHART_START ? state.zoomTarget : 1;
    state.card = null;
    state.visit = { entry, x: entry.x, z: entry.z, relight: true };
    state.relight = { entry, t: 0, lit: false };
    state.zoomTarget = RELIGHT_ZOOM;
    state.pan = { x: 0, z: 0 };
    const info = lightInfo(entry, nameBook.isKnown(entry.id), undefined, true);
    ui.showVisit({ title: info.title, sub: 'Moored. The lamp is being lit again…', nav: null, back: 'none' });
    onVisit(entry);
    return true;
  }
  function openPlace(entry) {
    state.card = entry;
    ui.showVisit(cardFor(entry, 'close'));
  }
  function endVisit() {
    state.visit = null;
    state.relight = null;
    state.zoomTarget = Math.min(state.returnZoom, ZOOM_CHART_START - 0.5);
    state.pan = { x: 0, z: 0 };
    ui.showVisit(null);
  }

  // input: wheel + pinch anywhere; drag and tap on the chart itself
  const zoomInput = attachZoomInput({ target: window, onZoom: zoomBy, onPinchStart: () => { state.pinched = true; state.drag = null; coastPhoneInterrupt(); }, wheelFactor });
  let coastPhoneInterrupt = () => {};
  const cc = ui.chartCanvas;
  cc.addEventListener('pointerdown', (e) => {
    if (zoomInput.tracker.pinching) return;
    cc.setPointerCapture?.(e.pointerId);
    state.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false };
  });
  cc.addEventListener('pointermove', (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId || zoomInput.tracker.pinching || !state.view) return;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > TAP_MAX_PX) d.moved = true;
    if (d.moved) { // drag: the map follows the finger
      const a = screenToWorld(state.view, state.W, state.H, d.x, d.y);
      const b = screenToWorld(state.view, state.W, state.H, e.clientX, e.clientY);
      state.pan.x += a[0] - b[0];
      state.pan.z += a[1] - b[1];
    }
    d.x = e.clientX; d.y = e.clientY;
  });
  const up = (e) => {
    const d = state.drag;
    state.drag = null;
    if (!d || d.id !== e.pointerId || d.moved || zoomInput.tracker.pinching || performance.now() - d.t0 > TAP_MAX_MS || !state.chart || !state.view) return;
    const hit = state.chart.hit(e.clientX, e.clientY, state.view, state.W, state.H);
    if (!hit) return;
    if (hit.type === 'light') startVisit(hit.entry);
    else if (hit.type === 'place') openPlace(hit.entry);
    else if (hit.section.owned) { // zoom to the sheet: the detail picture fills the view
      const r = state.chart.detailRect;
      state.zoomTarget = Math.max(ZOOM_CHART_FULL, fitZoom(r.x1 - r.x0, r.z1 - r.z0, state.W, state.H, 0.96));
      state.pan = { x: (r.x0 + r.x1) / 2 - state.focus.x, z: (r.z0 + r.z1) / 2 - state.focus.z };
    } else ui.toast(`${hit.section.lore} isn’t on granddad’s chart. Sail there yourself, or trade for this sheet.`, 4200);
  };
  cc.addEventListener('pointerup', up);
  cc.addEventListener('pointercancel', () => { state.drag = null; });
  window.addEventListener('pagehide', () => state.explored?.save(true));

  return {
    ui, mini, state,
    get visiting() { return !!state.visit; },
    setPhoneInterrupt(fn) { coastPhoneInterrupt = fn; },
    toggleChart, endVisit, setTarget, clearTarget,
    toast: (text, ms) => ui.toast(text, ms),
    relightById(id) { const e = lightList.find((l) => l.id === id); return e ? startRelight(e) : false; },
    get relighting() { return !!state.relight; },
    get target() { return nav.entry; },
    canSee: (entry) => seen.isSeen(entry),
    visitById(id) { const e = lightList.find((l) => l.id === id); if (e) startVisit(e); return !!e; },
    rects: () => ui.rects(),
    // Once a frame. boat: { x, z, heading, speed }. Returns what the camera and renderer should do.
    update(dt, nowS, boat, W, H, dpr, friends = []) {
      lastBoat = boat;
      // the relight timeline: the light comes on mid-turn, the fog lifts a little after, then the camera goes back to the boat
      let relightOut = null;
      if (state.relight) {
        const r = state.relight;
        r.t += dt;
        const f = relightFrame(r.t);
        if (f.ignited && !r.lit) {
          r.lit = true;
          const msg = onRelit(r.entry);
          if (msg) ui.toast(msg, 5600);
          if (nav.entry && nav.entry.id === r.entry.id) clearTarget();
        }
        if (state.explored && f.revealFrac > 0) state.explored.reveal(r.entry.x, r.entry.z, REVEAL_RADIUS_M * f.revealFrac);
        relightOut = { id: r.entry.id, lamp: f.lamp, lit: r.lit, yaw: f.yaw };
        if (f.done) { state.explored?.save(true); endVisit(); relightOut = { ...relightOut, yaw: 0, done: true }; }
      }
      const arrived = nav.entry && holdTarget(nav.entry) ? null : nav.update(boat.x, boat.z);
      if (arrived) { onTarget(null, null); ui.toast(`Arrived at ${navTitle(arrived)}`, 3200); onArrive(arrived); }
      state.W = W; state.H = H; state.dpr = dpr;
      if (!marksSet) { const m = getMarks(); if (m && m.length) { mini.marks.push(...m); marksSet = true; } }
      if (Number.isNaN(state.focus.x)) { state.focus.x = boat.x; state.focus.z = boat.z; }
      // zoom eases (in log space, so a zoom-out and a zoom-in feel alike)
      state.zoomTarget = Math.min(state.zoomTarget, maxZoom());
      const k = 1 - Math.exp(-ZOOM_EASE * dt);
      const prev = state.zoom;
      state.zoom = Math.exp(Math.log(state.zoom) + (Math.log(state.zoomTarget) - Math.log(state.zoom)) * k);
      state.zooming = Math.abs(Math.log(state.zoomTarget / state.zoom)) > 0.01 || Math.abs(state.zoom - prev) > 1e-4;
      // the focus glides to the lighthouse on a visit, and back to the boat
      const tx = state.visit ? state.visit.x : boat.x;
      const tz = state.visit ? state.visit.z : boat.z;
      const f = state.visit || Math.hypot(tx - state.focus.x, tz - state.focus.z) > 0.5 ? 1 - Math.exp(-FOCUS_EASE * dt) : 1;
      state.focus.x += (tx - state.focus.x) * f;
      state.focus.z += (tz - state.focus.z) * f;
      // fog and fog saving
      if (state.explored && !state.visit) {
        state.explored.mark(boat.x, boat.z);
        if (nowS - state.lastSave > 3) { state.lastSave = nowS; state.explored.save(); }
      }
      const t = state.chart ? chartBlend(state.zoom) : 0;
      state.t = t;
      // near the full chart the view settles on the middle of the whole coast, not wherever the boat is
      let pan = state.pan;
      if (state.chart && state.chart.loaded) {
        const r = state.chart.overRect;
        const lr = Math.log(state.zoom / ZOOM_CHART_FULL) / Math.log(Math.max(maxZoom(), ZOOM_CHART_FULL * 1.01) / ZOOM_CHART_FULL);
        const w = autoCentre(lr);
        if (w > 0) pan = { x: state.pan.x * (1 - w) + ((r.x0 + r.x1) / 2 - state.focus.x) * w, z: state.pan.z * (1 - w) + ((r.z0 + r.z1) / 2 - state.focus.z) * w };
      }
      const view = chartView(state.zoom, H, state.focus, pan);
      state.view = view;
      if (state.chart && (t > 0 || state.chartShown)) {
        state.chart.draw(view, W, H, dpr, { boat, friends, visitId: state.visit ? state.visit.entry.id : null, target: nav.entry });
        state.chartShown = t > 0;
      }
      if (state.card && t < 0.5) closeCard(); // zoomed back into the boat view: a place card from the chart goes with it
      ui.setChartMode(t >= 0.98);
      mini.update(boat, boat.heading || 0, { hidden: t > 0.35 });
      ui.setMiniHidden(t > 0.35);
      return {
        zoom: Math.min(state.zoom, ZOOM_CHART_FULL), // the 3D camera stops here; beyond it the chart takes over
        focus: state.focus,
        t,
        skip3D: t >= 0.999 && state.chart && state.chart.loaded, // the chart covers the view: pause the 3D render
        visiting: !!state.visit,
        yaw: relightOut ? relightOut.yaw : 0, // the camera's turn round the target (the relight's slow circle); 0 = north-up
        relight: relightOut, // { id, lamp 0..1, lit, yaw, done? } while a light is being relit
        zooming: state.zooming,
        chartLoaded: !!(state.chart && state.chart.loaded),
      };
    },
  };
}
