// Copies the pinned three.js build and the self-hosted fonts into public/.
// The site itself has no build step; run this only when bumping a version.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const nm = 'node_modules';
const out = 'public/vendor/three';
mkdirSync(join(out, 'addons/utils'), { recursive: true });
mkdirSync(join(out, 'addons/geometries'), { recursive: true });
for (const f of ['three.module.min.js', 'three.core.min.js']) {
  cpSync(join(nm, 'three/build', f), join(out, f));
}
cpSync(join(nm, 'three/examples/jsm/utils/BufferGeometryUtils.js'), join(out, 'addons/utils/BufferGeometryUtils.js'));
cpSync(join(nm, 'three/examples/jsm/geometries/RoundedBoxGeometry.js'), join(out, 'addons/geometries/RoundedBoxGeometry.js'));
cpSync(join(nm, 'three/LICENSE'), join(out, 'LICENSE'));

const fonts = 'public/fonts';
mkdirSync(fonts, { recursive: true });
const pick = [
  ['@fontsource-variable/inter-tight/files', /^inter-tight-latin-wght-(normal|italic)\.woff2$/],
  ['@fontsource/inter/files', /^inter-latin-(400|500|600)-normal\.woff2$/],
  ['@fontsource/instrument-serif/files', /^instrument-serif-latin-400-(normal|italic)\.woff2$/],
  ['@fontsource/quicksand/files', /^quicksand-latin-700-normal\.woff2?$/],
];
for (const [dir, re] of pick) {
  for (const f of readdirSync(join(nm, dir))) if (re.test(f)) cpSync(join(nm, dir, f), join(fonts, f));
}
console.log('vendored three + fonts');
