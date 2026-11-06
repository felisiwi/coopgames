import { relayPair, sleep } from './lib.mjs';
const { browser, host, guest } = await relayPair();
await sleep(18000);
const snap = (p) => p.evaluate(() => { const o = {}; for (const v of window.__busy.vessels) if (v.pose) o[v.id] = [v.pose.x ?? v.pose[0], v.pose.z ?? v.pose[1], v.lag]; return { t: Date.now(), o, ferryKeys: Object.keys(window.__busy.vessels.find(v=>v.kind==='ferry').pose||{}) }; });
const [a, b] = await Promise.all([snap(host), snap(guest)]);
let diffs = [], lagged = 0;
for (const id of Object.keys(a.o)) { const A = a.o[id], B = b.o[id]; if (!B) continue; const d = Math.hypot(A[0]-B[0], A[1]-B[1]); diffs.push(d); if (A[2] || B[2]) lagged++; }
diffs.sort((x,y)=>x-y);
console.log('pose keys', a.ferryKeys, 'vessels compared', diffs.length, 'median diff m', diffs[diffs.length>>1].toFixed(2), 'max diff m', diffs.at(-1).toFixed(2), 'with lag', lagged, 'clock gap ms', Math.abs(a.t-b.t));
const f = (s) => s.o['ferry-847']; console.log('ferry host', f(a), 'guest', f(b));
await browser.close();
// clock skew: guest device 90 s ahead
const r2 = await relayPair();
await r2.guest.ctx.addInitScript(() => { const off = 90000, D = Date; const now = D.now.bind(D); Date.now = () => now() + off; });
await r2.guest.reload(); await sleep(18000);
const [c, d] = await Promise.all([snap(r2.host), snap(r2.guest)]);
console.log('SKEW 90s ferry host', c.o['ferry-847'], 'guest', d.o['ferry-847'], 'dist m', Math.hypot(c.o['ferry-847'][0]-d.o['ferry-847'][0], c.o['ferry-847'][1]-d.o['ferry-847'][1]).toFixed(0));
await r2.browser.close();
