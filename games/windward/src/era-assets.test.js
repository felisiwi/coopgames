// node games/windward/src/era-assets.test.js — the Today and 1700 kits stay cheap (triangle budgets), build the same every time,
// sit where they should (waterline, ground, size), light their windows at dusk with no new lights, and the lab page is wired up.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import {
  ASSETS, ASSET_IDS, LAB_ORDER, LAB_DEFAULTS, COMPARE_GAP, createAsset, createCompare, parseLabParams, labParamsToSearch,
  defaultVariant, coastZ, groundY, FOCUS,
} from './era-assets.js';

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`ok - ${name}`); }
const everyVariant = [];
for (const id of ASSET_IDS) for (const v of ASSETS[id].variants.length ? ASSETS[id].variants : ['']) everyVariant.push([id, v]);
const bbox = (obj) => new THREE.Box3().setFromObject(obj);
const solidOf = (a) => a.group.children.find((c) => c.isMesh && !c.name.startsWith('windows'));
const lights = (a) => { let n = 0; a.group.traverse((o) => { if (o.isLight) n += 1; }); return n; };

check('every asset and variant builds, within its triangle budget; most are under ~800, big boats under ~3k', () => {
  for (const [id, v] of everyVariant) {
    const a = createAsset(id, { variant: v });
    const d = a.describe();
    assert.ok(d.triangles > 0, `${id} ${v} is empty`);
    assert.ok(d.triangles <= ASSETS[id].maxTris, `${id} ${v}: ${d.triangles} triangles over its ${ASSETS[id].maxTris} budget`);
    if (ASSETS[id].era !== 'scene') assert.ok(ASSETS[id].maxTris <= 3000, `${id}: budget above 3k`);
    if (!['ferry', 'guestharbour', 'cargoboat'].includes(id) && ASSETS[id].era !== 'scene') assert.ok(d.triangles <= 800, `${id} ${v}: ${d.triangles} > ~800`);
  }
});

check('the comparison scene: both harbours, each within budget, Today on the far side, 1700 on the near side', () => {
  const c = createCompare();
  const d = c.describe();
  assert.equal(d.triangles, d.today + d.y1700);
  assert.ok(d.today <= ASSETS.harbourToday.maxTris && d.y1700 <= ASSETS.harbour1700.maxTris);
  assert.equal(c.today.group.position.z, -COMPARE_GAP, 'Today is far (-z = top of the north-up screen)');
  assert.equal(c.old.group.position.z, COMPARE_GAP);
  assert.ok(d.meshes <= 8, `a harbour must stay a handful of draw calls, got ${d.meshes} meshes for both`);
});

check('built twice, an asset is identical (stones and fish are seeded, not random)', () => {
  for (const [id, v] of everyVariant) {
    const a = createAsset(id, { variant: v }).describe();
    const b = createAsset(id, { variant: v }).describe();
    assert.deepEqual(a, b);
    const pa = solidOf(createAsset(id, { variant: v })).geometry.attributes.position.array;
    const pb = solidOf(createAsset(id, { variant: v })).geometry.attributes.position.array;
    assert.equal(pa.length, pb.length);
    for (let i = 0; i < pa.length; i += 97) assert.equal(pa[i], pb[i]);
  }
});

check('no NaN or runaway coordinates in any asset', () => {
  for (const [id, v] of everyVariant) {
    const a = createAsset(id, { variant: v });
    a.group.traverse((o) => {
      if (!o.geometry) return;
      for (const x of o.geometry.attributes.position.array) assert.ok(Number.isFinite(x) && Math.abs(x) < 300, `${id} ${v}: bad coordinate ${x}`);
    });
  }
});

check('boats float: the hull reaches below the waterline, nothing rises absurdly, sizes are real', () => {
  const size = (id, v) => bbox(createAsset(id, { variant: v }).group).getSize(new THREE.Vector3());
  const lowest = (id, v) => bbox(createAsset(id, { variant: v }).group).min.y;
  for (const id of ['sailboat', 'motorboat', 'ferry', 'eka', 'cargoboat']) for (const v of ASSETS[id].variants.length ? ASSETS[id].variants : ['']) {
    const y = lowest(id, v);
    assert.ok(y < -0.1 && y > -2, `${id} ${v}: keel at ${y.toFixed(2)} m`);
  }
  const s = size('ferry', ''); // ~24 m long; Carl Wilhelmson is 27.37 m, Elise shorter (no length found)
  assert.ok(Math.max(s.x, s.z) > 22 && Math.max(s.x, s.z) < 30, `ferry length ${Math.max(s.x, s.z).toFixed(1)}`);
  const sb = size('sailboat', 'navy');
  assert.ok(Math.max(sb.x, sb.z) > 8 && Math.max(sb.x, sb.z) < 11);
  const eka = size('eka', 'a');
  assert.ok(Math.max(eka.x, eka.z) > 4.2 && Math.max(eka.x, eka.z) < 5.2, 'an eka is ~4.6 m (BOAT-BRIEF: 4-5 m)');
  assert.ok(size('cargoboat', '').z > size('eka', 'a').z * 2, 'the cargo boat is a lot bigger than an eka');
});

check('the 1700 kit is humble and the Today kit is big: cottage vs summer house footprint and height', () => {
  const house = bbox(createAsset('summerhouse', { variant: 'cream' }).group).getSize(new THREE.Vector3());
  for (const v of ['a', 'b', 'c']) {
    const cot = bbox(createAsset('cottage', { variant: v }).group).getSize(new THREE.Vector3());
    assert.ok(cot.x * cot.z < house.x * house.z * 0.6, `cottage ${v} should be much smaller than a summer house`);
    assert.ok(cot.y < 5.2, `cottage ${v} is ${cot.y.toFixed(1)} m tall`);
  }
});

check('no red on a 1700 cottage (bare grey timber; roofs turf or old grey-brown tile)', () => {
  for (const v of ['a', 'b', 'c']) {
    const col = solidOf(createAsset('cottage', { variant: v })).geometry.attributes.color;
    for (let i = 0; i < col.count; i++) {
      const [r, g] = [col.getX(i), col.getY(i)]; // linear values; the door (brown) has r/g ~1.5, the old red tile had ~3.3
      assert.ok(!(r > 0.25 && r > 2 * g), `cottage ${v}: a red triangle (${r.toFixed(2)}, ${g.toFixed(2)})`);
    }
  }
});

check('windows: houses and the ferry have glass; dusk turns it warm with no new lights; day turns it back', () => {
  for (const [id, v] of [['summerhouse', 'cream'], ['cottage', 'a'], ['ferry', ''], ['sailboat', 'navy'], ['harbourToday', ''], ['harbour1700', '']]) {
    const a = createAsset(id, { variant: v });
    assert.ok(a.describe().windows > 0, `${id} has no windows`);
    const glass = a.group.children.filter((c) => c.name.startsWith('windows'));
    const read = () => glass.map((g) => g.material.color.getHex());
    const day = read();
    a.setNight(true);
    const dusk = read();
    assert.notDeepEqual(day, dusk, `${id}: dusk changed nothing`);
    assert.equal(lights(a), 0, `${id}: added a light`);
    const lit = glass.find((g) => g.name === 'windows-on');
    const { r, g, b } = lit.material.color; // linear values: warm = red > green > blue, little blue
    assert.ok(r > 0.6 && r > g && g > b && b < 0.5, `${id}: lit windows are not warm (${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`);
    assert.ok(glass.every((g) => g.material.isMeshBasicMaterial), 'glass is unlit (emissive-looking) so it needs no lights');
    a.setNight(false);
    assert.deepEqual(read(), day);
  }
  assert.ok(createAsset('cottage', { variant: 'a', night: true }).group.children.find((c) => c.name === 'windows-on').material.color.getHex() !== 0, 'night: true at creation lights them');
});

check('materials follow ART.md: Lambert + flat shading for objects, no PBR, no outlines', () => {
  for (const [id, v] of everyVariant) {
    const a = createAsset(id, { variant: v });
    a.group.traverse((o) => {
      if (!o.isMesh) return;
      assert.ok(o.material.isMeshLambertMaterial || o.material.isMeshBasicMaterial, `${id}: ${o.material.type}`);
      if (o.material.isMeshLambertMaterial) assert.equal(o.material.flatShading, true);
      assert.ok(!o.material.isMeshStandardMaterial);
    });
  }
});

check('the shore: land to the north (-z), sea to the south, sinking into the sea at the ends', () => {
  assert.ok(groundY(0, coastZ(0) - 6) > 0.3, 'land behind the coast');
  assert.ok(groundY(0, coastZ(0) + 6) < -0.1, 'sea in front of it');
  assert.ok(groundY(-47, coastZ(-47) - 6) < 0.05 && groundY(47, coastZ(47) - 6) < 0.05, 'the ends sink into the sea (an islet, not a plate)');
});

check('the sail / sails-up toggle really changes the boats', () => {
  const up = createAsset('sailboat', { variant: 'navy', sails: true }).describe().triangles;
  const down = createAsset('sailboat', { variant: 'navy', sails: false }).describe().triangles;
  assert.notEqual(up, down);
  assert.notEqual(createAsset('cargoboat', { sails: true }).describe().triangles, createAsset('cargoboat', { sails: false }).describe().triangles);
});

check('lab URL: defaults give an empty address; every setting round-trips; junk is ignored', () => {
  assert.equal(labParamsToSearch('', parseLabParams('')), '');
  const s = { ...LAB_DEFAULTS, asset: 'eka', v: 'c', night: 1, rot: 123.4, cam: 'orbit', az: 10, el: 40, dist: 22 };
  const back = parseLabParams(labParamsToSearch('', s));
  for (const k of ['asset', 'v', 'night', 'rot', 'cam', 'az', 'el', 'dist']) assert.equal(back[k], s[k], k);
  const f = parseLabParams(labParamsToSearch('', { ...LAB_DEFAULTS, asset: 'compare', focus: '1700' }));
  assert.equal(f.asset, 'compare'); assert.equal(f.focus, '1700');
  const junk = parseLabParams('?asset=submarine&v=zzz&night=7&rot=abc&zoom=-4&cam=sideways&focus=moon');
  assert.equal(junk.asset, LAB_DEFAULTS.asset); assert.equal(junk.night, 0); assert.equal(junk.rot, LAB_DEFAULTS.rot); assert.equal(junk.cam, 'game'); assert.ok(junk.zoom >= 0.05);
  assert.equal(parseLabParams('?asset=sailboat&v=coral').v, 'coral');
  assert.equal(parseLabParams('?asset=sailboat&v=cream').v, defaultVariant('sailboat'), 'a variant that belongs to another asset falls back');
  assert.ok(FOCUS.includes(parseLabParams('?focus=today').focus));
  assert.equal(labParamsToSearch('?panel=1', { ...LAB_DEFAULTS }), '?panel=1', 'unrelated params survive');
});

check('the lab page is wired: its script exists, and every element id the script asks for exists in the HTML (no null crash at start)', () => {
  const html = readFileSync(new URL('../era-asset-lab.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./era-asset-lab.js', import.meta.url), 'utf8');
  assert.ok(html.includes('./src/era-asset-lab.js'));
  const have = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const asked = new Set([...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
  for (const id of asked) assert.ok(have.has(id), `era-asset-lab.js asks for #${id}, the page has none`);
  for (const t of ['width=device-width', 'viewport-fit=cover']) assert.ok(html.includes(t));
  assert.ok(/min-height:\s*44px|height:\s*44px/.test(html), 'touch targets are 44px');
  for (const id of LAB_ORDER) assert.ok(id === 'compare' || ASSETS[id], id);
});

check('new files only: the kit imports nothing but three.js', () => {
  const src = readFileSync(new URL('./era-assets.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '(.+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../vendor/three/three.module.js']);
});

console.log(`\n${passed} checks passed`);
