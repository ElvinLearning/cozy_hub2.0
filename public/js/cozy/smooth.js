// Desktop-only wheel smoothing over native scroll (the study's Lenis role).
// The document still scrolls natively, so sticky stages, anchors, the
// keyboard and the scrollbar behave as usual; only wheel input is eased.
// Touch and coarse pointers are left alone.

export class Smooth {
  constructor({ enabled = true, lambda = 9 } = {}) {
    this.enabled = enabled && matchMedia('(pointer: fine)').matches && !matchMedia('(hover: none)').matches;
    this.lambda = lambda;
    this.target = this.value = scrollY;
    this.written = -1;
    this.frozen = false; // capture tools drive scroll directly
    this.max = () => document.documentElement.scrollHeight - innerHeight;
    if (this.enabled) {
      addEventListener('wheel', (e) => {
        if (this.frozen || e.ctrlKey || e.defaultPrevented) return;
        // let scrollable children (open menus, textareas) keep their wheel
        if (e.target.closest?.('textarea, select, .pill-list')) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
        this.target = Math.max(0, Math.min(this.max(), this.target + e.deltaY * unit));
      }, { passive: false });
    }
    // keyboard, scrollbar, anchors and find-in-page move the page natively: follow them
    addEventListener('scroll', () => {
      if (Math.abs(scrollY - this.written) > 1.5) this.target = this.value = scrollY;
    }, { passive: true });
  }

  /** Animate to y (anchors). */
  to(y) {
    this.target = Math.max(0, Math.min(this.max(), y));
    if (!this.enabled) this.jump(this.target);
  }

  jump(y) {
    this.target = this.value = Math.max(0, Math.min(this.max(), y));
    this.written = Math.round(this.value);
    scrollTo(0, this.value);
  }

  update(dt) {
    if (this.frozen || Math.abs(this.target - this.value) < 0.5) {
      if (!this.frozen && this.value !== this.target) this.jump(this.target);
      return scrollY;
    }
    this.value += (this.target - this.value) * (1 - Math.exp(-this.lambda * dt));
    this.written = Math.round(this.value);
    scrollTo(0, this.value);
    return scrollY;
  }
}
