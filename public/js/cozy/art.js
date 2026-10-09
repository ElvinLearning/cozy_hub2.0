// Cozy illustration kit. Hand-drawn SVG in one flat, rounded, warm style:
// no outlines, one shade per shape, cocoa for faces. Parts carry classes
// (.breath, .steam, .tail, .blink, .snow, .glow, .flicker) that cozy.css
// animates, so every motion runs on the page's one clock.

export const C = {
  cocoa: '#3a2519',
  cocoa2: '#6b4a36',
  wall: '#f3e2c7',
  wallShade: '#ead3b2',
  floor: '#d9b089',
  floorShade: '#c99c74',
  cream: '#fff6e8',
  paper: '#f7efe2',
  honey: '#f0a43c',
  amber: '#dc6a32',
  red: '#c4553b',
  redShade: '#a8432f',
  redLight: '#e07a5f',
  mustard: '#e2a03f',
  mustardShade: '#c98728',
  sage: '#8aa58a',
  sageShade: '#6f8d70',
  sky: '#2b3466',
  sky2: '#46558f',
  ginger: '#e8955a',
  gingerShade: '#cf7a43',
  gingerBelly: '#f8dcbf',
  pup: '#f2dfc5',
  pupShade: '#d9bd98',
  pupEar: '#b98457',
  blush: '#f2a08f',
  choc: '#6b3a24',
  chocTop: '#8a4e30',
};

const g = (cls, body, extra = '') => `<g class="${cls}"${extra}>${body}</g>`;

/** Shared defs: knit pattern, paper grain, glows. Put once per SVG (ids are prefixed). */
export function defs(p) {
  return `<defs>
    <pattern id="${p}-knit" width="14" height="12" patternUnits="userSpaceOnUse">
      <rect width="14" height="12" fill="${C.red}"/>
      <path d="M0 2 L3.5 8 L7 2 M7 2 L10.5 8 L14 2" fill="none" stroke="${C.redLight}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
    </pattern>
    <pattern id="${p}-knitCream" width="14" height="12" patternUnits="userSpaceOnUse">
      <rect width="14" height="12" fill="#f3d9bd"/>
      <path d="M0 2 L3.5 8 L7 2 M7 2 L10.5 8 L14 2" fill="none" stroke="#e5c29c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </pattern>
    <pattern id="${p}-rug" width="40" height="16" patternUnits="userSpaceOnUse">
      <rect width="40" height="16" fill="${C.red}"/>
      <rect y="5" width="40" height="3" fill="${C.honey}" opacity=".8"/>
      <rect y="11" width="40" height="1.5" fill="${C.cream}" opacity=".7"/>
    </pattern>
    <linearGradient id="${p}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.sky2}"/></linearGradient>
    <radialGradient id="${p}-lamp"><stop offset="0" stop-color="#ffd88a" stop-opacity=".95"/><stop offset=".45" stop-color="#ffc66e" stop-opacity=".35"/><stop offset="1" stop-color="#ffc66e" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}-warm"><stop offset="0" stop-color="#fff1d6" stop-opacity=".9"/><stop offset="1" stop-color="#fff1d6" stop-opacity="0"/></radialGradient>
    <filter id="${p}-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .23  0 0 0 0 .15  0 0 0 0 .1  0 0 0 .07 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
      <feBlend in="SourceGraphic" mode="multiply"/>
    </filter>
  </defs>`;
}

/** Three curls of steam rising from (x, y). Each curl animates on its own phase. */
export function steam(x, y, s = 1, opacity = 0.75) {
  const curl = (dx, d, delay) =>
    `<path class="steam" style="animation-delay:${delay}s" d="${d}" transform="translate(${x + dx * s} ${y}) scale(${s})" fill="none" stroke="#fffaf0" stroke-width="5" stroke-linecap="round" opacity="${opacity}"/>`;
  return g(
    'steam-group',
    curl(-12, 'M0 0 C -10 -14, 10 -26, 0 -40 S -10 -66, 0 -80', 0) +
      curl(0, 'M0 0 C 10 -16, -10 -30, 0 -46 S 12 -72, 0 -92', -1.3) +
      curl(12, 'M0 0 C -8 -12, 8 -24, 0 -36 S -8 -58, 0 -70', -2.4)
  );
}

/** A mug of hot chocolate with marshmallows. (x, y) = bottom centre. */
export function mug(x, y, s = 1, { color = C.red, band = C.cream, steamOn = true } = {}) {
  const w = 52, h = 54;
  return g(
    'mug',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="${w * 0.62}" ry="6" fill="${C.cocoa}" opacity=".12"/>
      <path d="M${w / 2 + 2} ${-h * 0.72} c 22 0 22 30 0 30" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>
      <path d="M${-w / 2} ${-h} h ${w} v ${h - 10} q 0 10 -10 10 h ${-w + 20} q -10 0 -10 -10 z" fill="${color}"/>
      <rect x="${-w / 2}" y="${-h * 0.55}" width="${w}" height="9" fill="${band}" opacity=".9"/>
      <path d="M${-w / 2 + 6} ${-h + 6} v ${h - 22}" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".18"/>
      <ellipse cx="0" cy="${-h}" rx="${w / 2}" ry="7" fill="${C.choc}"/>
      <ellipse cx="0" cy="${-h + 1}" rx="${w / 2 - 4}" ry="5" fill="${C.chocTop}"/>
      <rect x="-15" y="${-h - 9}" width="12" height="11" rx="3.5" fill="${C.cream}" transform="rotate(-12 -9 ${-h - 4})"/>
      <rect x="0" y="${-h - 11}" width="13" height="12" rx="3.5" fill="#fff" transform="rotate(10 6 ${-h - 5})"/>
      <rect x="-4" y="${-h - 4}" width="10" height="8" rx="3" fill="#ffe9ef"/>
    </g>
    ${steamOn ? steam(x, y - h * s - 10 * s, s) : ''}`
  );
}

/** Sleeping curled cat. (x, y) = centre of the body. Faces left. */
export function cat(x, y, s = 1, { fur = C.ginger, shade = C.gingerShade, belly = C.gingerBelly } = {}) {
  return g(
    'cat',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="36" rx="84" ry="9" fill="${C.cocoa}" opacity=".14"/>
      <g class="breath">
        <path d="M-40 34 C -64 30, -60 -26, -6 -36 C 46 -46, 86 -18, 84 12 C 82 34, 56 40, 20 40 Z" fill="${fur}"/>
        <path d="M2 -35 q 10 14 2 30 M26 -36 q 12 14 4 32 M50 -26 q 10 12 4 28" fill="none" stroke="${shade}" stroke-width="7" stroke-linecap="round"/>
        <path d="M-30 30 C -10 40, 50 40, 76 22" fill="none" stroke="${shade}" stroke-width="6" stroke-linecap="round" opacity=".5"/>
      </g>
      <g class="tail">
        <path d="M78 18 C 84 44, 30 52, -26 46 C -52 44, -76 40, -84 30" fill="none" stroke="${fur}" stroke-width="17" stroke-linecap="round"/>
        <path d="M-66 37 C -74 36, -80 34, -84 30" fill="none" stroke="${shade}" stroke-width="17" stroke-linecap="round"/>
      </g>
      <ellipse cx="-62" cy="28" rx="12" ry="8" fill="${belly}"/>
      <ellipse cx="-42" cy="31" rx="12" ry="8" fill="${belly}"/>
      <g class="head">
        <ellipse cx="-52" cy="0" rx="40" ry="33" fill="${shade}"/>
        <path d="M-88 -10 C -92 -30, -90 -44, -84 -52 C -74 -46, -66 -38, -62 -30 Z" fill="${fur}" stroke="${fur}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-40 -32 C -34 -42, -24 -50, -14 -52 C -10 -40, -12 -26, -18 -16 Z" fill="${fur}" stroke="${fur}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-84 -42 C -82 -36, -78 -32, -74 -30 L -84 -26 Z" fill="${C.blush}" opacity=".75"/>
        <path d="M-20 -44 C -20 -36, -22 -30, -26 -26 L -34 -32 Z" fill="${C.blush}" opacity=".75"/>
        <ellipse cx="-54" cy="-4" rx="38" ry="31" fill="${fur}"/>
        <path d="M-58 -34 q 4 8 0 14 M-48 -35 q 3 7 0 12" fill="none" stroke="${shade}" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="-56" cy="12" rx="22" ry="13" fill="${belly}"/>
        <path class="blink-lid" d="M-78 -2 q 8 7 16 0 M-48 -2 q 8 7 16 0" fill="none" stroke="${C.cocoa}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M-58 7 h 6 l -3 4 z" fill="#d9675b" stroke="#d9675b" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-61 14 q 3 3 6 0 q 3 3 6 0" fill="none" stroke="${C.cocoa}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
        <ellipse cx="-82" cy="8" rx="7" ry="4.5" fill="${C.blush}" opacity=".6"/>
        <ellipse cx="-28" cy="8" rx="7" ry="4.5" fill="${C.blush}" opacity=".6"/>
      </g>
      <text class="zzz" x="-24" y="-60" font-family="Fraunces, serif" font-size="20" font-weight="600" fill="${C.cocoa2}" opacity=".6">z</text>
      <text class="zzz z2" x="-10" y="-78" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="${C.cocoa2}" opacity=".5">z</text>
    </g>`
  );
}

/** Sleeping puppy, curled, floppy ears. (x, y) = centre. */
export function pup(x, y, s = 1) {
  return g(
    'pup',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="30" rx="70" ry="9" fill="${C.cocoa}" opacity=".12"/>
      <g class="breath">
        <ellipse cx="12" cy="2" rx="62" ry="30" fill="${C.pup}"/>
        <ellipse cx="22" cy="-6" rx="22" ry="14" fill="${C.pupEar}" opacity=".55"/>
      </g>
      <path class="tail" d="M70 4 q 18 -10 10 -26" fill="none" stroke="${C.pup}" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="-42" cy="0" rx="30" ry="26" fill="${C.pup}"/>
      <path d="M-66 -12 q -16 8 -8 34 q 10 4 16 -6 z" fill="${C.pupEar}"/>
      <path d="M-22 -16 q 12 6 8 30 q -10 2 -14 -6 z" fill="${C.pupEar}"/>
      <ellipse cx="-50" cy="12" rx="14" ry="10" fill="#fbf1e4"/>
      <ellipse cx="-56" cy="8" rx="5" ry="4" fill="${C.cocoa}"/>
      <path d="M-50 -2 q 5 4 10 0 M-36 -4 q 4 3 8 0" fill="none" stroke="${C.cocoa}" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="-30" cy="6" rx="5" ry="3.5" fill="${C.blush}" opacity=".6"/>
      <ellipse cx="-14" cy="22" rx="14" ry="7" fill="${C.pup}"/>
      <ellipse cx="-36" cy="24" rx="12" ry="6" fill="${C.pupShade}"/>
    </g>`
  );
}

/** Night window with snow. (x, y) top-left, w x h. Snow is clipped to the glass. */
export function window(p, x, y, w, h) {
  const flakes = Array.from({ length: 26 }, (_, i) => {
    const fx = x + 10 + ((i * 37) % (w - 20));
    const fy = y + 8 + ((i * 53) % (h - 30));
    const r = 1.6 + ((i * 7) % 5) * 0.45;
    return `<circle class="snow" style="animation-delay:${-((i * 0.71) % 6).toFixed(2)}s;animation-duration:${(5 + (i % 4)).toFixed(1)}s" cx="${fx}" cy="${fy}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.55 + (i % 3) * 0.15).toFixed(2)}"/>`;
  }).join('');
  return g(
    'window',
    `<clipPath id="${p}-glass"><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="10"/></clipPath>
    <rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="18" fill="${C.wallShade}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${C.cream}"/>
    <g clip-path="url(#${p}-glass)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}-sky)"/>
      <circle cx="${x + w * 0.72}" cy="${y + h * 0.26}" r="${Math.min(w, h) * 0.1}" fill="#fff4d6"/>
      <circle cx="${x + w * 0.72}" cy="${y + h * 0.26}" r="${Math.min(w, h) * 0.18}" fill="#fff4d6" opacity=".12"/>
      <path d="M${x} ${y + h - 30} q ${w * 0.25} -26 ${w * 0.5} -8 t ${w * 0.5} -6 v 40 h ${-w} z" fill="#dfe6f5" opacity=".85"/>
      <path d="M${x + w * 0.16} ${y + h - 34} l 14 -40 l 14 40 z M${x + w * 0.3} ${y + h - 30} l 10 -28 l 10 28 z" fill="#5c6f9e" opacity=".55"/>
      ${flakes}
    </g>
    <rect x="${x + w / 2 - 4}" y="${y + 10}" width="8" height="${h - 20}" fill="${C.cream}"/>
    <rect x="${x + 10}" y="${y + h / 2 - 4}" width="${w - 20}" height="8" fill="${C.cream}"/>
    <rect x="${x - 14}" y="${y + h - 6}" width="${w + 28}" height="16" rx="8" fill="${C.cream}"/>
    <path d="M${x - 6} ${y + h - 6} q ${w * 0.3} -10 ${w * 0.6} -2 t ${w * 0.4 + 12} 0" fill="#fff" />`
  );
}

/** Floor lamp with a warm pool of light. (x, y) = floor point. */
export function lamp(p, x, y, hgt = 330) {
  return g(
    'lamp',
    `<circle class="glow flicker" cx="${x}" cy="${y - hgt + 50}" r="170" fill="url(#${p}-lamp)"/>
    <rect x="${x - 3}" y="${y - hgt + 50}" width="6" height="${hgt - 50}" rx="3" fill="${C.cocoa2}"/>
    <ellipse cx="${x}" cy="${y}" rx="30" ry="7" fill="${C.cocoa2}"/>
    <path d="M${x - 38} ${y - hgt + 70} L ${x - 22} ${y - hgt} L ${x + 22} ${y - hgt} L ${x + 38} ${y - hgt + 70} Z" fill="${C.honey}"/>
    <path d="M${x - 38} ${y - hgt + 70} L ${x + 38} ${y - hgt + 70}" stroke="#ffd88a" stroke-width="5" stroke-linecap="round"/>`
  );
}

/** Potted plant. (x, y) = floor point. */
export function plant(x, y, s = 1) {
  return g(
    'plant',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <g class="sway">
        <ellipse cx="-18" cy="-78" rx="12" ry="30" fill="${C.sage}" transform="rotate(-28 -18 -78)"/>
        <ellipse cx="16" cy="-84" rx="12" ry="32" fill="${C.sageShade}" transform="rotate(24 16 -84)"/>
        <ellipse cx="0" cy="-96" rx="11" ry="34" fill="${C.sage}"/>
        <ellipse cx="-28" cy="-52" rx="10" ry="22" fill="${C.sageShade}" transform="rotate(-52 -28 -52)"/>
        <ellipse cx="28" cy="-52" rx="10" ry="22" fill="${C.sage}" transform="rotate(50 28 -52)"/>
      </g>
      <path d="M-26 -44 h 52 l -6 44 h -40 z" fill="${C.amber}"/>
      <rect x="-30" y="-50" width="60" height="10" rx="5" fill="${C.honey}"/>
    </g>`
  );
}

/** Knitted blanket drape: a soft shape filled with the knit pattern, with a fringe. */
export function blanket(p, d, fringe = [], cream = false) {
  const tassels = fringe.map(([x, y]) => `<path d="M${x} ${y} v 12" stroke="${cream ? '#e5c29c' : C.redShade}" stroke-width="4" stroke-linecap="round"/>`).join('');
  return g('blanket', `<path d="${d}" fill="url(#${p}-${cream ? 'knitCream' : 'knit'})"/>${tassels}`);
}

/** Armchair. (x, y) = floor centre, width w. */
export function armchair(x, y, w = 260, { body = C.mustard, shade = C.mustardShade } = {}) {
  const h = 230;
  return g(
    'armchair',
    `<ellipse cx="${x}" cy="${y + 4}" rx="${w * 0.56}" ry="12" fill="${C.cocoa}" opacity=".14"/>
    <rect x="${x - w * 0.38}" y="${y - h}" width="${w * 0.76}" height="${h * 0.78}" rx="44" fill="${body}"/>
    <rect x="${x - w * 0.38}" y="${y - h + 40}" width="${w * 0.76}" height="10" rx="5" fill="${shade}" opacity=".35"/>
    <rect x="${x - w * 0.5}" y="${y - h * 0.5}" width="${w * 0.22}" height="${h * 0.42}" rx="26" fill="${shade}"/>
    <rect x="${x + w * 0.28}" y="${y - h * 0.5}" width="${w * 0.22}" height="${h * 0.42}" rx="26" fill="${shade}"/>
    <rect x="${x - w * 0.34}" y="${y - h * 0.34}" width="${w * 0.68}" height="${h * 0.22}" rx="18" fill="${body}"/>
    <rect x="${x - w * 0.44}" y="${y - 14}" width="12" height="18" rx="4" fill="${C.cocoa2}"/>
    <rect x="${x + w * 0.44 - 12}" y="${y - 14}" width="12" height="18" rx="4" fill="${C.cocoa2}"/>`
  );
}

/** Small round side table. (x, y) = floor point. */
export function sideTable(x, y, hgt = 120) {
  return g(
    'table',
    `<rect x="${x - 5}" y="${y - hgt}" width="10" height="${hgt}" fill="${C.cocoa2}"/>
    <ellipse cx="${x}" cy="${y}" rx="26" ry="6" fill="${C.cocoa2}"/>
    <ellipse cx="${x}" cy="${y - hgt}" rx="52" ry="11" fill="${C.cocoa2}"/>
    <ellipse cx="${x}" cy="${y - hgt - 3}" rx="52" ry="10" fill="#8a6247"/>`
  );
}

/** Garland of warm fairy lights from (x1,y1) to (x2,y2), sagging. */
export function fairyLights(x1, y1, x2, y2, sag = 40, n = 9) {
  const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + sag;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    const col = ['#ffd36b', '#ffb36b', '#ffe7a3'][i % 3];
    return `<circle class="twinkle" style="animation-delay:${-(i * 0.37).toFixed(2)}s" cx="${bx.toFixed(1)}" cy="${(by + 7).toFixed(1)}" r="5.5" fill="${col}"/><circle cx="${bx.toFixed(1)}" cy="${(by + 7).toFixed(1)}" r="14" fill="${col}" opacity=".18"/>`;
  }).join('');
  return g('lights', `<path d="M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" fill="none" stroke="${C.cocoa2}" stroke-width="2" opacity=".6"/>${pts}`);
}

/** A cosy human: head, hair, closed happy eyes, cheeks; body hidden under blanket. */
export function person(x, y, s = 1, { skin = '#f1c9a5', hair = C.cocoa, hairStyle = 'bun', tilt = 0 } = {}) {
  const hairShapes = {
    bun: `<circle cx="0" cy="-44" r="16" fill="${hair}"/><path d="M-30 -8 q -2 -34 30 -36 q 32 2 30 36 q -8 -18 -30 -20 q -22 2 -30 20 z" fill="${hair}"/>`,
    short: `<path d="M-31 -2 q -4 -40 31 -40 q 36 0 31 40 q -4 -22 -18 -26 q -14 8 -40 4 q -4 10 -4 22 z" fill="${hair}"/>`,
    curls: `${[-26, -14, 0, 14, 26, -20, 20].map((cx, i) => `<circle cx="${cx}" cy="${i > 4 ? -18 : -30 + Math.abs(cx) * 0.25}" r="${i > 4 ? 11 : 13}" fill="${hair}"/>`).join('')}`,
    beanie: `<path d="M-31 -8 q 0 -40 31 -40 q 31 0 31 40 z" fill="${C.sage}"/><rect x="-33" y="-14" width="66" height="12" rx="6" fill="${C.sageShade}"/><circle cx="0" cy="-50" r="9" fill="#f6dcc3"/>`,
  };
  return g(
    'person',
    `<g transform="translate(${x} ${y}) rotate(${tilt}) scale(${s})">
      ${hairStyle === 'bun' || hairStyle === 'curls' ? hairShapes[hairStyle] : ''}
      <ellipse cx="0" cy="0" rx="30" ry="32" fill="${skin}"/>
      ${hairStyle === 'short' || hairStyle === 'beanie' ? hairShapes[hairStyle] : ''}
      <path class="blink-lid" d="M-15 2 q 6 6 12 0 M4 2 q 6 6 12 0" fill="none" stroke="${C.cocoa}" stroke-width="3" stroke-linecap="round"/>
      <path d="M-5 16 q 5 4 10 0" fill="none" stroke="${C.cocoa}" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="-19" cy="12" rx="6" ry="4" fill="${C.blush}" opacity=".6"/>
      <ellipse cx="19" cy="12" rx="6" ry="4" fill="${C.blush}" opacity=".6"/>
    </g>`
  );
}

/** Couch. (x, y) floor centre. */
export function couch(x, y, w = 420) {
  const h = 170;
  return g(
    'couch',
    `<ellipse cx="${x}" cy="${y + 4}" rx="${w * 0.54}" ry="12" fill="${C.cocoa}" opacity=".14"/>
    <rect x="${x - w * 0.44}" y="${y - h}" width="${w * 0.88}" height="${h * 0.7}" rx="36" fill="${C.sage}"/>
    <rect x="${x - w * 0.5}" y="${y - h * 0.58}" width="${w * 0.14}" height="${h * 0.52}" rx="24" fill="${C.sageShade}"/>
    <rect x="${x + w * 0.36}" y="${y - h * 0.58}" width="${w * 0.14}" height="${h * 0.52}" rx="24" fill="${C.sageShade}"/>
    <rect x="${x - w * 0.38}" y="${y - h * 0.4}" width="${w * 0.76}" height="${h * 0.3}" rx="18" fill="${C.sage}"/>
    <rect x="${x - w * 0.46}" y="${y - 14}" width="12" height="18" rx="4" fill="${C.cocoa2}"/>
    <rect x="${x + w * 0.46 - 12}" y="${y - 14}" width="12" height="18" rx="4" fill="${C.cocoa2}"/>`
  );
}

/** Embroidery hoop with a stitched heart, hung on the wall. (x, y) = centre. */
export function hoop(x, y, r = 38) {
  return g(
    'hoop',
    `<path d="M${x} ${y - r - 18} l -10 14 M${x} ${y - r - 18} l 10 14" stroke="${C.cocoa2}" stroke-width="2" opacity=".5"/>
    <circle cx="${x}" cy="${y}" r="${r + 5}" fill="#b98457"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${C.cream}"/>
    <rect x="${x - 6}" y="${y - r - 10}" width="12" height="9" rx="3" fill="#a06f47"/>
    <path d="M${x} ${y + r * 0.42} C ${x - r * 0.9} ${y - r * 0.1}, ${x - r * 0.4} ${y - r * 0.75}, ${x} ${y - r * 0.28} C ${x + r * 0.4} ${y - r * 0.75}, ${x + r * 0.9} ${y - r * 0.1}, ${x} ${y + r * 0.42} Z" fill="${C.red}"/>
    <path d="M${x} ${y + r * 0.42} C ${x - r * 0.9} ${y - r * 0.1}, ${x - r * 0.4} ${y - r * 0.75}, ${x} ${y - r * 0.28} C ${x + r * 0.4} ${y - r * 0.75}, ${x + r * 0.9} ${y - r * 0.1}, ${x} ${y + r * 0.42} Z" fill="none" stroke="${C.cream}" stroke-width="1.6" stroke-dasharray="3 4" transform="translate(${x} ${y}) scale(.78) translate(${-x} ${-y})"/>`
  );
}

/** Wicker basket of yarn with knitting needles. (x, y) = floor centre. */
export function yarnBasket(x, y, s = 1) {
  return g(
    'yarn',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="62" ry="9" fill="${C.cocoa}" opacity=".14"/>
      <circle cx="-22" cy="-62" r="24" fill="${C.sage}"/>
      <path d="M-40 -70 q 18 -10 36 4 M-42 -58 q 20 -8 40 6 M-34 -78 q 12 -6 26 2" fill="none" stroke="${C.sageShade}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="18" cy="-58" r="22" fill="${C.honey}"/>
      <path d="M2 -66 q 16 -8 32 6 M2 -52 q 16 -8 32 4" fill="none" stroke="${C.mustardShade}" stroke-width="3" stroke-linecap="round"/>
      <path d="M-6 -70 L -40 -122 M4 -72 L 0 -128" stroke="${C.cocoa2}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="-40" cy="-122" r="5" fill="${C.red}"/><circle cx="0" cy="-128" r="5" fill="${C.red}"/>
      <path d="M-54 -48 h 108 l -10 48 h -88 z" fill="#c98f5a"/>
      <path d="M-50 -34 h 100 M-47 -20 h 94 M-44 -6 h 88" stroke="#a8743f" stroke-width="3" opacity=".7"/>
      <rect x="-58" y="-54" width="116" height="12" rx="6" fill="#b47c48"/>
      <path d="M40 -56 C 70 -40, 64 -6, 92 0" fill="none" stroke="${C.honey}" stroke-width="3" stroke-linecap="round"/>
    </g>`
  );
}

// ---------------------------------------------------------------- scenes

/** Hero: a reading nook inside a round vignette. viewBox 600x600. */
export function heroScene() {
  const p = 'hero';
  const fringe = Array.from({ length: 11 }, (_, i) => [168 + i * 15, 446 - i * 1.2]);
  return `<svg class="art art-hero" viewBox="0 0 600 600" role="img" aria-label="A ginger cat asleep on a knitted blanket in a mustard armchair, a mug of hot chocolate steaming beside it, snow falling outside the window">
    ${defs(p)}
    <clipPath id="${p}-round"><circle cx="300" cy="300" r="292"/></clipPath>
    <g clip-path="url(#${p}-round)">
      <rect width="600" height="600" fill="${C.wall}"/>
      <rect y="470" width="600" height="130" fill="${C.floor}"/>
      <rect y="470" width="600" height="8" fill="${C.floorShade}" opacity=".6"/>
      ${window(p, 330, 70, 190, 206)}
      ${hoop(232, 150, 34)}
      ${lamp(p, 92, 486, 340)}
      <ellipse cx="300" cy="548" rx="236" ry="36" fill="url(#${p}-rug)"/>
      ${armchair(270, 490, 282)}
      ${blanket(p, 'M162 268 Q 250 248 346 266 L 338 424 Q 300 444 250 448 Q 196 452 166 444 Q 152 360 162 268 Z', fringe, true)}
      ${cat(276, 404, 0.9)}
      ${sideTable(478, 490, 100)}
      ${mug(478, 384, 1.0)}
      ${yarnBasket(118, 572, 0.85)}
      <rect width="600" height="600" fill="url(#${p}-warm)" opacity=".18"/>
    </g>
    <circle cx="300" cy="300" r="292" fill="none" stroke="${C.cocoa}" stroke-opacity=".08" stroke-width="2"/>
  </svg>`;
}

/** Back view of a sitting cat, watching something. (x, y) = floor centre. */
export function catBack(x, y, s = 1, { fur = '#4b3a33', rim = '#9fc3e6' } = {}) {
  return g(
    'cat-back',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="60" ry="8" fill="#000" opacity=".25"/>
      <g class="tail"><path d="M30 -8 C 70 -6, 80 -40, 58 -62" fill="none" stroke="${fur}" stroke-width="16" stroke-linecap="round"/></g>
      <g class="breath">
        <path d="M-44 0 C -52 -40, -34 -86, 0 -88 C 34 -86, 52 -40, 44 0 Z" fill="${fur}"/>
        <path d="M-40 -30 C -42 -60, -24 -84, 0 -86" fill="none" stroke="${rim}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      </g>
      <g class="head">
        <path d="M-30 -112 L -34 -150 L -8 -128 Z M30 -112 L 34 -150 L 8 -128 Z" fill="${fur}" stroke="${fur}" stroke-width="6" stroke-linejoin="round"/>
        <ellipse cx="0" cy="-110" rx="34" ry="30" fill="${fur}"/>
        <path d="M-32 -114 L -33 -146 L -14 -128" fill="none" stroke="${rim}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" opacity=".7"/>
        <path d="M32 -114 L 33 -146 L 14 -128" fill="none" stroke="${rim}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" opacity=".7"/>
        <path d="M-30 -124 C -26 -136, -14 -140, 0 -140 C 14 -140, 26 -136, 30 -124" fill="none" stroke="${rim}" stroke-width="3.5" stroke-linecap="round" opacity=".55"/>
      </g>
    </g>`
  );
}

/** Retro TV. (x, y) = top-left of the cabinet body, w = width. Returns svg + screen rect. */
export function tv(x, y, w = 300) {
  const h = w * 0.8;
  const sw = w * 0.66, sh = sw * 0.75, sx = x + w * 0.07, sy = y + (h - sh) / 2;
  const kx = x + w * 0.82;
  return {
    screen: { x: sx, y: sy, w: sw, h: sh },
    svg: g(
      'tv',
      `<path d="M${x + w * 0.42} ${y} L ${x + w * 0.28} ${y - h * 0.42} M${x + w * 0.46} ${y} L ${x + w * 0.62} ${y - h * 0.46}" stroke="${C.cocoa2}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${x + w * 0.28}" cy="${y - h * 0.42}" r="6" fill="${C.honey}"/><circle cx="${x + w * 0.62}" cy="${y - h * 0.46}" r="6" fill="${C.honey}"/>
      <ellipse cx="${x + w * 0.44}" cy="${y + 2}" rx="${w * 0.08}" ry="10" fill="${C.cocoa2}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.09}" fill="${C.amber}"/>
      <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h * 0.16}" rx="${w * 0.07}" fill="#fff" opacity=".1"/>
      <rect x="${sx - 10}" y="${sy - 10}" width="${sw + 20}" height="${sh + 20}" rx="${w * 0.07}" fill="${C.cocoa}"/>
      <rect class="tv-screen" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${w * 0.055}" fill="#1b2140"/>
      <circle cx="${kx}" cy="${y + h * 0.22}" r="${w * 0.055}" fill="${C.cream}"/><path d="M${kx} ${y + h * 0.22} l ${w * 0.03} ${-w * 0.03}" stroke="${C.cocoa}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${kx}" cy="${y + h * 0.42}" r="${w * 0.04}" fill="${C.cream}"/>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="${kx - w * 0.055}" y="${y + h * (0.56 + i * 0.065)}" width="${w * 0.11}" height="4" rx="2" fill="${C.cocoa}" opacity=".45"/>`).join('')}
      <rect x="${x + w * 0.12}" y="${y + h}" width="10" height="16" rx="3" fill="${C.cocoa}"/>
      <rect x="${x + w * 0.88 - 10}" y="${y + h}" width="10" height="16" rx="3" fill="${C.cocoa}"/>`
    ),
  };
}

/** The TV room: a dark, cosy room lit by the TV; a cat watches from a pouf.
    The screen is left empty: the page lays the film over it (see TV_SCREEN). viewBox 900x600. */
export const TV_VIEW = { w: 900, h: 600 };
export const TV_SCREEN = tv(300, 150, 330).screen; // in TV_VIEW units
export function tvScene() {
  const p = 'tvr';
  const set = tv(300, 150, 330);
  const s = set.screen;
  return `<svg class="art art-tv" viewBox="0 0 900 600" role="img" aria-label="A retro TV on a wooden cabinet in a dark living room; a cat sits on a pouf watching it">
    ${defs(p)}
    <radialGradient id="${p}-glow" cx="${(s.x + s.w / 2) / 900}" cy="${(s.y + s.h / 2) / 600}" r=".55"><stop offset="0" stop-color="#9fc3e6" stop-opacity=".42"/><stop offset=".5" stop-color="#9fc3e6" stop-opacity=".12"/><stop offset="1" stop-color="#9fc3e6" stop-opacity="0"/></radialGradient>
    <rect width="900" height="600" fill="#3b271d"/>
    <rect y="470" width="900" height="130" fill="#2c1c14"/>
    ${fairyLights(-20, 40, 920, 50, 70, 13)}
    <rect class="tv-glow flicker" width="900" height="600" fill="url(#${p}-glow)"/>
    <rect x="232" y="${150 + 264 + 14}" width="440" height="22" rx="8" fill="#8a6247"/>
    <rect x="244" y="${150 + 264 + 34}" width="416" height="70" rx="6" fill="#6b4a36"/>
    <rect x="258" y="${150 + 264 + 46}" width="190" height="46" rx="5" fill="#5a3d2c"/><rect x="456" y="${150 + 264 + 46}" width="190" height="46" rx="5" fill="#5a3d2c"/>
    <circle cx="438" cy="${150 + 264 + 69}" r="4" fill="${C.honey}"/><circle cx="466" cy="${150 + 264 + 69}" r="4" fill="${C.honey}"/>
    <rect x="256" y="${150 + 264 + 102}" width="10" height="26" fill="#5a3d2c"/><rect x="638" y="${150 + 264 + 102}" width="10" height="26" fill="#5a3d2c"/>
    ${set.svg}
    <g transform="translate(652 336)">${plant(0, 92, 0.62)}</g>
    <rect x="238" y="416" width="56" height="12" rx="3" fill="${C.sage}"/><rect x="242" y="404" width="48" height="12" rx="3" fill="${C.honey}"/><rect x="236" y="392" width="52" height="12" rx="3" fill="${C.red}"/>
    <ellipse cx="450" cy="566" rx="330" ry="34" fill="url(#${p}-rug)" opacity=".85"/>
    <ellipse cx="640" cy="${560}" rx="70" ry="30" fill="${C.red}"/>
    <ellipse cx="640" cy="${548}" rx="66" ry="20" fill="${C.redLight}"/>
    ${catBack(640, 552, 0.82)}
  </svg>`;
}

/** The Cozy Agent: a sitting cat with a beret, a scarf and a clapperboard. viewBox 400x420. */
export function agentScene() {
  const fur = '#f2ead9', shade = '#ddcfb8';
  return `<svg class="art art-agent" viewBox="0 0 400 420" role="img" aria-label="The Cozy Agent: a cream cat in a red beret and honey scarf, holding a clapperboard">
    <ellipse cx="200" cy="404" rx="140" ry="12" fill="${C.cocoa}" opacity=".14"/>
    <g class="tail"><path d="M262 380 C 330 384, 352 330, 318 290" fill="none" stroke="${shade}" stroke-width="24" stroke-linecap="round"/></g>
    <g class="breath">
      <path d="M118 400 C 100 330, 130 230, 200 226 C 270 230, 300 330, 282 400 Z" fill="${fur}"/>
      <ellipse cx="200" cy="330" rx="48" ry="62" fill="#fffaf0"/>
      <ellipse cx="162" cy="398" rx="26" ry="14" fill="${fur}"/><ellipse cx="238" cy="398" rx="26" ry="14" fill="${fur}"/>
      <path d="M152 398 v -8 M162 399 v -9 M172 398 v -8 M228 398 v -8 M238 399 v -9 M248 398 v -8" stroke="${shade}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M134 236 Q 200 270 266 236 L 270 258 Q 200 292 130 258 Z" fill="${C.honey}"/>
      <path d="M228 262 l 14 58 l 22 -6 l -16 -60 z" fill="${C.mustardShade}"/>
      <path d="M230 262 l 14 58" stroke="${C.honey}" stroke-width="5" stroke-dasharray="4 6" opacity=".6"/>
    </g>
    <g class="head bob">
      <path d="M118 150 L 112 74 L 170 112 Z M282 150 L 288 74 L 230 112 Z" fill="${fur}" stroke="${fur}" stroke-width="10" stroke-linejoin="round"/>
      <path d="M124 130 L 122 92 L 152 112 Z M276 130 L 278 92 L 248 112 Z" fill="${C.blush}" opacity=".7"/>
      <ellipse cx="200" cy="168" rx="94" ry="80" fill="${fur}"/>
      <path d="M180 92 q 6 14 0 26 M200 90 q 6 14 0 28 M220 92 q 6 14 0 26" fill="none" stroke="${C.honey}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      <g transform="rotate(-10 196 92)">
        <ellipse cx="196" cy="98" rx="74" ry="12" fill="${C.redShade}"/>
        <path d="M120 96 C 124 50, 270 44, 274 94 C 240 84, 150 84, 120 96 Z" fill="${C.red}"/>
        <path d="M196 52 q 2 -16 12 -18" fill="none" stroke="${C.red}" stroke-width="6" stroke-linecap="round"/>
      </g>
      <g class="blink"><ellipse cx="164" cy="170" rx="13" ry="16" fill="${C.cocoa}"/><ellipse cx="236" cy="170" rx="13" ry="16" fill="${C.cocoa}"/>
      <circle cx="168" cy="164" r="4.5" fill="#fff"/><circle cx="240" cy="164" r="4.5" fill="#fff"/></g>
      <path d="M194 192 h 12 l -6 7 z" fill="#d9675b" stroke="#d9675b" stroke-width="3" stroke-linejoin="round"/>
      <path d="M188 204 q 6 7 12 0 q 6 7 12 0" fill="none" stroke="${C.cocoa}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="138" cy="196" rx="13" ry="8" fill="${C.blush}" opacity=".6"/><ellipse cx="262" cy="196" rx="13" ry="8" fill="${C.blush}" opacity=".6"/>
      <path d="M110 186 l -28 -6 M110 196 l -28 4 M290 186 l 28 -6 M290 196 l 28 4" stroke="${shade}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g class="clap" transform="translate(60 268) rotate(-8)">
      <rect x="0" y="22" width="120" height="86" rx="10" fill="${C.cocoa}"/>
      <rect x="10" y="40" width="100" height="6" rx="3" fill="${C.cream}" opacity=".5"/>
      <text x="12" y="74" font-family="Quicksand, sans-serif" font-weight="700" font-size="17" fill="${C.cream}">COZY</text>
      <text x="12" y="96" font-family="Quicksand, sans-serif" font-weight="700" font-size="12" fill="${C.honey}">TAKE 01</text>
      <g class="clap-top"><path d="M0 18 L 116 0 L 120 18 L 2 34 Z" fill="${C.cocoa}"/>
      <path d="M14 16 L 30 30 M40 12 L 56 26 M66 8 L 82 22 M92 4 L 108 18" stroke="${C.cream}" stroke-width="9"/></g>
      <ellipse cx="116" cy="70" rx="20" ry="16" fill="${fur}"/>
      <path d="M106 62 v 10 M116 60 v 12" stroke="${shade}" stroke-width="2.4" stroke-linecap="round"/>
    </g>
  </svg>`;
}

/** Pricing art: 'cup' (small), 'mug' (big), 'pot' (teapot in a knitted cosy). viewBox 240x200. */
export function pricingArt(kind) {
  const p = `pr-${kind}`;
  const body = {
    cup: `<ellipse cx="120" cy="182" rx="74" ry="12" fill="${C.cream}"/><ellipse cx="120" cy="180" rx="74" ry="10" fill="#fff"/>
      <path d="M152 134 c 22 0 22 26 0 26" fill="none" stroke="${C.sage}" stroke-width="8" stroke-linecap="round"/>
      <path d="M78 120 h 84 q 0 52 -42 56 q -42 -4 -42 -56 z" fill="${C.sage}"/>
      <ellipse cx="120" cy="120" rx="42" ry="7" fill="${C.choc}"/><ellipse cx="120" cy="121" rx="37" ry="5" fill="${C.chocTop}"/>
      ${steam(120, 106, 0.55)}`,
    mug: `${mug(120, 186, 1.25, { color: C.amber })}`,
    pot: `<ellipse cx="120" cy="186" rx="86" ry="10" fill="${C.cocoa}" opacity=".12"/>
      <path d="M60 150 C 40 146, 26 120, 16 96 L 30 90 C 40 110, 50 124, 64 126 Z" fill="${C.cream}"/>
      <path d="M182 112 c 38 0 38 56 0 56" fill="none" stroke="${C.cream}" stroke-width="11" stroke-linecap="round"/>
      <path d="M50 184 C 40 120, 70 64, 120 62 C 170 64, 200 120, 190 184 Z" fill="url(#${p}-knit)"/>
      <path d="M48 150 C 90 160, 150 160, 192 150 L 191 166 C 150 176, 90 176, 49 166 Z" fill="${C.honey}"/>
      <path d="M52 176 C 90 186, 150 186, 188 176 L 190 186 L 50 186 Z" fill="${C.redShade}"/>
      <circle cx="120" cy="54" r="16" fill="${C.cream}"/>
      <path d="M108 44 q 12 -8 24 0 M106 56 q 14 6 28 0" fill="none" stroke="#e5c29c" stroke-width="3" stroke-linecap="round"/>
      ${steam(22, 84, 0.5)}`,
  }[kind];
  return `<svg class="art art-price art-price-${kind}" viewBox="0 0 240 200" aria-hidden="true">${defs(p)}${body}</svg>`;
}

/** Kitten batting at something above it. (x, y) = floor centre. */
export function kitten(x, y, s = 1, { fur = '#c8b8aa', shade = '#a8988b' } = {}) {
  return g(
    'kitten',
    `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="50" ry="7" fill="#000" opacity=".2"/>
      <g class="tail"><path d="M26 -10 C 64 -10, 64 -50, 44 -60" fill="none" stroke="${fur}" stroke-width="12" stroke-linecap="round"/></g>
      <path d="M-34 0 C -40 -40, -22 -66, 0 -66 C 22 -66, 40 -40, 34 0 Z" fill="${fur}"/>
      <ellipse cx="0" cy="-30" rx="18" ry="26" fill="#efe6dc"/>
      <g class="bat"><path d="M18 -50 C 30 -80, 36 -104, 38 -122" fill="none" stroke="${fur}" stroke-width="13" stroke-linecap="round"/><circle cx="38" cy="-124" r="8" fill="#efe6dc"/></g>
      <ellipse cx="-14" cy="-2" rx="11" ry="6" fill="#efe6dc"/>
      <g class="head">
        <path d="M-30 -86 L -36 -118 L -10 -100 Z M30 -86 L 36 -118 L 10 -100 Z" fill="${fur}" stroke="${fur}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-30 -92 L -32 -110 L -18 -100 Z M30 -92 L 32 -110 L 18 -100 Z" fill="${C.blush}" opacity=".7"/>
        <ellipse cx="0" cy="-80" rx="34" ry="28" fill="${fur}"/>
        <path d="M-8 -106 q 3 8 0 14 M8 -106 q -3 8 0 14" fill="none" stroke="${shade}" stroke-width="3.5" stroke-linecap="round"/>
        <g class="blink"><ellipse cx="-13" cy="-82" rx="6" ry="8" fill="${C.cocoa}"/><ellipse cx="13" cy="-82" rx="6" ry="8" fill="${C.cocoa}"/>
        <circle cx="-11" cy="-85" r="2.2" fill="#fff"/><circle cx="15" cy="-85" r="2.2" fill="#fff"/></g>
        <path d="M-3 -70 h 6 l -3 4 z" fill="#d9675b"/>
        <ellipse cx="-22" cy="-70" rx="6" ry="4" fill="${C.blush}" opacity=".6"/><ellipse cx="22" cy="-70" rx="6" ry="4" fill="${C.blush}" opacity=".6"/>
      </g>
    </g>`
  );
}

/** Closing scene: two people and a dog under one blanket on the couch, fairy lights, snow. viewBox 900x560. */
export function couchScene() {
  const p = 'home';
  return `<svg class="art art-home" viewBox="0 0 900 560" role="img" aria-label="Two people asleep on a sage couch under a red knitted blanket, a puppy curled on their laps, a cat on the backrest, fairy lights and snow at the window">
    ${defs(p)}
    <rect width="900" height="560" fill="#4a3226"/>
    <rect y="470" width="900" height="90" fill="#36231a"/>
    <circle class="glow flicker" cx="110" cy="210" r="260" fill="url(#${p}-lamp)" opacity=".75"/>
    ${window(p, 300, 64, 300, 210)}
    ${fairyLights(-20, 30, 920, 36, 64, 14)}
    ${lamp(p, 104, 486, 330)}
    <ellipse cx="460" cy="520" rx="380" ry="36" fill="url(#${p}-rug)" opacity=".9"/>
    ${couch(460, 494, 520)}
    <path d="M330 380 C 330 330, 376 318, 400 318 C 424 318, 452 330, 452 380 Z" fill="${C.honey}"/>
    <path d="M444 380 C 444 330, 480 316, 504 316 C 528 316, 566 330, 566 380 Z" fill="${C.sky2}"/>
    ${person(394, 282, 1.22, { hairStyle: 'curls', hair: '#2f1d14', skin: '#c68a63', tilt: 12 })}
    ${person(500, 280, 1.22, { hairStyle: 'beanie', skin: '#f1c9a5', tilt: -14 })}
    ${blanket(p, 'M286 352 C 320 336, 360 344, 400 350 C 440 356, 470 340, 506 344 C 548 348, 590 338, 614 352 Q 640 400 628 462 Q 450 490 280 464 Q 266 400 286 352 Z', Array.from({ length: 14 }, (_, i) => [292 + i * 25, 466 + Math.sin(i / 13 * Math.PI) * 10]))}
    ${pup(462, 402, 0.74)}
    ${cat(650, 330, 0.5, { fur: '#5b4a42', shade: '#463830', belly: '#cbbdb0' })}
    ${sideTable(790, 494, 96)}
    ${mug(772, 392, 0.62, { color: C.honey })}
    ${mug(810, 392, 0.62, { color: C.red, steamOn: false })}
  </svg>`;
}

/** Kitten on its own, for the garland. viewBox 220x240. */
export function kittenArt() {
  return `<svg class="art art-kitten" viewBox="0 0 220 240" aria-hidden="true">${kitten(100, 232, 1)}</svg>`;
}

/** Fairy-light wire through the given peg points (viewBox units), with bulbs
    spaced evenly along it. Returns inner SVG for a 1200x420 garland. */
export function garlandWire(pegs, n = 22) {
  const pts = [[-30, 40], ...pegs, [1230, 52]];
  // centripetal-ish Catmull-Rom sampled densely
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  const d = 'M' + dense.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[len.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < len.length - 1 && len[i] < s) i++;
    const t = (s - len[i - 1]) / (len[i] - len[i - 1] || 1);
    return [dense[i - 1][0] + (dense[i][0] - dense[i - 1][0]) * t, dense[i - 1][1] + (dense[i][1] - dense[i - 1][1]) * t];
  };
  const cols = ['#ffd36b', '#ffb36b', '#ffe7a3', '#ff9f7a'];
  const bulbs = Array.from({ length: n }, (_, i) => {
    const [x, y] = at(((i + 0.5) / n) * total);
    const c = cols[i % cols.length];
    return `<g class="bulb" style="--i:${i}"><circle class="halo twinkle" style="animation-delay:${-(i * 0.43).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${(y + 9).toFixed(1)}" r="20" fill="${c}" opacity=".22"/><rect x="${(x - 3).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="6" height="6" rx="1.5" fill="#5a4031"/><ellipse class="twinkle" style="animation-delay:${-(i * 0.43).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${(y + 10).toFixed(1)}" rx="5.5" ry="7.5" fill="${c}"/></g>`;
  }).join('');
  return `<path d="${d}" fill="none" stroke="#7a5a45" stroke-width="2.4" stroke-linecap="round"/>${bulbs}`;
}
