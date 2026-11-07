// The sail-feel lab's weather you can SEE (THREE side): rain, drifting mist wisps, and a squall's dark cloud bank.
// The numbers that decide HOW MUCH (visibility, rain, cloud) come from weather.js / squall.js; the fog and light are set in the lab.
// Mist here is deliberately NOT the game's exploration fog: that one is a static wall of "not yet" over unexplored sea; weather mist
// is thin, cool and grey-white, drifts across the water in soft wisps, and is all around you (see docs/ALIVE-SEA.md decision 13).
import * as THREE from '../vendor/three/three.module.js';

// ---- rain: slanted streaks falling through a box round the boat ----
export function createRain(count = 280) {
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xcfdfea, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;
  lines.name = 'rain';
  const BOX = 150; const TOP = 70; const FALL = 22; const LEN = 2.4;
  const d = Array.from({ length: count }, () => ({ x: (Math.random() - 0.5) * BOX * 2, y: Math.random() * TOP, z: (Math.random() - 0.5) * BOX * 2 }));
  return {
    lines,
    // center {x, z}; windDir (game, FROM); windMs; intensity 0..1
    update(dt, center, windDir, windMs, intensity) {
      lines.visible = intensity > 0.02;
      material.opacity = 0.12 + 0.4 * intensity;
      if (!lines.visible) return;
      const sx = -Math.sin(windDir) * windMs * 0.45; const sz = -Math.cos(windDir) * windMs * 0.45; // streaks lean downwind
      const n = Math.ceil(count * Math.min(1, intensity));
      for (let i = 0; i < count; i++) {
        const p = d[i];
        if (i < n) {
          p.x += sx * dt; p.z += sz * dt; p.y -= FALL * dt;
          if (p.y < 0) { p.y += TOP; p.x = center.x + (Math.random() - 0.5) * BOX * 2; p.z = center.z + (Math.random() - 0.5) * BOX * 2; }
          if (Math.abs(p.x - center.x) > BOX) p.x = center.x + Math.sign(center.x - p.x) * BOX * 0.98;
          if (Math.abs(p.z - center.z) > BOX) p.z = center.z + Math.sign(center.z - p.z) * BOX * 0.98;
          pos[i * 6] = p.x; pos[i * 6 + 1] = p.y; pos[i * 6 + 2] = p.z;
          pos[i * 6 + 3] = p.x - (sx / FALL) * LEN; pos[i * 6 + 4] = p.y + LEN; pos[i * 6 + 5] = p.z - (sz / FALL) * LEN;
        } else { pos[i * 6 + 1] = pos[i * 6 + 4] = -9999; }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// ---- mist: soft grey-white wisps lying on the water, drifting downwind, breathing slowly ----
function softTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.5, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function createMist(count = 22) {
  const group = new THREE.Group();
  group.name = 'mist';
  const tex = softTexture();
  const BOX = 170;
  const wisps = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xe6ecee, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 3;
    group.add(mesh);
    wisps.push({ mesh, x: (Math.random() - 0.5) * BOX * 2, z: (Math.random() - 0.5) * BOX * 2, size: 50 + Math.random() * 60, speed: 0.6 + Math.random() * 0.8, phase: Math.random() * 6.28, y: 1.2 + Math.random() * 2.5 });
  }
  group.visible = false;
  return {
    group,
    // center {x, z}; windDir (game, FROM); mist 0..1; color: THREE.Color of the mist; tS seconds (for breathing)
    update(dt, center, windDir, mist, color, tS) {
      group.visible = mist > 0.02;
      if (!group.visible) return;
      const dx = -Math.sin(windDir); const dz = -Math.cos(windDir);
      for (const w of wisps) {
        w.x += dx * w.speed * dt; w.z += dz * w.speed * dt;
        if (Math.abs(w.x - center.x) > BOX) w.x = center.x - Math.sign(w.x - center.x) * BOX * 0.97;
        if (Math.abs(w.z - center.z) > BOX) w.z = center.z - Math.sign(w.z - center.z) * BOX * 0.97;
        w.mesh.position.set(w.x, w.y, w.z);
        w.mesh.scale.setScalar(w.size);
        w.mesh.material.color.copy(color);
        w.mesh.material.opacity = mist * 0.42 * (0.65 + 0.35 * Math.sin(tS * 0.35 + w.phase));
      }
    },
  };
}

// ---- a squall's cloud bank: a dark wall standing over the line, seen from near it or zoomed out ----
function gradientTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const r = g.createLinearGradient(0, 0, 0, 128);
  r.addColorStop(0, 'rgba(36,44,58,0)'); r.addColorStop(0.35, 'rgba(36,44,58,0.75)'); r.addColorStop(1, 'rgba(24,30,42,0.95)');
  g.fillStyle = r; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function createCloudBank() {
  const mat = new THREE.MeshBasicMaterial({ map: gradientTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 4;
  mesh.visible = false;
  mesh.name = 'squall-cloud';
  return {
    mesh,
    // boat {x, z}; sq = squallAt() result (needs event, aheadM, cloud). The wall stands `aheadM` upwind of the boat (at least 140 m).
    update(boat, sq) {
      const e = sq?.event;
      if (!e || sq.cloud < 0.03 || sq.aheadM === null) { mesh.visible = false; return; }
      const d = Math.max(140, sq.aheadM + 60);
      const ux = -e.tx; const uz = -e.tz; // upwind: where the squall is coming from
      const height = 90 + 220 * sq.cloud;
      mesh.visible = true;
      mesh.scale.set(1800, height, 1);
      mesh.position.set(boat.x + ux * d, height / 2 - 6, boat.z + uz * d);
      mesh.rotation.set(0, Math.atan2(ux, uz), 0); // the plane faces the boat
      mat.opacity = Math.min(0.92, Math.pow(sq.cloud, 0.7) * 1.05);
    },
  };
}
