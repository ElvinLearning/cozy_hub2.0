// One native scroll position and one requestAnimationFrame clock.
// CSS supplies the readable resting layout; this module only adds motion.
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const styleCache = new WeakMap();
function property(element, name, value) {
  if (!element) return;
  let values = styleCache.get(element);
  if (!values) styleCache.set(element, (values = new Map()));
  if (values.get(name) === value) return;
  element.style.setProperty(name, value);
  values.set(name, value);
}

function introEase(progress) {
  const bezier = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0, high = 1;
  for (let i = 0; i < 14; i++) {
    const middle = (low + high) / 2;
    if (bezier(middle, 0.2, 0.3) < progress) low = middle;
    else high = middle;
  }
  return bezier((low + high) / 2, 0.9, 0.986);
}

const listen = (target, event, handler, options, cleanup) => {
  target.addEventListener(event, handler, options);
  cleanup.push(() => target.removeEventListener(event, handler, options));
};

function layoutTop(element) {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
}

class ScrollClock {
  constructor(cleanup) {
    this.desktop = matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
    this.current = 0;
    this.target = 0;
    this.max = 0;
    this.height = innerHeight;
    this.active = false;
    this.paused = false;
    this.lastWritten = null;
    this.integrated = null;
    this.onArrival = null;
    this.kind = 'wheel';
    listen(window, 'wheel', (event) => this.wheel(event), { passive: false }, cleanup);
    listen(window, 'pointerdown', () => this.cancel(), { passive: true }, cleanup);
    listen(window, 'touchstart', () => this.cancel(), { passive: true }, cleanup);
    listen(window, 'keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) this.cancel();
    }, false, cleanup);
    listen(window, 'popstate', () => this.cancel(), false, cleanup);
    listen(this.desktop, 'change', () => this.cancel(), false, cleanup);
  }

  resize(height, max) {
    this.height = height;
    this.max = max;
    this.target = clamp(this.target, 0, max);
  }

  nestedScroll(event) {
    for (const node of event.composedPath()) {
      if (!(node instanceof Element) || node === document.body || node === document.documentElement) break;
      if (node.matches('input, textarea, select, [contenteditable="true"], [data-native-scroll]')) return true;
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) return true;
    }
    return false;
  }

  wheel(event) {
    if (this.paused || !this.desktop.matches || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY) || this.nestedScroll(event)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const start = this.active ? this.target : this.current;
    const target = clamp(start + event.deltaY * unit, 0, this.max);
    if (target === start && (start <= 0 || start >= this.max)) return;
    event.preventDefault();
    if (!this.active) this.integrated = null;
    this.onArrival = null;
    this.kind = 'wheel';
    this.target = target;
    this.active = true;
  }

  cancel() {
    this.active = false;
    this.onArrival = null;
    this.lastWritten = null;
    this.integrated = null;
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.cancel();
  }

  to(target, onArrival) {
    this.target = clamp(target, 0, this.max);
    this.kind = 'anchor';
    this.onArrival = onArrival;
    this.active = true;
    this.lastWritten = null;
    this.integrated = null;
  }

  update(nativeY, dt) {
    this.current = nativeY;
    if (!this.active) return nativeY;
    // Scrollbars, native keyboard scrolling and browser restoration take over.
    if (this.lastWritten !== null && Math.abs(nativeY - this.lastWritten) > 3) {
      this.cancel();
      return nativeY;
    }
    const from = this.integrated ?? nativeY;
    const distance = this.target - from;
    const factor = this.paused ? 1 : 1 - Math.exp(-dt / (this.kind === 'anchor' ? 150 : 105));
    const next = Math.abs(distance) < 0.5 ? this.target : from + distance * factor;
    const pixel = Math.round(next);
    window.scrollTo({ top: pixel, left: 0, behavior: 'instant' });
    this.integrated = next;
    this.lastWritten = pixel;
    this.current = pixel;
    if (Math.abs(this.target - pixel) <= 1) {
      this.active = false;
      this.lastWritten = null;
      this.integrated = null;
      const arrived = this.onArrival;
      this.onArrival = null;
      arrived?.();
    }
    return pixel;
  }
}

class LetterRing {
  constructor(element, refresh) {
    this.element = element;
    this.orbit = element?.closest('.hero-orbit');
    this.glyphs = [];
    this.ready = false;
    this.destroyed = false;
    this.startedAt = null;
    this.signature = '';
    if (!element) return;
    const phrase = 'Cozy Digital · ';
    element.setAttribute('aria-label', element.getAttribute('aria-label') || 'Cozy Digital');
    const fragment = document.createDocumentFragment();
    [...phrase.repeat(3)].forEach((character, index) => {
      const span = document.createElement('span');
      span.className = 'ring-letter';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = character === ' ' ? '\u00a0' : character;
      span.style.setProperty('--letter-opacity', '0');
      fragment.append(span);
      this.glyphs.push({ span, character, group: Math.floor(index / phrase.length), withinGroup: index % phrase.length, angle: 0 });
    });
    element.replaceChildren(fragment);
    Promise.resolve(document.fonts?.ready).then(() => {
      if (this.destroyed) return;
      this.ready = true;
      refresh();
    });
  }

  measure(width, height) {
    if (!this.element || !this.ready || !this.glyphs.length) return;
    const font = getComputedStyle(this.glyphs[0].span);
    const signature = [width, height, font.fontFamily, font.fontSize, font.fontWeight, font.fontStyle, font.letterSpacing, font.fontVariationSettings].join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    // Measure in normal flow so perspective and rotation do not alter widths.
    const ruler = document.createElement('div');
    ruler.setAttribute('aria-hidden', 'true');
    Object.assign(ruler.style, {
      position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden',
      pointerEvents: 'none', whiteSpace: 'pre', contain: 'layout style paint',
      fontFamily: font.fontFamily, fontSize: font.fontSize, fontWeight: font.fontWeight,
      fontStyle: font.fontStyle, fontStretch: font.fontStretch,
      fontVariationSettings: font.fontVariationSettings, fontKerning: font.fontKerning,
      letterSpacing: font.letterSpacing, lineHeight: '1',
    });
    const measures = this.glyphs.map(({ character }) => {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.textContent = character === ' ' ? '\u00a0' : character;
      ruler.append(span);
      return span;
    });
    document.body.append(ruler);
    const widths = measures.map((span) => Math.max(0.01, span.getBoundingClientRect().width));
    const total = widths.reduce((sum, value) => sum + value, 0);
    let passed = 0;
    this.glyphs.forEach((glyph, index) => {
      glyph.angle = ((passed + widths[index] / 2) / total) * 360;
      passed += widths[index];
      property(glyph.span, '--letter-angle', `${glyph.angle.toFixed(4)}deg`);
    });
    ruler.remove();
    this.element.dataset.ringReady = 'true';
  }

  update(now, time, paused, exit) {
    if (!this.element || !this.ready || !this.signature) return;
    if (this.startedAt === null) {
      this.startedAt = now;
      this.motionStart = time;
    }
    const elapsed = Math.max(0, (time - this.motionStart) / 1000);
    const fadeElapsed = Math.max(0, (now - this.startedAt) / 1000);
    const rotation = paused ? 60 : elapsed < 4.5
      ? 102 + (-295 - 102) * introEase(clamp(elapsed / 4.5))
      : -295 - ((elapsed - 4.5) / 150) * 360;
    property(this.element, '--ring-rotation', `${rotation.toFixed(4)}deg`);
    const opacity = (1 - smoothstep(0.12, 0.7, exit)).toFixed(4);
    property(this.element, '--ring-opacity', opacity);
    property(this.orbit, '--ring-opacity', opacity);
    for (const glyph of this.glyphs) {
      const delay = glyph.group * 0.6 + glyph.withinGroup * 0.055;
      const reveal = paused ? smoothstep(0, 0.6, fadeElapsed) : smoothstep(delay, delay + 0.65, elapsed);
      property(glyph.span, '--letter-opacity', reveal.toFixed(4));
      property(glyph.span, '--letter-y', `${(paused ? 0 : (1 - reveal) * 18).toFixed(3)}px`);
      property(glyph.span, '--letter-clip', `${(paused ? 0 : (1 - reveal) * 100).toFixed(3)}%`);
    }
  }

  destroy() { this.destroyed = true; }
}

class ChapterNavigation {
  constructor(scroll, refresh, cleanup) {
    this.scroll = scroll;
    this.refresh = refresh;
    this.container = document.getElementById('chapter-nav');
    this.toggle = document.getElementById('chapter-toggle');
    this.menu = document.getElementById('chapter-menu');
    this.number = document.getElementById('chapter-number');
    this.name = document.getElementById('chapter-name');
    this.links = [...(this.menu?.querySelectorAll('a[href^="#"]') || [])];
    this.current = null;
    this.opened = false;
    if (this.toggle && this.menu) {
      this.toggle.setAttribute('aria-controls', this.menu.id);
      this.close();
      listen(this.toggle, 'click', () => this.opened ? this.close() : this.open(), false, cleanup);
      listen(this.toggle, 'keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        this.open();
        (event.key === 'ArrowUp' ? this.links.at(-1) : this.links[0])?.focus();
      }, false, cleanup);
      listen(this.menu, 'keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const index = this.links.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.links.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + this.links.length) % this.links.length;
        this.links[next]?.focus();
      }, false, cleanup);
    }
    listen(document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.opened) {
        event.preventDefault();
        this.close(true);
      }
    }, false, cleanup);
    listen(document, 'pointerdown', (event) => {
      if (this.opened && !this.container?.contains(event.target)) this.close();
    }, { passive: true }, cleanup);
    listen(document, 'focusin', (event) => {
      if (this.opened && !this.container?.contains(event.target)) this.close();
    }, false, cleanup);
    listen(document, 'click', (event) => this.follow(event), false, cleanup);
  }

  label() {
    if (!this.toggle) return;
    const chapter = this.current;
    this.toggle.setAttribute('aria-label', `${this.opened ? 'Close' : 'Open'} chapter navigation${chapter ? `, current chapter ${chapter.number} ${chapter.name}` : ''}`);
  }

  open() {
    if (!this.toggle || !this.menu) return;
    this.opened = true;
    this.menu.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    this.container?.classList.add('is-open');
    this.label();
  }

  close(focus = false) {
    this.opened = false;
    if (this.menu) this.menu.hidden = true;
    this.toggle?.setAttribute('aria-expanded', 'false');
    this.container?.classList.remove('is-open');
    this.label();
    if (focus) this.toggle?.focus({ preventScroll: true });
  }

  follow(event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { return; }
    if (!id) return;
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    const selector = document.getElementById('lead-plan');
    if (selector && link.dataset.plan) selector.value = link.dataset.plan;
    const fromMenu = this.menu?.contains(link);
    this.close(Boolean(fromMenu));
    this.refresh();
    const destination = Math.max(0, layoutTop(section) - 28);
    try { history.pushState(null, '', link.hash); } catch { /* A sandbox may restrict history writes. */ }
    this.scroll.to(destination, () => {
      const focus = section.querySelector('h1, h2') || section;
      if (!focus.hasAttribute('tabindex')) focus.setAttribute('tabindex', '-1');
      focus.focus({ preventScroll: true });
    });
  }

  update(chapter) {
    if (!chapter || this.current?.element === chapter.element) return;
    this.current = chapter;
    if (this.number) this.number.textContent = chapter.number;
    if (this.name) this.name.textContent = chapter.name;
    for (const link of this.links) {
      if (link.hash === `#${chapter.element.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    this.label();
  }
}

class Inspirations {
  constructor(scroll, onChange, cleanup) {
    this.dialog = document.getElementById('inspiration-dialog');
    this.cards = [...(this.dialog?.querySelectorAll('[data-orbit-person]') || [])];
    this.scroll = scroll;
    this.returnFocus = null;
    this.hovered = false;
    this.focused = false;
    this.time = 0;
    this.sequence = '';
    this.keyAt = 0;
    this.onChange = onChange;
    if (!this.dialog) return;
    const close = () => this.dialog.open && this.dialog.close();
    for (const button of document.querySelectorAll('[data-open-inspirations]')) {
      listen(button, 'click', () => this.open(button), false, cleanup);
    }
    for (const button of this.dialog.querySelectorAll('[data-close-inspirations]')) listen(button, 'click', close, false, cleanup);
    listen(this.dialog, 'close', () => {
      document.body.classList.remove('inspirations-open');
      this.hovered = false;
      this.focused = false;
      this.onChange(false);
      if (this.returnFocus instanceof HTMLElement && this.returnFocus.isConnected) this.returnFocus.focus({ preventScroll: true });
    }, false, cleanup);
    listen(this.dialog, 'click', (event) => {
      if (event.target !== this.dialog) return;
      const box = this.dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }, false, cleanup);
    listen(this.dialog, 'pointerover', (event) => {
      this.hovered = event.target instanceof Element && Boolean(event.target.closest('[data-orbit-person]'));
    }, { passive: true }, cleanup);
    listen(this.dialog, 'pointerleave', () => { this.hovered = false; }, { passive: true }, cleanup);
    listen(this.dialog, 'focusin', (event) => {
      this.focused = event.target instanceof Element && Boolean(event.target.closest('[data-orbit-person]'));
    }, false, cleanup);
    listen(this.dialog, 'focusout', (event) => {
      this.focused = event.relatedTarget instanceof Element && Boolean(event.relatedTarget.closest('[data-orbit-person]'));
    }, false, cleanup);
    listen(document, 'keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat || event.key.length !== 1) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const now = performance.now();
      if (now - this.keyAt > 1600) this.sequence = '';
      this.keyAt = now;
      this.sequence = (this.sequence + event.key.toLowerCase()).slice(-4);
      if (this.sequence === 'cozy') {
        this.sequence = '';
        this.open(document.activeElement);
      }
    }, false, cleanup);
  }

  open(trigger) {
    if (!this.dialog || this.dialog.open || typeof this.dialog.showModal !== 'function') return;
    this.returnFocus = trigger;
    this.scroll.cancel();
    this.dialog.showModal();
    document.body.classList.add('inspirations-open');
    this.onChange(true);
    this.dialog.querySelector('[data-close-inspirations]')?.focus({ preventScroll: true });
  }

  update(dt, paused) {
    if (!this.dialog) return;
    const animated = !paused && this.scroll.desktop.matches;
    this.dialog.classList.toggle('orbit-ready', animated);
    this.dialog.toggleAttribute('data-orbit-ready', animated);
    if (animated && this.dialog.open && !this.hovered && !this.focused) this.time += dt / 1000;
    this.cards.forEach((card, index) => {
      const angle = index * Math.PI / 3 + this.time * 0.16;
      property(card, '--portrait-x', `${(animated ? Math.sin(angle) * 14 : 0).toFixed(3)}px`);
      property(card, '--portrait-y', `${(animated ? Math.cos(angle * 0.85) * 12 : 0).toFixed(3)}px`);
      property(card, '--portrait-rotate', `${(animated ? Math.sin(angle * 0.7) * 1.7 : 0).toFixed(3)}deg`);
    });
  }

  get opened() { return Boolean(this.dialog?.open); }
  destroy() { if (this.dialog?.open) this.dialog.close(); }
}

export function createLandingMotion({ onMotionChange = () => {} } = {}) {
  const root = document.documentElement;
  const cleanup = [];
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const toggles = [...document.querySelectorAll('[data-motion-toggle]')];
  const scroll = new ScrollClock(cleanup);
  const scene = document.querySelector('[data-hero-scene]');
  const videos = [...document.querySelectorAll('video')];
  const heroSticky = document.querySelector('.hero-sticky');
  const heroCopy = document.querySelector('[data-hero-copy]');
  let chapters = [], reveals = [], mediaVisibility = [], hero = null;
  let dirty = true, destroyed = false, suspended = false;
  let userPaused = false, paused = preference.matches;
  let frameId = 0, previous = null, motionTime = 0;
  let width = innerWidth, height = innerHeight;
  let heroWindow = height;
  const refresh = () => { dirty = true; };
  // IntersectionObserver does not account for crossfades or reveal opacity.
  // Publish their combined visibility at its boundary; media.js owns playback.
  const mediaHidden = (video, hidden) => {
    if (video.hasAttribute('data-media-hidden') !== hidden) video.toggleAttribute('data-media-hidden', hidden);
  };
  const ring = new LetterRing(document.querySelector('[data-ring]'), refresh);
  const navigation = new ChapterNavigation(scroll, refresh, cleanup);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
  const observed = new Set();
  const inspirations = new Inspirations(scroll, (opened) => {
    if (opened) navigation.close();
    scroll.setPaused(paused || opened);
    onMotionChange(paused || opened);
    refresh();
  }, cleanup);

  function layout(nativeY) {
    width = innerWidth;
    height = innerHeight;
    heroWindow = heroSticky?.offsetHeight || height;
    const seen = new Map(reveals.map((item) => [item.element, item.revealed]));
    chapters = [...document.querySelectorAll('[data-chapter]')].map((element) => ({
      element, top: element.getBoundingClientRect().top + nativeY, height: element.offsetHeight,
      number: element.dataset.chapterNumber || '', name: element.dataset.chapterName || '',
    }));
    hero = chapters.find(({ element }) => element.id === 'hello') || chapters[0];
    reveals = [...document.querySelectorAll('[data-reveal], [data-r]')].map((element) => ({
      element, top: layoutTop(element), revealed: seen.get(element) || 0,
    }));
    mediaVisibility = videos.map((video) => ({
      video, inHero: Boolean(scene?.contains(video)), inHow: Boolean(video.closest('#how')),
      reveals: reveals.filter(({ element }) => element.contains(video)),
    }));
    scroll.resize(height, Math.max(0, document.documentElement.scrollHeight - height));
    property(root, '--viewport-height', `${height}px`);
    property(root, '--hero-window', `${heroWindow}px`);
    ring.measure(width, height);
    const targets = new Set([document.body, ...chapters.map(({ element }) => element), ring.element].filter(Boolean));
    for (const element of observed) {
      if (!targets.has(element)) { observer?.unobserve(element); observed.delete(element); }
    }
    for (const element of targets) {
      if (!observed.has(element)) { observer?.observe(element); observed.add(element); }
    }
    dirty = false;
  }

  function applyPreference() {
    paused = preference.matches || userPaused;
    root.classList.toggle('motion-paused', paused);
    root.dataset.motion = paused ? 'paused' : 'running';
    scroll.setPaused(paused || inspirations.opened);
    for (const button of toggles) {
      button.setAttribute('aria-pressed', String(paused));
      button.disabled = preference.matches;
      const label = preference.matches ? 'Reduced motion is enabled in your device settings' : paused ? 'Resume motion' : 'Pause motion';
      button.setAttribute('aria-label', label);
      button.title = label;
      const text = button.querySelector('[data-motion-label]');
      if (text) text.textContent = preference.matches ? 'Motion reduced' : paused ? 'Resume motion' : 'Pause motion';
    }
    onMotionChange(paused || inspirations.opened);
    refresh();
  }

  function render(now) {
    frameId = 0;
    if (destroyed || suspended || document.hidden) return;
    const dt = previous === null ? 16 : Math.min(80, Math.max(0, now - previous));
    previous = now;
    if (!paused && !inspirations.opened) motionTime += dt;
    // This is the only native scroll read in the animation clock.
    const nativeY = window.scrollY;
    if (dirty) layout(nativeY);
    const y = scroll.update(nativeY, dt);
    let active = chapters[0];
    for (const chapter of chapters) {
      const progress = clamp((y + height - chapter.top) / (chapter.height + height));
      property(chapter.element, '--chapter-progress', progress.toFixed(5));
      if (chapter.top <= y + height * 0.3) active = chapter;
    }
    if (y >= scroll.max - 2) active = chapters.at(-1);
    navigation.update(active);
    const rawExit = hero ? clamp((y - hero.top) / Math.max(1, hero.height - heroWindow)) : 0;
    const exit = smoothstep(0.04, 1, rawExit);
    const howOpacity = smoothstep(0.48, 0.90, exit);
    const sceneOpacity = 1 - smoothstep(0.6, 1, exit);
    property(root, '--hero-exit', exit.toFixed(5));
    property(root, '--how-opacity', howOpacity.toFixed(5));
    property(root, '--how-interaction', howOpacity > 0.05 ? 'auto' : 'none');
    property(scene, '--scene-pan', (paused ? 0 : exit ** 1.3).toFixed(5));
    property(scene, '--scene-scale', (paused ? 1 : 1 + 3.6 * exit ** 1.3).toFixed(5));
    property(scene, '--scene-opacity', sceneOpacity.toFixed(5));
    property(heroCopy, '--copy-opacity', (1 - smoothstep(0.08, 0.64, exit)).toFixed(5));
    property(heroCopy, '--copy-y', `${(paused ? 0 : -exit * 28).toFixed(3)}px`);
    ring.update(now, motionTime, paused, exit);
    inspirations.update(dt, paused);
    for (const reveal of reveals) {
      const amount = paused ? 1 : smoothstep(reveal.top - height * 0.95, reveal.top - height * 0.73, y);
      reveal.revealed = Math.max(reveal.revealed, amount);
      property(reveal.element, '--reveal-opacity', reveal.revealed.toFixed(4));
      property(reveal.element, '--reveal-y', `${(paused ? 0 : (1 - reveal.revealed) * 18).toFixed(3)}px`);
    }
    for (const state of mediaVisibility) {
      let opacity = state.inHero ? sceneOpacity : 1;
      if (state.inHow) opacity *= howOpacity;
      for (const reveal of state.reveals) opacity *= reveal.revealed;
      mediaHidden(state.video, opacity <= 0.01);
    }
    frameId = requestAnimationFrame(render);
  }

  function start() {
    if (!destroyed && !suspended && !document.hidden && !frameId) {
      previous = null;
      frameId = requestAnimationFrame(render);
    }
  }
  function suspend() {
    suspended = true;
    cancelAnimationFrame(frameId);
    frameId = 0;
    previous = null;
    scroll.cancel();
  }
  function resume() {
    suspended = false;
    refresh();
    start();
  }

  listen(window, 'resize', refresh, { passive: true }, cleanup);
  listen(preference, 'change', applyPreference, false, cleanup);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previous = null;
      scroll.cancel();
    } else {
      refresh();
      start();
    }
  }, false, cleanup);
  for (const button of toggles) listen(button, 'click', () => {
    if (preference.matches) return;
    userPaused = !userPaused;
    applyPreference();
  }, false, cleanup);
  if (document.fonts) listen(document.fonts, 'loadingdone', () => {
    ring.signature = '';
    refresh();
  }, false, cleanup);
  property(root, '--how-opacity', '0');
  property(root, '--how-interaction', 'none');
  for (const video of videos) mediaHidden(video, true);
  root.classList.add('js', 'motion-ready');
  applyPreference();
  start();

  return {
    refresh, suspend, resume,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      suspend();
      observer?.disconnect();
      ring.destroy();
      navigation.close();
      inspirations.destroy();
      for (const release of cleanup) release();
    },
  };
}
