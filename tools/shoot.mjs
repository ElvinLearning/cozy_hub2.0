// Screenshot named states of the landing page.
// node tools/shoot.mjs [outDir] [w] [h] [states,comma,separated] [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [out = 'workbench/shots', W = '1440', H = '900', only = '', base = 'http://localhost:8090'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`${base}/?capture&dpr=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 120000 });
const states = await page.evaluate(() => window.__app.states);
const names = only ? only.split(',') : Object.keys(states);
const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
for (const name of names) {
  await page.evaluate((y) => window.__app.setScroll(y), states[name]);
  await page.evaluate((t) => window.__app.seekMedia(t), 1.0);
  await frames(name === 'intro' ? 2 : 4);
  const t0 = Date.now();
  await frames(1);
  const ms = Date.now() - t0;
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name.padEnd(16), String(states[name]).padStart(6), `${ms}ms/frame`, JSON.stringify(await page.evaluate(() => window.__app.job)));
}
console.log('errors:', JSON.stringify(await page.evaluate(() => window.__app.errors)));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
