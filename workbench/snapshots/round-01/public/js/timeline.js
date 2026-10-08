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
    pin: [0, 0.95, 0.2], // [start, end, soft]
    copyOut: [0.32, 0.86], // hero copy dissolves out
    cueOut: [0.02, 0.18], // scroll cue fades as soon as you move
  },
  // chapter 1: the chrome loop
  loop: {
    // ring centre is at (2.4, 0.1, -1.0); see chapters/loop.js
    camera: [
      { t: 0.0, v: [0.15, 0.25, 8.0, 0.35, 0.05, -1.0] }, // position xyz, target xyz
      { t: 0.55, v: [-0.5, 0.6, 7.4, 0.8, 0.08, -1.0] },
      { t: 1.05, v: [1.5, 0.35, 5.4, 2.2, 0.1, -1.0] },
      { t: 1.6, v: [2.35, 0.14, 2.6, 2.4, 0.1, -1.0] }, // into the ring
    ],
    ringOpen: [0.15, 0.9], // ring gap widens, pixels drift out
  },
  // ring iris: chapter 1 -> chapter 2 through the ring
  iris: [1.12, 1.62],
  assets: {
    pin: [2.0, 3.15, 0.2],
    cardsIn: [1.3, 2.35],
    copyIn: [1.95, 2.25],
    copyOut: [2.95, 3.2],
  },
  dissolve: {
    pin: [3.5, 5.3, 0.22],
    progress: [3.25, 5.05], // pixel flight 0 -> 1 (per-pixel stagger inside)
    beats: [3.55, 4.05, 4.55], // the three step captions
    beatLen: 0.55,
    // prints sit left of x = -1, the ring at x = 0.25, the screen at x = 2.5
    camera: [
      { t: 1.4, v: [-0.9, 0.3, 6.4, -1.1, 0.0, 0.0] },
      { t: 2.6, v: [-0.3, 0.2, 6.0, -0.5, 0.0, 0.0] },
      { t: 3.5, v: [-0.1, 0.3, 7.0, 0.1, 0.0, 0.0] },
      { t: 4.4, v: [1.2, 0.2, 6.4, 1.4, 0.0, 0.0] },
      { t: 5.2, v: [2.3, 0.05, 5.0, 2.5, 0.0, 0.0] },
      { t: 6.15, v: [2.5, 0.0, 1.9, 2.5, 0.0, 0.0] }, // screen fills the frame
    ],
  },
  film: {
    videoIn: [4.75, 5.15], // pixels resolve into the playing film
    pushIn: [5.2, 6.15],
    handoff: [5.95, 6.45], // webgl screen hands over to the DOM reel
  },
  // flow + stage sections after the film, relative to section tops
  reel: { dim: [['reel', 0.05], ['reel', 0.6]] },
  agent: {
    enter: [['agent', -0.75], ['agent', -0.05]], // pixel mosaic into chapter 3
    pin: [['agent', 0], ['agent', 1.3], 0.2],
    copyIn: [['agent', -0.25], ['agent', 0.1]],
    chat: [['agent', 0.05], ['agent', 1.2]], // chat messages appear across this span
    // orb at the origin, centred between the copy (left) and the chat (right)
    camera: [
      { t: ['agent', -0.75], v: [0.0, 0.7, 8.6, 0.0, 0.0, 0.0] },
      { t: ['agent', 0.2], v: [-0.4, 0.4, 7.0, 0.0, 0.0, 0.0] },
      { t: ['agent', 1.4], v: [-0.9, 0.05, 6.4, 0.0, -0.05, 0.0] },
      { t: ['agent', 2.4], v: [-0.7, -0.5, 7.4, 0.0, -0.2, 0.0] },
    ],
    exit: [['pricing', -0.4], ['pricing', 0.5]], // agent scene sinks to a backdrop
  },
  start: {
    enter: [['start', -0.9], ['start', -0.1]], // the loop comes back to close the page
    camera: [
      { t: ['start', -0.9], v: [2.4, 0.9, 10.5, 2.4, 0.1, -1.0] },
      { t: ['start', 0.6], v: [2.4, 0.35, 8.4, 2.4, 0.1, -1.0] },
    ],
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
