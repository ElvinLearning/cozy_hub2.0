import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { Higgsfield, mediaUrls } from '../server/higgsfield.mjs';
import { createMock } from '../tools/mock-higgsfield.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let mock, app, server, base, dataDir, cookie;

const api = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'x-cozy': '1', ...headers },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
};

before(async () => {
  mock = createMock({ stepsToFinish: 2 });
  const hfBase = await mock.listen();
  dataDir = mkdtempSync(join(tmpdir(), 'cozy-test-'));
  app = createApp({ root, dataDir, adminPassword: 'test-pass', hf: new Higgsfield({ key: 'mock:mock', baseUrl: hfBase }), pollMs: 0, log: () => {}, env: { PUBLIC_URL: 'https://cozy.example' } });
  server = createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  app.close();
  await new Promise((r) => server.close(r));
  await mock.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('public plans come from config', async () => {
  const r = await api('GET', '/api/plans');
  assert.equal(r.status, 200);
  assert.ok(r.data.plans.find((p) => p.id === 'starter' && p.price === 40));
});

test('admin routes need a session', async () => {
  const r = await api('GET', '/api/admin/me');
  assert.equal(r.status, 401);
  const bad = await api('POST', '/api/admin/login', { password: 'nope' });
  assert.equal(bad.status, 401);
  const ok = await api('POST', '/api/admin/login', { password: 'test-pass' });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.match(ok.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const me = await api('GET', '/api/admin/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.hfConfigured, true);
});

test('mutations without the x-cozy header are refused', async () => {
  const r = await fetch(base + '/api/admin/customers', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{"name":"x"}' });
  assert.equal(r.status, 403);
});

test('tampered session cookie is rejected', async () => {
  const forged = cookie.replace(/=(\d+)/, (_, n) => '=' + (Number(n) + 1000));
  const r = await fetch(base + '/api/admin/me', { headers: { Cookie: forged } });
  assert.equal(r.status, 401);
});

let customer;
test('customer on a plan gets its monthly credits', async () => {
  const r = await api('POST', '/api/admin/customers', { name: 'Ana', business: 'Ana’s Bakery', plan: 'starter', brand: { about: 'Sourdough in Tulsa', assets: ['https://x.test/a.jpg', 'javascript:alert(1)'] } });
  assert.equal(r.status, 201);
  customer = r.data.customer;
  assert.equal(customer.credits, 5);
  assert.deepEqual(customer.brand.assets, ['https://x.test/a.jpg']);
});

test('generation charges credits, polls to completion and exposes the video', async () => {
  const r = await api('POST', '/api/admin/jobs', { model: 'higgsfield-ai/dop/standard', arguments: { prompt: 'warm bakery morning', image_url: 'https://x.test/a.jpg', duration: 5 }, customerId: customer.id });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const job = r.data.job;
  assert.equal(job.status, 'queued');
  // webhook URL is passed through, signed
  const call = mock.calls.find((c) => c.path === '/higgsfield-ai/dop/standard');
  assert.match(call.query.hf_webhook, new RegExp(`^https://cozy.example/api/hf/webhook/${job.id}\\?t=`));
  assert.equal((await api('GET', '/api/admin/customers')).data.customers.find((c) => c.id === customer.id).credits, 4);
  let j = (await api('POST', `/api/admin/jobs/${job.id}/refresh`)).data.job;
  assert.equal(j.status, 'in_progress');
  j = (await api('POST', `/api/admin/jobs/${job.id}/refresh`)).data.job;
  assert.equal(j.status, 'completed');
  assert.equal(j.media.length, 1);
  assert.match(j.media[0], /\.mp4$/);
});

test('failed generation refunds exactly once', async () => {
  const r = await api('POST', '/api/admin/jobs', { model: 'higgsfield-ai/dop/standard', arguments: { prompt: 'FAIL' }, customerId: customer.id });
  const id = r.data.job.id;
  for (let i = 0; i < 4; i++) await api('POST', `/api/admin/jobs/${id}/refresh`);
  const c = (await api('GET', '/api/admin/customers')).data.customers.find((c) => c.id === customer.id);
  assert.equal(c.credits, 4);
  const ledger = (await api('GET', `/api/admin/ledger?customerId=${customer.id}`)).data.ledger;
  assert.equal(ledger.filter((l) => l.jobId === id).length, 2);
});

test('webhook needs a valid signature and re-reads status', async () => {
  const r = await api('POST', '/api/admin/jobs', { model: 'bytedance/seedream/v4/text-to-image', arguments: { prompt: 'bread' } });
  const id = r.data.job.id;
  const bad = await fetch(`${base}/api/hf/webhook/${id}?t=nope`, { method: 'POST', body: '{}' });
  assert.equal(bad.status, 403);
  const good = await fetch(`${base}/api/hf/webhook/${id}?t=${app.webhookSig(id)}`, { method: 'POST', body: '{"status":"completed"}' });
  assert.equal(good.status, 200);
  const j = (await api('GET', '/api/admin/jobs')).data.jobs.find((x) => x.id === id);
  assert.equal(j.status, 'in_progress'); // from the API, not from the webhook body
});

test('out-of-credit customers are blocked before anything is submitted', async () => {
  const c = (await api('POST', '/api/admin/customers', { name: 'Zero' })).data.customer;
  const before = mock.requests.size;
  const r = await api('POST', '/api/admin/jobs', { model: 'higgsfield-ai/dop/standard', arguments: { prompt: 'x' }, customerId: c.id });
  assert.equal(r.status, 402);
  assert.equal(mock.requests.size, before);
});

test('bad model ids never reach Higgsfield', async () => {
  const r = await api('POST', '/api/admin/jobs', { model: '../files/generate-upload-url', arguments: {} });
  assert.equal(r.status, 400);
});

test('admin upload goes through the presigned flow', async () => {
  const r = await api('POST', '/api/admin/upload', new Uint8Array([1, 2, 3]), { 'Content-Type': 'image/png' });
  assert.equal(r.status, 201);
  assert.match(r.data.url, /\/cdn\//);
  assert.equal(mock.uploads.size >= 1, true);
});

test('Cozy Agent session sends the brief, then charges per delivered video', async () => {
  const s = (await api('POST', '/api/admin/agent/sessions', { customerId: customer.id })).data.session;
  const hfSession = mock.sessions.get(s.hfSessionId);
  assert.match(hfSession.messages[0].message.text, /You are the Cozy Agent/);
  assert.match(hfSession.messages[0].message.text, /Sourdough in Tulsa/);
  const before = (await api('GET', '/api/admin/customers')).data.customers.find((c) => c.id === customer.id).credits;
  const r = await api('POST', `/api/admin/agent/sessions/${s.id}/messages`, { content: 'Make a 9:16 ad for our weekend croissants' });
  assert.equal(r.status, 202);
  const visible = r.data.session.messages.filter((m) => !m.hidden);
  assert.ok(visible.some((m) => m.role === 'assistant' && /vertical\.mp4/.test(m.text)));
  // sync again must not double-charge
  await api('POST', `/api/admin/agent/sessions/${s.id}/sync`);
  const after = (await api('GET', '/api/admin/customers')).data.customers.find((c) => c.id === customer.id).credits;
  assert.equal(before - after, 2);
});

test('lead intake: create, upload with token, refuse without', async () => {
  const r = await api('POST', '/api/leads', { name: 'Bo', email: 'bo@shop.test', business: 'Bo Shop', plan: 'growth', message: 'Sneakers' });
  assert.equal(r.status, 201);
  const { id, uploadToken } = r.data;
  const no = await fetch(`${base}/api/leads/${id}/files?name=logo.png&t=wrong`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: new Uint8Array([1]) });
  assert.equal(no.status, 403);
  const bad = await fetch(`${base}/api/leads/${id}/files?name=x.exe&t=${uploadToken}`, { method: 'PUT', headers: { 'Content-Type': 'application/x-msdownload' }, body: new Uint8Array([1]) });
  assert.equal(bad.status, 415);
  const ok = await fetch(`${base}/api/leads/${id}/files?name=../../logo.png&t=${uploadToken}`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: new Uint8Array([137, 80, 78, 71]) });
  assert.equal(ok.status, 201);
  const { name } = await ok.json();
  assert.doesNotMatch(name, /\.\./);
  const leads = (await api('GET', '/api/admin/leads')).data.leads;
  assert.equal(leads.find((l) => l.id === id).files.length, 1);
  const file = await fetch(`${base}/api/admin/leads/${id}/files/${encodeURIComponent(name)}`, { headers: { Cookie: cookie } });
  assert.equal(file.status, 200);
  const conv = await api('POST', `/api/admin/leads/${id}/convert`);
  assert.equal(conv.data.customer.credits, 20);
});

test('static: range requests and traversal', async () => {
  const r = await fetch(`${base}/brand/cozy-mark.svg`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 10);
  const t = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.notEqual(t.status, 200);
  const t2 = await fetch(`${base}/%2e%2e/server/app.mjs`);
  assert.notEqual(t2.status, 200);
});

test('mediaUrls finds urls in any result shape', () => {
  assert.deepEqual(mediaUrls({ video: { url: 'https://a/b.mp4' }, status_url: 'https://a/requests/1/status' }), ['https://a/b.mp4']);
  assert.deepEqual(mediaUrls({ images: [{ url: 'https://a/1' }, { url: 'https://a/2.png' }] }), ['https://a/1', 'https://a/2.png']);
});

test('unknown pages get the branded 404 with a 404 status', async () => {
  const r = await fetch(`${base}/no-such-page`);
  assert.equal(r.status, 404);
  assert.match(await r.text(), /didn't load/);
});
