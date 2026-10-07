// One command: `npm start`. Serves the landing page, the admin panel and the API.
//
// Environment (never committed; see .env.example):
//   PORT              default 8080
//   ADMIN_PASSWORD    admin sign-in; if unset a one-time password is printed at boot
//   SESSION_SECRET    signs admin cookies; random per boot if unset (sessions reset on restart)
//   HF_KEY            "key_id:key_secret" from cloud.higgsfield.ai (or HF_API_KEY + HF_API_SECRET)
//   HF_BASE_URL       default https://api.higgsfield.ai
//   PUBLIC_URL        https://your-domain, enables Higgsfield completion webhooks
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApp } from './app.mjs';
import { credentialFromEnv } from './higgsfield.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// minimal .env loader so local runs need no extra tooling; real env wins
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

let adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  adminPassword = randomBytes(9).toString('base64url');
  console.log(`\n  ADMIN_PASSWORD not set. One-time admin password for this run: ${adminPassword}\n`);
}

const app = createApp({ root, adminPassword, hfKey: credentialFromEnv() });
const port = Number(process.env.PORT) || 8080;
const server = createServer(app);
server.keepAliveTimeout = 65_000;
server.listen(port, () => {
  console.log(`  Cozy Hub on http://localhost:${port}   admin: http://localhost:${port}/admin/`);
  console.log(`  Higgsfield: ${credentialFromEnv() ? 'credentials loaded' : 'NOT configured (set HF_KEY)'}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (app.close(), server.close(() => process.exit(0))));
