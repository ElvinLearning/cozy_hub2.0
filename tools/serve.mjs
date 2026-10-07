// Serve any snapshot (or the live tree) on a port: node tools/serve.mjs <root> <port>
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../server/app.mjs';
const [root = '.', port = '8091'] = process.argv.slice(2);
const app = createApp({ root: resolve(root), adminPassword: 'critic', dataDir: mkdtempSync(join(tmpdir(), 'cozy-snap-')), pollMs: 0, log: () => {} });
createServer(app).listen(+port, () => console.log(`serving ${resolve(root)} on http://localhost:${port}`));
