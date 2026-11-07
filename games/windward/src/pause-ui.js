// The pause card (Next run, batch 1a): one old-paper card over a plain dim, a title and a "Tap to continue" button. The whole screen is the tap target, so a thumb
// anywhere resumes. Plain DOM, no logic (src/pause.js decides when). Sits ABOVE every other card (task-ui veil is z-index 30), so a story card or a lighthouse
// visit underneath is simply still there, untouched, when the player returns.
import { paperSurface, paperTitle, paperNote, paperButton, PAPER } from './paper.js';

export const PAUSE_CARD = { title: 'Paused', note: 'The sea will wait.', button: 'Tap to continue' }; // TODO(felix): confirm the wording

// opts: { parent, onTap(), copy } -> { show(), hide(), get visible }
export function createPauseCard({ parent = document.body, onTap = () => {}, copy = PAUSE_CARD } = {}) {
  const veil = document.createElement('div');
  veil.setAttribute('data-no-zoom', '');
  veil.setAttribute('data-pause-card', '');
  veil.style.cssText = `position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:${PAPER.dim};padding:24px;touch-action:manipulation;cursor:pointer`;
  const card = document.createElement('div');
  card.style.cssText = `${paperSurface()};max-width:300px;width:100%;padding:26px 24px 22px;text-align:center;box-sizing:border-box`;
  const title = document.createElement('div'); title.style.cssText = paperTitle(26); title.textContent = copy.title;
  const note = document.createElement('div'); note.style.cssText = `${paperNote(15)};margin:-2px 0 16px`; note.textContent = copy.note;
  const btn = document.createElement('button'); btn.type = 'button'; btn.style.cssText = paperButton(); btn.textContent = copy.button;
  card.append(title, note, btn);
  veil.appendChild(card);
  parent.appendChild(veil);
  let visible = false;
  veil.addEventListener('click', (e) => { e.stopPropagation(); onTap(); });
  // the veil swallows every touch and pointer press while it is up, so nothing underneath (the rope, the chart) reacts to the tap that resumes
  for (const type of ['pointerdown', 'touchstart', 'touchend', 'mousedown']) veil.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  return {
    show() { visible = true; veil.style.display = 'flex'; try { btn.focus({ preventScroll: true }); } catch { /* no focus: fine */ } },
    hide() { visible = false; veil.style.display = 'none'; },
    get visible() { return visible; },
    destroy() { veil.remove(); },
  };
}
