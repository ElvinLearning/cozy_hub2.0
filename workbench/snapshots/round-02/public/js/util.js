// Small, dependency-free math used by both the DOM and WebGL sides.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a)));
export const smoothstep = (a, b, x) => {
  const t = invLerp(a, b, x);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, x) => {
  const t = invLerp(a, b, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Frame-rate independent exponential approach. lambda ~ 1/time-constant. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** 0 -> 1 -> 0 window with soft edges: in over [a, b], out over [c, d]. */
export const band = (x, a, b, c, d) => smoothstep(a, b, x) * (1 - smoothstep(c, d, x));

// Integral of smoothstep on [0,1]: I(t) = t^3 - t^4/2, I(1) = 1/2.
const I = (t) => t * t * t - (t * t * t * t) / 2;

/**
 * Soft pin. Returns how many units the pinned thing has been held back at
 * scroll s, for a hold between a and b. Its screen velocity is 1 - w(s),
 * where w eases 0 -> 1 over [a - k/2, a + k/2] and 1 -> 0 over
 * [b - k/2, b + k/2]: the element decelerates into the pin and accelerates
 * out of it instead of stopping dead (C1 continuous, no jump). Centring the
 * ramps on a and b makes it settle exactly where a hard pin at a would.
 */
export function pinOffset(s, a, b, k = 0.15) {
  return pinRaw(s, a - k / 2, b + k / 2, k);
}
function pinRaw(s, a, b, k) {
  k = Math.max(1e-4, Math.min(k, (b - a) / 2));
  if (s <= a) return 0;
  const inRamp = (x) => k * I(clamp(x / k));
  // ramp up
  if (s <= a + k) return inRamp(s - a);
  const full = k / 2;
  if (s <= b - k) return full + (s - (a + k));
  // ramp down: w = 1 - smoothstep, integral = t*k - k*I(t)
  const mid = full + (b - k - (a + k));
  const t = clamp((s - (b - k)) / k);
  return mid + k * (t - I(t));
}
/** Total hold of a pin once fully past it. */
export const pinLength = (a, b, k = 0.15) => pinOffset(b + 1, a, b, k); // = b - a

/** Deterministic hash for per-instance randomness (same on every machine). */
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/** Non-uniform Catmull-Rom (Hermite) through keys [{t, v:[...]}], t ascending, clamped ends. */
export function spline(keys, t) {
  if (t <= keys[0].t) return keys[0].v.slice();
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v.slice();
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = (t - k1.t) / (k2.t - k1.t);
  // non-uniform Catmull-Rom tangents scaled to the segment's parameter span
  const out = [];
  for (let d = 0; d < k1.v.length; d++) {
    const p0 = k0.v[d], p1 = k1.v[d], p2 = k2.v[d], p3 = k3.v[d];
    const dt1 = k2.t - k1.t;
    // zero tangent at the first and last key: the path eases out of rest and into rest
    const m1 = k0 === k1 ? 0 : ((p2 - p0) / (k2.t - k0.t)) * dt1;
    const m2 = k3 === k2 ? 0 : ((p3 - p1) / (k3.t - k1.t)) * dt1;
    const u2 = u * u, u3 = u2 * u;
    out.push((2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2);
  }
  return out;
}
