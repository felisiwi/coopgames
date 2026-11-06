import { createRequire } from 'module';
const require = createRequire('/Users/felix/.npm/_npx/e41f203b7505f1fb/node_modules/');
export const { chromium } = require('playwright');
export const BASE = 'http://localhost:5199';
export const ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--disable-features=WebRtcHideLocalIpsWithMdns'];
export async function pair({ order = 'guest-first', hostWait = 0, hostExtra = 'debug=1', guestExtra = 'debug=1', size = {width:1100,height:700} } = {}) {
  const browser = await chromium.launch({ args: ARGS, executablePath: '/Users/felix/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
  const mk = async (name) => {
    const ctx = await browser.newContext({ viewport: size });
    const page = await ctx.newPage();
    page.logs = [];
    page.on('console', (m) => page.logs.push(`[${name}] ${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => page.logs.push(`[${name}] PAGEERROR: ${e.message}`));
    return page;
  };
  const host = await mk('host'), guest = await mk('guest');
  await host.goto(BASE + '/');
  await host.click('#host-button');
  await host.waitForFunction(() => new URLSearchParams(location.search).get('host'), null, { timeout: 30000 });
  const id = new URL(host.url()).searchParams.get('host');
  // test-only: add params to the host's address bar after the hub rewrote it
  if (hostExtra) await host.evaluate((x) => history.replaceState(null, '', location.pathname + location.search + '&' + x), hostExtra);
  const pick = () => host.click('text=Windward >> xpath=ancestor::article >> button');
  const join = () => guest.goto(`${BASE}/?host=${id}${guestExtra ? '&' + guestExtra : ''}`);
  if (order === 'guest-first') { await join(); await sleep(2000); await pick(); }
  else { await pick(); await sleep(hostWait); await join(); }
  return { browser, host, guest, id };
}
const sleep0 = 0;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
