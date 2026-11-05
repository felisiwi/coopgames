// The chart and minimap controls (stage 1c): the minimap (top left) with its Chart and settings buttons, zoom +/- (bottom
// left, away from the sheet thumb), the minimap settings sheet, the lighthouse visit card and a small toast. Plain DOM in
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

// opts: { parent, settings: { shape, rot }, debug, onSettings(settings), onChart(), onZoomStep(factor), onBack(), onJump(), onMiniTap(px, py, size) }
export function createChartUi({ parent = document.body, settings, debug = false, onSettings, onChart, onZoomStep, onBack, onJump, onMiniTap }) {
  // the chart's own canvas (drawn by src/chart.js), above the 3D view and the phone layer, below the controls
  const chartCanvas = el('canvas', 'position:fixed;inset:0;width:100%;height:100%;z-index:4;display:none;pointer-events:none;touch-action:none');
  chartCanvas.setAttribute('aria-label', "Granddad's chart of the west coast");
  parent.appendChild(chartCanvas);

  const top = el('div', `position:fixed;z-index:7;left:max(12px,env(safe-area-inset-left,0px));top:calc(12px + ${SAFE_TOP});display:flex;flex-direction:column;gap:8px;align-items:flex-start;pointer-events:none`);
  const mini = el('canvas', 'width:132px;height:132px;border:2px solid rgba(244,246,242,0.85);box-shadow:0 2px 10px rgba(0,0,0,0.25);background:#4d7d9d;display:block;pointer-events:auto;touch-action:manipulation');
  mini.width = 264; mini.height = 264;
  mini.setAttribute('aria-label', 'Minimap');
  const caption = el('div', `font:600 10px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(234,243,248,0.7);text-shadow:0 1px 2px rgba(0,0,0,.5);width:132px;text-align:center`);
  const row = el('div', 'display:flex;gap:8px;pointer-events:auto');
  const chartBtn = button('Chart', 'Open the chart');
  const gearBtn = button('⚙', 'Map settings', 'width:42px;padding:9px 0;font-size:17px');
  row.append(chartBtn, gearBtn);
  top.append(mini, caption, row);
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
  const backBtn = button('Back to the boat', 'Return the view to your boat', `background:${GOLD};color:#1f2a33;border-color:transparent`);
  const jumpBtn = button('Jump here (debug)', 'Jump the boat to this lighthouse');
  cardRow.append(backBtn);
  if (debug) cardRow.append(jumpBtn);
  card.append(cardTitle, cardSub, cardRow);
  parent.appendChild(card);

  const toastEl = el('div', `position:fixed;z-index:9;left:50%;transform:translateX(-50%);top:calc(64px + ${SAFE_TOP});display:none;max-width:min(90vw,380px);background:#efe3c8;color:#3d3226;font:16px Georgia,serif;font-style:italic;padding:9px 16px;border-radius:5px;border:1px solid rgba(61,50,38,.35);box-shadow:0 4px 14px rgba(0,0,0,.25);text-align:center`);
  parent.appendChild(toastEl);

  // settings sheet
  const sheet = el('div', `position:fixed;z-index:15;left:0;right:0;bottom:0;display:none;background:rgba(15,26,37,0.96);border-top:${LINE};border-radius:16px 16px 0 0;padding:14px max(16px,env(safe-area-inset-right,0px)) calc(16px + ${SAFE_BOTTOM}) max(16px,env(safe-area-inset-left,0px));color:${TEXT};font:${UI_FONT}`);
  sheet.setAttribute('data-no-zoom', '');
  const head = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px');
  head.append(el('div', 'font:700 15px system-ui,sans-serif', 'Map settings'));
  const done = button('Done', 'Close map settings');
  head.append(done);
  sheet.append(head);
  const segs = {};
  function seg(key, label, options) {
    const r = el('div', `display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:${LINE}`);
    r.append(el('label', 'color:rgba(234,243,248,0.7)', label));
    const g = el('div', `display:flex;border:${LINE};border-radius:9px;overflow:hidden`);
    segs[key] = [];
    for (const [v, text] of options) {
      const b = el('button', `font:${UI_FONT};color:${TEXT};background:transparent;border:0;padding:9px 11px;cursor:pointer;touch-action:manipulation`, text);
      b.type = 'button';
      b.addEventListener('click', () => { settings[key] = v; refresh(); onSettings(settings); });
      segs[key].push([v, b]);
      g.append(b);
    }
    r.append(g);
    sheet.append(r);
  }
  seg('shape', 'Minimap', [['round', 'Round'], ['square', 'Square'], ['off', 'Off']]);
  seg('rot', 'Minimap turns', [['north', 'North up'], ['heading', 'With the boat']]);
  parent.appendChild(sheet);
  function refresh() {
    for (const [key, list] of Object.entries(segs)) for (const [v, b] of list) { b.style.background = settings[key] === v ? GOLD : 'transparent'; b.style.color = settings[key] === v ? '#1f2a33' : TEXT; }
    caption.textContent = settings.rot === 'north' ? 'North up' : 'Turns with boat';
    caption.style.display = settings.shape === 'off' ? 'none' : 'block';
    mini.style.borderRadius = settings.shape === 'square' ? '14px' : '50%';
  }
  refresh();

  chartBtn.addEventListener('click', () => onChart());
  gearBtn.addEventListener('click', () => { sheet.style.display = 'block'; refresh(); });
  done.addEventListener('click', () => { sheet.style.display = 'none'; });
  zin.addEventListener('click', () => onZoomStep(1 / 1.35));
  zout.addEventListener('click', () => onZoomStep(1.35));
  backBtn.addEventListener('click', () => onBack());
  jumpBtn.addEventListener('click', () => onJump());
  mini.addEventListener('click', (e) => { const r = mini.getBoundingClientRect(); onMiniTap(e.clientX - r.left, e.clientY - r.top, r.width); });

  let toastTimer = 0;
  return {
    chartCanvas, mini, elements: { top, zoomCol, card, sheet, chartBtn },
    // Boxes the names must keep clear of (CSS px): the minimap column, zoom buttons, the visit card.
    rects() {
      return [top, zoomCol, card, sheet].filter((e) => e.style.display !== 'none').map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
        .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    },
    // info: { title, sub } or null
    showVisit(info) {
      card.style.display = info ? 'block' : 'none';
      if (info) { cardTitle.textContent = info.title; cardSub.textContent = info.sub || ''; }
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
      chartBtn.textContent = on ? 'Boat' : 'Chart';
      chartBtn.setAttribute('aria-label', on ? 'Back to the boat view' : 'Open the chart');
    },
    // the minimap is hidden (the chart is up): its caption goes with it
    setMiniHidden(h) { caption.style.visibility = h ? 'hidden' : 'visible'; },
    refresh,
  };
}
