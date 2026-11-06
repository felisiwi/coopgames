import { chromium, BASE, ARGS, sleep } from './harness.mjs';
export { sleep };
const exe='/Users/felix/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
// Two players in SEPARATE contexts, messages relayed through node (drop = () => true to cut the wire).
export async function relayPair({ hostQ = 'debug=1', guestQ = 'debug=1', size = {width:1100,height:700}, guestDelay = 0, seed = 424242 } = {}) {
  const browser = await chromium.launch({ args: ARGS, executablePath: exe });
  const mk = async (n) => { const ctx = await browser.newContext({ viewport: size }); const p = await ctx.newPage(); p.ctx = ctx; p.logs = []; p.name = n;
    p.on('console', m => p.logs.push(`[${n}] ${m.type()}: ${m.text().slice(0,300)}`)); p.on('pageerror', e => p.logs.push(`[${n}] PAGEERROR ${e.message}`)); return p; };
  const host = await mk('host'), guest = await mk('guest');
  const wire = { open: true, log: [] };
  const relay = (from, to) => async (msg) => { wire.log.push({ from: from.name, type: msg.type }); if (wire.open) { try { await to.evaluate((m) => window.__in && window.__in(m), msg); } catch {} } };
  await host.exposeFunction('__out', relay(host, guest)); await guest.exposeFunction('__out', relay(guest, host));
  const url = (role, extra) => `${BASE}/games/windward/docs/coop-check/bridge.html?role=${role}&seed=${seed}&${extra}`;
  await host.goto(url('host', hostQ)); if (guestDelay) await sleep(guestDelay);
  await guest.goto(url('guest', guestQ));
  return { browser, host, guest, wire, url };
}
export const ev = (p, fn, arg) => p.evaluate(fn, arg);
