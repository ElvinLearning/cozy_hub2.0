// The ring of letters: a real CSS 3D object made of letter spans.
//
// Following the Spring '26 CSS branch: three copies of the word are split into
// spans; once fonts are ready the glyph widths are measured and turned into
// angular spacing, so the letters sit around the cylinder at their true
// widths. A ResizeObserver re-measures. The ring itself is aria-hidden; the
// page h1 carries the accessible name.
//
// Timing (CSS branch values from the study): radius 37vmin, perspective
// 5400px, tilt 18deg, one revolution per 150 s, 4.5 s intro. All motion is
// driven from the page clock (update(t, ...)), so it can be stepped.

import { clamp, smoothstep } from '../util.js';

const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);

export class Ring {
  constructor(el, { word, copies = 3, sep = ' · ', turn = 150, intro = 4.5, tilt = 18, spin = 60 } = {}) {
    this.el = el;
    this.tiltEl = el.parentElement;
    this.turn = turn;
    this.intro = intro;
    this.tilt = tilt;
    this.spin = spin; // extra degrees the intro winds in, easing into the ambient rate
    this.R = 0;
    const text = (word + sep).repeat(copies);
    this.glyphs = [...text].map((c) => {
      const s = document.createElement('span');
      s.className = c === '·' ? 'g sep' : 'g';
      s.textContent = c === ' ' ? ' ' : c;
      el.append(s);
      return { el: s, w: 0, a: 0, c };
    });
    this.introDone = false;
  }

  /** Measure glyphs at a reference size and lay them around a circle of radius R px. */
  layout(R) {
    this.R = R;
    const ref = 100;
    this.el.style.fontSize = `${ref}px`;
    this.el.classList.add('measuring');
    let total = 0;
    for (const g of this.glyphs) {
      g.w = g.el.getBoundingClientRect().width;
      total += g.w;
    }
    this.el.classList.remove('measuring');
    // the font size that makes three copies close the circle exactly
    const C = 2 * Math.PI * R;
    const k = C / total;
    this.fontSize = ref * k;
    this.el.style.fontSize = `${this.fontSize.toFixed(2)}px`;
    let acc = 0;
    for (const g of this.glyphs) {
      g.a = ((acc + g.w / 2) / total) * 360;
      acc += g.w;
      g.base = `rotateY(${g.a.toFixed(3)}deg) translateZ(${R.toFixed(1)}px) translate(-50%, -50%)`;
      g.el.style.transform = g.base;
    }
  }

  /**
   * t: seconds since the intro started. dive: 0..1 scroll transition.
   * reduced: hold a fixed orientation, letters only fade in.
   */
  update(t, { dive = 0, reduced = false } = {}) {
    let theta;
    if (reduced) theta = 18;
    else theta = (t / this.turn) * 360 + this.spin * easeOutCubic(t / this.intro) - this.spin + 18;
    const tilt = this.tilt + 52 * smoothstep(0, 1, dive);
    const grow = 1 + 1.6 * Math.pow(dive, 1.5);
    this.el.style.transform = `rotateY(${(-theta).toFixed(3)}deg) scale3d(${grow.toFixed(4)}, 1, ${grow.toFixed(4)})`;
    this.tiltEl.style.transform = `rotateX(${tilt.toFixed(3)}deg)`;
    this.tiltEl.style.opacity = (1 - smoothstep(0.45, 0.8, dive)).toFixed(3);

    // intro: letters rise into place one after another
    if (!this.introDone || t < this.intro) {
      const n = this.glyphs.length;
      for (let i = 0; i < n; i++) {
        const g = this.glyphs[i];
        const p = smoothstep(0, 1, (t - 0.35 - (i / n) * 1.9) / 1.1);
        g.el.style.opacity = p.toFixed(3);
        g.el.style.transform = reduced || p >= 1 ? g.base : `${g.base} translateY(${((1 - p) * 0.5).toFixed(3)}em)`;
      }
      this.introDone = t >= this.intro;
    }
  }

  /** Jump past the intro (still captures). */
  finishIntro() {
    for (const g of this.glyphs) (g.el.style.opacity = 1), (g.el.style.transform = g.base);
    this.introDone = true;
  }
}
