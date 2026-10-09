// Existing pricing and intake contracts remain in dom.js. Visual motion has one clock.
import { loadPricing, setupForm, reelVideos } from './dom.js';
import { createLandingMotion } from './landing-motion.js';
import { createMediaController } from './media.js';

const videos = [...new Set([
  ...reelVideos().map(({ v }) => v),
  ...document.querySelectorAll('video[data-src]'),
])];
const media = createMediaController(videos);
const motion = createLandingMotion({ onMotionChange: (paused) => media.setPaused(paused) });
setupForm();
loadPricing().then(() => motion.refresh());
for (const year of document.querySelectorAll('#year, [data-year]')) year.textContent = String(new Date().getFullYear());

addEventListener('pagehide', (event) => {
  media.suspend();
  motion.suspend();
  if (!event.persisted) {
    media.destroy();
    motion.destroy();
  }
});
addEventListener('pageshow', (event) => {
  if (event.persisted) {
    motion.resume();
    media.resume();
  }
});
