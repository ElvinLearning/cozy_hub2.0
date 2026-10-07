// End-to-end check of the admin panel in a real browser against the mock
// Higgsfield API. Writes screenshots to workbench/admin/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMock } from './mock-higgsfield.mjs';

const out = 'workbench/admin';
mkdirSync(out, { recursive: true });
const mock = createMock({ stepsToFinish: 2 });
const hfBase = await mock.listen();
const port = 8099;
const srv = spawn(process.execPath, ['server/index.mjs'], {
  env: { ...process.env, PORT: String(port), ADMIN_PASSWORD: 'smoke', HF_KEY: 'mock:mock', HF_BASE_URL: hfBase, DATA_DIR: mkdtempSync(join(tmpdir(), 'cozy-smoke-')) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => srv.stdout.on('data', (d) => /Cozy Hub on/.test(d) && r()));
const base = `http://localhost:${port}`;
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + '/admin/');
  await page.screenshot({ path: `${out}/01-login.png` });
  await page.fill('input[name=password]', 'smoke');
  await page.click('button[type=submit]');
  await page.waitForSelector('#shell:not([hidden])');
  await page.click('button[data-view=customers]');
  await page.fill('#cus-form [name=name]', 'Ana Ruiz');
  await page.fill('#cus-form [name=business]', 'Ana’s Bakery');
  await page.fill('#cus-form [name=email]', 'ana@bakery.test');
  await page.selectOption('#cus-plan', 'starter');
  await page.click('#cus-form button[type=submit]');
  await page.waitForSelector('.cus-credits:has-text("5 cr")');
  await page.screenshot({ path: `${out}/02-customers.png` });
  await page.click('button[data-view=generate]');
  await page.selectOption('#gen-model', 'higgsfield-ai/dop/standard');
  await page.selectOption('#gen-customer', { index: 1 });
  await page.fill('#gen-fields [name=prompt]', 'Slow push-in on fresh croissants on a marble counter, morning window light, steam rising');
  await page.fill('#gen-fields [name=image_url]', 'https://example.test/croissant.jpg');
  await page.screenshot({ path: `${out}/03-generate.png` });
  await page.click('#gen-submit');
  await page.waitForSelector('[data-job]');
  await page.click('[data-job] button:has-text("Check")');
  await page.waitForTimeout(400);
  await page.click('[data-job] button:has-text("Check")').catch(() => {});
  await page.waitForSelector('[data-job] .chip.completed', { timeout: 8000 });
  await page.screenshot({ path: `${out}/04-jobs.png` });
  await page.click('button[data-view=agent]');
  await page.selectOption('#agent-customer', { index: 1 });
  await page.click('#agent-new button[type=submit]');
  await page.waitForSelector('#composer:not([hidden])');
  await page.fill('#composer-text', 'Make a 9:16 ad for our weekend croissants');
  await page.click('#composer button[type=submit]');
  await page.waitForSelector('.msg.assistant.completed >> text=/vertical\.mp4/');
  await page.screenshot({ path: `${out}/05-agent.png` });
  await page.click('button[data-view=overview]');
  await page.waitForSelector('.stat');
  await page.screenshot({ path: `${out}/06-overview.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/07-overview-mobile.png` });
  console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'admin smoke: OK, no console errors');
} finally {
  await browser.close();
  srv.kill();
  await mock.close();
}
