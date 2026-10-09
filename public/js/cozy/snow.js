// Tier 1: soft snow on a Canvas2D layer, pushed around by the pointer.
// A coarse velocity grid stands in for the study's fluid field: pointer
// moves splat velocity into the grid, the grid decays, flakes sample it.
// Drawn only while a dark chapter is on screen (opacity from the page clock).

import { hash } from '../util.js';

export class Snow {
  constructor(canvas, { count = 140 } = {}) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.n = count;
    this.flakes = Array.from({ length: count }, (_, i) => ({ u: hash(i), v: hash(i + 99), r: 0.8 + hash(i + 7) * 2.4, s: 0.4 + hash(i + 3) * 0.9, ph: hash(i + 11) * 6.28, vx: 0, vy: 0 }));
    this.G = 24;
    this.gx = new Float32Array(this.G * this.G);
    this.gy = new Float32Array(this.G * this.G);
    this.last = null;
    addEventListener('pointermove', (e) => this.splat(e.clientX, e.clientY), { passive: true });
    this.resize();
  }

  resize() {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    this.w = innerWidth;
    this.h = innerHeight;
    this.c.width = Math.round(this.w * d);
    this.c.height = Math.round(this.h * d);
    this.x.setTransform(d, 0, 0, d, 0, 0);
  }

  splat(px, py) {
    if (this.last) {
      const dx = px - this.last[0], dy = py - this.last[1];
      const G = this.G, cx = (px / this.w) * G, cy = (py / this.h) * G;
      for (let j = Math.max(0, Math.floor(cy - 2)); j < Math.min(G, Math.ceil(cy + 2)); j++)
        for (let i = Math.max(0, Math.floor(cx - 2)); i < Math.min(G, Math.ceil(cx + 2)); i++) {
          const f = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / 2);
          this.gx[j * G + i] += dx * f * 0.6;
          this.gy[j * G + i] += dy * f * 0.6;
        }
    }
    this.last = [px, py];
  }

  /** t: seconds, dt: step, alpha: 0..1 visibility. */
  draw(t, dt, alpha) {
    const { x, w, h, G } = this;
    x.clearRect(0, 0, w, h);
    this.c.style.opacity = alpha.toFixed(3);
    if (alpha <= 0.001) return;
    const k = Math.exp(-2.2 * dt);
    for (let i = 0; i < this.gx.length; i++) (this.gx[i] *= k), (this.gy[i] *= k);
    x.fillStyle = '#fff7ea';
    for (const f of this.flakes) {
      const gi = Math.min(G - 1, Math.max(0, Math.floor(f.v * G))) * G + Math.min(G - 1, Math.max(0, Math.floor(f.u * G)));
      f.vx += (this.gx[gi] / w - f.vx) * Math.min(1, dt * 3);
      f.vy += (this.gy[gi] / h - f.vy) * Math.min(1, dt * 3);
      f.u = (f.u + f.vx * dt * 2 + Math.sin(t * 0.7 + f.ph) * 0.00025 + 1) % 1;
      f.v = f.v + (f.s * 0.045 * dt) + f.vy * dt * 2;
      if (f.v > 1.02) (f.v -= 1.04), (f.u = hash(f.u * 1000 + t));
      if (f.v < -0.02) f.v += 1.04;
      x.globalAlpha = 0.35 + 0.5 * (f.r / 3.2);
      x.beginPath();
      x.arc(f.u * w, f.v * h, f.r, 0, 6.2832);
      x.fill();
    }
    x.globalAlpha = 1;
  }
}
