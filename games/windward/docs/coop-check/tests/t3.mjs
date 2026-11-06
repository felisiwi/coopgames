import { chromium, BASE, ARGS, sleep } from './harness.mjs';
const exe='/Users/felix/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({ args: ARGS, executablePath: exe });
const page = await (await browser.newContext()).newPage();
await page.goto(BASE + '/');   // hub page already loads window.Peer
for (const [label, cfgName] of [['no ICE servers (host candidates only)', 'none'], ['STUN only', 'stun'], ['hub ICE_SERVERS', 'hub']]) {
  const r = await page.evaluate(async ({ cfgName }) => {
    const { ICE_SERVERS } = await import('/shared/net.js');
    const ice = cfgName === 'none' ? [] : cfgName === 'stun' ? [{ urls: 'stun:stun.l.google.com:19302' }] : ICE_SERVERS;
    const log = [];
    const t0 = performance.now(); const st = (m) => log.push(`${Math.round(performance.now()-t0)}ms ${m}`);
    const a = new Peer({ config: { iceServers: ice } }), b = new Peer({ config: { iceServers: ice } });
    const aid = await new Promise((res, rej) => { a.on('open', res); a.on('error', e => rej(e)); setTimeout(() => rej(new Error('a open timeout')), 10000); }).catch(e => { st('A: ' + e.message); return null; });
    st('A id ' + (aid ? 'ok' : 'none'));
    await new Promise((res) => { b.on('open', res); setTimeout(res, 10000); }); st('B open');
    if (!aid) return log;
    a.on('connection', (c) => { c.on('open', () => st('A: conn open')); });
    const c = b.connect(aid);
    c.on('error', e => st('B conn error ' + e));
    const ok = await new Promise((res) => { c.on('open', () => res(true)); setTimeout(() => res(false), 15000); });
    st('B conn open = ' + ok + ' ice=' + c.peerConnection?.iceConnectionState + ' gather=' + c.peerConnection?.iceGatheringState);
    a.destroy(); b.destroy();
    return log;
  }, { cfgName });
  console.log('==', label, '\n' + r.join('\n'));
}
await browser.close();
