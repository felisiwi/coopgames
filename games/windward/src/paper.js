// Old paper (stage 1e): the look of every card and popup in the game: a warm aged-paper ground (a few layered CSS gradients and a faint noise as an inline SVG data URI: no image
// files), dark ink, ONE serif face for title and body, and a modest double border like a printed card or a logbook page. Plain strings, no DOM and no THREE; each UI file
// builds its elements with these. Readable on a phone: body text is 17 px on a 15 % darker-than-paper ink, buttons are at least 44 px tall.
export const SERIF = 'Georgia,"Iowan Old Style","Palatino Linotype",Palatino,"Times New Roman",serif';

export const PAPER = Object.freeze({
  ink: '#2b2014',        // body text: dark brown-black ink
  inkSoft: '#5b4630',    // secondary text
  title: '#6a2a14',      // titles: a dark red-brown, like a second ink colour
  paper: '#efe1c2',      // the base paper
  paperDark: '#d9c397',  // the aged edges
  rule: 'rgba(70,48,24,0.55)', // the printed border
  seal: '#3a2a1a',       // buttons: dark ink with paper-coloured text
  sealText: '#f3e6c8',
  dim: 'rgba(14,10,6,0.55)', // the dim behind a card
});

// A faint paper grain: tiny SVG turbulence, drawn once by the browser. (If a browser ignores it the gradients alone still read as paper.)
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.32 0'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>")}")`;

// The paper surface (a card): the grain over a warm radial wash over the base colour, a printed double rule inside a thin outer edge, a soft shadow. `tone`: 'paper' | 'dusk'
// (the same paper by lamplight: a little darker and warmer, for quiet moments).
export function paperSurface({ tone = 'paper', radius = 5, shadow = true } = {}) {
  const dusk = tone === 'dusk';
  const wash = dusk ? 'radial-gradient(ellipse at 30% 15%,#e9d3a6 0%,#d8bd8a 58%,#bd9c68 100%)' : 'radial-gradient(ellipse at 30% 15%,#f6ebd0 0%,#ecdcb8 58%,#d9c397 100%)';
  return [
    `background:${GRAIN},${wash}`,
    `background-color:${dusk ? '#d8bd8a' : PAPER.paper}`,
    `color:${PAPER.ink}`,
    `font-family:${SERIF}`,
    `border:1px solid ${PAPER.rule}`,
    `border-radius:${radius}px`,
    `box-shadow:inset 0 0 0 4px ${dusk ? '#dcc294' : '#f0e3c5'},inset 0 0 0 5px ${PAPER.rule},inset 0 0 26px rgba(120,84,40,.28)${shadow ? ',0 10px 34px rgba(0,0,0,.45)' : ''}`,
  ].join(';');
}

// A title line: the same serif, italic, in the title ink.
export const paperTitle = (size = 25) => `font:italic 600 ${size}px/1.2 ${SERIF};color:${PAPER.title};margin:0 0 10px;letter-spacing:.01em`;
// Body text: 17 px serif, comfortable leading.
export const paperBody = (size = 17) => `font:${size}px/1.45 ${SERIF};color:${PAPER.ink}`;
// A speaker's quoted line, a little larger and italic.
export const paperQuote = (size = 19) => `font:italic ${size}px/1.4 ${SERIF};color:${PAPER.ink}`;
// A small caption (progress, notes).
export const paperNote = (size = 13) => `font:italic ${size}px/1.35 ${SERIF};color:${PAPER.inkSoft}`;
// The button: dark ink, paper-coloured text, at least 44 px tall (a thumb), square-ish like a printed label.
export const paperButton = ({ primary = true } = {}) => [
  `font:600 16px ${SERIF}`, 'letter-spacing:.02em', 'min-height:44px', 'padding:10px 22px', 'cursor:pointer', 'touch-action:manipulation',
  primary ? `background:${PAPER.seal};color:${PAPER.sealText};border:1px solid ${PAPER.seal}` : `background:transparent;color:${PAPER.ink};border:1px solid ${PAPER.rule}`,
  'border-radius:4px',
].join(';');
// A quiet text link (Skip).
export const paperLink = () => `font:italic 14px ${SERIF};color:${PAPER.inkSoft};background:transparent;border:0;padding:10px 12px;cursor:pointer;touch-action:manipulation;text-decoration:underline`;
