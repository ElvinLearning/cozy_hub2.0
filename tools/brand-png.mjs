// Raster brand files from the SVG marks and a hero render:
// apple-touch-icon (180), favicon-32, og-image (1200x630).
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:8090';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 180, height: 180 } });
for (const [svg, size, out] of [['cozy-icon.svg', 180, 'apple-touch-icon.png'], ['cozy-favicon.svg', 32, 'favicon-32.png'], ['cozy-icon.svg', 512, 'icon-512.png']]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0;background:#08090b}</style><img src="${base}/brand/${svg}" width="${size}" height="${size}" style="display:block">`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `public/brand/${out}` });
}
// OG card: the live hero, framed for 1200x630
const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(`${base}/?capture&dpr=1`);
await og.waitForFunction(() => window.__app?.ready, null, { timeout: 180000 });
await og.evaluate(() => { window.__app.skipIntro(); window.__app.setScroll(0); document.getElementById('nav').style.display = 'none'; document.querySelector('.hero-copy .cta-row').style.display = 'none'; document.getElementById('hero-price').style.display = 'none'; });
await og.waitForTimeout(4000);
await og.screenshot({ path: 'public/brand/og-image.jpg' });
await b.close();
console.log('brand pngs written');
