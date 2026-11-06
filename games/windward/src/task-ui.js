// The cards of the game (stage 1d, restyled in stage 1e as old paper: src/paper.js): the start card (Today), the sail-home card, grandma's card (Today), the old-tower card, the light log,
// and showCards(), the run of one-speaker cards the 1950 story beats use (src/story-1950.js). Plain DOM; no logic lives here, game.js decides when to show them.
import { paperSurface, paperTitle, paperBody, paperQuote, paperNote, paperButton, paperLink, PAPER, SERIF } from './paper.js';

function el(tag, css, text) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Grandma's card (Felix, 2026-11-06): a short card with a dusk feel. Her line, then the gift. (Today only; in 1950 the boatbuilder's son and Britta say this in person.)
export const GRANDMA_CARD = {
  who: 'Grandma',
  line: 'He always said the lights talk, if you know how to listen.',
  gift: 'She gives you granddad\'s sea chest.',
  button: 'Carry on sailing',
};

// The start card copy of the Today game (Felix's text, split into short lines for a phone). Buttons: Set sail / Skip. (The 1950 game has no start card: its story beats are cards.)
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

// The card after the last light (Felix, 2026-11-06): a short nudge, not the ending. Its button sets the Navigate target to Fiskebäckskil.
export const REPORT_CARD = {
  title: 'All five lights are burning.',
  lines: ['Sail home to Fiskebäckskil and tell grandma.'],
  button: 'Navigate to Fiskebäckskil',
};

// opts: { parent, onSetSail(), onSkip(), onReport(), onGrandma(), onStrange(), copy }. copy.start (optional) replaces the Today start card's text.
// Returns { showStart({ progress }), showCards(list, { onDone }), showReport(nudge?), showGrandma(), showStrange(lines, button), showLog(rows), hide(), get visible }.
export function createTaskUi({ parent = document.body, onSetSail = () => {}, onSkip = () => {}, onReport = () => {}, onGrandma = () => {}, onStrange = () => {}, copy = {} } = {}) {
  const startCard = copy.start || START_CARD;
  const veil = el('div', `position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:${PAPER.dim};padding:24px`); // a plain dim, no backdrop blur: a blur over a live WebGL canvas is re-done every frame
  veil.setAttribute('data-no-zoom', '');
  const card = el('div', `${paperSurface()};max-width:352px;width:100%;padding:26px 24px 20px;text-align:center;box-sizing:border-box;max-height:calc(100vh - 48px);overflow-y:auto`);
  const title = el('div', paperTitle(26));
  const body = el('div', paperBody());
  const btn = el('button', paperButton());
  btn.type = 'button';
  const progress = el('div', `${paperNote(14)};margin:-2px 0 14px;display:none`);
  const skipBtn = el('button', `${paperLink()};display:none;margin:10px auto 0`, startCard.skip);
  skipBtn.type = 'button';
  card.append(title, body, progress, btn, skipBtn);
  veil.appendChild(card);
  parent.appendChild(veil);
  let visible = false;
  const hide = () => { visible = false; veil.style.display = 'none'; };
  // The dusk card: the same paper by lamplight, with a warm dim behind it.
  const setDusk = (on) => {
    veil.style.background = on ? 'linear-gradient(180deg, rgba(34,26,60,0.74), rgba(120,64,36,0.62))' : PAPER.dim;
    card.style.cssText = `${paperSurface({ tone: on ? 'dusk' : 'paper' })};max-width:352px;width:100%;padding:26px 24px 20px;text-align:center;box-sizing:border-box;max-height:calc(100vh - 48px);overflow-y:auto`;
  };
  const setTitle = (text, size = 26) => { title.style.cssText = paperTitle(size); title.textContent = text; };
  const lineEls = (lines, css = paperBody()) => lines.map((t) => el('div', `${css};margin:8px 0`, t));
  const show = () => { visible = true; veil.style.display = 'flex'; };
  let mode = 'end';
  let cards = null; // a run of cards in progress (showCards): { next() }
  btn.addEventListener('click', () => { hide(); setDusk(false); ({ start: onSetSail, report: onReport, grandma: onGrandma, strange: onStrange, cards: () => cards && cards.next() }[mode] || (() => {}))(); });
  skipBtn.addEventListener('click', () => { hide(); onSkip(); });
  return {
    get visible() { return visible; },
    hide,
    // The Today game's storm card, and what to do. progress (optional): a line such as "Lights restored: 2 of 5" when it is reopened from the chart.
    showStart({ progress: line = '' } = {}) {
      mode = 'start';
      setDusk(false); setTitle(startCard.title);
      body.replaceChildren(...lineEls(startCard.lines));
      progress.textContent = line;
      progress.style.display = line ? 'block' : 'none';
      btn.textContent = startCard.go;
      skipBtn.textContent = startCard.skip;
      skipBtn.style.display = 'block';
      show();
    },
    // A run of cards, one speaker each (the 1950 story beats and the "Now" card). cards: [{ title, lines, button, quote?, dusk? }]. No Skip. onDone() after the last button.
    showCards(list, { onDone = () => {} } = {}) {
      if (!list || !list.length) { onDone(); return; }
      let i = 0;
      const render = () => {
        const c = list[i];
        mode = 'cards';
        setDusk(!!c.dusk); setTitle(c.title || '');
        body.replaceChildren(...lineEls(c.lines, c.quote ? paperQuote(21) : paperBody()));
        progress.style.display = 'none';
        skipBtn.style.display = 'none';
        btn.textContent = c.button || 'Next';
        show();
      };
      cards = { next: () => { i += 1; if (i < list.length) render(); else { cards = null; onDone(); } } };
      render();
    },
    showReport(nudge = REPORT_CARD) {
      mode = 'report';
      setDusk(false); setTitle(nudge.title);
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      body.replaceChildren(...lineEls(nudge.lines));
      btn.textContent = nudge.button;
      show();
    },
    // Grandma's moment (Today): a dusk card. Her line, the gift, one button. The chest appears on the deck when it is dismissed (game.js).
    showGrandma() {
      mode = 'grandma';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      setDusk(true); setTitle(GRANDMA_CARD.who, 22);
      body.replaceChildren(el('div', `${paperQuote(23)};margin:2px 4px 14px`, `“${GRANDMA_CARD.line}”`), el('div', paperBody(), GRANDMA_CARD.gift));
      btn.textContent = GRANDMA_CARD.button;
      show();
    },
    // The end of chapter 1: "That tower has been dark since 1978. But you saw it." (1950: "That tower is not here yet.")
    showStrange(lines, button) {
      mode = 'strange';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      setDusk(true); setTitle('', 2);
      body.replaceChildren(...lines.map((t, i) => el('div', `${paperQuote(i ? 23 : 21)};margin:${i ? 10 : 2}px 0 0;${i ? `color:${PAPER.title}` : ''}`, t)));
      btn.textContent = button;
      show();
    },
    // The light log (the chart's Lights button): rows [{ name, glyph, text }]. One Close button.
    showLog(rows) {
      mode = 'log';
      progress.style.display = 'none';
      skipBtn.style.display = 'none';
      setDusk(false); setTitle('Light log', 24);
      if (!rows.length) body.replaceChildren(el('div', paperNote(16), 'No lights relit yet. Each one you bring back is listed here with its pattern.'));
      else body.replaceChildren(...rows.map((r) => {
        const row = el('div', `display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:8px 0;border-bottom:1px solid ${PAPER.rule};text-align:left`);
        row.append(el('span', `font:italic 18px ${SERIF};color:${PAPER.ink}`, r.name), el('span', `font:600 15px ${SERIF};color:${PAPER.title};white-space:nowrap`, r.text));
        return row;
      }));
      btn.textContent = 'Close';
      show();
    },
    elements: { veil, card, btn, skipBtn },
  };
}
