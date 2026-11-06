// The chart and minimap controls (stage 1c): the minimap (top left, round, north up; tap it to open the chart, a small badge says so),
// a Boat button that shows only while the chart is up, zoom +/- (bottom left, away from the rope), the lighthouse visit card and a toast. Plain DOM in
// the same quiet style as the HUD. No logic lives here: game.js passes callbacks.
const HUD_BG = 'rgba(20,34,48,0.78)';
const LINE = '1px solid rgba(234,246,255,0.18)';
const TEXT = '#eaf3f8';
const GOLD = '#f2c46d';
const UI_FONT = '600 13px system-ui,-apple-system,sans-serif';
const SAFE_TOP = 'env(safe-area-inset-top,0px)';
const SAFE_BOTTOM = 'env(safe-area-inset-bottom,0px)';

function el(tag, css, text) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(label, aria, css = '') {
  const b = el('button', `font:${UI_FONT};color:${TEXT};background:${HUD_BG};border:${LINE};border-radius:10px;padding:9px 12px;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;${css}`, label);
  b.type = 'button';
  b.setAttribute('aria-label', aria);
  return b;
}

// opts: { parent, debug, onChart(), onZoomStep(factor), onBack(), onNavigate(), onJump(), onMiniTap(px, py, size) }
export function createChartUi({ parent = document.body, debug = false, onChart, onZoomStep, onBack, onNavigate = () => {}, onJump, onMiniTap }) {
  // the chart's own canvas (drawn by src/chart.js), above the 3D view and the phone layer, below the controls
  const chartCanvas = el('canvas', 'position:fixed;inset:0;width:100%;height:100%;z-index:4;display:none;pointer-events:none;touch-action:none');
  chartCanvas.setAttribute('aria-label', "Granddad's chart of the west coast");
  parent.appendChild(chartCanvas);

  const top = el('div', `position:fixed;z-index:7;left:max(12px,env(safe-area-inset-left,0px));top:calc(12px + ${SAFE_TOP});display:flex;flex-direction:column;gap:8px;align-items:flex-start;pointer-events:none`);
  const mini = el('canvas', 'width:132px;height:132px;border:2px solid rgba(244,246,242,0.85);box-shadow:0 2px 10px rgba(0,0,0,0.25);background:#4d7d9d;display:block;pointer-events:auto;touch-action:manipulation;border-radius:50%');
  mini.width = 264; mini.height = 264;
  mini.setAttribute('aria-label', 'Minimap: tap to open the chart');
  mini.style.cursor = 'pointer';
  const caption = el('div', `font:600 10px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(234,243,248,0.7);text-shadow:0 1px 2px rgba(0,0,0,.5);width:132px;text-align:center`, 'North up');
  const row = el('div', 'display:flex;gap:8px;pointer-events:auto');
  const chartBtn = button('Boat', 'Back to the boat view', 'display:none'); // only while the chart is up
  row.append(chartBtn);
  // The minimap is the way into the chart: a tap opens it (or visits a lighthouse under the finger). A small expand badge on its edge
  // says it is tappable; it takes no touches itself, so the tap goes to the map.
  const miniWrap = el('div', 'position:relative;line-height:0');
  const badge = el('div', `position:absolute;right:-5px;bottom:-5px;width:24px;height:24px;border-radius:8px;background:${HUD_BG};border:${LINE};display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:.92`);
  badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="${TEXT}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 1.5h3v3M10.5 1.5L7 5M4.5 10.5h-3v-3M1.5 10.5L5 7"/></svg>`;
  miniWrap.append(mini, badge);
  top.append(miniWrap, caption, row);
  parent.appendChild(top);

  const zoomCol = el('div', `position:fixed;z-index:7;left:max(12px,env(safe-area-inset-left,0px));bottom:calc(64px + ${SAFE_BOTTOM});display:flex;flex-direction:column;gap:8px`);
  const zin = button('+', 'Zoom in', 'width:42px;height:42px;padding:0;font-size:20px;line-height:1');
  const zout = button('−', 'Zoom out', 'width:42px;height:42px;padding:0;font-size:20px;line-height:1');
  zoomCol.append(zin, zout);
  parent.appendChild(zoomCol);

  const card = el('div', `position:fixed;z-index:8;left:50%;transform:translateX(-50%);bottom:calc(64px + ${SAFE_BOTTOM});display:none;min-width:220px;max-width:min(92vw,360px);background:${HUD_BG};border:${LINE};border-radius:14px;padding:12px 14px;color:${TEXT};font:${UI_FONT};text-align:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)`);
  const cardTitle = el('div', 'font:italic 600 19px Georgia,"Times New Roman",serif;margin-bottom:2px');
  const cardSub = el('div', 'font:12px system-ui,sans-serif;opacity:.75;margin-bottom:10px');
  const cardRow = el('div', 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap');
  const navBtn = button('Navigate here', 'Sail to this place: show it as a tag you can follow', `background:${GOLD};color:#1f2a33;border-color:transparent`);
  const backBtn = button('Back to the boat', 'Return the view to your boat');
  const jumpBtn = button('Jump here (debug)', 'Jump the boat to this lighthouse');
  cardRow.append(navBtn, backBtn);
  if (debug) cardRow.append(jumpBtn);
  card.append(cardTitle, cardSub, cardRow);
  parent.appendChild(card);

  const toastEl = el('div', `position:fixed;z-index:9;left:50%;transform:translateX(-50%);top:calc(64px + ${SAFE_TOP});display:none;max-width:min(90vw,380px);background:#efe3c8;color:#3d3226;font:16px Georgia,serif;font-style:italic;padding:9px 16px;border-radius:5px;border:1px solid rgba(61,50,38,.35);box-shadow:0 4px 14px rgba(0,0,0,.25);text-align:center`);
  parent.appendChild(toastEl);

  chartBtn.addEventListener('click', () => onChart());
  zin.addEventListener('click', () => onZoomStep(1 / 1.35));
  zout.addEventListener('click', () => onZoomStep(1.35));
  backBtn.addEventListener('click', () => onBack());
  navBtn.addEventListener('click', () => onNavigate());
  jumpBtn.addEventListener('click', () => onJump());
  mini.addEventListener('click', (e) => { const r = mini.getBoundingClientRect(); onMiniTap(e.clientX - r.left, e.clientY - r.top, r.width); });

  let toastTimer = 0;
  return {
    chartCanvas, mini, elements: { top, zoomCol, card, boatBtn: chartBtn, navBtn, backBtn },
    // Boxes the names must keep clear of (CSS px): the minimap column, zoom buttons, the visit card.
    rects() {
      return [top, zoomCol, card].filter((e) => e.style.display !== 'none').map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
        .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    },
    // info: { title, sub, nav: 'start' | 'stop' | null, back: 'boat' | 'close' } or null. A lighthouse visit says "Back to the boat",
    // a place picked on the chart says "Close"; the gold button starts (or stops) sailing there.
    showVisit(info) {
      card.style.display = info ? 'block' : 'none';
      if (!info) return;
      cardTitle.textContent = info.title;
      cardSub.textContent = info.sub || '';
      navBtn.style.display = info.nav ? 'inline-block' : 'none';
      navBtn.textContent = info.nav === 'stop' ? 'Stop navigating' : 'Navigate here';
      backBtn.textContent = info.back === 'close' ? 'Close' : 'Back to the boat';
      backBtn.setAttribute('aria-label', info.back === 'close' ? 'Close this card' : 'Return the view to your boat');
      jumpBtn.style.display = info.back === 'close' ? 'none' : 'inline-block';
    },
    toast(text, ms = 3200) {
      toastEl.textContent = text;
      toastEl.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, ms);
    },
    // the chart is up: it takes the touches (drag to pan, tap a lighthouse) and the Chart button becomes "Boat"
    setChartMode(on) {
      chartCanvas.style.pointerEvents = on ? 'auto' : 'none';
      chartBtn.style.display = on ? 'inline-block' : 'none';
    },
    // the minimap is hidden (the chart is up): its caption goes with it
    setMiniHidden(h) { caption.style.visibility = h ? 'hidden' : 'visible'; badge.style.visibility = h ? 'hidden' : 'visible'; },
  };
}
