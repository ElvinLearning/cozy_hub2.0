import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { Higgsfield, HiggsfieldError, REFUNDABLE, TERMINAL, agentText, mediaUrls } from './higgsfield.mjs';
import { cozyBrief, deliveredVideos } from './agent.mjs';
import { Store, newId } from './store.mjs';
import { safeJoin, serveFile } from './static.mjs';

const UPLOAD_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf']);
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body, headers = {}) {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(s), ...headers });
  res.end(s);
}

async function readJson(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Body too large');
    chunks.push(c);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'File too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function limiter(perMinute) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < 60_000);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) hits.clear();
    return arr.length <= perMinute;
  };
}

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function createApp(opts = {}) {
  const root = opts.root || process.cwd();
  const env = opts.env || process.env;
  const publicDir = join(root, 'public');
  const store = opts.store || new Store(opts.dataDir || join(root, 'data'));
  const uploadsDir = join(opts.dataDir || join(root, 'data'), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  const hf = opts.hf || new Higgsfield({ key: opts.hfKey ?? null, baseUrl: env.HF_BASE_URL || 'https://api.higgsfield.ai' });
  const secret = env.SESSION_SECRET || randomBytes(32).toString('hex');
  const adminPassword = opts.adminPassword ?? env.ADMIN_PASSWORD;
  const publicUrl = (env.PUBLIC_URL || '').replace(/\/+$/, '');
  const secureCookie = publicUrl.startsWith('https://');
  const loginLimit = limiter(10);
  const leadLimit = limiter(20);
  const log = opts.log || ((...a) => console.log(new Date().toISOString(), ...a));

  const config = () => ({
    plans: JSON.parse(readFileSync(join(root, 'config/plans.json'), 'utf8')),
    models: JSON.parse(readFileSync(join(root, 'config/models.json'), 'utf8')).models,
  });

  // ---------- auth ----------
  const sign = (v) => createHmac('sha256', secret).update(v).digest('base64url');
  const SESSION_HOURS = 12;
  function makeSession() {
    const exp = Date.now() + SESSION_HOURS * 3600_000;
    const v = `${exp}.${randomBytes(9).toString('base64url')}`;
    return `${v}.${sign(v)}`;
  }
  function isAdmin(req) {
    const m = /(?:^|;\s*)cozy_admin=([^;]+)/.exec(req.headers.cookie || '');
    if (!m) return false;
    const parts = m[1].split('.');
    if (parts.length !== 3) return false;
    const v = `${parts[0]}.${parts[1]}`;
    const a = Buffer.from(sign(v));
    const b = Buffer.from(parts[2]);
    return a.length === b.length && timingSafeEqual(a, b) && Number(parts[0]) > Date.now();
  }
  const cookie = (val, maxAge) => `cozy_admin=${val}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
  function passwordOk(given) {
    if (!adminPassword) return false;
    const a = createHmac('sha256', secret).update(String(given)).digest();
    const b = createHmac('sha256', secret).update(adminPassword).digest();
    return timingSafeEqual(a, b);
  }

  const webhookSig = (jobId) => sign(`hook:${jobId}`).slice(0, 32);
  const leadSig = (leadId) => sign(`lead:${leadId}`).slice(0, 32);

  // ---------- credits ----------
  async function charge(customerId, delta, reason, ref = {}) {
    if (!customerId || !delta) return null;
    const c = await store.update('customers', customerId, (r) => ({ credits: (r.credits || 0) + delta }));
    if (!c) throw new HttpError(404, 'Customer not found');
    await store.insert('ledger', { id: newId('led'), customerId, delta, reason, ...ref, balance: c.credits, at: new Date().toISOString() });
    return c;
  }

  // ---------- jobs ----------
  async function refreshJob(id) {
    const job = store.get('jobs', id);
    if (!job || !job.requestId || TERMINAL.has(job.status)) return job;
    const data = await hf.status(job.requestId);
    const status = String(data.status || job.status);
    const patch = { status, result: data, media: mediaUrls(data) };
    if (REFUNDABLE.has(status) && job.customerId && job.credits && !job.refunded) {
      patch.refunded = true;
      await charge(job.customerId, job.credits, `refund: ${status}`, { jobId: job.id });
    }
    if (status !== job.status) log('job', id, job.status, '->', status);
    return store.update('jobs', id, patch);
  }

  let polling = false;
  async function pollOnce() {
    if (polling || !hf.configured) return;
    polling = true;
    try {
      for (const j of store.all('jobs').filter((j) => j.requestId && !TERMINAL.has(j.status))) {
        try {
          await refreshJob(j.id);
        } catch (e) {
          log('poll error', j.id, e.message);
        }
      }
    } finally {
      polling = false;
    }
  }
  const pollTimer = opts.pollMs === 0 ? null : setInterval(pollOnce, opts.pollMs || 15_000);
  pollTimer?.unref?.();

  // ---------- agent ----------
  async function syncAgent(id) {
    const s = store.get('agent_sessions', id);
    if (!s) throw new HttpError(404, 'Session not found');
    const data = await hf.agentMessages(s.hfSessionId);
    const messages = (data.messages || []).map((m) => ({
      id: m.message_id,
      role: m.role,
      status: m.status,
      text: agentText(m),
      createdAt: m.created_at || '',
      hidden: m.message_id === s.briefMessageId,
    }));
    // charge once per delivered video, the moment a turn completes with it
    const charged = new Set(s.chargedMessages || []);
    const { agent: agentCfg = {} } = config().plans;
    let extra = 0;
    for (const m of messages) {
      if (m.role !== 'assistant' || m.status !== 'completed' || charged.has(m.id)) continue;
      charged.add(m.id);
      const vids = deliveredVideos(m.text).length;
      const cost = vids * (agentCfg.creditsPerAsset ?? 1) + (agentCfg.creditsPerTurn ?? 0);
      if (cost && s.customerId) {
        await charge(s.customerId, -cost, `Cozy Agent: ${vids} video${vids === 1 ? '' : 's'}`, { agentSessionId: s.id, messageId: m.id });
        extra += cost;
      }
    }
    return store.update('agent_sessions', id, { status: data.status || s.status, messages, chargedMessages: [...charged], creditsUsed: (s.creditsUsed || 0) + extra });
  }

  // ---------- routing ----------
  const routes = [];
  const route = (method, pattern, handler, { admin = false } = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    routes.push({ method, re, keys, handler, admin });
  };

  route('GET', '/healthz', (req, res) => json(res, 200, { ok: true }));

  route('GET', '/api/plans', (req, res) => {
    const { plans } = config();
    json(res, 200, { currency: plans.currency, plans: plans.plans, packs: plans.packs }, { 'Cache-Control': 'public, max-age=60' });
  });

  // public intake: a business leaves its details and drops in its assets
  route('POST', '/api/leads', async (req, res, p, ip) => {
    if (!leadLimit(ip)) throw new HttpError(429, 'Too many requests, try again in a minute.');
    const b = await readJson(req, 20_000);
    if (str(b.company_site)) return json(res, 200, { id: 'ok' }); // honeypot
    const lead = {
      id: newId('lead'),
      name: str(b.name, 120),
      email: str(b.email, 200),
      business: str(b.business, 200),
      website: str(b.website, 300),
      plan: str(b.plan, 40),
      message: str(b.message, 4000),
      files: [],
      createdAt: new Date().toISOString(),
    };
    if (!lead.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) throw new HttpError(400, 'Name and a valid email are required.');
    await store.insert('leads', lead);
    log('lead', lead.id, lead.business || lead.name);
    json(res, 201, { id: lead.id, uploadToken: leadSig(lead.id) });
  });

  route('PUT', '/api/leads/:id/files', async (req, res, p, ip) => {
    if (!leadLimit(ip)) throw new HttpError(429, 'Too many uploads, try again in a minute.');
    const url = new URL(req.url, 'http://x');
    const lead = store.get('leads', p.id);
    if (!lead || url.searchParams.get('t') !== leadSig(p.id)) throw new HttpError(403, 'Invalid upload link');
    if ((lead.files || []).length >= 12) throw new HttpError(400, 'Up to 12 files per project.');
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!UPLOAD_TYPES.has(type)) throw new HttpError(415, 'Images, short videos and PDFs only.');
    const original = str(url.searchParams.get('name') || 'file', 120).split(/[\\/]/).pop().replace(/[^\w.\- ]+/g, '_').replace(/\.{2,}/g, '.').replace(/^[.\s]+/, '') || 'file';
    const name = `${Date.now().toString(36)}-${original.replace(/\.[^.]*$/, '')}.${EXT[type]}`.replace(/\s+/g, '-');
    const dir = join(uploadsDir, lead.id);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, name);
    let size = 0;
    const LIMIT = 200 * 1024 * 1024;
    try {
      await pipeline(
        req,
        new Transform({
          transform(chunk, _e, cb) {
            size += chunk.length;
            cb(size > LIMIT ? new HttpError(413, 'Files up to 200 MB.') : null, chunk);
          },
        }),
        createWriteStream(dest)
      );
    } catch (e) {
      try { unlinkSync(dest); } catch {}
      throw e instanceof HttpError ? e : new HttpError(400, 'Upload interrupted');
    }
    await store.update('leads', lead.id, (r) => ({ files: [...(r.files || []), { name, type, size, original }] }));
    json(res, 201, { name, size });
  });

  // HF calls this when a generation finishes; we never trust the body, we re-read the status.
  route('POST', '/api/hf/webhook/:id', async (req, res, p) => {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('t') !== webhookSig(p.id)) throw new HttpError(403, 'Bad signature');
    await readRaw(req, 2_000_000).catch(() => null);
    await refreshJob(p.id).catch((e) => log('webhook refresh failed', p.id, e.message));
    json(res, 200, { ok: true });
  });

  // ----- admin -----
  route('POST', '/api/admin/login', async (req, res, p, ip) => {
    if (!loginLimit(ip)) throw new HttpError(429, 'Too many attempts, wait a minute.');
    const b = await readJson(req, 10_000);
    if (!passwordOk(b.password || '')) throw new HttpError(401, adminPassword ? 'Wrong password' : 'ADMIN_PASSWORD is not set on the server.');
    json(res, 200, { ok: true }, { 'Set-Cookie': cookie(makeSession(), SESSION_HOURS * 3600) });
  });
  route('POST', '/api/admin/logout', (req, res) => json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) }));

  route('GET', '/api/admin/me', (req, res) => {
    const { plans, models } = config();
    json(res, 200, { ok: true, hfConfigured: hf.configured, hfBase: hf.base, webhooks: Boolean(publicUrl), plans, models });
  }, { admin: true });

  route('GET', '/api/admin/overview', (req, res) => {
    const jobs = store.all('jobs');
    const customers = store.all('customers');
    const plans = config().plans.plans;
    const mrr = customers.reduce((s, c) => s + (plans.find((p) => p.id === c.plan)?.price || 0), 0);
    json(res, 200, {
      customers: customers.length,
      mrr,
      jobs: jobs.length,
      running: jobs.filter((j) => j.requestId && !TERMINAL.has(j.status)).length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      leads: store.all('leads').length,
      agentSessions: store.all('agent_sessions').length,
    });
  }, { admin: true });

  route('GET', '/api/admin/customers', (req, res) => json(res, 200, { customers: [...store.all('customers')].reverse() }), { admin: true });
  route('POST', '/api/admin/customers', async (req, res) => {
    const b = await readJson(req);
    const plans = config().plans.plans;
    const plan = plans.find((p) => p.id === b.plan) || null;
    const c = {
      id: newId('cus'),
      name: str(b.name, 120),
      email: str(b.email, 200),
      business: str(b.business, 200),
      plan: plan ? plan.id : '',
      credits: 0,
      brand: cleanBrand(b.brand),
      createdAt: new Date().toISOString(),
    };
    if (!c.name && !c.business) throw new HttpError(400, 'Give the customer a name or business.');
    await store.insert('customers', c);
    if (plan) await charge(c.id, plan.credits, `${plan.name} plan: monthly credits`);
    json(res, 201, { customer: store.get('customers', c.id) });
  }, { admin: true });
  route('PATCH', '/api/admin/customers/:id', async (req, res, p) => {
    const b = await readJson(req);
    const patch = {};
    for (const k of ['name', 'email', 'business', 'plan']) if (k in b) patch[k] = str(b[k], 200);
    if ('brand' in b) patch.brand = cleanBrand(b.brand);
    const c = await store.update('customers', p.id, patch);
    if (!c) throw new HttpError(404, 'Customer not found');
    json(res, 200, { customer: c });
  }, { admin: true });
  route('POST', '/api/admin/customers/:id/credits', async (req, res, p) => {
    const b = await readJson(req);
    const delta = Math.trunc(Number(b.delta));
    if (!Number.isFinite(delta) || !delta || Math.abs(delta) > 10_000) throw new HttpError(400, 'delta must be a non-zero whole number');
    const c = await charge(p.id, delta, str(b.reason, 200) || 'manual adjustment');
    json(res, 200, { customer: c });
  }, { admin: true });
  route('GET', '/api/admin/ledger', (req, res) => {
    const id = new URL(req.url, 'http://x').searchParams.get('customerId');
    const rows = store.all('ledger').filter((r) => !id || r.customerId === id);
    json(res, 200, { ledger: rows.slice(-500).reverse() });
  }, { admin: true });

  route('GET', '/api/admin/jobs', (req, res) => json(res, 200, { jobs: [...store.all('jobs')].reverse().slice(0, 300) }), { admin: true });
  route('POST', '/api/admin/jobs', async (req, res) => {
    const b = await readJson(req);
    const model = str(b.model, 200);
    const args = b.arguments && typeof b.arguments === 'object' && !Array.isArray(b.arguments) ? b.arguments : null;
    if (!model || !args) throw new HttpError(400, 'model and arguments are required');
    const known = config().models.find((m) => m.id === model);
    const credits = Number.isFinite(Number(b.credits)) ? Math.max(0, Math.trunc(Number(b.credits))) : known?.credits ?? 1;
    const customerId = str(b.customerId, 60) || null;
    const customer = customerId ? store.get('customers', customerId) : null;
    if (customerId && !customer) throw new HttpError(404, 'Customer not found');
    if (customer && credits > (customer.credits || 0) && !b.allowNegative) throw new HttpError(402, `${customer.name || customer.business} has ${customer.credits} credits; this costs ${credits}.`);
    const job = { id: newId('job'), model, arguments: args, customerId, credits: customer ? credits : 0, status: 'submitting', label: str(b.label, 200), createdAt: new Date().toISOString() };
    await store.insert('jobs', job);
    if (customer && credits) await charge(customer.id, -credits, `generation: ${model}`, { jobId: job.id });
    try {
      const webhookUrl = publicUrl ? `${publicUrl}/api/hf/webhook/${job.id}?t=${webhookSig(job.id)}` : undefined;
      const r = await hf.submit(model, args, { webhookUrl });
      const saved = await store.update('jobs', job.id, { requestId: r.request_id, status: r.status || 'queued', statusUrl: r.status_url, cancelUrl: r.cancel_url });
      log('job', job.id, 'submitted', model, r.request_id);
      json(res, 201, { job: saved });
    } catch (e) {
      await store.update('jobs', job.id, { status: 'failed', error: e.message, refunded: Boolean(customer && credits) });
      if (customer && credits) await charge(customer.id, credits, 'refund: submit failed', { jobId: job.id });
      throw e;
    }
  }, { admin: true });
  route('POST', '/api/admin/jobs/:id/refresh', async (req, res, p) => {
    const j = await refreshJob(p.id);
    if (!j) throw new HttpError(404, 'Job not found');
    json(res, 200, { job: j });
  }, { admin: true });
  route('POST', '/api/admin/jobs/:id/cancel', async (req, res, p) => {
    const j = store.get('jobs', p.id);
    if (!j) throw new HttpError(404, 'Job not found');
    await hf.cancel(j.requestId);
    json(res, 200, { job: await refreshJob(p.id) });
  }, { admin: true });

  // push a file to Higgsfield storage and get back a URL models can read
  route('POST', '/api/admin/upload', async (req, res) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!UPLOAD_TYPES.has(type)) throw new HttpError(415, 'Unsupported file type');
    const bytes = await readRaw(req, 200 * 1024 * 1024);
    json(res, 201, { url: await hf.upload(bytes, type) });
  }, { admin: true });

  route('GET', '/api/admin/leads', (req, res) => json(res, 200, { leads: [...store.all('leads')].reverse() }), { admin: true });
  route('GET', '/api/admin/leads/:id/files/:name', async (req, res, p) => {
    const file = safeJoin(join(uploadsDir, p.id), '/' + basename(decodeURIComponent(p.name)));
    if (!file || !(await serveFile(req, res, file, { cache: 'private, max-age=60' }))) throw new HttpError(404, 'File not found');
  }, { admin: true });
  route('POST', '/api/admin/leads/:id/files/:name/push', async (req, res, p) => {
    const lead = store.get('leads', p.id);
    const f = lead?.files?.find((x) => x.name === decodeURIComponent(p.name));
    if (!f) throw new HttpError(404, 'File not found');
    const url = await hf.upload(await readFile(join(uploadsDir, lead.id, f.name)), f.type);
    await store.update('leads', lead.id, (r) => ({ files: r.files.map((x) => (x.name === f.name ? { ...x, hfUrl: url } : x)) }));
    json(res, 200, { url });
  }, { admin: true });
  route('POST', '/api/admin/leads/:id/convert', async (req, res, p) => {
    const lead = store.get('leads', p.id);
    if (!lead) throw new HttpError(404, 'Lead not found');
    const plan = config().plans.plans.find((x) => x.id === lead.plan);
    const c = { id: newId('cus'), name: lead.name, email: lead.email, business: lead.business, plan: plan?.id || '', credits: 0, brand: cleanBrand({ about: lead.message, assets: (lead.files || []).map((f) => f.hfUrl).filter(Boolean) }), leadId: lead.id, createdAt: new Date().toISOString() };
    await store.insert('customers', c);
    if (plan) await charge(c.id, plan.credits, `${plan.name} plan: monthly credits`);
    await store.update('leads', lead.id, { customerId: c.id });
    json(res, 201, { customer: store.get('customers', c.id) });
  }, { admin: true });

  route('GET', '/api/admin/agent/sessions', (req, res) => json(res, 200, { sessions: [...store.all('agent_sessions')].reverse().map(({ messages, ...s }) => ({ ...s, count: messages?.length || 0 })) }), { admin: true });
  route('POST', '/api/admin/agent/sessions', async (req, res) => {
    const b = await readJson(req);
    const customer = b.customerId ? store.get('customers', b.customerId) : null;
    if (b.customerId && !customer) throw new HttpError(404, 'Customer not found');
    const created = await hf.agentCreate({});
    const briefId = await hf.agentSend(created.session_id, cozyBrief(customer || {}));
    const s = { id: newId('agt'), hfSessionId: created.session_id, customerId: customer?.id || null, title: str(b.title, 120) || `Cozy Agent · ${customer?.business || customer?.name || 'internal'}`, status: 'processing', briefMessageId: briefId.message_id, messages: [], chargedMessages: [], creditsUsed: 0, createdAt: new Date().toISOString() };
    await store.insert('agent_sessions', s);
    json(res, 201, { session: s });
  }, { admin: true });
  route('GET', '/api/admin/agent/sessions/:id', async (req, res, p) => {
    const s = store.get('agent_sessions', p.id);
    if (!s) throw new HttpError(404, 'Session not found');
    json(res, 200, { session: s });
  }, { admin: true });
  route('POST', '/api/admin/agent/sessions/:id/sync', async (req, res, p) => json(res, 200, { session: await syncAgent(p.id) }), { admin: true });
  route('POST', '/api/admin/agent/sessions/:id/messages', async (req, res, p) => {
    const s = store.get('agent_sessions', p.id);
    if (!s) throw new HttpError(404, 'Session not found');
    const b = await readJson(req);
    const content = str(b.content, 8000);
    if (!content) throw new HttpError(400, 'Say something to the agent first.');
    if (s.customerId) {
      const c = store.get('customers', s.customerId);
      if (c && (c.credits || 0) <= 0 && !b.allowNegative) throw new HttpError(402, `${c.business || c.name} is out of credits.`);
    }
    await hf.agentSend(s.hfSessionId, content);
    json(res, 202, { session: await syncAgent(p.id) });
  }, { admin: true });
  route('POST', '/api/admin/agent/sessions/:id/interrupt', async (req, res, p) => {
    const s = store.get('agent_sessions', p.id);
    if (!s) throw new HttpError(404, 'Session not found');
    await hf.agentInterrupt(s.hfSessionId);
    json(res, 200, { session: await syncAgent(p.id) });
  }, { admin: true });
  route('POST', '/api/admin/agent/media', async (req, res) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!UPLOAD_TYPES.has(type)) throw new HttpError(415, 'Unsupported file type');
    const bytes = await readRaw(req, 200 * 1024 * 1024);
    const kind = type.startsWith('video/') ? 'video' : type.startsWith('image/') ? 'image' : 'file';
    json(res, 201, { url: await hf.agentUpload(bytes, EXT[type], kind) });
  }, { admin: true });

  // ---------- request handler ----------
  async function handle(req, res) {
    const ip = req.socket.remoteAddress || '?';
    const path = new URL(req.url, 'http://x').pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    try {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        if (r.admin) {
          if (!isAdmin(req)) throw new HttpError(401, 'Sign in first');
          // SameSite=Strict blocks cross-site cookies; this header blocks simple-form CSRF too
          if (req.method !== 'GET' && req.headers['x-cozy'] !== '1') throw new HttpError(403, 'Missing x-cozy header');
        }
        const params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
        return await r.handler(req, res, params, ip);
      }
      if (path.startsWith('/api/')) throw new HttpError(404, 'Not found');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
      if (path.startsWith('/admin')) {
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
      }
      const file = safeJoin(publicDir, path === '/' ? '/index.html' : path);
      if (file && (await serveFile(req, res, file, { cache: /\/(vendor|fonts|media|brand)\//.test(path) ? 'public, max-age=604800' : 'public, max-age=300' }))) return;
      if (!(await serveFile(req, res, join(publicDir, '404.html'), { status: 404 }).catch(() => false))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      }
    } catch (e) {
      const status = e instanceof HttpError ? e.status : e instanceof HiggsfieldError ? (e.status >= 400 && e.status < 600 ? (e.status === 401 ? 502 : e.status) : 502) : 500;
      const message = e instanceof HttpError || e instanceof HiggsfieldError ? e.message : 'Server error';
      if (status >= 500) log('error', req.method, path, e.stack || e.message);
      if (!res.headersSent) json(res, status, { error: message, ...(e instanceof HiggsfieldError ? { source: 'higgsfield', upstreamStatus: e.status } : {}) });
      else res.destroy();
    }
  }

  handle.store = store;
  handle.pollOnce = pollOnce;
  handle.close = () => pollTimer && clearInterval(pollTimer);
  handle.webhookSig = webhookSig;
  return handle;
}

function cleanBrand(b) {
  if (!b || typeof b !== 'object') return {};
  const out = {};
  for (const k of ['about', 'audience', 'voice', 'colors', 'avoid']) if (b[k]) out[k] = str(b[k], 2000);
  if (Array.isArray(b.assets)) out.assets = b.assets.map((a) => str(a, 1000)).filter((a) => /^https?:\/\//.test(a)).slice(0, 20);
  return out;
}

// convenience for the admin: list what's on disk for a lead (used by tests)
export function leadFiles(dataDir, leadId) {
  try {
    return readdirSync(join(dataDir, 'uploads', leadId)).map((n) => ({ name: n, size: statSync(join(dataDir, 'uploads', leadId, n)).size }));
  } catch {
    return [];
  }
}
