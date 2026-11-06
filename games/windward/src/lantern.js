// The lantern of a lighthouse (stage 1d): dark after the storm, lit with its real flash pattern once restored.
//
//   lightOnAt(light, t)       pure: is the light showing at time t? `light` is a lighthouses.js entry's `light`: { kind, count, period,
//                             flashSeconds?, gap? } as the Lighthouse Directory gives it. (seamark-meshes.js lightIsOn does the same for
//                             the OSM lights; these are the 29 hand-drawn towers, whose data has its own shape.)
//   createLanternFx(group, e) the glow: the 'lantern-glass' mesh goes from dull grey to warm and bright, a halo sprite pulses on the
//                             pattern and a soft beam sweeps round. Emissive materials only, no PointLight (a new light recompiles every
//                             material in the scene, a hitch on phones). By day the beam is faint; night is not built yet.
import * as THREE from '../vendor/three/three.module.js';
import { GLASS } from './lighthouses.js';
import { getGlowTexture } from './seamark-meshes.js';

export const FLASH_DEFAULT_S = 0.5; // a "flash" with no stated length
export const FLASH_SPACING_EXTRA_S = 1.5; // flashes in a group start flashLength + this apart unless `gap` says
export const ECLIPSE_S = 1.0; // an occulting light goes dark this long, `count` times a period
export const ECLIPSE_SPACING_S = 2.0;

// light: { kind: 'flash' | 'occulting' | 'on-off', count, period, flashSeconds?, gap? } or null (no stated pattern: steady).
export function lightPattern(light) {
  if (!light || !light.period) return { steady: true, period: 1, on: [[0, 1]] };
  const fs = light.flashSeconds ?? (light.kind === 'on-off' ? light.period / 2 : FLASH_DEFAULT_S);
  const count = Math.max(1, light.count ?? 1);
  if (light.kind === 'on-off') return { period: light.period, on: [[0, Math.min(fs, light.period)]] };
  if (light.kind === 'occulting') { // steady light with `count` eclipses
    const dark = [];
    for (let i = 0; i < count; i++) dark.push([i * ECLIPSE_SPACING_S, i * ECLIPSE_SPACING_S + ECLIPSE_S]);
    const on = [];
    let from = 0;
    for (const [a, b] of dark) { if (a > from) on.push([from, a]); from = b; }
    if (from < light.period) on.push([from, light.period]);
    return { period: light.period, on, dark };
  }
  const spacing = light.gap ?? (fs + FLASH_SPACING_EXTRA_S);
  const on = [];
  for (let i = 0; i < count; i++) { const a = i * spacing; if (a < light.period) on.push([a, Math.min(light.period, a + fs)]); }
  return { period: light.period, on };
}
export function lightOnAt(light, t) {
  const p = lightPattern(light);
  if (p.steady) return true;
  const u = ((t % p.period) + p.period) % p.period;
  return p.on.some(([a, b]) => u >= a && u < b);
}

const DARK_GLASS = 0x3b4752; // a dull blue-grey: the storm has put the lamp out
const DIM = 0.55; // a lit lantern between flashes still glows a little: you can tell it is burning

// group: the THREE.Group from createLighthouse(name), already placed. entry: the LIGHTHOUSES entry (its `light` pattern).
// opts.beam: false for a faint ghost of a light (the old Måseskär tower): the glass and halo flash on the pattern, no sweeping beam.
// opts.solidHalo: a warm amber halo with normal blending, not additive: additive light vanishes against pale fogged land, and the ghost is seen in fog.
export function createLanternFx(group, entry, { beam: withBeam = true, solidHalo = false } = {}) {
  const glass = [];
  group.traverse((o) => { if (o.isMesh && /^lantern-glass/.test(o.name)) glass.push(o); });
  const darkMat = new THREE.MeshLambertMaterial({ color: DARK_GLASS, flatShading: true });
  const litMat = new THREE.MeshBasicMaterial({ color: GLASS, toneMapped: false });
  const centre = new THREE.Vector3();
  if (glass.length) {
    group.updateWorldMatrix(true, true);
    new THREE.Box3().setFromObject(glass[0]).getCenter(centre);
    group.worldToLocal(centre);
  } else centre.set(0, 8, 0);
  const haloMat = new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xffe8a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  if (solidHalo) { haloMat.blending = THREE.NormalBlending; haloMat.color.setHex(0xffb830); }
  const halo = new THREE.Sprite(haloMat);
  halo.name = 'lantern-halo';
  halo.position.copy(centre);
  halo.scale.setScalar(9);
  halo.visible = false;
  const L = 80;
  const beamGeo = new THREE.ConeGeometry(3.4, L, 6, 1, true);
  beamGeo.translate(0, -L / 2, 0); // apex at the lantern, the cone opening away along -y ...
  beamGeo.rotateZ(Math.PI / 2); // ... turned to open along +x
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.name = 'lantern-beam';
  beam.position.copy(centre);
  beam.visible = false;
  group.add(halo);
  if (withBeam) group.add(beam);
  const phase0 = (entry.name.length * 0.37) % 1;
  let lit = false;
  const setGlass = (m) => { for (const g of glass) g.material = m; };
  setGlass(darkMat);
  const api = {
    group, halo, beam, glass, dim: 1, haloMul: 1, phase: phase0, // dim scales the whole effect (the old tower is only a ghost of a light)
    get lit() { return lit; },
    // lit: the lamp is burning (restored, or never put out). Dark: unlit glass, no halo, no beam.
    setLit(on) {
      lit = !!on;
      setGlass(lit ? litMat : darkMat);
      halo.visible = beam.visible = lit;
      if (!lit) { haloMat.opacity = 0; beamMat.opacity = 0; }
    },
    // t in seconds; level 0..1 scales the whole effect (the lamp warming up when the light comes back on)
    update(t, level = 1) {
      if (!lit) return;
      const on = lightOnAt(entry.light, t + api.phase * (entry.light?.period ?? 0));
      const k = (on ? 1 : DIM) * level * api.dim;
      litMat.color.setHex(GLASS).multiplyScalar(0.55 + 0.45 * k);
      haloMat.opacity = 0.9 * k * (on ? 1 : 0.45);
      halo.scale.setScalar((7 + 4 * k) * api.haloMul);
      beamMat.opacity = 0.2 * (on ? 1 : 0.25) * level * api.dim; // faint by day
      beam.rotation.y = t * 0.8 + api.phase * 6.28;
    },
    dispose() { darkMat.dispose(); litMat.dispose(); haloMat.dispose(); beamMat.dispose(); beamGeo.dispose(); },
  };
  return api;
}
