// Visibility observers own media playback. There is no animation or polling clock.
export function createMediaController(videos) {
  const records = [];
  const mobile = matchMedia('(max-width: 767px)');
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let suspended = false, destroyed = false;
  const eligible = (record) => !destroyed && !paused && !suspended && !document.hidden && record.visible
    && !record.video.hasAttribute('data-media-pending') && !record.video.hasAttribute('data-media-hidden');

  function sourcesFor(video) {
    const useMobile = mobile.matches && Boolean(video.dataset.mobileSrc || video.dataset.mobileWebm);
    const mp4 = useMobile ? video.dataset.mobileSrc : video.dataset.src;
    const webm = (useMobile ? video.dataset.mobileWebm : video.dataset.webm) || mp4?.replace(/\.mp4(?=\?|$)/, '.webm');
    const preferWebm = !video.canPlayType('video/mp4; codecs="avc1.42E01E"') && video.canPlayType('video/webm; codecs="vp9"');
    return {
      sources: [...new Set((preferWebm ? [webm, mp4] : [mp4, webm]).filter(Boolean))],
      variant: useMobile ? 'mobile' : 'desktop',
    };
  }

  function showPlaying(record, playing) {
    record.playing = playing;
    record.video.dataset.playing = String(playing);
    if (record.frame) record.frame.classList.toggle('is-playing', records.some((other) => other.frame === record.frame && other.playing));
  }

  function stop(record, unload = false) {
    record.token++;
    record.requested = false;
    record.video.pause();
    showPlaying(record, false);
    if (unload && (record.loaded || record.video.hasAttribute('src'))) {
      record.video.removeAttribute('src');
      record.video.load();
      record.loaded = false;
      record.sourceIndex = 0;
      record.failed = false;
    }
  }

  function play(record) {
    if (!eligible(record) || record.failed || record.requested || record.playing) return;
    const video = record.video;
    if (!record.loaded) {
      const source = record.sources[record.sourceIndex];
      if (!source) return;
      video.src = source;
      video.load();
      record.loaded = true;
    }
    const token = ++record.token;
    record.requested = true;
    let pending;
    try { pending = video.play(); } catch { record.requested = false; return; }
    Promise.resolve(pending).then(() => {
      if (record.token !== token || !eligible(record)) {
        if (!eligible(record)) stop(record);
        return;
      }
      record.requested = false;
      showPlaying(record, !video.paused);
    }).catch(() => {
      if (record.token !== token) return;
      record.requested = false;
      showPlaying(record, false);
    });
  }

  const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const record = records.find(({ video }) => video === entry.target);
      if (!record) continue;
      record.visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (eligible(record)) play(record);
      else stop(record);
    }
  }, { threshold: [0, 0.01, 0.1] }) : null;

  for (const video of videos) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = 'none';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.removeAttribute('autoplay');
    const { sources, variant } = sourcesFor(video);
    const record = {
      video, frame: video.closest('.media-frame') || video.parentElement,
      sources, variant, sourceIndex: 0, loaded: false, visible: false,
      playing: false, requested: false, failed: false, token: 0,
    };
    records.push(record);
    video.dataset.mediaVariant = variant;
    const canplay = () => { if (eligible(record)) play(record); };
    const ended = () => { showPlaying(record, false); if (eligible(record)) play(record); };
    const error = () => {
      stop(record);
      record.loaded = false;
      record.sourceIndex++;
      if (record.sourceIndex < record.sources.length) play(record);
      else {
        record.failed = true;
        video.dataset.mediaError = 'unavailable';
      }
    };
    record.release = () => {
      video.removeEventListener('canplay', canplay);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', error);
    };
    video.addEventListener('canplay', canplay);
    video.addEventListener('ended', ended);
    video.addEventListener('error', error);
    showPlaying(record, false);
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
    visibility?.observe(video);
  }

  function refresh() {
    if (destroyed) return;
    for (const record of records) {
      if (eligible(record)) play(record);
      else stop(record, paused);
    }
  }

  function updateSources(record) {
    const next = sourcesFor(record.video);
    if (record.variant === next.variant && record.sources.length === next.sources.length && record.sources.every((source, index) => source === next.sources[index])) return;
    // Invalidate pending play promises before unloading the previous crop.
    stop(record, true);
    record.sources = next.sources;
    record.variant = next.variant;
    record.video.dataset.mediaVariant = next.variant;
    record.video.removeAttribute('data-media-error');
    record.sourceIndex = 0;
    record.failed = false;
    record.visible = false;
    // A fresh intersection avoids starting a now-hidden responsive element.
    visibility?.unobserve(record.video);
    visibility?.observe(record.video);
  }
  const breakpoint = () => {
    if (destroyed) return;
    for (const record of records) updateSources(record);
    refresh();
  };
  mobile.addEventListener('change', breakpoint);
  const pageVisibility = () => refresh();
  document.addEventListener('visibilitychange', pageVisibility);
  const mutations = typeof MutationObserver === 'function' ? new MutationObserver((entries) => {
    for (const video of new Set(entries.map(({ target }) => target))) {
      const record = records.find((item) => item.video === video);
      if (record) updateSources(record);
    }
    refresh();
  }) : null;
  for (const { video } of records) mutations?.observe(video, {
    attributes: true,
    attributeFilter: ['data-media-pending', 'data-media-hidden', 'data-src', 'data-webm', 'data-mobile-src', 'data-mobile-webm'],
  });

  return {
    setPaused(value) { paused = Boolean(value); refresh(); },
    suspend() { suspended = true; refresh(); },
    resume() { suspended = false; refresh(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      visibility?.disconnect();
      mutations?.disconnect();
      mobile.removeEventListener('change', breakpoint);
      document.removeEventListener('visibilitychange', pageVisibility);
      for (const record of records) {
        record.release();
        stop(record, true);
      }
    },
  };
}
