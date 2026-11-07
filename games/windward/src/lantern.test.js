// node games/windward/src/lantern.test.js: the lantern's flash patterns (src/lantern.js) against the real lighthouse data, and the glow.
import assert from 'node:assert/strict';
import { LIGHTHOUSES, createLighthouse, lanternOptions, NO_BEAM_LIGHTS } from './lighthouses.js';
import { lightOnAt, lightPattern, createLanternFx, ECLIPSE_S } from './lantern.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const sample = (light, step = 0.05) => { const p = lightPattern(light).period; const a = []; for (let t = 0; t < p; t += step) a.push(lightOnAt(light, t)); return a; };
const flashes = (light) => { const a = sample(light); let n = 0; for (let i = 0; i < a.length; i++) if (a[i] && !a[(i + a.length - 1) % a.length]) n++; return n; };
const onSeconds = (light) => sample(light).filter(Boolean).length * 0.05;

check('"two flashes every 6 s" (Hättan): two flashes a period, 0.5 s long, the rest dark; repeats every period', () => {
  const l = LIGHTHOUSES.find((x) => x.name === 'Hättan').light;
  assert.equal(flashes(l), 2);
  assert.ok(Math.abs(onSeconds(l) - 1.0) < 0.11);
  for (const t of [0.1, 2.1, 6.1, 8.1]) assert.equal(lightOnAt(l, t), true, `on at ${t}`);
  for (const t of [1, 3, 5.9, 7.2]) assert.equal(lightOnAt(l, t), false, `off at ${t}`);
});

check('the stated lengths and gaps are honoured: long flashes, Vinga\'s 7.5 s gap, "three flashes every 9 s" (Gäven)', () => {
  const g = (n) => LIGHTHOUSES.find((x) => x.name === n).light;
  assert.equal(flashes(g('Gäven')), 3);
  assert.ok(Math.abs(onSeconds(g('Nordkoster')) - 8) < 0.2, 'four long (2 s) flashes');
  assert.equal(lightOnAt(g('Vinga'), 0.2), true);
  assert.equal(lightOnAt(g('Vinga'), 7.7), true, 'the second flash starts 7.5 s after the first');
  assert.equal(lightOnAt(g('Vinga'), 5), false);
});

check('occulting lights are steady with eclipses; on-off lights are on for their stated seconds', () => {
  const l = LIGHTHOUSES.find((x) => x.name === 'Brandskärsflak').light; // occulting twice every 8 s
  assert.equal(l.kind, 'occulting');
  const dark = 8 - onSeconds(l);
  assert.ok(Math.abs(dark - 2 * ECLIPSE_S) < 0.11, `dark ${dark}`);
  assert.equal(lightOnAt(l, 0.5), false); assert.equal(lightOnAt(l, 1.5), true);
  const onoff = LIGHTHOUSES.find((x) => x.name === 'Stora Pölsan').light; // 2 s on, 6 s off
  assert.ok(Math.abs(onSeconds(onoff) - 2) < 0.11);
});

check('every lighthouse in the data has a pattern that lights and darkens (or is steady), without throwing', () => {
  for (const e of LIGHTHOUSES) {
    const a = sample(e.light, 0.1);
    assert.ok(a.some(Boolean), `${e.name} is never on`);
    const p = lightPattern(e.light);
    assert.ok(p.steady || a.some((x) => !x), `${e.name} is never off`);
    assert.ok(p.period > 0 && Number.isFinite(p.period));
  }
  assert.equal(lightOnAt(null, 3), true, 'no stated pattern: steady');
});

check('the glow: dark by default (no halo, no beam), lit shows the halo and beam on the pattern, and dark again when put out', () => {
  const entry = LIGHTHOUSES.find((x) => x.name === 'Hättan');
  const g = createLighthouse('Hättan');
  const fx = createLanternFx(g, entry);
  assert.ok(fx.glass.length >= 1, 'the lantern glass was found');
  assert.equal(fx.lit, false);
  assert.equal(fx.halo.visible, false); assert.equal(fx.beam.visible, false);
  const darkColor = fx.glass[0].material.color.getHex();
  fx.setLit(true);
  assert.equal(fx.halo.visible, true); assert.equal(fx.beam.visible, true);
  assert.notEqual(fx.glass[0].material.color.getHex(), darkColor, 'the glass changes');
  let onOp = 0, offOp = 9;
  for (let t = 0; t < 6; t += 0.05) { fx.update(t); if (lightOnAt(entry.light, t + (entry.name.length * 0.37 % 1) * 6)) onOp = Math.max(onOp, fx.halo.material.opacity); else offOp = Math.min(offOp, fx.halo.material.opacity); }
  assert.ok(onOp > offOp + 0.2, `flash ${onOp.toFixed(2)} vs between ${offOp.toFixed(2)}`);
  fx.update(0, 0);
  assert.equal(fx.halo.material.opacity, 0, 'level 0: nothing yet (the lamp warming up)');
  fx.setLit(false);
  assert.equal(fx.halo.visible, false);
  assert.equal(fx.glass[0].material.color.getHex(), darkColor);
});

check('every tower has a lantern glass to light', () => {
  for (const e of LIGHTHOUSES) {
    const g = createLighthouse(e.name);
    let n = 0; g.traverse((o) => { if (o.isMesh && /^lantern-glass/.test(o.name)) n++; });
    assert.ok(n >= 1, `${e.name} has no lantern glass`);
  }
});

check('Islandsberg\'s light (behind gable windows) glows with NO sweeping beam; every other light keeps its beam, unchanged', () => {
  assert.deepEqual([...NO_BEAM_LIGHTS], ['Islandsberg'], 'only Islandsberg');
  assert.deepEqual(lanternOptions('Islandsberg'), { beam: false });
  for (const e of LIGHTHOUSES) {
    const group = createLighthouse(e.name);
    const fx = createLanternFx(group, e, lanternOptions(e.name));
    const beam = group.getObjectByName('lantern-beam');
    if (e.name === 'Islandsberg') assert.equal(beam, undefined, 'Islandsberg has no beam in its tower');
    else { assert.deepEqual(lanternOptions(e.name), {}, `${e.name}: no options, the default (a beam)`); assert.ok(beam, `${e.name} keeps its sweeping beam`); }
    assert.ok(group.getObjectByName('lantern-halo'), `${e.name} has its halo (the glow)`);
  }
  // lit: Islandsberg glows (halo up, the window glass lit) and throws nothing round
  const e = LIGHTHOUSES.find((x) => x.name === 'Islandsberg');
  const group = createLighthouse('Islandsberg'); const fx = createLanternFx(group, { ...e, light: { pattern: 'steady', kind: 'fixed', period: 0 } }, lanternOptions('Islandsberg'));
  fx.setLit(true); fx.update(3, 1);
  assert.equal(fx.halo.visible, true, 'lit: the halo glows'); assert.ok(fx.glass.length >= 2, 'behind the whole row of windows'); assert.equal(group.getObjectByName('lantern-beam'), undefined, 'and no beam is ever added');
  fx.setLit(false); assert.equal(fx.halo.visible, false, 'dark again when put out');
});

console.log(`${passed} checks passed`);
