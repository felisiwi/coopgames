import { relayPair, sleep } from './lib.mjs';
const { browser, host, guest, wire } = await relayPair();
await sleep(16000);
for (const p of [host, guest]) await p.getByText('Set sail').click({ timeout: 3000 }).catch(() => {});
const hb = await host.evaluate(() => window.__lure.names.filter(e => e.kind === 'harbour').slice(0, 4).map(e => ({ id: e.id, x: e.x, z: e.z, name: e.name })));
console.log('harbours', JSON.stringify(hb));
const H = hb.find(h => /Grundsunds hamn|hamn/i.test(h.name || h.id)) || hb[0];
// put BOTH boats in the same harbour, host first (slow), guest 6 s later
await host.evaluate((p) => Object.assign(window.__self, { x: p.x, z: p.z, speed: 0 }), H);
await sleep(3500); await host.screenshot({ path: 't8-host-moment.png' });
const hs = await host.evaluate(() => ({ stats: JSON.stringify(window.__lure.moment.stats), deck: (typeof window.__lure.deck.count==='function'?window.__lure.deck.count():window.__lure.deck.count), ls: Object.keys(localStorage) }));
console.log('host moment', JSON.stringify(hs));
await guest.screenshot({ path: 't8-guest-while-host-moment.png' });
await guest.evaluate((p) => Object.assign(window.__self, { x: p.x + 25, z: p.z + 10, speed: 0 }), H);
await sleep(3500); await guest.screenshot({ path: 't8-guest-moment.png' });
const gs = await guest.evaluate(() => ({ stats: JSON.stringify(window.__lure.moment.stats), deck: (typeof window.__lure.deck.count==='function'?window.__lure.deck.count():window.__lure.deck.count) }));
console.log('guest moment', JSON.stringify(gs));
// does the host's boat show on the guest's screen / mini map while host is held in the moment?
console.log('guest recv last pos from host', JSON.stringify(await guest.evaluate(() => window.__recv.filter(m => m.type === 'pos').at(-1))), 'host self', JSON.stringify(await host.evaluate(() => ({ x: window.__self.x, z: window.__self.z }))));
await browser.close();
