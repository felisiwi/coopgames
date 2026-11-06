import { relayPair, sleep } from './lib.mjs';
const { browser, host, guest, wire } = await relayPair();
await sleep(16000);
const state = (p) => p.evaluate(() => { const t = window.__task; const j = (o) => { try { return JSON.parse(JSON.stringify(o)); } catch { return String(o); } };
  return { phase: t.task.phase, restored: t.task.restoredCount, dark: t.task.ids.map((i) => t.task.isDark(i)), hud: [...document.querySelectorAll('div')].map(d => d.textContent).find(x => /lights \d\/5|places named/.test(x) && x.length < 120), chapter: j(t.chapter && (t.chapter.state ?? t.chapter)), lightLog: j(t.lightLog && (t.lightLog.entries ?? t.lightLog.list ?? Object.keys(t.lightLog))), ls: Object.keys(localStorage), names: window.__names.count + '/' + window.__names.total }; });
// dismiss the start card on both
for (const p of [host, guest]) { await p.getByText('Set sail').click({ timeout: 3000 }).catch(() => {}); }
console.log('BEFORE host', JSON.stringify(await state(host))); console.log('BEFORE guest', JSON.stringify(await state(guest)));
const L = await host.evaluate(() => { const l = window.__task.task.lights[0]; return { id: l.id, name: l.name, x: l.x, z: l.z }; }); console.log('light', L);
await host.evaluate((l) => { Object.assign(window.__self, { x: l.x - 30, z: l.z, speed: 0 }); }, L);
await sleep(4000); await host.screenshot({ path: 't6-host-visit.png' }); await guest.screenshot({ path: 't6-guest-during.png' });
await sleep(14000);
await host.screenshot({ path: 't6-host-after.png' });
console.log('AFTER host', JSON.stringify(await state(host))); console.log('AFTER guest', JSON.stringify(await state(guest)));
// guest sails to the same light to see the tower from its side
await guest.evaluate((l) => { Object.assign(window.__self, { x: l.x - 80, z: l.z + 40, speed: 0 }); }, L);
await sleep(5000); await guest.screenshot({ path: 't6-guest-at-light.png' });
console.log('guest at light, own state', JSON.stringify(await state(guest)));
console.log('msg types on wire:', JSON.stringify(wire.log.reduce((a, m) => (a[m.from + ':' + m.type] = (a[m.from + ':' + m.type] || 0) + 1, a), {})));
console.log([...host.logs, ...guest.logs].filter(l => /PAGEERR|error/i.test(l)).slice(0, 5).join('\n'));
await browser.close();
