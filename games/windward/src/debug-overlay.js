// ?debug=1 — on-screen performance overlay (real-coast trial). Created only when the flag is set.
//
// Shows: load time to first frame, fps (average and worst frame over the last second, and worst
// since the 3rd second), draw calls, triangles, JS heap (Chrome only), download size, plus any
// extra lines the game adds with set(). The latest numbers are also kept in window.__stats so a
// headless run can read them. Costs one text update per 250 ms and a few array pushes per frame.
const MB = (n) => (n / 1048576).toFixed(2);

export function createDebugOverlay(renderer) {
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;top:4px;right:4px;margin:0;padding:6px 8px;z-index:9999;pointer-events:none;'
    + 'font:10px/1.35 ui-monospace,Menlo,monospace;color:#eaf6ff;background:rgba(8,20,32,.72);border-radius:6px;max-width:62vw;white-space:pre-wrap';
  el.textContent = 'debug…';
  document.body.appendChild(el);

  const extra = new Map();
  const frames = []; // { t, dt } for the last second
  let last = null;
  let firstFrameMs = null;
  let firstRaf = null; // rAF clock at the first frame
  let firstCostMs = null; // how long the first frame took (shader compile + uploads)
  let worstEverMs = 0;
  let frameCount = 0;
  let shownAt = 0;

  function resourceBytes() {
    let enc = 0, dec = 0, n = 0;
    for (const e of performance.getEntriesByType('resource')) { enc += e.encodedBodySize || 0; dec += e.decodedBodySize || 0; n++; }
    return { enc, dec, n };
  }

  return {
    el,
    set(key, text) { extra.set(key, text); },
    // Call once per animation frame, right AFTER renderer.render().
    frame(now) {
      frameCount++;
      if (firstFrameMs === null) { firstFrameMs = performance.now(); firstRaf = now; } // ms since navigation start
      if (last !== null) {
        const dt = now - last;
        frames.push({ t: now, dt });
        if (firstCostMs === null) firstCostMs = dt; // 2nd rAF - 1st rAF = the first frame's render time
        else if (now > firstRaf + 3000 && dt > worstEverMs) worstEverMs = dt; // steady state: ignore the first 3 s
      }
      last = now;
      while (frames.length && frames[0].t < now - 1000) frames.shift();
      if (now - shownAt < 250) return;
      shownAt = now;

      const span = frames.length ? frames[frames.length - 1].t - frames[0].t + frames[0].dt : 0;
      const avgFps = span ? (frames.length * 1000) / span : 0;
      const worstMs = frames.reduce((m, f) => Math.max(m, f.dt), 0);
      const info = renderer.info;
      const heap = performance.memory ? performance.memory.usedJSHeapSize : null;
      const res = resourceBytes();
      const stats = {
        firstFrameMs: Math.round(firstFrameMs),
        firstFrameCostMs: firstCostMs === null ? null : Math.round(firstCostMs),
        fpsAvg1s: +avgFps.toFixed(1),
        worstFrameMs1s: +worstMs.toFixed(1),
        worstFps1s: worstMs ? +(1000 / worstMs).toFixed(1) : 0,
        worstFrameMsEver: +worstEverMs.toFixed(1),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        heapMB: heap === null ? null : +MB(heap),
        downloadedEncodedMB: +MB(res.enc),
        downloadedDecodedMB: +MB(res.dec),
        requests: res.n,
        canvas: `${renderer.domElement.width}x${renderer.domElement.height}`,
        frames: frameCount,
      };
      window.__stats = stats;
      el.textContent = [
        `first frame  ${stats.firstFrameMs} ms from navigation start (its own render: ${stats.firstFrameCostMs ?? '…'} ms)`,
        `fps          ${stats.fpsAvg1s} avg 1s | worst ${stats.worstFps1s} (${stats.worstFrameMs1s} ms)`,
        `worst ever   ${stats.worstFrameMsEver} ms (steady state, 3 s after first frame)`,
        `draw calls   ${stats.drawCalls}   triangles ${stats.triangles.toLocaleString('en')}`,
        `geom ${stats.geometries}  tex ${stats.textures}  heap ${stats.heapMB === null ? 'n/a' : stats.heapMB + ' MB'}`,
        `download     ${MB(res.enc)} MB on the wire, ${MB(res.dec)} MB decoded, ${res.n} requests`,
        `canvas       ${stats.canvas}  dpr ${window.devicePixelRatio}`,
        ...extra.values(),
      ].join('\n');
    },
  };
}
