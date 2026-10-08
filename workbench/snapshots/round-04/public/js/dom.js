// DOM-only pieces: pricing from /api/plans, the lead form with uploads,
// and lazy reel videos.

const money = (n, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...kids.filter(Boolean));
  return e;
}

export async function loadPricing() {
  const box = document.getElementById('plans');
  try {
    const res = await fetch('/api/plans');
    if (!res.ok) throw new Error();
    const { plans, packs, currency } = await res.json();
    box.replaceChildren(
      ...plans.map((p) =>
        el(
          'article',
          { class: `plan${p.featured ? ' featured' : ''}`, 'data-r': '' },
          p.featured ? el('span', { class: 'tag', text: 'Most loved' }) : null,
          el('h3', { text: p.name }),
          el('div', { class: 'price' }, el('b', { text: money(p.price, currency) }), el('span', { text: `/ ${p.interval}` })),
          el('p', { text: p.blurb }),
          el('ul', {}, ...p.features.map((f) => el('li', { text: f }))),
          el('a', { class: `btn ${p.featured ? 'btn-solid' : 'btn-ghost'}`, href: '#start', 'data-plan': p.id, text: p.cta || 'Choose' })
        )
      )
    );
    if (packs?.length) document.getElementById('packs').textContent = `Need more? ${packs.map((x) => `${x.name} for ${money(x.price, currency)}`).join(' · ')}.`;
    const sel = document.getElementById('lead-plan');
    sel.append(...plans.map((p) => el('option', { value: p.id, text: `${p.name} · ${money(p.price, currency)}/${p.interval}` })));
    box.addEventListener('click', (e) => {
      const a = e.target.closest('[data-plan]');
      if (a) sel.value = a.dataset.plan;
    });
    const min = Math.min(...plans.map((p) => p.price));
    document.getElementById('hero-price').textContent = `Plans from ${money(min, currency)} a month.`;
    return plans;
  } catch {
    box.replaceChildren(el('p', { class: 'packs', text: 'Pricing is loading slowly. Tell us about your business below and we will send it over.' }));
    return [];
  }
}

export function setupForm() {
  const form = document.getElementById('lead-form');
  const input = document.getElementById('lead-files');
  const zone = document.getElementById('dropzone');
  const list = document.getElementById('picked');
  const msg = document.getElementById('lead-msg');
  const btn = document.getElementById('lead-submit');
  let files = [];
  const render = () => list.replaceChildren(...files.map((f) => el('li', { 'data-name': f.name, text: f.name.length > 28 ? `${f.name.slice(0, 25)}…` : f.name })));
  const add = (fl) => {
    files = [...files, ...[...fl].filter((f) => f.size <= 200 * 1024 * 1024)].slice(0, 12);
    render();
  };
  input.addEventListener('change', () => add(input.files));
  zone.addEventListener('dragover', (e) => (e.preventDefault(), zone.classList.add('over')));
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    add(e.dataTransfer.files);
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    const data = Object.fromEntries(new FormData(form));
    delete data.files;
    if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) {
      msg.className = 'form-msg bad';
      msg.textContent = 'Add your name and a working email so we can reply.';
      return;
    }
    btn.disabled = true;
    msg.textContent = 'Sending…';
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Something went wrong');
      let done = 0;
      for (const f of files) {
        msg.textContent = `Uploading ${++done} of ${files.length}…`;
        const li = list.querySelector(`[data-name="${CSS.escape(f.name)}"]`);
        const up = await fetch(`/api/leads/${out.id}/files?name=${encodeURIComponent(f.name)}&t=${out.uploadToken}`, { method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f });
        li?.classList.add(up.ok ? 'ok' : 'bad');
      }
      form.reset();
      files = [];
      msg.className = 'form-msg ok';
      msg.textContent = 'Got it. We will be in touch with your first concept.';
    } catch (err) {
      msg.className = 'form-msg bad';
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

/** Reel videos load when near the viewport and play only while visible. */
export function reelVideos() {
  return [...document.querySelectorAll('#reel-grid video')].map((v) => ({ v, loaded: false, playing: false }));
}
