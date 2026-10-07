// A local stand-in for the Higgsfield API with the same routes and shapes
// the server uses, so the admin panel can be exercised without real keys
// or spending credits.  Run: HF_BASE_URL=http://localhost:8787 HF_KEY=mock:mock npm start
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export function createMock({ stepsToFinish = 2, requireKey = 'mock:mock' } = {}) {
  const requests = new Map();
  const sessions = new Map();
  const uploads = new Map();
  const calls = [];
  let base = '';

  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const body = async (req) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const s = Buffer.concat(chunks);
    try {
      return JSON.parse(s.toString() || '{}');
    } catch {
      return s;
    }
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    calls.push({ method: req.method, path: p, query: Object.fromEntries(url.searchParams) });
    if (p.startsWith('/upload/')) {
      uploads.set(p.slice(8), await body(req));
      return send(res, 200, {});
    }
    if (req.headers.authorization !== `Key ${requireKey}`) return send(res, 401, { detail: 'Invalid credentials' });

    if (req.method === 'POST' && p === '/files/generate-upload-url') {
      const b = await body(req);
      const id = randomUUID();
      return send(res, 200, { public_url: `${base}/cdn/${id}`, upload_url: `${base}/upload/${id}`, upload_headers: { 'Content-Type': b.content_type } });
    }
    let m;
    if ((m = /^\/requests\/([^/]+)\/status$/.exec(p)) && req.method === 'GET') {
      const r = requests.get(m[1]);
      if (!r) return send(res, 404, { detail: 'not found' });
      if (r.status !== 'canceled') {
        r.polls++;
        r.status = r.polls >= stepsToFinish ? (r.args.prompt === 'FAIL' ? 'failed' : 'completed') : 'in_progress';
      }
      const out = { status: r.status, request_id: r.id };
      if (r.status === 'completed') {
        if (r.model.includes('image')) out.images = [{ url: `${base}/cdn/${r.id}.png` }];
        else out.video = { url: `${base}/cdn/${r.id}.mp4` };
      }
      return send(res, 200, out);
    }
    if ((m = /^\/requests\/([^/]+)\/cancel$/.exec(p)) && req.method === 'POST') {
      const r = requests.get(m[1]);
      if (!r) return send(res, 404, { detail: 'not found' });
      if (r.polls > 0) return send(res, 400, { detail: 'already processing' });
      r.status = 'canceled';
      return send(res, 200, {});
    }
    // agent API
    if (req.method === 'POST' && p === '/v1/agent/sessions') {
      const id = randomUUID();
      sessions.set(id, { id, status: 'idle', messages: [] });
      return send(res, 200, { session_id: id, status: 'idle' });
    }
    if ((m = /^\/v1\/agent\/sessions\/([^/]+)\/messages$/.exec(p))) {
      const s = sessions.get(m[1]);
      if (!s) return send(res, 404, { detail: 'no session' });
      if (req.method === 'POST') {
        const b = await body(req);
        const uid = randomUUID();
        s.messages.push({ message_id: uid, role: 'user', status: 'completed', message: { type: 'text', text: b.content }, created_at: new Date().toISOString() });
        const isBrief = /You are the Cozy Agent/.test(b.content);
        const text = isBrief ? 'Ready.' : `Here is your cut.\n${base}/cdn/${uid}-vertical.mp4\n${base}/cdn/${uid}-wide.mp4\nNext: try a 3-second hook variant.`;
        s.messages.push({ message_id: randomUUID(), role: 'assistant', status: 'completed', message: { parts: [{ type: 'text', text }] }, created_at: new Date().toISOString() });
        return send(res, 200, { message_id: uid });
      }
      const after = url.searchParams.get('after');
      const i = after ? s.messages.findIndex((x) => x.message_id === after) : -1;
      return send(res, 200, { status: 'idle', messages: s.messages.slice(i + 1) });
    }
    if ((m = /^\/v1\/agent\/sessions\/([^/]+)\/interrupt$/.exec(p))) return send(res, 200, {});
    if (req.method === 'POST' && p === '/v1/agent/media') {
      const b = await body(req);
      const id = randomUUID();
      return send(res, 200, { id, upload_url: `${base}/upload/${id}`, content_type: b.type === 'image' ? 'image/jpeg' : 'application/octet-stream', url: `${base}/cdn/${id}.${b.extension}` });
    }
    if ((m = /^\/v1\/agent\/media\/([^/]+)\/confirm$/.exec(p))) return send(res, 200, { status: uploads.has(m[1]) ? 'uploaded' : 'pending' });
    // any other POST is a model submit: /{vendor}/{model}/...
    if (req.method === 'POST' && p.split('/').length >= 3) {
      const args = await body(req);
      const id = randomUUID();
      requests.set(id, { id, model: p.slice(1), args, status: 'queued', polls: 0, webhook: url.searchParams.get('hf_webhook') });
      return send(res, 200, { request_id: id, status: 'queued', status_url: `${base}/requests/${id}/status`, cancel_url: `${base}/requests/${id}/cancel` });
    }
    send(res, 404, { detail: 'unknown route' });
  });

  return {
    server,
    requests,
    sessions,
    uploads,
    calls,
    listen(port = 0) {
      return new Promise((r) => server.listen(port, '127.0.0.1', () => ((base = `http://127.0.0.1:${server.address().port}`), r(base))));
    },
    close() {
      return new Promise((r) => server.close(r));
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mock = createMock();
  const base = await mock.listen(Number(process.env.PORT) || 8787);
  console.log(`mock Higgsfield on ${base}  (HF_KEY=mock:mock HF_BASE_URL=${base})`);
}
