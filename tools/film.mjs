// Frame-perfect 60 fps film of the full scroll.
//
//   node tools/film.mjs --out workbench/film/cozy-1080p.mp4 --w 1920 --h 1080 --dpr 1 [--base url] [--from s --to s]
//
// - Playwright's fake clock is installed and paused, so time only moves
//   when we say: exactly one animation frame (1/60 s) per video frame,
//   stepped through __app.step because the paused clock never fires rAF.
// - Every <video> is paused and seeked to the same virtual time each frame.
// - Scroll is fed as an exact value via __app.setScroll, only on frames
//   where it moves (no synthetic scroll-event spam).
// - The schedule: hold on the intro, cruise at ~0.75 vh/s, slow to ~0.4 vh/s
//   through the signature moments, with speed ramps >= 0.5 vh long.
// - PNG frames are piped straight into x264 (crf 13, yuv420p, faststart).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const W = +arg('w', 1920), H = +arg('h', 1080), DPR = +arg('dpr', 1);
const out = arg('out', 'workbench/film/cozy.mp4');
const base = arg('base', 'http://localhost:8090');
const crf = arg('crf', '13');
const FPS = 60, FRAME_MS = 16;
const introHold = +arg('hold', 6);
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.clock.install({ time: new Date('2026-10-01T12:00:00Z') });
await page.goto(`${base}/?capture&dpr=${DPR}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app?.ready, null, { timeout: 300000, polling: 250 });
await page.clock.pauseAt(new Date('2026-10-01T13:00:00Z'));

const L = await page.evaluate(() => ({ ...window.__app.layout, T: window.__app.T, states: window.__app.states }));
const vh = L.vh, maxS = L.max / vh;
const T = L.T;

// ---- speed profile in vh/s, keyed to the story beats
const SLOW = [
  [T.iris[0] - 0.1, T.iris[1] + 0.1, 0.45],
  [T.dissolve.progress[0], T.film.pushIn[1], 0.4],
  [T.agent.enter[0], T.agent.chat[1], 0.55],
];
const CRUISE = 0.75, RAMP = 0.5; // vh
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function speed(s) {
  let v = CRUISE;
  for (const [a, b, slow] of SLOW) {
    const k = smooth(a - RAMP, a, s) * (1 - smooth(b, b + RAMP, s));
    v = Math.min(v, CRUISE + (slow - CRUISE) * k);
  }
  // ease out of rest at the start and into rest at the very end (square-root profile
  // = constant deceleration, so the stop has no kink; floor keeps it moving to the end)
  const tail = Math.min(1, Math.sqrt(Math.max(0, maxS - s) / 0.6));
  return v * Math.max(0.2, smooth(0, 0.35, s)) * Math.max(0.03, tail);
}
const from = +arg('from', 0), to = Math.min(+arg('to', maxS), maxS);
const schedule = [];
for (let i = 0; i < Math.round((from === 0 ? introHold : 0.5) * FPS); i++) schedule.push(from);
let s = from;
while (s < to - 1e-4) {
  s = Math.min(to, s + speed(s) / FPS);
  schedule.push(s);
}
for (let i = 0; i < FPS * 1.5; i++) schedule.push(to);
const frames = schedule.length;
console.log(`film: ${W}x${H}@${DPR}x, ${frames} frames (${(frames / FPS).toFixed(1)} s), scroll ${from.toFixed(2)} -> ${to.toFixed(2)} vh`);

const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((r) => ff.on('close', r));

// Playwright 1.56's paused clock never fires requestAnimationFrame, so the
// page hands its frame loop to us: one __app.step(1/60) per video frame.
await page.evaluate(() => (window.__app.manual(true), window.__app.restartIntro()));
// the first capture at a new size warms up the software compositor (~100 s at 1080p); do it off the clock
await page.screenshot({ type: 'png', timeout: 600000 });
let lastS = -1;
const t0 = Date.now();
const log = [];
for (let f = 0; f < frames; f++) {
  const sv = schedule[f];
  if (sv !== lastS) {
    await page.evaluate((y) => window.__app.setScroll(y), sv * vh);
    lastS = sv;
  }
  // seek media to the time this frame will show, then run exactly one 16 ms frame.
  // (page timers are fake and paused, so the seek's own timeout can't fire: race it here)
  const vt = (await page.evaluate(() => window.__app.time)) + 1 / FPS;
  await Promise.race([page.evaluate((t) => window.__app.seekMedia(t), vt), new Promise((r) => setTimeout(r, 4000))]);
  await page.clock.runFor(FRAME_MS); // page timers and Date move in lockstep
  await page.evaluate((dt) => window.__app.step(dt), 1 / FPS);
  const png = await page.screenshot({ type: 'png', timeout: 180000 });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  log.push({ f, s: +sv.toFixed(4), t: +vt.toFixed(3), job: await page.evaluate(() => window.__app.job?.a + (window.__app.job?.b ? '>' + window.__app.job.b : '')) });
  if (f % 60 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`  frame ${f}/${frames}  s=${sv.toFixed(2)}  ${(el / (f + 1)).toFixed(2)} s/frame  eta ${(((frames - f) * el) / (f + 1) / 60).toFixed(1)} min`);
  }
}
ff.stdin.end();
await ffDone;
writeFileSync(out.replace(/\.mp4$/, '.frames.json'), JSON.stringify({ W, H, DPR, FPS, vh, frames: log }, null, 0));
console.log(`wrote ${out} in ${((Date.now() - t0) / 60000).toFixed(1)} min; page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
await browser.close();
