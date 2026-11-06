// The first task's screens (stage 1d): the start card (the storm, once, reopenable from the chart) and the end card (you reported to grandma).
// Plain DOM in the same quiet style as the chart UI; no logic lives here, game.js decides when to show them.
const HUD_BG = 'rgba(20,34,48,0.92)';
const LINE = '1px solid rgba(234,246,255,0.2)';
const TEXT = '#eaf3f8';
const GOLD = '#f2c46d';

function el(tag, css, text) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

// The end card copy: short, a few lines. Exported so a test can check it and the checklist can quote it.
export const END_CARD = {
  title: 'The lights are burning',
  lines: [
    'Five lighthouses shine again after the storm.',
    'Grandma in Fiskebäckskil hears your report, and puts the kettle on.',
  ],
  button: 'Carry on sailing',
};

// The start card copy (Felix's text, split into short lines for a phone). Buttons: Set sail / Skip.
export const START_CARD = {
  title: 'After the storm',
  lines: [
    'A storm has put out the five lighthouses nearest Grundsund.',
    'Take granddad\'s old koster, Svalan, sail to each one and bring its light back.',
    'Then report to grandma in Fiskebäckskil.',
  ],
  go: 'Set sail',
  skip: 'Skip',
};

// The card after the fifth light (Felix, 2026-11-06): a short nudge, not the ending. Its button sets the Navigate target to Fiskebäckskil.
export const REPORT_CARD = {
  title: 'All five lights are burning.',
  lines: ['Sail home to Fiskebäckskil and tell grandma.'],
  button: 'Navigate to Fiskebäckskil',
};

// opts: { parent, onSetSail(), onSkip(), onContinue(), onReport() }. Returns { showStart({ progress }), showReport(), showEnd(), hide(), get visible }.
export function createTaskUi({ parent = document.body, onContinue = () => {}, onSetSail = () => {}, onSkip = () => {}, onReport = () => {} } = {}) {
  const veil = el('div', 'position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(10,20,30,0.62);padding:24px'); // a plain dim, no backdrop blur: a blur over a live WebGL canvas is re-done every frame, and the card does not need it
  veil.setAttribute('data-no-zoom', '');
  const card = el('div', `max-width:340px;width:100%;background:${HUD_BG};border:${LINE};border-radius:16px;padding:22px 20px 18px;color:${TEXT};text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)`);
  const title = el('div', `font:italic 600 26px Georgia,"Times New Roman",serif;color:${GOLD};margin-bottom:10px`);
  const body = el('div', 'font:15px/1.45 system-ui,-apple-system,sans-serif;opacity:.92;margin-bottom:16px');
  const btn = el('button', `font:600 15px system-ui,sans-serif;color:#1f2a33;background:${GOLD};border:0;border-radius:10px;padding:11px 20px;cursor:pointer;touch-action:manipulation`);
  btn.type = 'button';
  const progress = el('div', `font:600 12px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${GOLD};opacity:.85;margin:-6px 0 14px;display:none`);
  const skipBtn = el('button', `display:none;margin:12px auto 0;font:500 13px system-ui,sans-serif;color:${TEXT};opacity:.7;background:transparent;border:0;padding:6px 12px;cursor:pointer;touch-action:manipulation;text-decoration:underline`, START_CARD.skip);
  skipBtn.type = 'button';
  card.append(title, body, progress, btn, skipBtn);
  veil.appendChild(card);
  parent.appendChild(veil);
  let visible = false;
  const hide = () => { visible = false; veil.style.display = 'none'; };
  let mode = 'end';
  btn.addEventListener('click', () => { hide(); (mode === 'start' ? onSetSail : mode === 'report' ? onReport : onContinue)(); });
  skipBtn.addEventListener('click', () => { hide(); onSkip(); });
  return {
    get visible() { return visible; },
    hide,
    // The storm, and what to do. progress (optional): a line such as "Lights restored: 2 of 5" when it is reopened from the chart.
    showStart({ progress: line = '' } = {}) {
      mode = 'start';
      title.textContent = START_CARD.title;
      body.replaceChildren(...START_CARD.lines.map((t) => el('div', 'margin:6px 0', t)));
      progress.textContent = line;
      progress.style.display = line ? 'block' : 'none';
      btn.textContent = START_CARD.go;
      skipBtn.style.display = 'block';
      visible = true;
      veil.style.display = 'flex';
    },
    showReport() {
      mode = 'report';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      title.textContent = REPORT_CARD.title;
      body.replaceChildren(...REPORT_CARD.lines.map((t) => el('div', 'margin:4px 0', t)));
      btn.textContent = REPORT_CARD.button;
      visible = true;
      veil.style.display = 'flex';
    },
    showEnd() {
      mode = 'end';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      title.textContent = END_CARD.title;
      body.replaceChildren(...END_CARD.lines.map((t) => el('div', 'margin:4px 0', t)));
      btn.textContent = END_CARD.button;
      visible = true;
      veil.style.display = 'flex';
    },
    elements: { veil, card, btn, skipBtn },
  };
}
