// Cozy Studio admin. Plain DOM, no framework. Everything user-supplied
// (leads come from the public form) is set with textContent, never innerHTML.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

async function api(method, path, body, headers = {}) {
  const isRaw = body instanceof Blob;
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'x-cozy': '1', ...(body !== undefined && !isRaw ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : isRaw ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/admin/login') showLogin();
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};
const chip = (status) => h('span', { class: `chip ${status || ''}`, text: (status || '').replace('_', ' ') });
const isVideo = (u) => /\.(mp4|webm|mov)(\?|$)/i.test(u);
const isImage = (u) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u);
const media = (u) => (isVideo(u) ? h('video', { src: u, controls: true, playsInline: true, preload: 'metadata', loop: true }) : isImage(u) ? h('img', { src: u, alt: '', loading: 'lazy' }) : h('a', { href: u, target: '_blank', rel: 'noopener', text: u }));

const state = { me: null, customers: [], jobs: [], view: 'overview', session: null };

// ---------- auth ----------
function showLogin() {
  $('#shell').hidden = true;
  $('#login').hidden = false;
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('POST', '/api/admin/login', { password: e.target.password.value });
    e.target.reset();
    await boot();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});
$('#logout').addEventListener('click', async () => {
  await api('POST', '/api/admin/logout').catch(() => {});
  showLogin();
});

// ---------- navigation ----------
function go(view) {
  state.view = view;
  $$('#nav button').forEach((b) => (b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== view));
  history.replaceState(null, '', `#${view}`);
  ({ overview: loadOverview, jobs: loadJobs, customers: loadCustomers, leads: loadLeads, agent: loadAgent, pricing: renderPricing, generate: refreshCustomerSelects })[view]?.();
}
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) go(b.dataset.view);
});

async function boot() {
  try {
    state.me = await api('GET', '/api/admin/me');
  } catch {
    return showLogin();
  }
  $('#login').hidden = true;
  $('#shell').hidden = false;
  const hf = $('#hf-state');
  hf.className = `hf-state${state.me.hfConfigured ? ' on' : ''}`;
  hf.replaceChildren(h('i'), h('span', { text: state.me.hfConfigured ? `Higgsfield connected${state.me.webhooks ? ' · webhooks on' : ' · polling'}` : 'Higgsfield key missing. Set HF_KEY on the server.' }));
  setupGenerate();
  await loadCustomers(false);
  go(location.hash.slice(1) || 'overview');
}

// ---------- overview ----------
async function loadOverview() {
  const [o, { jobs }, { leads }] = await Promise.all([api('GET', '/api/admin/overview'), api('GET', '/api/admin/jobs'), api('GET', '/api/admin/leads')]);
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: state.me.plans.currency || 'USD', maximumFractionDigits: 0 });
  $('#stats').replaceChildren(
    ...[
      [money.format(o.mrr), 'monthly recurring (plans)'],
      [o.customers, 'customers'],
      [o.running, 'generating now'],
      [o.completed, 'videos delivered'],
      [o.leads, 'leads'],
      [o.agentSessions, 'agent sessions'],
    ].map(([b, s]) => h('div', { class: 'stat' }, h('b', { text: b }), h('span', { text: s })))
  );
  $('#ov-jobs').replaceChildren(...(jobs.slice(0, 6).map((j) => h('div', { class: 'item' }, chip(j.status), h('span', { class: 't', text: j.arguments?.prompt || j.model }), h('small', { text: ago(j.createdAt) })))), ...(jobs.length ? [] : [h('div', { class: 'empty', text: 'No generations yet.' })]));
  $('#ov-leads').replaceChildren(...(leads.slice(0, 6).map((l) => h('div', { class: 'item' }, h('span', { class: 't', text: `${l.business || l.name} · ${l.email}` }), h('small', { text: ago(l.createdAt) })))), ...(leads.length ? [] : [h('div', { class: 'empty', text: 'No leads yet.' })]));
  setBadges(o.running, leads.filter((l) => !l.customerId).length);
}
function setBadges(running, leads) {
  const rb = $('#running-badge');
  rb.hidden = !running;
  rb.textContent = running;
  const lb = $('#leads-badge');
  lb.hidden = !leads;
  lb.textContent = leads;
}

// ---------- generate ----------
let genMode = 'form';
function setupGenerate() {
  const sel = $('#gen-model');
  sel.replaceChildren(...state.me.models.map((m) => h('option', { value: m.id, text: `${m.label}${m.verified ? '' : '  (verify id)'}` })), h('option', { value: '__custom', text: 'Custom model id…' }));
  sel.onchange = () => renderFields();
  $('#gen-custom').oninput = () => syncRaw();
  renderFields();
  $$('.seg button').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.mode === genMode) return;
      if (b.dataset.mode === 'form') {
        try {
          renderFields(JSON.parse($('#gen-raw').value || '{}'));
        } catch {
          return ($('#gen-error').textContent = 'Fix the JSON before switching back.');
        }
      } else syncRaw();
      genMode = b.dataset.mode;
      $$('.seg button').forEach((x) => x.classList.toggle('seg-on', x === b));
      $('#gen-fields').hidden = genMode !== 'form';
      $('#gen-raw-wrap').hidden = genMode !== 'raw';
    })
  );
  const drop = $('#gen-drop');
  $('#gen-pick').onclick = () => $('#gen-file').click();
  $('#gen-file').onchange = (e) => e.target.files[0] && uploadToHF(e.target.files[0]);
  drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('over')));
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files[0]) uploadToHF(e.dataTransfer.files[0]);
  });
  $('#gen-form').addEventListener('submit', submitGeneration);
}

function currentModel() {
  const v = $('#gen-model').value;
  $('#gen-custom-wrap').hidden = v !== '__custom';
  return v === '__custom' ? { id: $('#gen-custom').value.trim(), defaults: { prompt: '' }, credits: 1, custom: true } : state.me.models.find((m) => m.id === v);
}

function renderFields(values) {
  const m = currentModel();
  const note = $('#gen-model-note');
  note.className = `hint${m.verified === false ? ' warn' : ''}`;
  note.textContent = m.custom ? 'Any Higgsfield model id. Use Raw JSON to send exactly the body its docs show.' : m.verified ? `${m.kind} · ${m.credits} credit${m.credits === 1 ? '' : 's'} · ${m.source || ''}` : `Model id not yet verified against a live call (${m.source}). Check it on cloud.higgsfield.ai, then mark verified in config/models.json.`;
  if (!values) $('#gen-credits').value = m.credits ?? 1;
  const v = values || { ...m.defaults };
  const box = $('#gen-fields');
  box.replaceChildren();
  for (const [k, val] of Object.entries(v)) {
    let input;
    if (k === 'prompt') input = h('textarea', { name: k, rows: 4, placeholder: 'What should happen on screen? Camera, light, subject, mood.' });
    else if (typeof val === 'boolean') input = h('select', { name: k }, h('option', { value: 'true', text: 'true' }), h('option', { value: 'false', text: 'false' }));
    else if (k === 'aspect_ratio') input = h('select', { name: k }, ...['16:9', '9:16', '1:1', '4:5', '21:9'].map((a) => h('option', { value: a, text: a })));
    else input = h('input', { name: k, type: typeof val === 'number' ? 'number' : 'text', step: 'any', spellcheck: 'false' });
    input.value = typeof val === 'object' ? JSON.stringify(val) : String(val);
    input.dataset.type = typeof val;
    input.addEventListener('input', syncRaw);
    box.append(h('label', { class: k === 'prompt' || /url/.test(k) ? 'full' : '' }, k, input));
  }
  syncRaw();
}

function readFields() {
  const out = {};
  for (const el of $$('#gen-fields [name]')) {
    const t = el.dataset.type;
    if (t === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
    else if (t === 'boolean') out[el.name] = el.value === 'true';
    else if (t === 'object') {
      try {
        out[el.name] = JSON.parse(el.value);
      } catch {
        out[el.name] = el.value;
      }
    } else out[el.name] = el.value;
  }
  for (const k of Object.keys(out)) if (out[k] === '' || out[k] === null) delete out[k];
  return out;
}
const syncRaw = () => ($('#gen-raw').value = JSON.stringify(readFields(), null, 2));

async function uploadToHF(file) {
  $('#gen-error').textContent = '';
  const drop = $('#gen-drop span');
  const before = drop.textContent;
  drop.textContent = `Uploading ${file.name}…`;
  try {
    const { url } = await api('POST', '/api/admin/upload', file, { 'Content-Type': file.type || 'application/octet-stream' });
    const field = $('#gen-fields [name="image_url"]') || $('#gen-fields [name="input_image"]');
    if (field && genMode === 'form') {
      field.value = url;
      syncRaw();
    } else {
      const body = JSON.parse($('#gen-raw').value || '{}');
      body.image_url = url;
      $('#gen-raw').value = JSON.stringify(body, null, 2);
    }
    toast('Uploaded to Higgsfield');
  } catch (e) {
    $('#gen-error').textContent = e.message;
  } finally {
    drop.textContent = before;
    setupDropLink();
  }
}
function setupDropLink() {
  const l = $('#gen-pick');
  if (l) l.onclick = () => $('#gen-file').click();
}

async function submitGeneration(e) {
  e.preventDefault();
  const err = $('#gen-error');
  err.textContent = '';
  const m = currentModel();
  let args;
  try {
    args = genMode === 'raw' ? JSON.parse($('#gen-raw').value) : readFields();
  } catch {
    return (err.textContent = 'Request body is not valid JSON.');
  }
  if (!m.id) return (err.textContent = 'Type a model id.');
  const btn = $('#gen-submit');
  btn.disabled = true;
  try {
    const { job } = await api('POST', '/api/admin/jobs', { model: m.id, arguments: args, customerId: $('#gen-customer').value || null, credits: Number($('#gen-credits').value) });
    toast('Sent to Higgsfield');
    await loadCustomers(false);
    go('jobs');
    highlight(job.id);
  } catch (e2) {
    err.textContent = e2.data?.source === 'higgsfield' ? `Higgsfield said: ${e2.message}` : e2.message;
  } finally {
    btn.disabled = false;
  }
}
function highlight(id) {
  requestAnimationFrame(() => $(`[data-job="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

// ---------- jobs ----------
let jobsTimer;
async function loadJobs() {
  const { jobs } = await api('GET', '/api/admin/jobs');
  state.jobs = jobs;
  const cust = Object.fromEntries(state.customers.map((c) => [c.id, c]));
  const running = jobs.filter((j) => j.requestId && !['completed', 'failed', 'nsfw', 'canceled'].includes(j.status));
  $('#jobs').replaceChildren(
    ...jobs.map((j) => {
      const done = j.status === 'completed' && j.media?.length;
      const live = running.includes(j);
      return h(
        'article',
        { class: 'job', 'data-job': j.id },
        h('div', { class: `job-media${live ? ' running' : ''}` }, done ? media(j.media[0]) : h('span', { text: live ? 'Generating…' : j.status })),
        h('div', { class: 'job-top' }, chip(j.status), h('small', { class: 'muted', text: ago(j.createdAt) })),
        h('div', { class: 'job-model', title: j.model, text: j.model }),
        j.arguments?.prompt ? h('p', { text: j.arguments.prompt }) : null,
        j.error ? h('div', { class: 'job-err', text: j.error }) : null,
        h(
          'div',
          { class: 'job-foot' },
          h('span', { text: j.customerId ? `${cust[j.customerId]?.business || cust[j.customerId]?.name || 'customer'} · ${j.credits} cr${j.refunded ? ' (refunded)' : ''}` : 'internal' }),
          ...(j.media || []).slice(0, 3).map((u, i) => h('a', { href: u, target: '_blank', rel: 'noopener', text: `file ${i + 1}` })),
          live && j.status === 'queued' ? h('button', { class: 'btn btn-quiet btn-sm', text: 'Cancel', onclick: () => api('POST', `/api/admin/jobs/${j.id}/cancel`).then(loadJobs).catch((e) => toast(e.message)) }) : null,
          live ? h('button', { class: 'btn btn-quiet btn-sm', text: 'Check', onclick: () => api('POST', `/api/admin/jobs/${j.id}/refresh`).then(loadJobs).catch((e) => toast(e.message)) }) : null
        )
      );
    }),
    ...(jobs.length ? [] : [h('div', { class: 'empty', text: 'Nothing generated yet. Head to Generate.' })])
  );
  setBadges(running.length, Number($('#leads-badge').textContent || 0));
  clearTimeout(jobsTimer);
  if (running.length && state.view === 'jobs') {
    jobsTimer = setTimeout(async () => {
      await Promise.all(running.map((j) => api('POST', `/api/admin/jobs/${j.id}/refresh`).catch(() => {})));
      if (state.view === 'jobs') loadJobs();
    }, 5000);
  }
}
$('#jobs-refresh').addEventListener('click', loadJobs);

// ---------- customers ----------
async function loadCustomers(render = true) {
  const { customers } = await api('GET', '/api/admin/customers');
  state.customers = customers;
  refreshCustomerSelects();
  const planSel = $('#cus-plan');
  if (planSel.options.length === 1) planSel.append(...state.me.plans.plans.map((p) => h('option', { value: p.id, text: `${p.name} · $${p.price}/${p.interval} · ${p.credits} credits` })));
  if (!render) return;
  const plans = Object.fromEntries(state.me.plans.plans.map((p) => [p.id, p]));
  $('#customers').replaceChildren(
    ...customers.map((c) =>
      h(
        'div',
        { class: 'item' },
        h('div', { class: 't' }, h('div', { text: c.business || c.name }), h('small', { text: [c.name, c.email, plans[c.plan]?.name].filter(Boolean).join(' · ') })),
        h('span', { class: `cus-credits${(c.credits || 0) <= 1 ? ' low' : ''}`, text: `${c.credits || 0} cr` }),
        h('button', {
          class: 'btn btn-quiet btn-sm',
          text: '± credits',
          onclick: async () => {
            const v = prompt(`Add (or subtract with -) credits for ${c.business || c.name}`, String(plans[c.plan]?.credits || 5));
            if (!v) return;
            const reason = prompt('Reason (shows in the ledger)', 'monthly renewal') || 'manual adjustment';
            try {
              await api('POST', `/api/admin/customers/${c.id}/credits`, { delta: Number(v), reason });
              loadCustomers();
            } catch (e) {
              toast(e.message);
            }
          },
        }),
        h('button', { class: 'btn btn-quiet btn-sm', text: 'Agent', onclick: () => (go('agent'), ($('#agent-customer').value = c.id)) })
      )
    ),
    ...(customers.length ? [] : [h('div', { class: 'empty', text: 'No customers yet.' })])
  );
}
function refreshCustomerSelects() {
  for (const id of ['#gen-customer', '#agent-customer']) {
    const sel = $(id);
    const keep = sel.value;
    sel.replaceChildren(sel.options[0], ...state.customers.map((c) => h('option', { value: c.id, text: `${c.business || c.name} · ${c.credits || 0} cr` })));
    sel.value = keep;
  }
}
$('#cus-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  $('#cus-error').textContent = '';
  try {
    await api('POST', '/api/admin/customers', {
      name: f.name.value,
      business: f.business.value,
      email: f.email.value,
      plan: f.plan.value,
      brand: { about: f.about.value, audience: f.audience.value, voice: f.voice.value, colors: f.colors.value, avoid: f.avoid.value, assets: f.assets.value.split('\n').map((s) => s.trim()).filter(Boolean) },
    });
    f.reset();
    toast('Customer added');
    loadCustomers();
  } catch (err) {
    $('#cus-error').textContent = err.message;
  }
});

// ---------- leads ----------
async function loadLeads() {
  const { leads } = await api('GET', '/api/admin/leads');
  setBadges(Number($('#running-badge').textContent || 0), leads.filter((l) => !l.customerId).length);
  $('#leads').replaceChildren(
    ...leads.map((l) =>
      h(
        'article',
        { class: 'lead' },
        h('div', { class: 'lead-top' }, h('b', { text: l.business || l.name }), h('span', { class: 'muted', text: `${l.name} · ` }, h('a', { href: `mailto:${l.email}`, text: l.email })), l.plan ? h('span', { class: 'chip', text: l.plan }) : null, h('small', { class: 'muted', text: ago(l.createdAt) })),
        l.website ? h('a', { href: /^https?:\/\//.test(l.website) ? l.website : `https://${l.website}`, target: '_blank', rel: 'noopener noreferrer', text: l.website }) : null,
        l.message ? h('p', { text: l.message }) : null,
        l.files?.length
          ? h(
              'div',
              { class: 'lead-files' },
              ...l.files.map((f) => {
                const src = `/api/admin/leads/${l.id}/files/${encodeURIComponent(f.name)}`;
                const thumb = f.type.startsWith('image/') && f.type !== 'image/svg+xml' ? h('img', { src, alt: '', loading: 'lazy' }) : f.type.startsWith('video/') ? h('video', { src, muted: true, preload: 'metadata' }) : h('span', { text: f.type.split('/')[1] });
                return h(
                  'div',
                  { class: 'lead-file' },
                  h('a', { class: 'thumb', href: src, target: '_blank' }, thumb),
                  h('span', { title: f.original, text: f.original }),
                  f.hfUrl
                    ? h('button', { class: 'btn btn-quiet btn-sm', text: 'Copy HF URL', onclick: () => navigator.clipboard.writeText(f.hfUrl).then(() => toast('Copied')) })
                    : h('button', { class: 'btn btn-quiet btn-sm', text: 'Send to Higgsfield', onclick: () => api('POST', `/api/admin/leads/${l.id}/files/${encodeURIComponent(f.name)}/push`).then(() => (toast('Uploaded'), loadLeads())).catch((e) => toast(e.message)) })
                );
              })
            )
          : null,
        h('div', { class: 'actions' }, l.customerId ? h('span', { class: 'muted', text: 'Customer created ✓' }) : h('button', { class: 'btn btn-primary btn-sm', text: 'Make customer', onclick: () => api('POST', `/api/admin/leads/${l.id}/convert`).then(() => (toast('Customer created'), loadLeads(), loadCustomers(false))).catch((e) => toast(e.message)) }))
      )
    ),
    ...(leads.length ? [] : [h('div', { class: 'empty', text: 'No leads yet. They arrive from the form at the bottom of the landing page.' })])
  );
}

// ---------- Cozy Agent ----------
let agentTimer;
async function loadAgent() {
  refreshCustomerSelects();
  const { sessions } = await api('GET', '/api/admin/agent/sessions');
  $('#agent-sessions').replaceChildren(
    ...sessions.map((s) => h('button', { class: 'item', 'aria-current': state.session?.id === s.id ? 'true' : null, onclick: () => openSession(s.id) }, h('span', { class: 't', text: s.title }), h('small', { text: ago(s.createdAt) }))),
    ...(sessions.length ? [] : [h('div', { class: 'empty', text: 'No sessions yet.' })])
  );
  if (state.session) renderSession(state.session);
}
$('#agent-new').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { session } = await api('POST', '/api/admin/agent/sessions', { customerId: $('#agent-customer').value || null });
    state.session = session;
    await loadAgent();
    pollSession();
  } catch (err) {
    toast(err.message);
  }
});
async function openSession(id) {
  const { session } = await api('POST', `/api/admin/agent/sessions/${id}/sync`).catch(() => api('GET', `/api/admin/agent/sessions/${id}`));
  state.session = session;
  loadAgent();
  pollSession();
}
// A turn is running if the API says so, or if the newest visible row is
// the user's (sent but not yet picked up) or an assistant row in progress.
function busy(s) {
  const rows = (s.messages || []).filter((m) => !m.hidden);
  const last = rows[rows.length - 1];
  return s.status === 'processing' || !last || last.role === 'user' || rows.some((m) => m.status === 'processing');
}
function renderSession(s) {
  const cust = state.customers.find((c) => c.id === s.customerId);
  const working = busy(s) && s.status !== 'awaiting_input';
  $('#chat-head').replaceChildren(h('b', { text: s.title }), chip(working ? 'processing' : s.status === 'awaiting_input' ? 'awaiting_input' : 'idle'), h('small', { class: 'muted', text: cust ? `${cust.credits} credits left · ${s.creditsUsed || 0} used here` : 'internal' }));
  const log = $('#chat-log');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.replaceChildren(
    ...(s.messages || [])
      .filter((m) => !m.hidden)
      .map((m) => {
        const urls = [...new Set(m.text.match(/https?:\/\/[^\s)\]>"']+/g) || [])].map((u) => u.replace(/[.,;]+$/, ''));
        return h('div', { class: `msg ${m.role} ${m.status}` }, m.text || (m.status === 'processing' ? 'Working…' : ''), ...urls.filter((u) => isVideo(u) || isImage(u)).map(media));
      })
  );
  if (working && !(s.messages || []).some((m) => !m.hidden && m.status === 'processing')) log.append(h('div', { class: 'msg assistant processing', text: (s.messages || []).some((m) => !m.hidden) ? 'Working…' : 'Reading the brand file…' }));
  if (atBottom) log.scrollTop = log.scrollHeight;
  $('#composer').hidden = false;
}
function pollSession() {
  clearTimeout(agentTimer);
  if (!state.session) return;
  renderSession(state.session);
  if (busy(state.session) && state.session.status !== 'awaiting_input') {
    agentTimer = setTimeout(async () => {
      if (state.view !== 'agent' || !state.session) return;
      try {
        state.session = (await api('POST', `/api/admin/agent/sessions/${state.session.id}/sync`)).session;
      } catch {}
      pollSession();
    }, 3000);
  }
}
$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = $('#composer-text');
  $('#composer-error').textContent = '';
  try {
    state.session = (await api('POST', `/api/admin/agent/sessions/${state.session.id}/messages`, { content: t.value })).session;
    t.value = '';
    await loadCustomers(false);
    pollSession();
  } catch (err) {
    $('#composer-error').textContent = err.message;
  }
});
$('#composer-text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#composer').requestSubmit();
});
$('#composer-attach').addEventListener('click', () => $('#composer-file').click());
$('#composer-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  $('#composer-error').textContent = `Uploading ${f.name}…`;
  try {
    const { url } = await api('POST', '/api/admin/agent/media', f, { 'Content-Type': f.type });
    $('#composer-text').value += `${$('#composer-text').value ? '\n' : ''}${url}`;
    $('#composer-error').textContent = '';
  } catch (err) {
    $('#composer-error').textContent = err.message;
  }
  e.target.value = '';
});
$('#composer-stop').addEventListener('click', async () => {
  if (!state.session) return;
  try {
    state.session = (await api('POST', `/api/admin/agent/sessions/${state.session.id}/interrupt`)).session;
    pollSession();
  } catch (err) {
    toast(err.message);
  }
});

// ---------- pricing ----------
function renderPricing() {
  const p = state.me.plans;
  $('#pricing').replaceChildren(
    ...p.plans.map((x) => h('div', { class: `plan${x.featured ? ' featured' : ''}` }, h('div', { class: 'eyebrow', text: x.name }), h('b', { text: `$${x.price}` }), h('span', { class: 'muted', text: ` /${x.interval}` }), h('p', { text: `${x.credits} credits · ${x.blurb}` }), h('ul', {}, ...x.features.map((f) => h('li', { text: f }))))),
    ...p.packs.map((x) => h('div', { class: 'plan' }, h('div', { class: 'eyebrow', text: 'Credit pack' }), h('b', { text: `$${x.price}` }), h('p', { text: `${x.name} (${x.credits} credits)` })))
  );
}

boot();
