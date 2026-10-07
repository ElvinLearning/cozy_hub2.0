// Static file serving with byte-range support. Video seeking (and the
// capture tools, which open many parallel connections) need 206 responses.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.pdf': 'application/pdf',
};

export function contentType(path) {
  return TYPES[extname(path).toLowerCase()] || 'application/octet-stream';
}

/** Resolve a URL path inside root, or null if it escapes root. */
export function safeJoin(root, urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  const full = resolve(join(root, normalize(p)));
  const base = resolve(root);
  if (full !== base && !full.startsWith(base + sep)) return null;
  return full;
}

export async function serveFile(req, res, file, { cache = 'public, max-age=300' } = {}) {
  let st;
  try {
    st = await stat(file);
    if (st.isDirectory()) {
      file = join(file, 'index.html');
      st = await stat(file);
    }
  } catch {
    return false;
  }
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': contentType(file),
    'Accept-Ranges': 'bytes',
    'Last-Modified': st.mtime.toUTCString(),
    ETag: etag,
    'Cache-Control': file.endsWith('.html') ? 'no-cache' : cache,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start, end;
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') {
        start = Math.max(0, st.size - Number(m[2]));
        end = st.size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? st.size - 1 : Math.min(Number(m[2]), st.size - 1);
      }
    }
    if (start === undefined || start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
      res.end();
      return true;
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end(), true;
    createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end(), true;
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
  return true;
}
