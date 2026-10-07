// Numeric checks on every camera path before rendering anything:
// pitch, speed and acceleration along scroll, and stacked direction changes.
// node tools/check-timeline.mjs [layout.json]   (defaults to a 1440x900 layout)
import { readFileSync } from 'node:fs';
import { T, resolve } from '../public/js/timeline.js';
import { spline } from '../public/js/util.js';

const layout = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : { top: { hero: 0, assets: 2, dissolve: 3.5, film: 5.7, reel: 6.8, agent: 9.4, pricing: 11.7, start: 12.95 } };
const R = resolve(layout);
const paths = { loop: R.loop.camera, studio: R.dissolve.camera, agent: R.agent.camera };
const ds = 0.005;
let problems = 0;
for (const [name, keys] of Object.entries(paths)) {
  const a = keys[0].t, b = keys[keys.length - 1].t;
  let maxPitch = 0, maxV = 0, maxA = 0, maxScreen = 0;
  const turns = [];
  let prevDir = null;
  const lastSign = [0, 0, 0];
  for (let s = a; s <= b; s += ds) {
    const p0 = spline(keys, s), p1 = spline(keys, s + ds), p2 = spline(keys, s + 2 * ds);
    const v = [0, 1, 2].map((i) => (p1[i] - p0[i]) / ds);
    const v2 = [0, 1, 2].map((i) => (p2[i] - p1[i]) / ds);
    const acc = Math.hypot(...[0, 1, 2].map((i) => (v2[i] - v[i]) / ds));
    const speed = Math.hypot(...v);
    const look = [p0[3] - p0[0], p0[4] - p0[1], p0[5] - p0[2]];
    const pitch = (Math.atan2(look[1], Math.hypot(look[0], look[2])) * 180) / Math.PI;
    // angular speed of the view direction (deg per vh): what reads as "whip"
    const l1 = [p1[3] - p1[0], p1[4] - p1[1], p1[5] - p1[2]];
    const cos = (look[0] * l1[0] + look[1] * l1[1] + look[2] * l1[2]) / (Math.hypot(...look) * Math.hypot(...l1));
    const ang = (Math.acos(Math.min(1, cos)) * 180) / Math.PI / ds;
    maxPitch = Math.max(maxPitch, Math.abs(pitch));
    maxV = Math.max(maxV, speed);
    maxA = Math.max(maxA, acc);
    maxScreen = Math.max(maxScreen, ang);
    // direction reversals on any axis (sign of the last clearly-moving velocity flips)
    for (let i = 0; i < 3; i++) {
      if (Math.abs(v[i]) < 0.05) continue;
      const sg = Math.sign(v[i]);
      if (lastSign[i] && sg !== lastSign[i]) turns.push(+s.toFixed(3));
      lastSign[i] = sg;
    }
    prevDir = look;
  }
  turns.sort((x, y) => x - y);
  // axes turning within 0.05 vh of each other are one change of direction (the path curving);
  // two separate changes closer than 0.35 vh are what reads as a hitch
  const events = turns.filter((t, i) => i === 0 || t - turns[i - 1] > 0.05);
  const stacked = events.filter((t, i) => i > 0 && t - events[i - 1] < 0.35);
  const bad = maxPitch > 25 || maxScreen > 60 || stacked.length;
  if (bad) problems++;
  console.log(`${bad ? 'WARN' : 'ok  '} ${name.padEnd(7)} pitch<=${maxPitch.toFixed(1)}deg  speed<=${maxV.toFixed(2)} u/vh  accel<=${maxA.toFixed(1)} u/vh^2  view-rotation<=${maxScreen.toFixed(1)} deg/vh  direction changes ${events.length}${stacked.length ? `  STACKED at ${stacked.join(',')}` : ''}`);
}
// soft pins must ease over >= 0.1 vh
for (const [k, v] of Object.entries({ hero: R.hero.pin, assets: R.assets.pin, dissolve: R.dissolve.pin, agent: R.agent.pin })) {
  const ok = v[2] >= 0.1;
  if (!ok) problems++;
  console.log(`${ok ? 'ok  ' : 'WARN'} pin ${k.padEnd(8)} [${v[0].toFixed(2)}, ${v[1].toFixed(2)}] soft ${v[2]}`);
}
process.exit(problems ? 1 : 0);
