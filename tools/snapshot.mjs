// Freeze the site for a critic round: copies the code (html/css/js/config)
// and links the heavy, unchanging assets. node tools/snapshot.mjs <round>
import { cpSync, mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const round = process.argv[2];
if (!round) throw new Error('usage: snapshot.mjs <round-id>');
const out = resolve('workbench/snapshots', round);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'public'), { recursive: true });
for (const d of ['index.html', 'css', 'js', 'admin', 'brand', '404.html']) {
  if (existsSync(join('public', d))) cpSync(join('public', d), join(out, 'public', d), { recursive: true });
}
for (const d of ['media', 'vendor', 'fonts']) symlinkSync(resolve('public', d), join(out, 'public', d));
cpSync('config', join(out, 'config'), { recursive: true });
console.log('snapshot', out);
