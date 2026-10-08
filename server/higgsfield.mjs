// Thin client for the Higgsfield platform API, mirroring the official SDK
// (pypi: higgsfield-client 0.2.0):
//   POST {base}/{model_id}[?hf_webhook=url]   body = model arguments
//        -> { request_id, status_url, cancel_url }
//   GET  {base}/requests/{id}/status          -> { status, ...result }
//        status: queued | in_progress | completed | failed | nsfw | canceled
//   POST {base}/requests/{id}/cancel          (only before processing starts)
//   POST {base}/files/generate-upload-url     { content_type } -> { public_url, upload_url, upload_headers? }
//   Agent API under {base}/v1/agent: sessions, messages, interrupt, media.
// Auth is one header: "Authorization: Key <key_id>:<key_secret>".
// Credentials come from the environment only and never leave the server.

export const TERMINAL = new Set(['completed', 'failed', 'nsfw', 'canceled']);
export const REFUNDABLE = new Set(['failed', 'nsfw', 'canceled']);

export class HiggsfieldError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function credentialFromEnv(env = process.env) {
  if (env.HF_KEY) return env.HF_KEY;
  if (env.HF_API_KEY && env.HF_API_SECRET) return `${env.HF_API_KEY}:${env.HF_API_SECRET}`;
  return null;
}

export class Higgsfield {
  constructor({ key, baseUrl = 'https://api.higgsfield.ai', fetchImpl = fetch, timeoutMs = 60_000 } = {}) {
    this.key = key;
    this.base = baseUrl.replace(/\/+$/, '');
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  get configured() {
    return Boolean(this.key);
  }

  async call(method, path, body, { auth = true } = {}) {
    if (auth && !this.key) throw new HiggsfieldError('Higgsfield credentials are not configured (set HF_KEY or HF_API_KEY + HF_API_SECRET).', 503);
    const url = path.startsWith('http') ? path : `${this.base}${path}`;
    const res = await this.fetch(url, {
      method,
      headers: {
        ...(auth ? { Authorization: `Key ${this.key}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        'User-Agent': 'cozy-hub/2.0',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = (data && (data.detail || data.details || data.message || data.error)) || text || res.statusText;
      throw new HiggsfieldError(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status, data);
    }
    return data;
  }

  // ---- generations ----
  submit(model, args, { webhookUrl } = {}) {
    if (!/^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)+$/i.test(model)) {
      throw new HiggsfieldError(`Not a model id: ${model}`, 400);
    }
    const q = webhookUrl ? `?${new URLSearchParams({ hf_webhook: webhookUrl })}` : '';
    return this.call('POST', `/${model}${q}`, args);
  }

  status(requestId) {
    return this.call('GET', `/requests/${encodeURIComponent(requestId)}/status`);
  }

  cancel(requestId) {
    return this.call('POST', `/requests/${encodeURIComponent(requestId)}/cancel`);
  }

  async upload(bytes, contentType) {
    const slot = await this.call('POST', '/files/generate-upload-url', { content_type: contentType });
    const put = await this.fetch(slot.upload_url, {
      method: 'PUT',
      headers: slot.upload_headers || { 'Content-Type': contentType },
      body: bytes,
      signal: AbortSignal.timeout(this.timeoutMs * 3),
    });
    if (!put.ok) throw new HiggsfieldError(`Upload failed (${put.status})`, put.status);
    return slot.public_url;
  }

  // ---- agent API ----
  agentCreate(config = {}) {
    return this.call('POST', '/v1/agent/sessions', { config });
  }

  agentSend(sessionId, content) {
    return this.call('POST', `/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`, { content });
  }

  agentMessages(sessionId, after) {
    const q = after ? `?${new URLSearchParams({ after })}` : '';
    return this.call('GET', `/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages${q}`);
  }

  agentInterrupt(sessionId) {
    return this.call('POST', `/v1/agent/sessions/${encodeURIComponent(sessionId)}/interrupt`);
  }

  async agentUpload(bytes, extension, type = 'image') {
    const slot = await this.call('POST', '/v1/agent/media', { extension, type });
    const put = await this.fetch(slot.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': slot.content_type },
      body: bytes,
      signal: AbortSignal.timeout(this.timeoutMs * 3),
    });
    if (!put.ok) throw new HiggsfieldError(`Agent media upload failed (${put.status})`, put.status);
    const confirm = await this.call('POST', `/v1/agent/media/${encodeURIComponent(slot.id)}/confirm`, { type });
    if (!confirm || confirm.status !== 'uploaded') throw new HiggsfieldError('Agent media upload was not confirmed', 502);
    return slot.url;
  }
}

/** Every media URL in a result payload, whatever shape the model returns. */
export function mediaUrls(payload) {
  const out = new Set();
  const walk = (v, key = '') => {
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v) && (/\.(mp4|webm|mov|png|jpe?g|webp|gif)(\?|$)/i.test(v) || /^(url|video_url|image_url|raw)$/.test(key))) out.add(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!/status_url|cancel_url/.test(k)) walk(x, k);
  };
  walk(payload);
  return [...out];
}

/** Plain text of an agent transcript row (user rows: {text}; assistant: {parts:[{type:'text',text}]}). */
export function agentText(message) {
  const body = message && message.message;
  if (!body || typeof body !== 'object') return typeof body === 'string' ? body : '';
  if (typeof body.text === 'string') return body.text;
  if (Array.isArray(body.parts)) return body.parts.filter((p) => p && p.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n');
  return '';
}
