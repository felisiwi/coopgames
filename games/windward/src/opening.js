// The opening scene (stage 1e, batch 2): ~30 s, today, not playable, skippable, shown once. Britta's kitchen, Svalan at the jetty through the window, the wind
// getting up, the storm, a flash, dark. Then the game wakes you in 1950 (src/story-1950.js has the words; game.js runs the sequence).
//
// Two halves in one file:
//  - pure logic (no DOM): the beat timeline lookup and the "shown once" flags, testable in node;
//  - createOpening(): a full-screen DOM overlay with ONE inline SVG picture whose layers cross-fade per beat (no images to load, scales to any phone), a caption, a
//    Skip button. Under prefers-reduced-motion the lightning flash and the pitching are switched off.
import { OPENING_BEATS, OPENING_TOTAL_S, OPENING_SKIP } from './story-1950.js';

export const OPENING_KEY = 'windward.opening.v1'; // the opening has played (or was skipped)
export const INTRO_KEY = 'windward.intro.v1';     // the whole first-minutes sequence (opening, waking cards, Britta's card) has been through once

const flag = (storage, key) => { try { return !!storage && storage.getItem(key) === '1'; } catch { return false; } };
const setFlag = (storage, key) => { try { storage?.setItem(key, '1'); } catch { /* blocked: carry on */ } };
export const hasSeenOpening = (storage) => flag(storage, OPENING_KEY);
export const markOpeningSeen = (storage) => setFlag(storage, OPENING_KEY);
export const hasSeenIntro = (storage) => flag(storage, INTRO_KEY);
export const markIntroSeen = (storage) => setFlag(storage, INTRO_KEY);
export const resetIntro = (storage) => { try { storage?.removeItem(OPENING_KEY); storage?.removeItem(INTRO_KEY); } catch { /* blocked */ } };

// The beat playing at second t (null once it is over).
export function beatAt(t, beats = OPENING_BEATS) {
  for (const b of beats) if (t >= b.at && t < b.at + b.dur) return b;
  return null;
}

// Should the opening play? ?opening=0 never, ?opening=1 always (to look at it), otherwise only in the 1950 game and only once.
export function shouldShowOpening({ era, seen, param }) {
  if (param === '0') return false;
  if (param === '1') return true;
  return era === '1950' && !seen;
}

// ------------------------------------------------------------------------------------------------------------------ the picture
const SVG = `
<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="ow-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9a36b"/><stop offset="0.55" stop-color="#f2cf94"/><stop offset="1" stop-color="#e0b88a"/></linearGradient>
    <linearGradient id="ow-grey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d7f8c"/><stop offset="1" stop-color="#a7b3b8"/></linearGradient>
    <linearGradient id="ow-storm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2a36"/><stop offset="1" stop-color="#48606c"/></linearGradient>
    <linearGradient id="ow-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f8a9a"/><stop offset="1" stop-color="#2d4c5c"/></linearGradient>
    <radialGradient id="ow-glow" cx="0.5" cy="0.62" r="0.7"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
    <clipPath id="ow-win"><rect x="90" y="150" width="210" height="320"/></clipPath>
  </defs>
  <g class="ow-clip">
    <g class="ow-ext">
      <rect class="ow-sky ow-sky-dusk" width="390" height="844" fill="url(#ow-dusk)"/>
      <rect class="ow-sky ow-sky-grey" width="390" height="844" fill="url(#ow-grey)"/>
      <rect class="ow-sky ow-sky-storm" width="390" height="844" fill="url(#ow-storm)"/>
      <rect y="470" width="390" height="374" fill="url(#ow-sea)"/>
      <g class="ow-waves" fill="none" stroke="#e8f1f2" stroke-opacity="0.35" stroke-width="2.5" stroke-linecap="round">
        <path d="M10 520 q20 -8 40 0 t40 0"/><path d="M200 545 q20 -8 40 0 t40 0"/><path d="M60 585 q24 -9 48 0 t48 0"/><path d="M250 620 q24 -9 48 0 t48 0"/><path d="M20 690 q28 -10 56 0 t56 0"/><path d="M210 740 q28 -10 56 0 t56 0"/>
      </g>
      <path class="ow-jetty" d="M0 600 L390 548 L390 582 L0 650 Z" fill="#3a2e28"/>
      <g class="ow-jetty" fill="#2a211c"><rect x="60" y="610" width="9" height="70"/><rect x="170" y="590" width="9" height="70"/><rect x="290" y="565" width="9" height="66"/></g>
      <g class="ow-koster" transform="translate(236 552)">
        <g class="ow-rock">
          <path d="M-96 0 Q-74 44 0 48 Q86 44 116 -12 L104 -16 Q62 12 -22 14 Q-72 10 -96 0 Z" fill="#2c2a2e"/>
          <path d="M-96 0 Q-72 6 -22 14 Q62 12 104 -16 L116 -12 Q112 -4 100 -2 Q60 18 -22 20 Q-76 16 -96 0Z" fill="#e8dfc9" opacity="0.9"/>
          <line x1="0" y1="-4" x2="0" y2="-196" stroke="#2c2a2e" stroke-width="4"/>
          <path class="ow-sail" d="M5 -186 L5 -34 L76 -34 Z" fill="#efe6d0"/>
          <path class="ow-sail" d="M-5 -176 L-86 -22 L-5 -22 Z" fill="#e4d9bd"/>
        </g>
      </g>
      <g class="ow-rain" stroke="#dbe8ee" stroke-width="1.6" stroke-linecap="round" opacity="0.55">${Array.from({ length: 34 }, (_, i) => `<line x1="${(i * 37) % 420 - 20}" y1="${(i * 71) % 880 - 40}" x2="${(i * 37) % 420 - 32}" y2="${(i * 71) % 880 - 14}"/>`).join('')}</g>
      <path class="ow-wave" d="M-20 844 L-20 600 Q60 470 150 560 Q210 500 270 470 Q350 440 410 520 L410 844 Z" fill="#1d3a48" opacity="0.92"/>
    </g>
  </g>
  <g class="ow-kitchen">
    <path d="M0 0H390V844H0Z M90 150V470H300V150Z" fill="#4a3226" fill-rule="evenodd"/>
    <rect width="390" height="844" fill="url(#ow-glow)"/>
    <path d="M195 150V470M90 310H300" stroke="#2c1d15" stroke-width="9"/>
    <rect x="80" y="470" width="230" height="14" rx="3" fill="#6a4a37"/>
    <rect x="0" y="690" width="390" height="154" fill="#5d3f2f"/><rect x="0" y="690" width="390" height="10" fill="#76523e"/>
    <path d="M104 690 q4 -34 36 -34 q32 0 36 34 Z" fill="#e9dfcc"/><path d="M174 668 q8 -22 24 -22 h6 v22 Z" fill="#e9dfcc"/>
    <path class="ow-steam" d="M140 640 q-10 -22 0 -40 q10 -18 0 -36" fill="none" stroke="#fff3df" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>
    <path d="M250 690 v-58 h54 v58 Z" fill="#b9553f"/><rect x="246" y="624" width="62" height="10" rx="3" fill="#8f3f30"/>
  </g>
  <rect class="ow-flash" width="390" height="844" fill="#fff"/>
  <rect class="ow-dark" width="390" height="844" fill="#000"/>
</svg>`;

const CSS = `
.ow{position:fixed;inset:0;z-index:40;background:#000;overflow:hidden;font-family:Georgia,"Times New Roman",serif;touch-action:manipulation}
.ow svg{position:absolute;inset:0;width:100%;height:100%}
.ow-sky,.ow-kitchen,.ow-flash,.ow-dark,.ow-rain,.ow-wave,.ow-jetty,.ow-ext,.ow-clip{transition:opacity 1.4s ease,transform 3s ease-in-out}
.ow-sky{opacity:0}.ow-kitchen{opacity:0}.ow-flash{opacity:0}.ow-dark{opacity:0}.ow-rain{opacity:0}.ow-wave{opacity:0;transform:translateY(300px)}
.ow-clip{clip-path:none}
.ow-ext{transform-origin:0 0}
.ow[data-scene=kitchen] .ow-clip{clip-path:url(#ow-win)}
.ow[data-scene=kitchen] .ow-ext{transform:translate(90px,150px) scale(.56)}
.ow[data-scene=kitchen] .ow-sky-dusk,.ow[data-scene=kitchen] .ow-kitchen{opacity:1}
.ow[data-scene=jetty] .ow-sky-grey{opacity:1}.ow[data-scene=jetty] .ow-rain{opacity:.35}
.ow[data-scene=storm] .ow-sky-storm{opacity:1}.ow[data-scene=storm] .ow-rain{opacity:1}
.ow[data-scene=flash] .ow-sky-storm{opacity:1}.ow[data-scene=flash] .ow-rain{opacity:1}.ow[data-scene=flash] .ow-wave{opacity:.95;transform:translateY(0);transition:opacity .6s,transform 3.5s ease-in}
.ow[data-scene=flash] .ow-flash{animation:ow-flash 4.2s ease-out both}
.ow[data-scene=dark] .ow-sky-storm{opacity:1}.ow[data-scene=dark] .ow-dark{opacity:1;transition:opacity 2s ease}
.ow-rain{animation:ow-rain .55s linear infinite}
.ow-rock{animation:ow-rock 2.6s ease-in-out infinite;transform-origin:0 20px}
.ow[data-scene=storm] .ow-rock,.ow[data-scene=flash] .ow-rock{animation-duration:1.1s}
.ow-steam{animation:ow-steam 3s ease-in-out infinite}
@keyframes ow-rain{from{transform:translate(0,-30px)}to{transform:translate(-14px,30px)}}
@keyframes ow-rock{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2.5deg)}}
@keyframes ow-steam{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:.6;transform:translateY(-8px)}}
@keyframes ow-flash{0%{opacity:0}12%{opacity:.95}22%{opacity:.08}30%{opacity:.75}55%,100%{opacity:0}}
.ow-cap{position:absolute;left:0;right:0;bottom:11%;padding:0 28px;text-align:center;color:#fbf0dc;font-size:21px;line-height:1.35;font-style:italic;text-shadow:0 2px 10px rgba(0,0,0,.7);opacity:0;transition:opacity .7s ease;pointer-events:none}
.ow-cap.on{opacity:1}
.ow-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;min-width:44px;min-height:44px;padding:8px 16px;font:600 14px system-ui,sans-serif;color:#eaf3f8;background:rgba(20,34,48,.55);border:1px solid rgba(234,246,255,.3);border-radius:22px;cursor:pointer}
@media (prefers-reduced-motion:reduce){.ow *{animation:none!important}.ow-ext,.ow-wave{transition:opacity .6s}}
`;

// Plays the opening over the page. onDone() is called once, when it ends or is skipped. Returns { skip(), destroy(), get playing }.
export function createOpening({ parent = document.body, beats = OPENING_BEATS, total = OPENING_TOTAL_S, onDone = () => {} } = {}) {
  if (!document.getElementById('ow-style')) { const st = document.createElement('style'); st.id = 'ow-style'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div');
  root.className = 'ow';
  root.setAttribute('data-no-zoom', '');
  root.innerHTML = SVG;
  const cap = document.createElement('div'); cap.className = 'ow-cap';
  const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'ow-skip'; skip.textContent = OPENING_SKIP;
  root.append(cap, skip);
  parent.appendChild(root);
  let playing = true, raf = 0, current = null;
  const t0 = performance.now();
  const finish = () => { if (!playing) return; playing = false; cancelAnimationFrame(raf); root.remove(); onDone(); };
  const showBeat = (b) => {
    current = b;
    root.dataset.scene = b.scene;
    cap.classList.remove('on');
    if (b.caption) setTimeout(() => { if (current === b && playing) { cap.textContent = b.caption; cap.classList.add('on'); } }, 500);
  };
  const tick = () => {
    if (!playing) return;
    const t = (performance.now() - t0) / 1000;
    if (t >= total) return finish();
    const b = beatAt(t, beats);
    if (b && b !== current) showBeat(b);
    raf = requestAnimationFrame(tick);
  };
  skip.addEventListener('click', finish);
  showBeat(beats[0]);
  raf = requestAnimationFrame(tick);
  return { skip: finish, destroy: () => { playing = false; cancelAnimationFrame(raf); root.remove(); }, get playing() { return playing; } };
}
