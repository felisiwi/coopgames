import { relayPair, sleep } from './lib.mjs';
// A) year: host asks for 1950, guest opens the plain link
const { browser, host, guest, wire } = await relayPair({ hostQ: 'debug=1&year=1950', guestQ: 'debug=1' });
await sleep(16000);
for (const p of [host, guest]) await p.getByText('Set sail').click({ timeout: 3000 }).catch(() => {});
const era = (p) => p.evaluate(() => { const b = window.__busy; return { profile: b.stats().profile, boats: b.stats().vessels, ferry: !!b.vessels.find(v => v.kind === 'ferry'), kit: b.stats().placeholderKit, houses: b.stats().houses }; });
console.log('A) year host(1950)', JSON.stringify(await era(host)), ' guest(default)', JSON.stringify(await era(guest)));
// D) ping
const pingBefore = await guest.evaluate(() => window.__recv.filter(m => m.type === 'ping').length);
await host.keyboard.press('Space'); await sleep(1500);
const gp = await guest.evaluate(() => ({ pings: window.__recv.filter(m => m.type === 'ping').length, notice: [...document.querySelectorAll('div')].map(d => d.textContent).find(t => /pinged/.test(t) && t.length < 120) }));
console.log('D) ping before/after', pingBefore, gp);
// C) harbour arrival on host only
const keys = await host.evaluate(() => ({ lure: Object.keys(window.__lure), moment: Object.keys(window.__lure.moment), kinds: [...new Set(window.__lure.names.map(n => n.kind))], deck: Object.keys(window.__lure.deck) }));
console.log('C) keys', JSON.stringify(keys));
const place = await host.evaluate(() => { const n = window.__lure.names.find(e => e.id === 'village:Fiskebäckskil') || window.__lure.names.find(e => e.kind === 'village'); return { id: n.id, x: n.x, z: n.z }; });
console.log('place', place);
await host.evaluate((p) => Object.assign(window.__self, { x: p.x, z: p.z, speed: 0 }), place);
await sleep(5000);
await host.screenshot({ path: 't7-host-harbour.png' });
await guest.screenshot({ path: 't7-guest-while-host-in-harbour.png' });
const gstate = await guest.evaluate((p) => ({ otherSeen: true, ls: Object.keys(localStorage) }), place);
console.log('guest ls', gstate.ls);
// E) friend leaves: cut the wire for the guest's pos (simulate closing the tab), wait for host notice
wire.open = false; await sleep(9000);
const hn = await host.evaluate(() => [...document.querySelectorAll('div')].map(d => d.textContent).find(t => /friend has left/.test(t) && t.length < 140));
console.log('E) host notice after wire cut:', hn);
wire.open = true; await sleep(3000);
console.log('E) after wire restored, host notice now:', await host.evaluate(() => [...document.querySelectorAll('div')].map(d => d.textContent).find(t => /friend has left/.test(t) && t.length < 140)));
console.log([...host.logs, ...guest.logs].filter(l => /PAGEERR|error/i.test(l)).slice(0, 5).join('\n'));
await browser.close();
