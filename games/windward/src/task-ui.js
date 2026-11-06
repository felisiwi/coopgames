// The first task's screens (stage 1d): the end card when you report to grandma. (The start screen joins this file in batch 3.) Plain DOM in the
// same quiet style as the chart UI; no logic lives here, game.js decides when to show them.
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

// opts: { parent }. Returns { showEnd(), hide(), get visible }.
export function createTaskUi({ parent = document.body, onContinue = () => {} } = {}) {
  const veil = el('div', 'position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(10,20,30,0.45);padding:24px;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)');
  veil.setAttribute('data-no-zoom', '');
  const card = el('div', `max-width:340px;width:100%;background:${HUD_BG};border:${LINE};border-radius:16px;padding:22px 20px 18px;color:${TEXT};text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)`);
  const title = el('div', `font:italic 600 26px Georgia,"Times New Roman",serif;color:${GOLD};margin-bottom:10px`);
  const body = el('div', 'font:15px/1.45 system-ui,-apple-system,sans-serif;opacity:.92;margin-bottom:16px');
  const btn = el('button', `font:600 15px system-ui,sans-serif;color:#1f2a33;background:${GOLD};border:0;border-radius:10px;padding:11px 20px;cursor:pointer;touch-action:manipulation`);
  btn.type = 'button';
  card.append(title, body, btn);
  veil.appendChild(card);
  parent.appendChild(veil);
  let visible = false;
  const hide = () => { visible = false; veil.style.display = 'none'; };
  btn.addEventListener('click', () => { hide(); onContinue(); });
  return {
    get visible() { return visible; },
    hide,
    showEnd() {
      title.textContent = END_CARD.title;
      body.replaceChildren(...END_CARD.lines.map((t) => el('div', 'margin:4px 0', t)));
      btn.textContent = END_CARD.button;
      visible = true;
      veil.style.display = 'flex';
    },
    elements: { veil, card, btn },
  };
}
