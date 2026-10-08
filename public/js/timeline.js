// Every scroll-driven number on the page, in viewport heights (vh).
// Stage sections have fixed heights from here; flow sections (reel,
// pricing, start) take their natural height and are measured at layout.
// Keys that belong to a flow section are written relative to its top as
// ['section', offset] and resolved by resolve(layout).
//
// Pacing rules: pins ease in/out over >= 0.12 vh (see pinOffset), camera
// keys sit >= 0.35 vh apart, and no two direction changes stack closer
// than that. tools/check-timeline.mjs verifies the camera numerically.

export const STAGES = {
  hero: 2.0,
  assets: 1.5,
  dissolve: 2.2,
  film: 1.1,
  agent: 2.3,
};

export const T = {
  hero: {
    pin: [-1, 0.95, 0.2], // [start, end, soft]; held from the first frame
    copyOut: [0.1, 0.42], // hero copy clears before the ring swings toward it
    cueOut: [0.02, 0.18], // scroll cue fades as soon as you move
  },
  // chapter 1: the chrome loop
  loop: {
    // ring centre is at (2.4, 0.1, -1.0); see chapters/loop.js
    // x and y move one way only (no stacked direction changes; see tools/check-timeline.mjs)
    camera: [
      { t: 0.0, v: [0.05, 0.5, 8.0, 0.2, 0.05, -1.0] }, // position xyz, target xyz
      { t: 0.55, v: [0.45, 0.42, 7.2, 0.95, 0.07, -1.0] },
      { t: 1.05, v: [1.5, 0.3, 5.4, 2.2, 0.1, -1.0] },
      { t: 1.6, v: [2.35, 0.14, 2.6, 2.4, 0.1, -1.0] }, // into the ring
    ],
    ringOpen: [0.15, 0.9], // ring gap widens, pixels drift out
    // phones: the ring sits in the top quarter (NDC y) above the copy, then
    // centres and the camera flies through it
    portrait: { ndcY: 0.46, centre: [0.45, 1.05], fly: [0.45, 1.5], nearDist: 2.6, fitPad: 0.75 },
  },
  // ring iris: chapter 1 -> chapter 2 through the ring
  iris: [0.92, 1.38],
  assets: {
    pin: [2.0, 3.15, 0.2],
    cardsIn: [0.62, 1.55], // the hero print is arriving inside the aperture as the iris opens
    copyIn: [1.95, 2.25],
    copyOut: [2.95, 3.2],
  },
  dissolve: {
    pin: [3.5, 5.3, 0.22],
    progress: [3.25, 5.05], // pixel flight 0 -> 1 (per-pixel stagger inside)
    beats: [3.55, 4.0, 4.45], // the three step captions
    titleOut: [3.82, 4.08], // the headline lifts out before the ring drifts up into its band
    beatLen: 0.55,
    // prints sit left of x = -1, the ring at x = 0.25, the screen at x = 2.5
    camera: [
      // one pull-back (to ~3.5) then one push-in: a single change of direction in z
      { t: 1.4, v: [-1.85, 0.3, 4.4, -1.95, 0.12, 0.35] }, // iris lands on the hero print, close
      { t: 2.6, v: [-0.75, 0.27, 6.3, -0.8, 0.0, 0.0] },
      { t: 3.5, v: [-0.05, 0.24, 7.0, 0.05, 0.0, 0.0] },
      { t: 4.4, v: [1.15, 0.17, 6.4, 1.3, 0.0, 0.0] },
      { t: 5.2, v: [2.35, 0.07, 5.0, 2.45, 0.0, 0.0] },
      { t: 6.15, v: [2.5, 0.0, 3.3, 2.5, 0.0, 0.0] }, // film spans ~88% of a 16:10 frame: big, not visibly upscaled
    ],
  },
  film: {
    videoIn: [4.75, 5.15], // pixels resolve into the playing film
    // phones: follow the stream along x, keep the subject in the band the copy leaves free
    portrait: { ndcY: { assets: 0.38, dissolve: 0.13, film: 0.04 }, printHalfWidth: 1.9, screenPad: 1.04 },
    pushIn: [5.2, 6.15],
  },
  // flow + stage sections after the film, relative to section tops
  // the film recedes as the reel's header rises over it (it used to stay at full
  // brightness behind the eyebrow until the reel reached the top of the screen)
  reel: { dim: [['reel', -0.45], ['reel', 0.2]] },
  agent: {
    enter: [['agent', -0.75], ['agent', -0.05]], // pixel mosaic into chapter 3
    pin: [['agent', 0], ['agent', 1.3], 0.2],
    copyIn: [['agent', -0.25], ['agent', 0.1]],
    chat: [['agent', 0.05], ['agent', 1.2]], // chat messages appear across this span
    // orb at the origin, centred between the copy (left) and the chat (right)
    camera: [
      { t: ['agent', -0.75], v: [0.0, 0.7, 8.6, 0.0, 0.0, 0.0] },
      { t: ['agent', 0.2], v: [-0.4, 0.4, 7.4, 0.0, 0.0, 0.0] },
      { t: ['agent', 1.4], v: [-0.8, 0.05, 6.9, 0.0, -0.05, 0.0] },
      { t: ['agent', 2.4], v: [-0.95, -0.5, 6.6, 0.0, -0.2, 0.0] },
    ],
    // agent scene winds down as the chat ends and is gone before the pricing header reaches the orb
    // (desktop) / before the departing agent header has fully crossed it (phones)
    exit: [['pricing', -1.1], ['pricing', -0.55]],
    portrait: { ndcY: 0.55, swarmPad: 0.3 },
  },
  start: {
    // the loop comes back to close the page, once the start header has (nearly) cleared its spot
    enter: [['start', -0.25], ['start', 0.15]],
    // the closing loop gets its own space: lower left under the copy on desktop,
    // lower part of the screen (dimmed, above the footer) on phones. ndc = where the ring centre sits.
    frame: { ndc: [-0.52, -0.3], dist: [16, 14.5], portraitNdcY: -0.36, dolly: [['start', -0.9], ['start', 0.9]] },
    exposure: { desktop: 0.7, portrait: 0.38 },
  },
};

/** Resolve ['section', offset] references against measured section tops (vh). */
export function resolve(layout) {
  const r = (v) => (Array.isArray(v) && typeof v[0] === 'string' ? layout.top[v[0]] + v[1] : v);
  const walk = (o) => {
    if (Array.isArray(o)) {
      if (typeof o[0] === 'string' && typeof o[1] === 'number' && o.length === 2) return r(o);
      return o.map(walk);
    }
    if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]));
    return o;
  };
  return walk(T);
}
