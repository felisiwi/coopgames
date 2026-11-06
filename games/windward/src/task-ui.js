// The first task's screens (stage 1d): the start card (the storm, once, reopenable from the chart), the sail-home card, grandma's card (the end of
// the task: she gives you granddad's sea chest), the old-tower card (the end of chapter 1) and the light log.
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

// Grandma's card (Felix, 2026-11-06): a short card with a dusk feel. Her line, then the gift. (Replaces the old "end card".)
export const GRANDMA_CARD = {
  who: 'Grandma',
  line: 'He always said the lights talk, if you know how to listen.',
  gift: 'She gives you granddad\'s sea chest.',
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

// opts: { parent, onSetSail(), onSkip(), onReport(), onGrandma(), onStrange() }. Returns { showStart({ progress }), showReport(), showGrandma(), showStrange(),
// showLog(rows), hide(), get visible }.
export function createTaskUi({ parent = document.body, onSetSail = () => {}, onSkip = () => {}, onReport = () => {}, onGrandma = () => {}, onStrange = () => {} } = {}) {
  const veil = el('div', 'position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(10,20,30,0.62);padding:24px'); // a plain dim, no backdrop blur: a blur over a live WebGL canvas is re-done every frame, and the card does not need it
  veil.setAttribute('data-no-zoom', '');
  const card = el('div', `max-width:340px;width:100%;background:${HUD_BG};border:${LINE};border-radius:16px;padding:22px 20px 18px;color:${TEXT};text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)`);
  const TITLE_CSS = `font:italic 600 26px Georgia,"Times New Roman",serif;color:${GOLD};margin-bottom:10px`;
  const title = el('div', TITLE_CSS);
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
  // grandma's card: dusk. A warm amber glow over indigo behind the card, a deep indigo card with a warm edge.
  const setDusk = (on) => {
    veil.style.background = on ? 'linear-gradient(180deg, rgba(34,26,60,0.80), rgba(168,92,58,0.58))' : 'rgba(10,20,30,0.62)';
    card.style.background = on ? 'rgba(30,24,52,0.94)' : HUD_BG;
    card.style.borderColor = on ? 'rgba(242,196,109,0.35)' : 'rgba(234,246,255,0.2)';
  };
  let mode = 'end';
  btn.addEventListener('click', () => { hide(); setDusk(false); ({ start: onSetSail, report: onReport, grandma: onGrandma, strange: onStrange }[mode] || (() => {}))(); });
  skipBtn.addEventListener('click', () => { hide(); onSkip(); });
  return {
    get visible() { return visible; },
    hide,
    // The storm, and what to do. progress (optional): a line such as "Lights restored: 2 of 5" when it is reopened from the chart.
    showStart({ progress: line = '' } = {}) {
      mode = 'start';
      setDusk(false); title.style.cssText = TITLE_CSS;
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
      setDusk(false); title.style.cssText = TITLE_CSS;
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      title.textContent = REPORT_CARD.title;
      body.replaceChildren(...REPORT_CARD.lines.map((t) => el('div', 'margin:4px 0', t)));
      btn.textContent = REPORT_CARD.button;
      visible = true;
      veil.style.display = 'flex';
    },
    // Grandma's moment: a dusk card. Her line, the gift, one button. The chest appears on the deck when it is dismissed (game.js).
    showGrandma() {
      mode = 'grandma';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      setDusk(true);
      title.textContent = GRANDMA_CARD.who;
      title.style.cssText = `font:600 13px system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};margin-bottom:12px`;
      const quote = el('div', 'font:italic 22px/1.3 Georgia,"Times New Roman",serif;color:#fbf0dc;margin:0 4px 14px', `\u201c${GRANDMA_CARD.line}\u201d`);
      const gift = el('div', 'font:15px/1.4 system-ui,sans-serif;opacity:.9', GRANDMA_CARD.gift);
      body.replaceChildren(quote, gift);
      btn.textContent = GRANDMA_CARD.button;
      visible = true;
      veil.style.display = 'flex';
    },
    // The end of chapter 1: "That tower has been dark since 1978. But you saw it."
    showStrange(lines, button) {
      mode = 'strange';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      title.textContent = '';
      title.style.cssText = 'height:2px';
      body.replaceChildren(...lines.map((t, i) => el('div', i ? `margin:8px 0 0;font:italic 22px/1.3 Georgia,serif;color:${GOLD}` : 'font:italic 20px/1.35 Georgia,serif;color:#fbf0dc', t)));
      btn.textContent = button;
      visible = true;
      veil.style.display = 'flex';
    },
    // The light log (the chart's Lights button): rows [{ name, glyph, text }]. One Close button.
    showLog(rows) {
      mode = 'log';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      title.textContent = 'Light log';
      title.style.cssText = `font:italic 600 24px Georgia,serif;color:${GOLD};margin-bottom:10px`;
      if (!rows.length) body.replaceChildren(el('div', 'opacity:.8', 'No lights relit yet. Each one you bring back is listed here with its pattern.'));
      else body.replaceChildren(...rows.map((r) => {
        const row = el('div', 'display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:7px 0;border-bottom:1px solid rgba(234,246,255,0.12);text-align:left');
        row.append(el('span', 'font:italic 17px Georgia,serif', r.name), el('span', `font:600 15px ui-monospace,Menlo,monospace;color:${GOLD};white-space:nowrap`, r.text));
        return row;
      }));
      btn.textContent = 'Close';
      visible = true;
      veil.style.display = 'flex';
    },
    elements: { veil, card, btn, skipBtn },
  };
}
