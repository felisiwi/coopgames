// The jungle clearing they scrap in, plus the dust and stars kicked up by
// scrapping in it. Scenery is generated from the hub's `seed`, so both
// peers look at the same clearing without anything crossing the wire.
import { STAGE } from './config.js';

// Small deterministic PRNG. Same seed, same jungle, on every machine.
function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStage(seed) {
  const rand = mulberry32(seed >>> 0);
  const { W, H, GROUND_Y } = STAGE;

  const volcanoes = [
    { x: W * (0.12 + rand() * 0.08), h: 150 + rand() * 60, w: 210 },
    { x: W * (0.74 + rand() * 0.12), h: 110 + rand() * 70, w: 170 },
  ];

  // Mid-ground tree line: silhouettes behind the action.
  const trees = [];
  for (let i = 0; i < 14; i++) {
    trees.push({
      x: rand() * W,
      h: 90 + rand() * 80,
      lean: (rand() - 0.5) * 0.3,
      fronds: 5 + Math.floor(rand() * 3),
      sway: rand() * Math.PI * 2,
    });
  }

  // Foreground ferns, drawn after the fighters for depth.
  const ferns = [];
  for (let i = 0; i < 10; i++) {
    ferns.push({
      x: rand() * W,
      s: 0.7 + rand() * 0.8,
      sway: rand() * Math.PI * 2,
      blades: 5 + Math.floor(rand() * 3),
    });
  }

  // Ground speckle: pebbles and tufts, fixed per seed so they don't crawl.
  const speckle = [];
  for (let i = 0; i < 70; i++) {
    speckle.push({
      x: rand() * W,
      y: GROUND_Y + 8 + rand() * (H - GROUND_Y - 12),
      r: 1 + rand() * 3,
      tuft: rand() < 0.3,
    });
  }

  function drawBack(ctx, t) {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#2b3f6b');
    sky.addColorStop(0.45, '#7a6a9c');
    sky.addColorStop(0.8, '#e3906b');
    sky.addColorStop(1, '#f7c98b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Low sun.
    ctx.fillStyle = 'rgba(255,226,164,0.85)';
    ctx.beginPath();
    ctx.arc(W * 0.62, GROUND_Y - 96, 46, 0, Math.PI * 2);
    ctx.fill();

    for (const v of volcanoes) {
      ctx.fillStyle = 'rgba(44,40,72,0.72)';
      ctx.beginPath();
      ctx.moveTo(v.x - v.w, GROUND_Y);
      ctx.lineTo(v.x - v.w * 0.16, GROUND_Y - v.h);
      ctx.lineTo(v.x + v.w * 0.16, GROUND_Y - v.h);
      ctx.lineTo(v.x + v.w, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    for (const tr of trees) drawPalm(ctx, tr, t, 'rgba(32,44,50,0.8)', 1);

    // Ground.
    const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    dirt.addColorStop(0, '#6b7f4a');
    dirt.addColorStop(0.18, '#5d6b3d');
    dirt.addColorStop(1, '#3f4a2c');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, GROUND_Y, W, 3);

    for (const p of speckle) {
      if (p.tuft) {
        ctx.strokeStyle = 'rgba(120,145,80,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 3, p.y - 6);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 3, p.y - 7);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(30,36,20,0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawFront(ctx, t) {
    for (const f of ferns) {
      ctx.save();
      ctx.translate(f.x, H + 6);
      ctx.scale(f.s, f.s);
      const sway = Math.sin(t * 1.2 + f.sway) * 0.09;
      ctx.strokeStyle = 'rgba(24,40,26,0.9)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      for (let i = 0; i < f.blades; i++) {
        const a = -Math.PI / 2 + (i - (f.blades - 1) / 2) * 0.34 + sway;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a) * 40,
          Math.sin(a) * 46,
          Math.cos(a) * 78,
          Math.sin(a) * 86,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return { drawBack, drawFront };
}

function drawPalm(ctx, tr, t, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(tr.x, STAGE.GROUND_Y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const sway = Math.sin(t * 0.8 + tr.sway) * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(tr.lean * 40, -tr.h * 0.6, (tr.lean + sway) * 70, -tr.h);
  ctx.stroke();
  const topX = (tr.lean + sway) * 70;
  const topY = -tr.h;
  for (let i = 0; i < tr.fronds; i++) {
    const a = -Math.PI / 2 + (i - (tr.fronds - 1) / 2) * 0.62 + sway;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * 28,
      topY + Math.sin(a) * 26,
      topX + Math.cos(a) * 52,
      topY + Math.sin(a) * 44 + 12,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// ── Effects ────────────────────────────────────────────────────────────
// Dust, impact stars, and the comic-book word that pops on a solid hit.
// Purely cosmetic and purely local — never synced, never gameplay.

const HIT_WORDS = ['BONK!', 'POMF!', 'WHAP!', 'THWIP!', 'BOOF!', 'SNRK!'];
const BLOCK_WORDS = ['tink', 'nope', 'blok'];

export function createEffects() {
  let parts = [];
  let words = [];
  let shake = 0;

  return {
    get shake() {
      return shake;
    },

    dust(x, y, amount = 8, spread = 90) {
      for (let i = 0; i < amount; i++) {
        parts.push({
          kind: 'dust',
          x,
          y,
          vx: (Math.random() - 0.5) * spread,
          vy: -Math.random() * 70 - 10,
          life: 0.5 + Math.random() * 0.3,
          age: 0,
          r: 3 + Math.random() * 6,
        });
      }
    },

    hit(x, y, dir, big) {
      const n = big ? 14 : 8;
      for (let i = 0; i < n; i++) {
        parts.push({
          kind: 'star',
          x,
          y,
          vx: dir * (60 + Math.random() * 260),
          vy: (Math.random() - 0.6) * 260,
          life: 0.35 + Math.random() * 0.3,
          age: 0,
          r: big ? 5 + Math.random() * 5 : 3 + Math.random() * 3,
          spin: (Math.random() - 0.5) * 20,
          a: Math.random() * Math.PI,
        });
      }
      shake = Math.min(1, shake + (big ? 0.85 : 0.35));
    },

    word(x, y, blocked, big) {
      const pool = blocked ? BLOCK_WORDS : HIT_WORDS;
      words.push({
        text: pool[Math.floor(Math.random() * pool.length)],
        x,
        y,
        age: 0,
        life: blocked ? 0.5 : 0.75,
        size: blocked ? 20 : big ? 42 : 30,
        tilt: (Math.random() - 0.5) * 0.4,
        blocked,
      });
    },

    update(dt) {
      shake = Math.max(0, shake - dt * 3.2);
      for (const p of parts) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.kind === 'dust' ? 90 : 900) * dt;
        if (p.kind === 'dust') p.vx *= Math.exp(-2.2 * dt);
        if (p.spin) p.a += p.spin * dt;
      }
      parts = parts.filter((p) => p.age < p.life);
      for (const w of words) {
        w.age += dt;
        w.y -= 46 * dt;
      }
      words = words.filter((w) => w.age < w.life);
    },

    draw(ctx) {
      for (const p of parts) {
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = k;
        if (p.kind === 'dust') {
          ctx.fillStyle = '#cfc3a6';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.5 + k), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.a);
          ctx.fillStyle = '#ffe27a';
          star(ctx, p.r * (0.4 + k));
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      for (const w of words) {
        const k = 1 - w.age / w.life;
        const pop = w.age < 0.09 ? w.age / 0.09 : 1;
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.tilt);
        ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.textAlign = 'center';
        ctx.font = `800 ${w.size}px ui-rounded, "Trebuchet MS", system-ui, sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(24,18,34,0.9)';
        ctx.fillStyle = w.blocked ? '#bcd8e8' : '#ffd166';
        ctx.strokeText(w.text, 0, 0);
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

function star(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    ctx[fn](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}
