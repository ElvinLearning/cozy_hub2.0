// Builds the Cozy Digital marks as pure-path SVGs (no font dependency).
// The wordmark is Quicksand Bold, the face the original logo was set in,
// converted to outlines. The mark is the original glowing ring, redrawn
// flat: the ring opens at the upper right and breaks into the logo's
// pixel scatter, so the loop literally turns into digital.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';

const OUT = 'public/brand';
mkdirSync(OUT, { recursive: true });

const buf = readFileSync('node_modules/@fontsource/quicksand/files/quicksand-latin-700-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

export const BRAND = { violet: '#c084fc', indigo: '#818cf8', cyan: '#67e8f9', ink: '#08090b' };

const deg = (d) => (d * Math.PI) / 180;
const f = (n) => +n.toFixed(2);

// ---------- the mark (128 x 128 box) ----------
// Drawn once in a 128 box; bigger lockups scale the group instead of
// redrawing, so every size carries the same pixel pattern.
function mark({ id = 'm', w = 7.5, small = false } = {}) {
  const cx = 64, cy = 64, r = 44;
  const gapFrom = 18, gapTo = 64; // degrees, math orientation (0 = right, 90 = up)
  const P = (a) => [f(cx + r * Math.cos(deg(a))), f(cy - r * Math.sin(deg(a)))];
  const [sx, sy] = P(gapTo);
  const [ex, ey] = P(gapFrom);
  const ring = `<path d="M${sx} ${sy}A${r} ${r} 0 1 0 ${ex} ${ey}" fill="none" stroke="url(#${id}-ring)" stroke-width="${w}" stroke-linecap="round"/>`;
  // axis-aligned pixel scatter filling the gap and drifting up and out:
  // [centre x, centre y, size, colour]
  const px = [
    [96.5, 36, 9, BRAND.indigo],
    [107, 27, 7, BRAND.cyan],
    [89, 24.5, 5.5, BRAND.violet],
    [108.5, 40.5, 5, BRAND.cyan],
    [100, 17, 5, BRAND.cyan],
    [115, 19, 4, BRAND.indigo],
    [117.5, 31, 3.4, BRAND.violet],
    [110, 10.5, 3.2, BRAND.cyan],
    [122, 12, 2.4, BRAND.cyan],
    [102, 6.5, 2.2, BRAND.indigo],
  ];
  const pts = small
    ? [[96, 35, 14, BRAND.indigo], [111, 22, 10, BRAND.cyan], [112, 40, 7, BRAND.violet], [99, 14, 7, BRAND.cyan]]
    : px;
  const squares = pts
    .map(([x, y, s, c]) => `<rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${s}" height="${s}" rx="${f(s * 0.2)}" fill="${c}"/>`)
    .join('');
  const [kx, ky, k, t] = [81, 9, 6, 1.2];
  const spark = `<path d="M${kx} ${ky - k}Q${kx + t} ${ky - t} ${kx + k} ${ky}Q${kx + t} ${ky + t} ${kx} ${ky + k}Q${kx - t} ${ky + t} ${kx - k} ${ky}Q${kx - t} ${ky - t} ${kx} ${ky - k}Z" fill="#fff"/>`;
  const defs = `<linearGradient id="${id}-ring" x1="${cx - r}" y1="${cy - r}" x2="${cx + r}" y2="${cy + r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND.violet}"/><stop offset=".5" stop-color="${BRAND.indigo}"/><stop offset="1" stop-color="${BRAND.cyan}"/></linearGradient>`;
  return { defs, body: ring + squares + (small ? '' : spark) };
}

function word(text, x, y, size) {
  const p = font.getPath(text, x, y, size);
  return { d: p.toPathData(2), box: p.getBoundingBox() };
}

function svg(w, h, defs, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" role="img" aria-label="${title}"><title>${title}</title><defs>${defs}</defs>${body}</svg>\n`;
}

// 1. mark alone (favicon / app icon)
{
  const m = mark({ id: 'mk' });
  writeFileSync(`${OUT}/cozy-mark.svg`, svg(128, 128, m.defs, m.body, 'Cozy Digital'));
  // dark tile for app icons
  writeFileSync(
    `${OUT}/cozy-icon.svg`,
    svg(128, 128, m.defs, `<rect width="128" height="128" rx="28" fill="${BRAND.ink}"/>` + m.body, 'Cozy Digital')
  );
}

// 1b. favicon: heavier ring, four big pixels, no sparkle
{
  const m = mark({ id: 'fv', w: 12, small: true });
  writeFileSync(`${OUT}/cozy-favicon.svg`, svg(128, 128, m.defs, `<rect width="128" height="128" rx="28" fill="${BRAND.ink}"/>` + m.body, 'Cozy Digital'));
}

// 2. horizontal lockup: mark + "cozy digital"
{
  const size = 64;
  const m = mark({ id: 'hz' });
  const wd = word('cozy digital', 0, 0, size);
  const tw = wd.box.x2 - wd.box.x1;
  const th = wd.box.y2 - wd.box.y1;
  const gap = 18;
  const tx = 128 + gap - wd.box.x1;
  // optical centre: x-height centre on ring centre
  const xh = font.tables.os2.sxHeight / font.unitsPerEm * size;
  const ty = 64 + xh / 2;
  const w2 = word('cozy digital', tx, ty, size);
  const W = 128 + gap + tw + 4;
  const defs = m.defs + `<linearGradient id="hz-word" x1="${f(tx)}" y1="0" x2="${f(tx + tw)}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND.violet}"/><stop offset=".45" stop-color="${BRAND.indigo}"/><stop offset="1" stop-color="${BRAND.cyan}"/></linearGradient>`;
  writeFileSync(`${OUT}/cozy-logo-horizontal.svg`, svg(W, 128, defs, m.body + `<path d="${w2.d}" fill="url(#hz-word)"/>`, 'Cozy Digital'));
  // single-colour version for dark UI chrome where the gradient would be noise
  writeFileSync(`${OUT}/cozy-logo-horizontal-mono.svg`, svg(W, 128, m.defs, m.body + `<path d="${w2.d}" fill="#edf0ed"/>`, 'Cozy Digital'));
  void th;
}

// 3. badge: the original composition (stacked wordmark inside the ring), modernised
{
  const m = mark({ id: 'bd', w: 3.4 });
  const size = 92;
  const a = word('cozy', 0, 0, size);
  const b = word('digital', 0, 0, size);
  const aw = a.box.x2 - a.box.x1, bw = b.box.x2 - b.box.x1;
  // same stagger as the original: "cozy" sits left, "digital" steps right
  const blockW = Math.max(aw, bw) + 26;
  const left = 256 - blockW / 2 - 10;
  const base1 = 256 - 4, base2 = base1 + size * 0.86;
  const w1 = word('cozy', left - a.box.x1, base1, size);
  const w2 = word('digital', left + 26 - b.box.x1, base2, size);
  const defs = m.defs +
    `<linearGradient id="bd-word" x1="${f(left)}" y1="180" x2="${f(left + blockW)}" y2="330" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND.violet}"/><stop offset=".5" stop-color="${BRAND.indigo}"/><stop offset="1" stop-color="${BRAND.cyan}"/></linearGradient>`;
  const body = `<g transform="scale(4)">${m.body}</g><path d="${w1.d} ${w2.d}" fill="url(#bd-word)"/>`;
  // the ring gradient is userSpaceOnUse, so it scales with the group
  writeFileSync(`${OUT}/cozy-logo-badge.svg`, svg(512, 512, defs, body, 'Cozy Digital'));
}

console.log('logos written to', OUT);
