// A tiny JSON-file store. One file per collection under data/, written
// atomically (temp file + rename) and serialised through a per-file queue so
// concurrent requests never interleave writes. Good for one server process
// and thousands of rows; swap for Postgres when the business outgrows it.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
    this.queues = new Map();
    mkdirSync(dir, { recursive: true });
  }

  file(name) {
    return join(this.dir, `${name}.json`);
  }

  all(name) {
    if (!this.cache.has(name)) {
      let rows = [];
      try {
        rows = JSON.parse(readFileSync(this.file(name), 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      this.cache.set(name, rows);
    }
    return this.cache.get(name);
  }

  get(name, id) {
    return this.all(name).find((r) => r.id === id) || null;
  }

  /** Mutate a collection inside fn(rows); the result is persisted before resolving. */
  async tx(name, fn) {
    const prev = this.queues.get(name) || Promise.resolve();
    const run = prev.then(() => {
      const rows = this.all(name);
      const out = fn(rows);
      const tmp = `${this.file(name)}.${randomBytes(4).toString('hex')}.tmp`;
      writeFileSync(tmp, JSON.stringify(rows, null, 2));
      renameSync(tmp, this.file(name));
      return out;
    });
    this.queues.set(name, run.catch(() => {}));
    return run;
  }

  insert(name, row) {
    return this.tx(name, (rows) => (rows.push(row), row));
  }

  update(name, id, patch) {
    return this.tx(name, (rows) => {
      const r = rows.find((x) => x.id === id);
      if (!r) return null;
      Object.assign(r, typeof patch === 'function' ? patch(r) : patch, { updatedAt: new Date().toISOString() });
      return r;
    });
  }
}

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`;
}
