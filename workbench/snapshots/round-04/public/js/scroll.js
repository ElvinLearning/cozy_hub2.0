// One smooth scroll value drives everything. Native scroll sets the target;
// `value` follows with a critically damped spring. The DOM content is
// translated by `value`, and every WebGL chapter reads the same number in
// the same frame, so text and pictures never drift apart.

export class SmoothScroll {
  constructor({ content, reduced = false, stiffness = 90 } = {}) {
    this.content = content;
    this.reduced = reduced;
    this.k = stiffness; // spring stiffness; damping is critical (2*sqrt(k))
    this.target = window.scrollY;
    this.value = this.target;
    this.velocity = 0;
    this.max = 0;
    this.frozen = false; // capture tools set the value directly
    addEventListener('scroll', () => {
      if (!this.frozen) this.target = window.scrollY;
    }, { passive: true });
  }

  /** Set the document height so native scrolling covers the content. */
  setHeight(px) {
    document.body.style.height = `${Math.ceil(px)}px`;
    this.max = Math.max(0, px - innerHeight);
  }

  /** Jump straight to a position (no easing). */
  jump(y) {
    this.target = this.value = Math.max(0, Math.min(this.max, y));
    this.velocity = 0;
    if (!this.frozen) window.scrollTo(0, this.value);
  }

  update(dt) {
    if (this.reduced || this.frozen) {
      if (!this.frozen) this.value = this.target;
      this.velocity = 0;
    } else {
      // semi-implicit Euler, sub-stepped so long frames stay stable
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      const c = 2 * Math.sqrt(this.k);
      for (let i = 0; i < steps; i++) {
        const a = this.k * (this.target - this.value) - c * this.velocity;
        this.velocity += a * h;
        this.value += this.velocity * h;
      }
      if (Math.abs(this.target - this.value) < 0.05 && Math.abs(this.velocity) < 0.5) {
        this.value = this.target;
        this.velocity = 0;
      }
    }
    // whole device pixels keep text crisp; webgl reads the fractional value
    const dpr = devicePixelRatio || 1;
    this.content.style.transform = `translate3d(0, ${-Math.round(this.value * dpr) / dpr}px, 0)`;
    return this.value;
  }
}
