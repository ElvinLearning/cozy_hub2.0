// The conductor: one rAF loop, one clock, one scroll value.
//   scroll (native) -> SmoothScroll.value -> DOM transform + every chapter
// Chapters build ahead of need in idle time and are isolated: if one throws,
// only that chapter is switched off.
import * as THREE from 'three';
import { SmoothScroll } from './scroll.js';
import { STAGES, resolve } from './timeline.js';
import { clamp, damp, invLerp, pinOffset, smoothstep, band } from './util.js';
import { Pipeline } from './gfx/pipeline.js';
import { bakeEnvironment } from './gfx/brand.js';
import { LoopChapter } from './chapters/loop.js';
import { StudioChapter } from './chapters/studio.js';
import { AgentChapter } from './chapters/agent.js';
import { loadPricing, setupForm, reelVideos } from './dom.js';

const params = new URLSearchParams(location.search);
const FLAGS = {
  debug: params.has('debug'),
  capture: params.has('capture'),
  dpr: params.get('dpr') ? Number(params.get('dpr')) : null,
  noGL: params.has('nogl'),
  quality: params.get('q'),
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !FLAGS.capture;
document.documentElement.classList.add('js');

const content = document.getElementById('content');
const canvas = document.getElementById('gl');
const scroll = new SmoothScroll({ content, reduced });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let resolveReady;
const app = (window.__app = {
  ready: false,
  whenReady: new Promise((r) => (resolveReady = r)),
  flags: FLAGS,
  layout: null,
  states: {},
  chapters: {},
  errors: [],
  stats: { frames: 0, frameMs: 0 },
});

// ---------------------------------------------------------------- layout
let layout = null;
let T = null;
let lastW = 0, lastH = 0;
function computeLayout(force = false) {
  const w = innerWidth, h = innerHeight;
  // mobile browsers change innerHeight as the URL bar hides; ignore small changes
  if (!force && w === lastW && Math.abs(h - lastH) < 120) return false;
  lastW = w;
  lastH = h;
  const vh = h;
  document.documentElement.style.setProperty('--vh', `${vh / 100}px`);
  for (const sec of document.querySelectorAll('[data-stage]')) sec.style.setProperty('--stage', STAGES[sec.dataset.stage]);
  const top = {};
  for (const sec of document.querySelectorAll('[data-stage],[data-flow]')) top[sec.dataset.stage || sec.dataset.flow] = sec.offsetTop / vh;
  const total = content.scrollHeight;
  scroll.setHeight(total);
  layout = { w, h, vh, top, total, max: scroll.max };
  T = resolve(layout);
  // DOM elements revealed by position
  reveals = [...document.querySelectorAll('[data-r]')].map((el) => {
    let y = 0;
    for (let n = el; n && n !== content; n = n.offsetParent) y += n.offsetTop;
    return { el, top: y / vh };
  });
  reel = reelVideos().map((r) => {
    let y = 0;
    for (let n = r.v.parentElement; n && n !== content; n = n.offsetParent) y += n.offsetTop;
    const prev = reel.find((x) => x.v === r.v);
    return { ...r, ...(prev || {}), top: y / vh };
  });
  app.layout = layout;
  app.T = T;
  app.states = namedStates();
  return true;
}
let reveals = [];
let reel = [];

function namedStates() {
  const vh = layout.vh;
  const at = (v) => Math.round(clamp(v, 0, layout.max / vh) * vh);
  return {
    intro: 0,
    hero: at(0.0),
    'hero-scrolled': at(0.6),
    iris: at((T.iris[0] + T.iris[1]) / 2),
    assets: at(2.55),
    'dissolve-start': at(T.dissolve.progress[0] + 0.25),
    'dissolve-mid': at((T.dissolve.progress[0] + T.dissolve.progress[1]) / 2),
    'dissolve-late': at(T.dissolve.progress[1] - 0.25),
    film: at(T.film.videoIn[1] + 0.05),
    'film-full': at(T.film.pushIn[1]),
    reel: at(layout.top.reel + 0.55),
    'agent-enter': at((T.agent.enter[0] + T.agent.enter[1]) / 2),
    agent: at(layout.top.agent + 0.75),
    pricing: at(layout.top.pricing + 0.25),
    start: at(layout.top.start + 0.15),
    end: at(layout.max / vh),
  };
}

// ---------------------------------------------------------------- renderer
let renderer = null, pipe = null, targets = {}, quality = { low: false };
const ctx = {};
function initGL() {
  if (FLAGS.noGL) throw new Error('nogl flag');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: FLAGS.capture });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the final pass encodes sRGB itself
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  const coarse = matchMedia('(pointer: coarse)').matches;
  quality.low = FLAGS.quality ? FLAGS.quality === 'low' : coarse || (navigator.hardwareConcurrency || 8) <= 4;
  pipe = new Pipeline(renderer, { bloomLevels: quality.low ? 5 : 6 });
  Object.assign(ctx, { renderer, quality, loadTexture, makeVideo });
}

const maxDpr = () => FLAGS.dpr || Math.min(devicePixelRatio || 1, quality.low ? 1.5 : 2);
let dprScale = 1; // adaptive quality multiplier
function sizeGL() {
  if (!renderer) return;
  const pr = maxDpr() * dprScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  pipe.resize(innerWidth, innerHeight, pr);
  for (const k of Object.keys(targets)) {
    targets[k].dispose();
    targets[k] = pipe.chapterTarget();
  }
  for (const c of Object.values(app.chapters)) c.resize?.(innerWidth, innerHeight);
}

// textures: decoded off the main thread, uploaded one per frame
const uploadQueue = [];
async function loadTexture(url) {
  let tex;
  if ('createImageBitmap' in window) {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', colorSpaceConversion: 'none' });
    tex = new THREE.Texture(bmp);
    tex.flipY = false;
  } else {
    tex = await new THREE.TextureLoader().loadAsync(url);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  uploadQueue.push(tex);
  return tex;
}
// H.264 where the browser has it, VP9 WebM otherwise (open-source Chromium ships without H.264)
const probe = document.createElement('video');
const canH264 = !!probe.canPlayType('video/mp4; codecs="avc1.42E01E"');
const pickSrc = (mp4) => (canH264 || !probe.canPlayType('video/webm; codecs="vp9"') ? mp4 : mp4.replace(/\.mp4$/, '.webm'));
const videos = [];
function makeVideo(src) {
  const v = document.createElement('video');
  Object.assign(v, { src: pickSrc(src), muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
  v.setAttribute('muted', '');
  v.load();
  videos.push(v);
  return v;
}

// chapters build in order; each one is fenced
async function buildChapter(name, Ctor) {
  try {
    const c = new Ctor(ctx);
    await c.build();
    c.resize(innerWidth, innerHeight);
    targets[name] = pipe.chapterTarget();
    app.chapters[name] = c;
  } catch (e) {
    console.error(`[cozy] chapter ${name} disabled:`, e);
    app.errors.push(`${name}: ${e.message}`);
  }
}
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));

// ---------------------------------------------------------------- DOM motion
const $ = (s) => document.querySelector(s);
const pins = [...document.querySelectorAll('[data-pin]')].map((el) => ({ el, name: el.dataset.pin }));
const heroCopy = $('#hero-copy');
const heroLines = [...document.querySelectorAll('.hero-copy .line > *')];
const heroRest = [...document.querySelectorAll('.hero-copy .eyebrow, .hero-copy .lede, .hero-copy .cta-row, .hero-copy .fine')];
const cue = $('#scroll-cue');
const assetsCopy = $('#assets-copy');
const beatTitle = $('[data-beat-title]');
const beats = [...document.querySelectorAll('[data-beat]')];
const filmCap = $('#film-cap');
const agentCopy = $('#agent-copy');
const chatRows = [...document.querySelectorAll('[data-chat]')];
const chat = $('#chat');
const nav = $('#nav');
const navLinks = [...document.querySelectorAll('.nav-links a')];

const style = (el, o, y = 0, extra = '') => {
  el.style.opacity = o.toFixed(3);
  el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)${extra}`;
  el.style.visibility = o < 0.002 ? 'hidden' : '';
};

let introStart = -1;
function updateDOM(s, t) {
  const vh = layout.vh;
  // pins
  for (const p of pins) {
    const spec = p.name === 'hero' ? T.hero.pin : p.name === 'assets' ? T.assets.pin : p.name === 'dissolve' ? T.dissolve.pin : T.agent.pin;
    p.el.style.transform = `translate3d(0, ${(pinOffset(s, spec[0], spec[1], spec[2]) * vh).toFixed(2)}px, 0)`;
  }
  // hero intro (time) then exit (scroll)
  const it = introStart < 0 ? 0 : reduced ? 9 : t - introStart;
  heroLines.forEach((l, i) => {
    const k = smoothstep(0.15 + i * 0.12, 1.15 + i * 0.12, it);
    l.style.transform = `translate3d(0, ${((1 - k) * 105).toFixed(2)}%, 0)`;
  });
  heroRest.forEach((el, i) => style(el, smoothstep(0.7 + i * 0.1, 1.5 + i * 0.1, it), (1 - smoothstep(0.7 + i * 0.1, 1.5 + i * 0.1, it)) * 18));
  const out = smoothstep(T.hero.copyOut[0], T.hero.copyOut[1], s);
  style(heroCopy, 1 - out, -out * 0.12 * vh);
  style(cue, smoothstep(1.2, 2.0, it) * (1 - smoothstep(T.hero.cueOut[0], T.hero.cueOut[1], s)));

  // assets copy
  const a = smoothstep(T.assets.copyIn[0], T.assets.copyIn[1], s) * (1 - smoothstep(T.assets.copyOut[0], T.assets.copyOut[1], s));
  style(assetsCopy, a, (1 - smoothstep(T.assets.copyIn[0], T.assets.copyIn[1], s)) * 40);

  // dissolve: title, then three beats that stay lit once reached
  const dEnd = T.dissolve.pin[1];
  const dt = smoothstep(T.dissolve.pin[0] - 0.35, T.dissolve.pin[0] - 0.05, s) * (1 - smoothstep(dEnd - 0.35, dEnd - 0.05, s));
  style(beatTitle, dt, (1 - smoothstep(T.dissolve.pin[0] - 0.35, T.dissolve.pin[0] - 0.05, s)) * 30);
  beats.forEach((b, i) => {
    const on = smoothstep(T.dissolve.beats[i], T.dissolve.beats[i] + 0.2, s);
    const next = i < 2 ? smoothstep(T.dissolve.beats[i + 1], T.dissolve.beats[i + 1] + 0.2, s) : 0;
    style(b, on * (1 - 0.45 * next) * (1 - smoothstep(dEnd - 0.35, dEnd - 0.05, s)), (1 - on) * 24);
  });
  // film caption
  style(filmCap, band(s, T.film.videoIn[1] - 0.1, T.film.videoIn[1] + 0.15, T.film.pushIn[0] + 0.2, T.film.pushIn[0] + 0.5));

  // agent
  const ai = smoothstep(T.agent.copyIn[0], T.agent.copyIn[1], s);
  const aOut = 1 - smoothstep(T.agent.pin[1] + 0.4, T.agent.pin[1] + 0.9, s);
  style(agentCopy, ai * aOut, (1 - ai) * 40);
  style(chat, ai * aOut, (1 - ai) * 60);
  const [c0, c1] = T.agent.chat;
  const fr = [0.0, 0.18, 0.42, 0.68, 0.8];
  chatRows.forEach((r, i) => {
    const at = c0 + (c1 - c0) * fr[i];
    const k = smoothstep(at, at + 0.12, s);
    style(r, k, (1 - k) * 14);
    r.style.display = i === 4 && s > c1 + 0.05 ? 'none' : '';
  });

  // flow reveals
  for (const r of reveals) {
    const k = reduced ? 1 : smoothstep(r.top - 0.95, r.top - 0.7, s);
    style(r.el, k, (1 - k) * 36);
  }
  // reel videos: load near the viewport, play while visible
  for (const r of reel) {
    const rect = r.top; // vh
    const near = s > rect - 2.0 && s < rect + 1.6;
    const vis = s > rect - 1.0 && s < rect + 0.9;
    if (near && !r.loaded) {
      r.v.src = pickSrc(r.v.dataset.src);
      r.loaded = true;
    }
    if (FLAGS.capture) continue;
    if (vis && !r.playing && r.loaded) {
      r.v.play().catch(() => {});
      r.playing = true;
    } else if (!vis && r.playing) {
      r.v.pause();
      r.playing = false;
    }
  }
  // nav
  nav.style.setProperty('--nav-shade', smoothstep(0.3, 0.8, s).toFixed(3));
  const sec = s >= layout.top.pricing - 0.5 ? (s >= layout.top.start - 0.5 ? null : '#pricing') : s >= layout.top.agent - 0.5 ? '#agent' : s >= layout.top.reel - 0.5 ? '#work' : s >= layout.top.assets - 0.5 ? '#how' : null;
  navLinks.forEach((l) => (l.getAttribute('href') === sec ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
}

// ---------------------------------------------------------------- frame
let last = -1, time = 0, frameDt = 1 / 60, filmT = 0;
const pointer = [0, 0], pointerTarget = [0, 0];
addEventListener('pointermove', (e) => {
  pointerTarget[0] = (e.clientX / innerWidth) * 2 - 1;
  pointerTarget[1] = -((e.clientY / innerHeight) * 2 - 1);
}, { passive: true });

const bg = new THREE.Color(0.0012, 0.0013, 0.0018);
let frameAvg = 16, frameN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last < 0 ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
  last = now;
  frameDt = dt;
  if (!reduced) time += dt;
  if (!layout) return;
  const y = scroll.update(dt);
  const s = y / layout.vh;
  updateDOM(s, time);
  if (!renderer || !app.chapters.loop) return;

  if (!FLAGS.capture) {
    pointer[0] = damp(pointer[0], pointerTarget[0], 3, dt);
    pointer[1] = damp(pointer[1], pointerTarget[1], 3, dt);
  }
  const ptr = FLAGS.capture || reduced ? [0, 0] : pointer;
  const t0 = performance.now();
  // one texture upload per frame
  const tex = uploadQueue.shift();
  if (tex) renderer.initTexture(tex);

  try {
    composite(s, time, ptr);
  } catch (e) {
    console.error(e);
  }
  // adaptive resolution (live only)
  const cost = performance.now() - t0;
  app.stats.frames++;
  app.stats.frameMs = cost;
  if (!FLAGS.capture && !FLAGS.dpr) {
    frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
    if (++frameN > 90) {
      frameN = 0;
      if (frameAvg > 24 && dprScale > 0.55) (dprScale = Math.max(0.55, dprScale * 0.85)), sizeGL();
      else if (frameAvg < 15 && dprScale < 1) (dprScale = Math.min(1, dprScale * 1.1)), sizeGL();
    }
  }
}

function composite(s, t, ptr) {
  const C = app.chapters;
  const iris = invLerp(T.iris[0], T.iris[1], s);
  const studioDim = 1 - smoothstep(T.reel.dim[0], T.reel.dim[1], s);
  const agentIn = invLerp(T.agent.enter[0], T.agent.enter[1], s);
  const agentDim = 1 - 0.72 * smoothstep(T.agent.exit[0], T.agent.exit[1], s);
  const endIn = invLerp(T.start.enter[0], T.start.enter[1], s);
  const mode = reduced ? 0 : null;

  let job;
  if (s < T.iris[0] || !C.studio) {
    job = { a: 'loop', mode: 0, mix: 0 };
  } else if (iris < 1) {
    job = { a: 'loop', b: 'studio', mode: mode ?? 1, mix: iris };
  } else if (agentIn <= 0 || !C.agent) {
    job = studioDim > 0.001 ? { a: 'studio', mode: 0, mix: 0, expA: studioDim } : { mode: 0, mix: 0 };
    if (s > T.reel.dim[1] && C.agent && s < T.agent.enter[0]) job = { mode: 0, mix: 0 };
  } else if (endIn <= 0) {
    job = agentIn < 1 ? { a: studioDim > 0.001 ? 'studio' : null, b: 'agent', mode: mode ?? 2, mix: agentIn, expA: studioDim, expB: agentDim } : { a: 'agent', mode: 0, mix: 0, expA: agentDim };
  } else {
    job = endIn < 1 ? { a: 'agent', b: 'loopEnd', mode: 0, mix: endIn, expA: agentDim, expB: 0.75 } : { a: 'loopEnd', mode: 0, mix: 0, expA: 0.75 };
  }

  const need = new Set([job.a, job.b].filter(Boolean));
  if (need.has('loop')) {
    C.loop.update(s, t, T, 'hero', ptr);
    C.loop.render(targets.loop);
  }
  if (need.has('loopEnd')) {
    C.loop.update(s, t, T, 'end', ptr);
    C.loop.render(targets.loop);
  }
  if (need.has('studio')) {
    C.studio.update(s, t, T, ptr);
    C.studio.render(targets.studio);
  }
  if (need.has('agent')) {
    C.agent.update(s, t, T, ptr);
    C.agent.render(targets.agent);
  }
  // the studio film holds its first frame (= the print) until the pixels land,
  // then plays from the top; scrolling back above the landing rewinds it
  const studioVideo = C.studio?.video;
  if (studioVideo) {
    const landed = need.has('studio') && (C.studio.show || 0) > 0.02;
    filmT = landed ? filmT + frameDt : 0;
    if (!FLAGS.capture) {
      if (landed && studioVideo.paused) studioVideo.play().catch(() => {});
      else if (!landed && (!studioVideo.paused || studioVideo.currentTime > 0.05)) {
        studioVideo.pause();
        studioVideo.currentTime = 0;
      }
    }
  }
  const tgt = (n) => (n === 'loopEnd' ? targets.loop : n ? targets[n] : null);
  const center = job.mode === 1 && job.a === 'loop' ? C.loop.ringScreen() : [0.5, 0.5];
  pipe.render({ a: tgt(job.a), b: tgt(job.b), mix: job.mix, mode: job.mode, expA: job.expA ?? 1, expB: job.expB ?? 1, center, exposure: 1.0, bloom: 0.7, bgColor: bg });
  app.job = job;
}

// ---------------------------------------------------------------- capture API
app.goto = (state, { instant = true } = {}) => {
  const y = typeof state === 'number' ? state : app.states[state];
  if (y === undefined) throw new Error(`unknown state ${state}`);
  if (instant) scroll.jump(y);
  else window.scrollTo({ top: y, behavior: 'smooth' });
  return y;
};
/** Recorder: freeze native scroll and drive the value exactly. */
app.setScroll = (y) => {
  scroll.frozen = true;
  scroll.target = scroll.value = clamp(y, 0, scroll.max);
};
app.release = () => {
  scroll.frozen = false;
  scroll.jump(scroll.value);
};
/** Seek every video to the same virtual time; resolves when frames are ready. */
app.seekMedia = async (t) => {
  const all = [...videos, ...reel.filter((r) => r.loaded).map((r) => r.v)];
  const studioVideo = app.chapters.studio?.video;
  await Promise.all(
    all.map((v) => {
      if (!v.duration || !isFinite(v.duration)) return null;
      v.pause();
      const target = (v === studioVideo ? filmT : t) % v.duration;
      if (Math.abs(v.currentTime - target) < 1e-3) return null;
      return new Promise((res) => {
        const done = () => (v.removeEventListener('seeked', done), res());
        v.addEventListener('seeked', done);
        v.currentTime = target;
        setTimeout(done, 1500);
      });
    })
  );
  const vt = app.chapters.studio?.vtex;
  if (vt && vt.image.readyState >= 2) vt.needsUpdate = true;
};
app.setIntro = (t) => (introStart = t);

// ---------------------------------------------------------------- boot
async function boot() {
  computeLayout(true);
  document.fonts?.ready.then(() => computeLayout(true));
  loadPricing().then(() => computeLayout(true));
  setupForm();
  document.getElementById('year').textContent = new Date().getFullYear();
  try {
    initGL();
    sizeGL();
    ctx.env = bakeEnvironment(renderer);
    await buildChapter('loop', LoopChapter);
  } catch (e) {
    console.warn('[cozy] WebGL unavailable, static page:', e.message);
    app.errors.push(`gl: ${e.message}`);
    document.body.classList.add('no-gl');
    renderer = null;
  }
  // hash links: jump with the smooth scroll
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const sec = id === 'top' ? document.getElementById('top') : document.getElementById(id);
    if (!sec) return;
    e.preventDefault();
    let yy = 0;
    for (let n = sec; n && n !== content; n = n.offsetParent) yy += n.offsetTop;
    if (id === 'how') yy = 2.4 * layout.vh;
    window.scrollTo({ top: yy, behavior: reduced ? 'auto' : 'smooth' });
  });
  addEventListener('resize', () => {
    if (computeLayout()) sizeGL();
  });
  document.body.classList.remove('is-loading');
  requestAnimationFrame((ts) => {
    introStart = FLAGS.capture ? 0 : time + 0.25;
    last = -1;
    frame(ts);
  });
  // the rest of the page builds in idle time, in scroll order
  if (renderer) {
    await idle();
    await buildChapter('studio', StudioChapter);
    await idle();
    await buildChapter('agent', AgentChapter);
  }
  // the film has to have a frame before we call it ready
  await Promise.all(videos.map((v) => (v.readyState >= 2 ? null : new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 8000); }))));
  // let queued texture uploads drain before calling it ready
  while (uploadQueue.length) await new Promise((r) => requestAnimationFrame(r));
  computeLayout(true);
  app.ready = true;
  resolveReady();
  if (FLAGS.debug) console.log('[cozy] ready', app.layout, app.errors);
}
boot();
